import type { ClientIdentificationApiResponse } from "@linvo-ai/shared";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

interface CustomerViewProps {
  decisionLoading: "accept" | "reject" | null;
  onDecision: (decision: "accept" | "reject") => void;
  result: ClientIdentificationApiResponse | null;
}

export function CustomerView({ decisionLoading, onDecision, result }: CustomerViewProps) {
  if (!result) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Cliente atual</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Nenhum cliente identificado ainda.</p>
        </CardContent>
      </Card>
    );
  }

  if (result.status === "error") {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Cliente atual</CardTitle>
        </CardHeader>
        <CardContent>
          <Alert variant="destructive">
            <AlertDescription>{result.message}</AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between gap-3">
        <CardTitle className="text-base">
          {result.activeClient?.displayName ??
            result.pendingClient?.displayName ??
            "Cliente nao confirmado"}
        </CardTitle>
        <Badge variant="linvo">{Math.round(result.confidence * 100)}%</Badge>
      </CardHeader>
      <CardContent className="grid gap-3">
      {result.pendingClient && result.saveState === "pending_confirmation" ? (
        <Alert variant="info">
          <AlertTitle>Adicionar cliente?</AlertTitle>
          <AlertDescription>
            <span className="block">
              {result.pendingClient.displayName ?? "Cliente sem nome"}
              {result.pendingClient.maskedIdentifiers.protocol
                ? ` - ${result.pendingClient.maskedIdentifiers.protocol}`
                : ""}
            </span>
            <span className="mt-3 flex gap-2">
              <Button
                disabled={Boolean(decisionLoading)}
                size="sm"
                type="button"
                variant="linvo"
                onClick={() => onDecision("accept")}
              >
                {decisionLoading === "accept" ? "Adicionando..." : "Adicionar"}
              </Button>
              <Button
                disabled={Boolean(decisionLoading)}
                size="sm"
                type="button"
                variant="secondary"
                onClick={() => onDecision("reject")}
              >
                {decisionLoading === "reject" ? "Ignorando..." : "Ignorar"}
              </Button>
            </span>
          </AlertDescription>
        </Alert>
      ) : null}
      {result.case ? (
        <dl className="grid grid-cols-[90px_1fr] gap-x-3 gap-y-1 text-sm">
          <dt className="text-muted-foreground">Protocolo</dt>
          <dd>{result.case.protocol ?? "Nao confirmado"}</dd>
          <dt className="text-muted-foreground">Assunto</dt>
          <dd>{result.case.subject ?? "Nao confirmado"}</dd>
          <dt className="text-muted-foreground">Status</dt>
          <dd>{result.case.status ?? "Nao confirmado"}</dd>
        </dl>
      ) : null}
      {result.pendingClient?.case ? (
        <dl className="grid grid-cols-[90px_1fr] gap-x-3 gap-y-1 text-sm">
          <dt className="text-muted-foreground">Protocolo</dt>
          <dd>{result.pendingClient.case.protocol ?? "Nao confirmado"}</dd>
          <dt className="text-muted-foreground">Assunto</dt>
          <dd>{result.pendingClient.case.subject ?? "Nao confirmado"}</dd>
          <dt className="text-muted-foreground">Status</dt>
          <dd>{result.pendingClient.case.status ?? "Nao confirmado"}</dd>
        </dl>
      ) : null}
      {result.warnings.length ? (
        <Alert variant="warning">
          {result.warnings.map((warning) => (
            <AlertDescription key={warning}>{warning}</AlertDescription>
          ))}
        </Alert>
      ) : null}
      {result.evidence.length ? (
        <>
          <Separator />
          <ul className="grid gap-1 pl-4 text-sm text-muted-foreground">
            {result.evidence.map((item) => (
              <li className="list-disc" key={item}>
                {item}
              </li>
            ))}
          </ul>
        </>
      ) : null}
      </CardContent>
    </Card>
  );
}
