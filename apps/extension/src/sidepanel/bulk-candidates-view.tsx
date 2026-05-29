import { useEffect, useMemo, useState } from "react";

import type {
  BulkClientIdentificationApiResponse,
  BulkClientIdentificationCandidate
} from "@linvo-ai/shared";

interface BulkCandidatesViewProps {
  decisionLoading: boolean;
  onDecision: (acceptRequestIds: string[], rejectRequestIds: string[]) => void;
  result: BulkClientIdentificationApiResponse | null;
}

function identifierText(candidate: BulkClientIdentificationCandidate): string {
  return (
    candidate.maskedIdentifiers.protocol ??
    candidate.maskedIdentifiers.phone ??
    candidate.maskedIdentifiers.email ??
    candidate.maskedIdentifiers.document ??
    "Sem identificador forte"
  );
}

function stateText(candidate: BulkClientIdentificationCandidate): string {
  if (candidate.saveState === "known") {
    return "Ja salvo";
  }

  if (candidate.saveState === "low_confidence") {
    return "Revisar depois";
  }

  return "Novo";
}

export function BulkCandidatesView({
  decisionLoading,
  onDecision,
  result
}: BulkCandidatesViewProps) {
  const [selected, setSelected] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!result || result.status !== "ok") {
      setSelected(new Set());
      return;
    }

    setSelected(
      new Set(
        result.candidates
          .filter((candidate) => candidate.selectedByDefault)
          .map((candidate) => candidate.requestId)
      )
    );
  }, [result]);

  const pendingCandidates = useMemo(
    () =>
      result?.status === "ok"
        ? result.candidates.filter((candidate) => candidate.saveState === "pending_confirmation")
        : [],
    [result]
  );
  const selectedCount = pendingCandidates.filter((candidate) => selected.has(candidate.requestId)).length;

  if (!result) {
    return null;
  }

  if (result.status === "error") {
    return (
      <section className="panel">
        <h2>Clientes encontrados</h2>
        <p className="error">{result.message}</p>
      </section>
    );
  }

  function toggleCandidate(candidate: BulkClientIdentificationCandidate) {
    if (candidate.saveState !== "pending_confirmation") {
      return;
    }

    setSelected((current) => {
      const next = new Set(current);

      if (next.has(candidate.requestId)) {
        next.delete(candidate.requestId);
      } else {
        next.add(candidate.requestId);
      }

      return next;
    });
  }

  function submit() {
    const acceptRequestIds = pendingCandidates
      .filter((candidate) => selected.has(candidate.requestId))
      .map((candidate) => candidate.requestId);
    const rejectRequestIds = pendingCandidates
      .filter((candidate) => !selected.has(candidate.requestId))
      .map((candidate) => candidate.requestId);

    onDecision(acceptRequestIds, rejectRequestIds);
  }

  return (
    <section className="panel">
      <div className="section-heading">
        <h2>Clientes encontrados</h2>
        <span>{result.candidates.length}</span>
      </div>
      {result.candidates.length === 0 ? (
        <p className="muted">Nenhum candidato encontrado na lista.</p>
      ) : (
        <>
          <ul className="bulk-list">
            {result.candidates.map((candidate) => (
              <li key={candidate.requestId}>
                <label className="bulk-row">
                  <input
                    checked={selected.has(candidate.requestId)}
                    disabled={candidate.saveState !== "pending_confirmation" || decisionLoading}
                    type="checkbox"
                    onChange={() => toggleCandidate(candidate)}
                  />
                  <span>
                    <strong>{candidate.displayName ?? candidate.rowText}</strong>
                    <small>{identifierText(candidate)}</small>
                  </span>
                  <em>{stateText(candidate)}</em>
                </label>
                {candidate.warnings.length ? (
                  <p className="bulk-warning">{candidate.warnings[0]}</p>
                ) : null}
              </li>
            ))}
          </ul>
          <button
            className="bulk-submit"
            disabled={decisionLoading || selectedCount === 0}
            type="button"
            onClick={submit}
          >
            {decisionLoading ? "Adicionando..." : `Adicionar selecionados (${selectedCount})`}
          </button>
        </>
      )}
    </section>
  );
}
