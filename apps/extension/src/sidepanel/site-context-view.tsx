import type { SiteAgentContextSummary } from "@linvo-ai/shared";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { LoadingInfo } from "@/components/ui/loading-info";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger
} from "@/components/ui/tooltip";
import { LoaderCircleIcon, MapIcon, Trash2Icon } from "lucide-react";

interface SiteContextViewProps {
  errorMessage: string;
  loading: boolean;
  onDelete: () => void;
  onToggle: () => void;
  open: boolean;
  siteContext: SiteAgentContextSummary | null;
}

export function SiteContextView({
  errorMessage,
  loading,
  onDelete,
  onToggle,
  open,
  siteContext
}: SiteContextViewProps) {
  if (!siteContext && !loading && !errorMessage) {
    return null;
  }

  return (
    <section className="grid justify-items-end gap-2">
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            aria-expanded={open}
            aria-label="Contexto do site"
            className="size-8 opacity-70 hover:opacity-100"
            disabled={loading && !siteContext}
            size="icon"
            type="button"
            variant="ghost"
            onClick={onToggle}
          >
            {loading ? (
              <LoaderCircleIcon className="linvo-inline-spinner size-4" />
            ) : (
              <MapIcon className="size-4" />
            )}
          </Button>
        </TooltipTrigger>
        <TooltipContent side="left">Contexto do site</TooltipContent>
      </Tooltip>

      {open ? (
        <Card className="linvo-motion-rise w-full">
          <CardContent className="grid gap-3 p-3 text-sm">
            {errorMessage ? (
              <Alert variant="destructive">
                <AlertDescription>{errorMessage}</AlertDescription>
              </Alert>
            ) : null}

            {siteContext ? (
              <>
                <div className="flex items-start justify-between gap-3">
                  <div className="grid gap-1">
                    <strong className="text-sm">Contexto do site</strong>
                    <span className="text-xs text-muted-foreground">
                      {siteContext.domain} - {Math.round(siteContext.confidence * 100)}%
                    </span>
                    {loading ? (
                      <span className="linvo-refresh-note">
                        <LoaderCircleIcon className="linvo-inline-spinner size-3" />
                        Atualizando mapa do site
                      </span>
                    ) : null}
                  </div>
                  <Button
                    aria-label="Remover contexto do site"
                    disabled={loading}
                    size="icon"
                    type="button"
                    variant="ghost"
                    onClick={onDelete}
                  >
                    <Trash2Icon className="size-4" />
                  </Button>
                </div>

                <p className="text-muted-foreground">{siteContext.summary}</p>

                <div className="grid gap-1">
                  <span className="text-xs font-medium uppercase text-muted-foreground">
                    Regioes
                  </span>
                  <ul className="grid gap-1">
                    {siteContext.regions.map((region) => (
                      <li className="linvo-motion-rise rounded-md border bg-muted/30 p-2" key={region.kind}>
                        <strong className="block text-xs">{region.label ?? region.kind}</strong>
                        <span className="text-xs text-muted-foreground">
                          {region.description}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>

                <RuleList items={siteContext.focusRules} title="Foco" />
                <RuleList items={siteContext.ignoreRules} title="Ignorar" />
              </>
            ) : loading ? (
              <LoadingInfo
                compact
                description="Mapeando regioes importantes da pagina atual."
                skeletonLines={3}
                title="Carregando contexto"
              />
            ) : null}
          </CardContent>
        </Card>
      ) : null}
    </section>
  );
}

function RuleList({ items, title }: { items: string[]; title: string }) {
  return (
    <div className="grid gap-1">
      <span className="text-xs font-medium uppercase text-muted-foreground">{title}</span>
      <ul className="grid gap-1 pl-4 text-xs text-muted-foreground">
        {items.map((item) => (
          <li className="list-disc" key={item}>
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}
