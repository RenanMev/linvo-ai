import type { ClientIdentificationApiResponse } from "@linvo-ai/shared";

interface CustomerViewProps {
  decisionLoading: "accept" | "reject" | null;
  onDecision: (decision: "accept" | "reject") => void;
  result: ClientIdentificationApiResponse | null;
}

export function CustomerView({ decisionLoading, onDecision, result }: CustomerViewProps) {
  if (!result) {
    return (
      <section className="panel">
        <h2>Cliente atual</h2>
        <p className="muted">Nenhum cliente identificado ainda.</p>
      </section>
    );
  }

  if (result.status === "error") {
    return (
      <section className="panel">
        <h2>Cliente atual</h2>
        <p className="error">{result.message}</p>
      </section>
    );
  }

  return (
    <section className="panel">
      <div className="section-heading">
        <h2>
          {result.activeClient?.displayName ??
            result.pendingClient?.displayName ??
            "Cliente nao confirmado"}
        </h2>
        <span>{Math.round(result.confidence * 100)}%</span>
      </div>
      {result.pendingClient && result.saveState === "pending_confirmation" ? (
        <div className="confirm-card">
          <strong>Adicionar cliente?</strong>
          <p>
            {result.pendingClient.displayName ?? "Cliente sem nome"}
            {result.pendingClient.maskedIdentifiers.protocol
              ? ` - ${result.pendingClient.maskedIdentifiers.protocol}`
              : ""}
          </p>
          <div className="confirm-actions">
            <button
              disabled={Boolean(decisionLoading)}
              type="button"
              onClick={() => onDecision("accept")}
            >
              {decisionLoading === "accept" ? "Adicionando..." : "Adicionar"}
            </button>
            <button
              className="secondary-button"
              disabled={Boolean(decisionLoading)}
              type="button"
              onClick={() => onDecision("reject")}
            >
              {decisionLoading === "reject" ? "Ignorando..." : "Ignorar"}
            </button>
          </div>
        </div>
      ) : null}
      {result.case ? (
        <dl>
          <dt>Protocolo</dt>
          <dd>{result.case.protocol ?? "Nao confirmado"}</dd>
          <dt>Assunto</dt>
          <dd>{result.case.subject ?? "Nao confirmado"}</dd>
          <dt>Status</dt>
          <dd>{result.case.status ?? "Nao confirmado"}</dd>
        </dl>
      ) : null}
      {result.pendingClient?.case ? (
        <dl>
          <dt>Protocolo</dt>
          <dd>{result.pendingClient.case.protocol ?? "Nao confirmado"}</dd>
          <dt>Assunto</dt>
          <dd>{result.pendingClient.case.subject ?? "Nao confirmado"}</dd>
          <dt>Status</dt>
          <dd>{result.pendingClient.case.status ?? "Nao confirmado"}</dd>
        </dl>
      ) : null}
      {result.warnings.length ? (
        <div className="notice">
          {result.warnings.map((warning) => (
            <p key={warning}>{warning}</p>
          ))}
        </div>
      ) : null}
      {result.evidence.length ? (
        <ul className="evidence">
          {result.evidence.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
