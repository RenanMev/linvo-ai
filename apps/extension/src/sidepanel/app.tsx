import { useEffect, useMemo, useState } from "react";

import type {
  AuthUser,
  BulkClientIdentificationApiResponse,
  ClientIdentificationApiResponse,
  ClientIdentificationDecisionResponse,
  CustomerSummary
} from "@linvo-ai/shared";

import type {
  BulkIdentificationUpdatedMessage,
  IdentificationUpdatedMessage,
  RuntimeResponseMessage
} from "../lib/runtime-messages";
import { AuthView } from "./auth-view";
import { BulkCandidatesView } from "./bulk-candidates-view";
import { CustomerView } from "./customer-view";
import { RecentCustomersView } from "./recent-customers-view";

type SessionState =
  | { status: "checking" }
  | { status: "logged_out"; message?: string }
  | { status: "logged_in"; user: AuthUser };

function currentDomainFromResult(result: ClientIdentificationApiResponse | null): string | null {
  return result?.status === "ok" ? result.domain : null;
}

function currentDomainFromBulkResult(result: BulkClientIdentificationApiResponse | null): string | null {
  return result?.status === "ok" ? result.domain : null;
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

export function App() {
  const [session, setSession] = useState<SessionState>({ status: "checking" });
  const [result, setResult] = useState<ClientIdentificationApiResponse | null>(null);
  const [bulkResult, setBulkResult] = useState<BulkClientIdentificationApiResponse | null>(null);
  const [recentCustomers, setRecentCustomers] = useState<CustomerSummary[]>([]);
  const [decisionLoading, setDecisionLoading] = useState<"accept" | "reject" | null>(null);
  const [bulkDecisionLoading, setBulkDecisionLoading] = useState(false);

  useEffect(() => {
    void chrome.runtime.sendMessage({ type: "auth/me" }).then((response: RuntimeResponseMessage) => {
      if (response.ok && "user" in response && response.user) {
        setSession({ status: "logged_in", user: response.user });
        return;
      }

      setSession({ status: "logged_out" });
    }).catch(() => {
      setSession({ status: "logged_out", message: "Nao foi possivel restaurar a sessao." });
    });
  }, []);

  useEffect(() => {
    const listener = (message: IdentificationUpdatedMessage | BulkIdentificationUpdatedMessage) => {
      if (message.type === "assist/client-identification.updated") {
        setResult(message.response);

        if (message.response.status === "ok") {
          setRecentCustomers(message.response.recentCustomers);
        }
      }

      if (message.type === "assist/client-identification.bulk.updated") {
        setBulkResult(message.response);

        if (message.response.status === "ok") {
          setRecentCustomers(message.response.recentCustomers);
        }
      }
    };

    chrome.runtime.onMessage.addListener(listener);
    return () => chrome.runtime.onMessage.removeListener(listener);
  }, []);

  const domain = useMemo(
    () => currentDomainFromResult(result) ?? currentDomainFromBulkResult(bulkResult),
    [bulkResult, result]
  );

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
        setRecentCustomers(response.response.recentCustomers);
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
        setRecentCustomers(response.response.recentCustomers);
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

  if (session.status === "checking") {
    return <main className="shell">Carregando...</main>;
  }

  if (session.status === "logged_out") {
    return (
      <main className="shell">
        <AuthView
          {...(session.message ? { message: session.message } : {})}
          onAuthenticated={(user) => setSession({ status: "logged_in", user })}
        />
      </main>
    );
  }

  return (
    <main className="shell">
      <header className="topbar">
        <div>
          <strong>Linvo AI</strong>
          <span>{session.user.email}</span>
        </div>
        <button
          type="button"
          onClick={() => {
            void chrome.runtime.sendMessage({ type: "auth/logout" });
            setSession({ status: "logged_out" });
            setResult(null);
            setBulkResult(null);
          }}
        >
          Sair
        </button>
      </header>
      <CustomerView
        decisionLoading={decisionLoading}
        onDecision={handleDecision}
        result={result}
      />
      <BulkCandidatesView
        decisionLoading={bulkDecisionLoading}
        onDecision={handleBulkDecision}
        result={bulkResult}
      />
      <RecentCustomersView customers={recentCustomers} domain={domain} />
    </main>
  );
}
