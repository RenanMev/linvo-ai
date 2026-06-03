import { useEffect, useState } from "react";

import type {
  AuthUser,
  BulkClientIdentificationApiResponse,
  BulkClientIdentificationCandidate,
  ClientIdentificationApiResponse,
  ClientIdentificationDecisionResponse,
  CustomerSummary,
  SiteAgentContextSummary
} from "@linvo-ai/shared";

import { Button } from "@/components/ui/button";
import { LoadingInfo } from "@/components/ui/loading-info";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { LogOutIcon, PaletteIcon } from "lucide-react";

import type {
  BulkIdentificationUpdatedMessage,
  ClientInfoOpenedMessage,
  IdentificationUpdatedMessage,
  RuntimeResponseMessage
} from "../lib/runtime-messages";
import { CLIENT_INFO_OPEN_SELECTION_STORAGE_KEY } from "../lib/runtime-messages";
import { AuthView } from "./auth-view";
import { BulkCandidatesView } from "./bulk-candidates-view";
import {
  ContactsView,
  type ContactCaseDraft,
  type ContactIdentifierDrafts
} from "./contacts-view";
import { CustomerView } from "./customer-view";
import { DesignSystemView } from "./design-system-view";
import { SiteContextView } from "./site-context-view";

type SessionState =
  | { status: "checking" }
  | { status: "logged_out"; message?: string }
  | { status: "logged_in"; user: AuthUser };

type SidepanelScreen = "assistant" | "design-system";

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

function screenFromHash(): SidepanelScreen {
  return globalThis.location.hash.startsWith("#design-system")
    ? "design-system"
    : "assistant";
}

function hasChromeRuntime(): boolean {
  return typeof chrome !== "undefined" &&
    Boolean(chrome.runtime?.sendMessage);
}

