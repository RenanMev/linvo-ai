import { useEffect, useState } from "react";

import type {
  AuthUser,
  BulkClientIdentificationApiResponse,
  BulkClientIdentificationCandidate,
  ClientIdentificationApiResponse,
  ClientIdentificationDecisionResponse,
  CustomerSummary
} from "@linvo-ai/shared";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from "@/components/ui/card";
import {
  Field,
  FieldDescription,
  FieldLabel
} from "@/components/ui/field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { LogOutIcon } from "lucide-react";

import type {
  BulkIdentificationUpdatedMessage,
  ClientInfoOpenedMessage,
  IdentificationUpdatedMessage,
  RuntimeResponseMessage
} from "../lib/runtime-messages";
import {
  CLIENT_ANCHOR_MENU_ENABLED_STORAGE_KEY,
  CLIENT_ANCHOR_MENU_PLACEMENT_STORAGE_KEY,
  type ClientAnchorPlacementPreference,
  getClientAnchorMenuEnabled,
  getClientAnchorMenuPlacement,
  normalizeClientAnchorMenuEnabled,
  normalizeClientAnchorMenuPlacement,
  saveClientAnchorMenuEnabled,
  saveClientAnchorMenuPlacement
} from "../lib/client-anchor-preferences";
import { CLIENT_INFO_OPEN_SELECTION_STORAGE_KEY } from "../lib/runtime-messages";
import { AuthView } from "./auth-view";
import { BulkCandidatesView } from "./bulk-candidates-view";
import {
  ContactsView,
  type ContactCaseDraft,
  type ContactIdentifierDrafts
} from "./contacts-view";
import { CustomerView } from "./customer-view";

type SessionState =
  | { status: "checking" }
  | { status: "logged_out"; message?: string }
  | { status: "logged_in"; user: AuthUser };

const EMPTY_IDENTIFIER_DRAFTS: ContactIdentifierDrafts = {
  document: "",
  email: "",
  phone: "",
  protocol: ""
};

const EMPTY_CASE_DRAFT: ContactCaseDraft = {
  protocol: "",
  status: "",
  subject: ""
};
const CLIENT_INFO_OPEN_SELECTION_TTL_MS = 5 * 60 * 1_000;

interface PendingClientInfoOpenSelection {
  customerId?: unknown;
  requestedAt?: unknown;
}

function identifierDraftsFromCustomer(customer: CustomerSummary): ContactIdentifierDrafts {
  return {
    document: customer.maskedIdentifiers.document ?? "",
    email: customer.maskedIdentifiers.email ?? "",
    phone: customer.maskedIdentifiers.phone ?? "",
    protocol: customer.maskedIdentifiers.protocol ?? ""
  };
}

function caseDraftFromCustomer(customer: CustomerSummary): ContactCaseDraft {
  const firstCase = customer.cases[0];

  return {
    ...(firstCase?.id ? { caseId: firstCase.id } : {}),
    protocol: firstCase?.protocol ?? customer.maskedIdentifiers.protocol ?? "",
    status: firstCase?.status ?? "",
    subject: firstCase?.subject ?? ""
  };
}

function resultFromDecision(
  result: ClientIdentificationApiResponse,
  decision: ClientIdentificationDecisionResponse
): ClientIdentificationApiResponse {
  if (result.status === "error") {
    return result;
  }

  if (decision.decision === "accept") {
    return {
      ...result,
      activeClient: decision.activeClient,
      case: decision.activeClient?.cases[0] ?? result.case,
      pendingClient: null,
      recentCustomers: decision.recentCustomers,
      saveState: decision.saved ? "known" : "low_confidence",
      saved: decision.saved
    };
  }

  return {
    ...result,
    pendingClient: null,
    recentCustomers: decision.recentCustomers,
    saveState: "low_confidence",
    saved: false,
    warnings: [...result.warnings, "Cliente ignorado."]
  };
}

