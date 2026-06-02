import { useEffect, useMemo, useState } from "react";

import type {
  BulkClientIdentificationApiResponse,
  BulkClientIdentificationCandidate
} from "@linvo-ai/shared";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Trash2Icon } from "lucide-react";

interface BulkCandidatesViewProps {
  deleteLoadingRequestIds?: Set<string>;
  decisionLoading: boolean;
  onDeleteCandidate?: (candidate: BulkClientIdentificationCandidate) => void;
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
  deleteLoadingRequestIds = new Set(),
  decisionLoading,
  onDeleteCandidate,
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
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Clientes encontrados</CardTitle>
        </CardHeader>
        <CardContent>
          <Alert variant="destructive">
            <AlertDescription>{result.message}</AlertDescription>
          </Alert>
        </CardContent>
      </Card>
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
    <Card>
      <CardHeader className="flex items-center justify-between gap-3">
        <CardTitle className="text-base">Clientes encontrados</CardTitle>
        <Badge variant="linvo">{result.candidates.length}</Badge>
      </CardHeader>
      <CardContent>
      {result.candidates.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhum candidato encontrado na lista.</p>
      ) : (
        <div className="grid gap-3">
          <ScrollArea className="max-h-64">
          <ul className="grid gap-2 pr-3">
            {result.candidates.map((candidate) => {
              const deleteLoading = deleteLoadingRequestIds.has(candidate.requestId);

              return (
                <li key={candidate.requestId}>
                  <div className="rounded-lg border bg-card p-2">
                    <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2">
                      <label className="grid min-w-0 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 text-sm">
                        <Checkbox
                          aria-label={`Selecionar ${candidate.displayName ?? candidate.rowText}`}
                          checked={selected.has(candidate.requestId)}
                          disabled={candidate.saveState !== "pending_confirmation" || decisionLoading}
                          onCheckedChange={() => toggleCandidate(candidate)}
                        />
                        <span className="grid min-w-0 gap-0.5">
                          <strong className="truncate">{candidate.displayName ?? candidate.rowText}</strong>
                          <small className="truncate text-xs text-muted-foreground">{identifierText(candidate)}</small>
                        </span>
                        <Badge variant={candidate.saveState === "known" ? "secondary" : "outline"}>
                          {stateText(candidate)}
                        </Badge>
                      </label>
                      <Button
                      aria-label={`Delete ${candidate.displayName ?? candidate.rowText}`}
                      disabled={decisionLoading || deleteLoading}
                      size="icon"
                      title="Apagar cliente desta lista."
                      type="button"
                      variant="destructive"
                      onClick={() => onDeleteCandidate?.(candidate)}
                    >
                        <Trash2Icon className="size-4" />
                        <span className="sr-only">{deleteLoading ? "Apagando" : "Delete"}</span>
                      </Button>
                    </div>
                    {candidate.warnings.length ? (
                      <p className="mt-2 pl-6 text-xs text-muted-foreground">{candidate.warnings[0]}</p>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
          </ScrollArea>
          <Button
            disabled={decisionLoading || selectedCount === 0}
            type="button"
            variant="linvo"
            onClick={submit}
          >
            {decisionLoading ? "Adicionando..." : `Adicionar selecionados (${selectedCount})`}
          </Button>
        </div>
      )}
      </CardContent>
    </Card>
  );
}