function hasChromeMessageBus(): boolean {
  return typeof chrome !== "undefined" &&
    Boolean(chrome.runtime?.onMessage);
}

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
      saved: decision.saved,
      siteContext: decision.siteContext,
      siteContextStatus: decision.siteContextStatus
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
  const [sidepanelScreen, setSidepanelScreen] =
    useState<SidepanelScreen>(() => screenFromHash());
  const [session, setSession] = useState<SessionState>({ status: "checking" });
  const [result, setResult] = useState<ClientIdentificationApiResponse | null>(null);
  const [bulkResult, setBulkResult] = useState<BulkClientIdentificationApiResponse | null>(null);
  const [contacts, setContacts] = useState<CustomerSummary[]>([]);
  const [contactsError, setContactsError] = useState("");
  const [contactsLoading, setContactsLoading] = useState(false);
  const [siteContext, setSiteContext] = useState<SiteAgentContextSummary | null>(null);
  const [siteContextError, setSiteContextError] = useState("");
  const [siteContextLoading, setSiteContextLoading] = useState(false);
  const [siteContextOpen, setSiteContextOpen] = useState(false);
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

  useEffect(() => {
    const listener = () => setSidepanelScreen(screenFromHash());

    globalThis.addEventListener("hashchange", listener);
    return () => globalThis.removeEventListener("hashchange", listener);
  }, []);

  useEffect(() => {
    if (sidepanelScreen !== "assistant") {
      return;
    }

    if (!hasChromeRuntime()) {
      setSession({
        message: "Preview local ativo. Abra a extensao no Chrome para autenticar.",
        status: "logged_out"
      });
      return;
    }

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
  }, [sidepanelScreen]);

  useEffect(() => {
    if (sidepanelScreen !== "assistant") {
      return;
    }

    if (!hasChromeMessageBus()) {
      return;
    }

    const listener = (
      message:
        | IdentificationUpdatedMessage
        | BulkIdentificationUpdatedMessage
        | ClientInfoOpenedMessage
    ) => {
      if (message.type === "assist/client-identification.updated") {
        setResult(message.response);

        if (message.response.status === "ok") {
          setSiteContext(message.response.siteContext);
          setSiteContextError(
            message.response.siteContextStatus === "unavailable"
              ? "O cliente foi identificado, mas o contexto do site nao pode ser atualizado agora."
              : ""
          );
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
          void loadSiteContext(message.response.domain);
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
  }, [sidepanelScreen]);

  const selectedContact =
    contacts.find((customer) => customer.id === selectedContactId) ?? contacts[0] ?? null;

  useEffect(() => {
    if (
      sidepanelScreen !== "assistant" ||
      session.status !== "logged_in" ||
      !selectedContact?.domain ||
      !hasChromeRuntime()
    ) {
      return;
    }

    void loadSiteContext(selectedContact.domain);
  }, [sidepanelScreen, session.status, selectedContact?.domain]);

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

  async function loadSiteContext(domain: string) {
    setSiteContextLoading(true);
    setSiteContextError("");

    try {
      const response = await chrome.runtime.sendMessage({
        domain,
        type: "assist/site-context.get"
      }) as RuntimeResponseMessage;

      if (!response.ok) {
        setSiteContextError(response.error.message);
        return;
      }

      if ("response" in response && response.response.status === "ok" && "siteContext" in response.response) {
        setSiteContext(response.response.siteContext);
      }
    } catch {
      setSiteContextError("Nao foi possivel carregar o contexto do site.");
    } finally {
      setSiteContextLoading(false);
    }
  }

  async function handleDeleteSiteContext() {
    if (!siteContext) {
      return;
    }

    const confirmed = globalThis.confirm("Remover o contexto salvo deste site?");

    if (!confirmed) {
      return;
    }

    setSiteContextLoading(true);
    setSiteContextError("");

    try {
      const response = await chrome.runtime.sendMessage({
        request: {
          domain: siteContext.domain
        },
        type: "assist/site-context.delete"
      }) as RuntimeResponseMessage;

      if (!response.ok) {
        setSiteContextError(response.error.message);
        return;
      }

      if ("response" in response && response.response.status === "ok" && "deleted" in response.response) {
        setSiteContext(null);
        setSiteContextOpen(false);
      }
    } catch {
      setSiteContextError("Nao foi possivel remover o contexto do site.");
    } finally {
      setSiteContextLoading(false);
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
        const nextResult = resultFromDecision(result, response.response);

        setSiteContext(response.response.siteContext);
        setSiteContextError(
          response.response.siteContextStatus === "unavailable"
            ? "O cliente foi atualizado, mas o contexto do site nao pode ser salvo agora."
            : ""
        );
        setResult(nextResult);
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

  function openAssistantScreen() {
    setSidepanelScreen("assistant");

    if (globalThis.location.hash.startsWith("#design-system")) {
      globalThis.history.replaceState(
        null,
        "",
        `${globalThis.location.pathname}${globalThis.location.search}`
      );
    }
  }

  function openDesignSystemScreen() {
    setSidepanelScreen("design-system");

    if (globalThis.location.hash !== "#design-system") {
      globalThis.location.hash = "design-system";
    }
  }

  if (sidepanelScreen === "design-system") {
    return (
      <TooltipProvider>
        <DesignSystemView onBack={openAssistantScreen} />
        <Toaster position="bottom-right" />
      </TooltipProvider>
    );
  }

  if (session.status === "checking") {
    return (
      <main className="linvo-auth-screen">
        <section className="linvo-auth-card linvo-auth-loading linvo-motion-rise" aria-live="polite">
          <LoadingInfo
            className="linvo-loading-info-bare"
            description="Validando sua conta e preparando o painel."
            skeletonLines={3}
            title="Sincronizando sessao"
          />
        </section>
      </main>
    );
  }

  if (session.status === "logged_out") {
    return (
      <TooltipProvider>
        <main className="linvo-auth-screen">
          <header className="linvo-auth-topbar">
            <div>
              <strong>Linvo AI</strong>
              <span>Atendimento com IA</span>
            </div>
            <button
              className="linvo-auth-design-button"
              type="button"
              onClick={openDesignSystemScreen}
            >
              <PaletteIcon className="size-4" />
              Design system
            </button>
          </header>
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
      <main className="linvo-main-shell grid min-h-screen gap-3 bg-background p-4">
        <header className="linvo-motion-rise flex items-center justify-between gap-3">
          <div className="grid min-w-0 gap-0.5">
            <strong className="truncate text-base">Linvo AI</strong>
            <span className="truncate text-xs text-muted-foreground">{session.user.email}</span>
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              type="button"
              variant="outline"
              onClick={openDesignSystemScreen}
            >
              <PaletteIcon className="size-4" />
              Sistema
            </Button>
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
                setSiteContext(null);
                setSiteContextError("");
                setSiteContextOpen(false);
              }}
            >
              <LogOutIcon className="size-4" />
              Sair
            </Button>
          </div>
        </header>
        <SiteContextView
          errorMessage={siteContextError}
          loading={siteContextLoading}
          onDelete={handleDeleteSiteContext}
          onToggle={() => setSiteContextOpen((current) => !current)}
          open={siteContextOpen}
          siteContext={siteContext}
        />
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