function isFreshClientInfoOpenSelection(
  value: PendingClientInfoOpenSelection
): value is { customerId: string; requestedAt: string } {
  if (
    typeof value.customerId !== "string" ||
    typeof value.requestedAt !== "string"
  ) {
    return false;
  }

  const requestedAt = Date.parse(value.requestedAt);

  return Number.isFinite(requestedAt) &&
    Date.now() - requestedAt <= CLIENT_INFO_OPEN_SELECTION_TTL_MS;
}

async function readPendingClientInfoOpenCustomerId(): Promise<string | null> {
  try {
    const stored = await chrome.storage.local?.get({
      [CLIENT_INFO_OPEN_SELECTION_STORAGE_KEY]: null
    });
    const value = stored?.[CLIENT_INFO_OPEN_SELECTION_STORAGE_KEY];

    if (
      value &&
      typeof value === "object" &&
      isFreshClientInfoOpenSelection(value as PendingClientInfoOpenSelection)
    ) {
      return (value as { customerId: string }).customerId;
    }
  } catch {
    return null;
  }

  return null;
}

export function App() {
  const [session, setSession] = useState<SessionState>({ status: "checking" });
  const [result, setResult] = useState<ClientIdentificationApiResponse | null>(null);
  const [bulkResult, setBulkResult] = useState<BulkClientIdentificationApiResponse | null>(null);
  const [contacts, setContacts] = useState<CustomerSummary[]>([]);
  const [contactsError, setContactsError] = useState("");
  const [contactsLoading, setContactsLoading] = useState(false);
  const [decisionLoading, setDecisionLoading] = useState<"accept" | "reject" | null>(null);
  const [bulkDecisionLoading, setBulkDecisionLoading] = useState(false);
  const [bulkDeleteLoadingIds, setBulkDeleteLoadingIds] = useState<Set<string>>(new Set());
  const [selectedContactId, setSelectedContactId] = useState<string | null>(null);
  const [contactCaseDraft, setContactCaseDraft] =
    useState<ContactCaseDraft>(EMPTY_CASE_DRAFT);
  const [contactIdentifierDrafts, setContactIdentifierDrafts] =
    useState<ContactIdentifierDrafts>(EMPTY_IDENTIFIER_DRAFTS);
  const [contactNameDraft, setContactNameDraft] = useState("");
  const [contactNotesDraft, setContactNotesDraft] = useState("");
  const [contactSaving, setContactSaving] = useState(false);
  const [contactDeletingId, setContactDeletingId] = useState<string | null>(null);
  const [clientAnchorEnabled, setClientAnchorEnabled] = useState(true);
  const [clientAnchorPlacement, setClientAnchorPlacement] =
    useState<ClientAnchorPlacementPreference>("smart");
  const [clientAnchorSaving, setClientAnchorSaving] = useState(false);
  const [clientAnchorNotice, setClientAnchorNotice] = useState("");

  useEffect(() => {
    void chrome.runtime.sendMessage({ type: "auth/me" }).then((response: RuntimeResponseMessage) => {
      if (response.ok && "user" in response && response.user) {
        setSession({ status: "logged_in", user: response.user });
        void loadContacts();
        return;
      }

      setSession({ status: "logged_out" });
    }).catch(() => {
      setSession({ status: "logged_out", message: "Nao foi possivel restaurar a sessao." });
    });
  }, []);

  useEffect(() => {
    const listener = (
      message:
        | IdentificationUpdatedMessage
        | BulkIdentificationUpdatedMessage
        | ClientInfoOpenedMessage
    ) => {
      if (message.type === "assist/client-identification.updated") {
        setResult(message.response);

        if (message.response.status === "ok") {
          void loadContacts();
        }
      }

      if (message.type === "assist/client-identification.bulk.updated") {
        setBulkResult(message.response);

        if (message.response.status === "ok") {
          void loadContacts();
        }
      }

      if (message.type === "assist/client-info.opened") {
        if (message.response.status === "ok") {
          setContacts(message.response.customers);
          setSelectedContactId(message.response.customer.id);
          setContactsError("");
          return;
        }

        if (message.response.status === "no_match") {
          setContacts(message.response.customers);
          setContactsError(message.response.reason);
        }
      }
    };

    chrome.runtime.onMessage.addListener(listener);
    return () => chrome.runtime.onMessage.removeListener(listener);
  }, []);

  useEffect(() => {
    void Promise.all([
      getClientAnchorMenuEnabled(),
      getClientAnchorMenuPlacement()
    ])
      .then(([enabled, placement]) => {
        setClientAnchorEnabled(enabled);
        setClientAnchorPlacement(placement);
      })
      .catch(() => {
        setClientAnchorEnabled(true);
        setClientAnchorPlacement("smart");
      });

    const listener: Parameters<
      typeof chrome.storage.onChanged.addListener
    >[0] = (changes, areaName) => {
      if (areaName !== "sync") {
        return;
      }

      if (CLIENT_ANCHOR_MENU_ENABLED_STORAGE_KEY in changes) {
        setClientAnchorEnabled(
          normalizeClientAnchorMenuEnabled(
            changes[CLIENT_ANCHOR_MENU_ENABLED_STORAGE_KEY]?.newValue
          )
        );
      }

      if (CLIENT_ANCHOR_MENU_PLACEMENT_STORAGE_KEY in changes) {
        setClientAnchorPlacement(
          normalizeClientAnchorMenuPlacement(
            changes[CLIENT_ANCHOR_MENU_PLACEMENT_STORAGE_KEY]?.newValue
          )
        );
      }
    };

    chrome.storage.onChanged.addListener(listener);
    return () => chrome.storage.onChanged.removeListener(listener);
  }, []);

  const selectedContact =
    contacts.find((customer) => customer.id === selectedContactId) ?? contacts[0] ?? null;

  useEffect(() => {
    if (!selectedContact) {
      setContactCaseDraft(EMPTY_CASE_DRAFT);
      setContactIdentifierDrafts(EMPTY_IDENTIFIER_DRAFTS);
      setContactNameDraft("");
      setContactNotesDraft("");
      return;
    }

    setSelectedContactId(selectedContact.id);
    setContactCaseDraft(caseDraftFromCustomer(selectedContact));
    setContactIdentifierDrafts(identifierDraftsFromCustomer(selectedContact));
    setContactNameDraft(selectedContact.displayName ?? "");
    setContactNotesDraft(selectedContact.notes ?? "");
  }, [selectedContact?.id]);

  async function loadContacts() {
    setContactsLoading(true);
    setContactsError("");

    try {
      const preferredCustomerId = await readPendingClientInfoOpenCustomerId();
      const response = await chrome.runtime.sendMessage({
        type: "assist/customers.list"
      }) as RuntimeResponseMessage;

      if (!response.ok) {
        setContactsError(response.error.message);
        return;
      }

      if ("response" in response && response.response.status === "ok" && "customers" in response.response) {
        const loadedCustomers = response.response.customers;
        setContacts(loadedCustomers);
        setSelectedContactId((current) =>
          preferredCustomerId && loadedCustomers.some((customer) => customer.id === preferredCustomerId)
            ? preferredCustomerId
            : current && loadedCustomers.some((customer) => customer.id === current)
            ? current
            : loadedCustomers[0]?.id ?? null
        );
      }
    } catch {
      setContactsError("Nao foi possivel carregar seus contatos agora.");
    } finally {
      setContactsLoading(false);
    }
  }

  async function handleDecision(decision: "accept" | "reject") {
    if (!result || result.status !== "ok") {
      return;
    }

    setDecisionLoading(decision);

    try {
      const response = await chrome.runtime.sendMessage({
        request: {
          decision,
          requestId: result.requestId
        },
        type: "assist/client-identification.decision"
      }) as RuntimeResponseMessage;

      if (!response.ok) {
        setResult({
          errorCode: response.error.errorCode as never,
          message: response.error.message,
          status: "error"
        });
        return;
      }

      if ("response" in response && response.response.status === "ok" && "decision" in response.response) {
        void loadContacts();
        setResult(resultFromDecision(result, response.response));
        return;
      }

      if ("response" in response && response.response.status === "error") {
        setResult(response.response);
      }
    } catch {
      setResult({
        errorCode: "INTERNAL_ERROR",
        message: "Nao foi possivel atualizar o cliente agora.",
        status: "error"
      });
    } finally {
      setDecisionLoading(null);
    }
  }

  async function handleBulkDecision(acceptRequestIds: string[], rejectRequestIds: string[]) {
    if (!bulkResult || bulkResult.status !== "ok") {
      return;
    }

    setBulkDecisionLoading(true);

    try {
      const response = await chrome.runtime.sendMessage({
        request: {
          acceptRequestIds,
          batchId: bulkResult.batchId,
          rejectRequestIds
        },
        type: "assist/client-identification.bulk.decision"
      }) as RuntimeResponseMessage;

      if (!response.ok) {
        setBulkResult({
          errorCode: response.error.errorCode as never,
          message: response.error.message,
          status: "error"
        });
        return;
      }

      if ("response" in response && response.response.status === "ok" && "acceptedCount" in response.response) {
        void loadContacts();
        setBulkResult(null);
        return;
      }

      if ("response" in response && response.response.status === "error") {
        setBulkResult(response.response);
      }
    } catch {
      setBulkResult({
        errorCode: "INTERNAL_ERROR",
        message: "Nao foi possivel atualizar a lista agora.",
        status: "error"
      });
    } finally {
      setBulkDecisionLoading(false);
    }
  }

  function removeBulkCandidate(requestId: string) {
    setBulkResult((current) => {
      if (!current || current.status !== "ok") {
        return current;
      }

      return {
        ...current,
        candidates: current.candidates.filter(
          (candidate) => candidate.requestId !== requestId
        )
      };
    });
  }

  async function handleDeleteBulkCandidate(candidate: BulkClientIdentificationCandidate) {
    const confirmed = globalThis.confirm(
      `Delete ${candidate.displayName ?? candidate.rowText}?`
    );

    if (!confirmed) {
      return;
    }

    if (candidate.saveState !== "known" || !candidate.customerId) {
      removeBulkCandidate(candidate.requestId);
      return;
    }

    setBulkDeleteLoadingIds((current) => new Set(current).add(candidate.requestId));

    try {
      const response = await chrome.runtime.sendMessage({
        request: {
          customerId: candidate.customerId
        },
        type: "assist/customer.delete"
      }) as RuntimeResponseMessage;

      if (!response.ok) {
        setBulkResult({
          errorCode: response.error.errorCode as never,
          message: response.error.message,
          status: "error"
        });
        return;
      }

      if ("response" in response && response.response.status === "ok" && "customerId" in response.response) {
        const deletedCustomerId = response.response.customerId;
        setContacts((current) =>
          current.filter((customer) => customer.id !== deletedCustomerId)
        );
        removeBulkCandidate(candidate.requestId);
      }
    } catch {
      setBulkResult({
        errorCode: "INTERNAL_ERROR",
        message: "Nao foi possivel apagar o cliente agora.",
        status: "error"
      });
    } finally {
      setBulkDeleteLoadingIds((current) => {
        const next = new Set(current);
        next.delete(candidate.requestId);
        return next;
      });
    }
  }

  async function handleSaveContact() {
    if (!selectedContact) {
      return;
    }

    setContactSaving(true);
    setContactsError("");

    try {
      const response = await chrome.runtime.sendMessage({
        request: {
          case: {
            ...(contactCaseDraft.caseId ? { caseId: contactCaseDraft.caseId } : {}),
            protocol: contactCaseDraft.protocol,
            status: contactCaseDraft.status,
            subject: contactCaseDraft.subject
          },
          customerId: selectedContact.id,
          displayName: contactNameDraft,
          maskedIdentifiers: contactIdentifierDrafts,
          notes: contactNotesDraft
        },
        type: "assist/customer.update"
      }) as RuntimeResponseMessage;

      if (!response.ok) {
        setContactsError(response.error.message);
        return;
      }

      if ("response" in response && response.response.status === "ok" && "customer" in response.response) {
        setContacts(response.response.customers);
        setSelectedContactId(response.response.customer.id);
      }
    } catch {
      setContactsError("Nao foi possivel salvar as informacoes do contato.");
    } finally {
      setContactSaving(false);
    }
  }

  function handleIdentifierDraftChange(
    field: keyof ContactIdentifierDrafts,
    value: string
  ) {
    setContactIdentifierDrafts((current) => ({
      ...current,
      [field]: value
    }));
  }

  function handleCaseDraftChange(field: keyof ContactCaseDraft, value: string) {
    setContactCaseDraft((current) => ({
      ...current,
      [field]: value
    }));
  }

  async function handleDeleteContact(customer: CustomerSummary) {
    const confirmed = globalThis.confirm(
      `Delete ${customer.displayName ?? "este contato"}?`
    );

    if (!confirmed) {
      return;
    }

    setContactDeletingId(customer.id);
    setContactSaving(true);
    setContactsError("");

    try {
      const response = await chrome.runtime.sendMessage({
        request: {
          customerId: customer.id
        },
        type: "assist/customer.delete"
      }) as RuntimeResponseMessage;

      if (!response.ok) {
        setContactsError(response.error.message);
        return;
      }

      if ("response" in response && response.response.status === "ok" && "customerId" in response.response) {
        const deletedCustomerId = response.response.customerId;
        setContacts((current) =>
          current.filter((item) => item.id !== deletedCustomerId)
        );
        setSelectedContactId((current) => current === deletedCustomerId ? null : current);
      }
    } catch {
      setContactsError("Nao foi possivel apagar o contato agora.");
    } finally {
      setContactSaving(false);
      setContactDeletingId(null);
    }
  }

  async function handleClientAnchorToggle(enabled: boolean) {
    setClientAnchorSaving(true);
    setClientAnchorNotice("");

    try {
      const saved = await saveClientAnchorMenuEnabled(enabled);
      setClientAnchorEnabled(saved);
      setClientAnchorNotice(
        saved
          ? "Icone inteligente ativado."
          : "Icone inteligente desativado."
      );
    } catch {
      setClientAnchorNotice("Nao foi possivel salvar essa opcao agora.");
    } finally {
      setClientAnchorSaving(false);
    }
  }

  async function handleClientAnchorPlacementChange(
    placement: ClientAnchorPlacementPreference
  ) {
    setClientAnchorSaving(true);
    setClientAnchorNotice("");

    try {
      const saved = await saveClientAnchorMenuPlacement(placement);
      setClientAnchorPlacement(saved);
      setClientAnchorNotice("Posicao do icone salva.");
    } catch {
      setClientAnchorNotice("Nao foi possivel salvar a posicao agora.");
    } finally {
      setClientAnchorSaving(false);
    }
  }

  if (session.status === "checking") {
    return (
      <main className="min-h-screen bg-background p-4 text-sm">
        <Card>
          <CardContent className="py-4 text-muted-foreground">Carregando...</CardContent>
        </Card>
      </main>
    );
  }

  if (session.status === "logged_out") {
    return (
      <TooltipProvider>
        <main className="min-h-screen bg-background p-4">
          <AuthView
            {...(session.message ? { message: session.message } : {})}
            onAuthenticated={(user) => {
              setSession({ status: "logged_in", user });
              void loadContacts();
            }}
          />
          <Toaster position="bottom-right" />
        </main>
      </TooltipProvider>
    );
  }

  return (
    <TooltipProvider>
      <main className="grid min-h-screen gap-3 bg-background p-4">
        <header className="flex items-center justify-between gap-3">
          <div className="grid min-w-0 gap-0.5">
            <strong className="truncate text-base">Linvo AI</strong>
            <span className="truncate text-xs text-muted-foreground">{session.user.email}</span>
          </div>
          <Button
            size="sm"
            type="button"
            variant="outline"
            onClick={() => {
              void chrome.runtime.sendMessage({ type: "auth/logout" });
              setSession({ status: "logged_out" });
              setResult(null);
              setBulkResult(null);
              setContacts([]);
              setSelectedContactId(null);
            }}
          >
            <LogOutIcon className="size-4" />
            Sair
          </Button>
        </header>
        <Card className="border-teal-900/20 bg-slate-950 text-slate-50">
          <CardHeader className="flex items-start justify-between gap-3">
            <div className="grid gap-1">
              <CardTitle className="text-base">Icone inteligente</CardTitle>
              <CardDescription className="text-teal-100/80">
                A IA ancora o icone perto do cliente identificado.
              </CardDescription>
            </div>
            <Badge variant={clientAnchorEnabled ? "linvo" : "secondary"}>
              {clientAnchorEnabled ? "Ativo" : "Desligado"}
            </Badge>
          </CardHeader>
          <CardContent className="grid gap-3">
            <Field className="grid grid-cols-[1fr_auto] items-start gap-3 rounded-lg border border-white/10 bg-white/5 p-3">
              <span className="grid gap-1">
                <FieldLabel className="text-slate-50">Fixar novo icone no cliente</FieldLabel>
                <FieldDescription className="text-teal-100/80">
                  Guarda a escolha por pagina e reaparece quando o cliente for reconhecido.
                </FieldDescription>
              </span>
              <Switch
                checked={clientAnchorEnabled}
                disabled={clientAnchorSaving}
                onCheckedChange={(checked) => {
                  void handleClientAnchorToggle(checked);
                }}
              />
            </Field>
            <Field>
              <FieldLabel className="text-teal-100" htmlFor="client-anchor-placement">
                Onde fixar
              </FieldLabel>
              <Select
                value={clientAnchorPlacement}
                disabled={!clientAnchorEnabled || clientAnchorSaving}
                onValueChange={(value) => {
                  void handleClientAnchorPlacementChange(
                    normalizeClientAnchorMenuPlacement(value)
                  );
                }}
              >
                <SelectTrigger id="client-anchor-placement" className="border-white/10 bg-white/10 text-slate-50">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="smart">Automatico</SelectItem>
                  <SelectItem value="right">Direita do cliente</SelectItem>
                  <SelectItem value="left">Esquerda do cliente</SelectItem>
                  <SelectItem value="top">Acima do cliente</SelectItem>
                  <SelectItem value="bottom">Abaixo do cliente</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            {clientAnchorNotice ? (
              <p className="text-xs text-teal-100">{clientAnchorNotice}</p>
            ) : null}
          </CardContent>
        </Card>
        <CustomerView
          decisionLoading={decisionLoading}
          onDecision={handleDecision}
          result={result}
        />
        <BulkCandidatesView
          deleteLoadingRequestIds={bulkDeleteLoadingIds}
          decisionLoading={bulkDecisionLoading}
          onDeleteCandidate={handleDeleteBulkCandidate}
          onDecision={handleBulkDecision}
          result={bulkResult}
        />
        <ContactsView
          caseDraft={contactCaseDraft}
          customers={contacts}
          deletingCustomerId={contactDeletingId}
          errorMessage={contactsError}
          identifierDrafts={contactIdentifierDrafts}
          loading={contactsLoading}
          nameDraft={contactNameDraft}
          notesDraft={contactNotesDraft}
          onCaseDraftChange={handleCaseDraftChange}
          onDelete={handleDeleteContact}
          onIdentifierDraftChange={handleIdentifierDraftChange}
          onNameDraftChange={setContactNameDraft}
          onNotesDraftChange={setContactNotesDraft}
          onRefresh={() => void loadContacts()}
          onSave={handleSaveContact}
          onSelect={setSelectedContactId}
          saving={contactSaving}
          selectedCustomerId={selectedContactId}
        />
        <Toaster position="bottom-right" />
      </main>
    </TooltipProvider>
  );
}
