import type { CustomerSummary } from "@linvo-ai/shared";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { LoadingInfo } from "@/components/ui/loading-info";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  LoaderCircleIcon,
  RefreshCwIcon,
  SearchIcon,
  StarIcon
} from "lucide-react";

import {
  customerSearchText,
  resolveFavoriteFields
} from "./customer-favorites";

interface ContactsViewProps {
  activeDomain: string | null;
  customers: CustomerSummary[];
  errorMessage: string;
  loading: boolean;
  onRefresh: () => void;
  onSearchQueryChange: (value: string) => void;
  onSelect: (customerId: string) => void;
  searchQuery: string;
}

export function ContactsView({
  activeDomain,
  customers,
  errorMessage,
  loading,
  onRefresh,
  onSearchQueryChange,
  onSelect,
  searchQuery
}: ContactsViewProps) {
  const normalizedQuery = searchQuery.trim().toLowerCase();
  const visibleCustomers = normalizedQuery
    ? customers.filter((customer) => customerSearchText(customer).includes(normalizedQuery))
    : customers;
  const initialLoading = loading && customers.length === 0;

  return (
    <Card className="linvo-motion-rise">
      <CardHeader className="flex items-center justify-between gap-3">
        <div className="grid min-w-0 gap-0.5">
          <CardTitle className="text-base">Contatos</CardTitle>
          <span className="truncate text-xs text-muted-foreground">
            {activeDomain ?? "Abra um site/CRM para listar contatos"}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="linvo">{customers.length}</Badge>
          <Button
            disabled={loading || !activeDomain}
            size="icon"
            type="button"
            variant="secondary"
            onClick={onRefresh}
          >
            {loading ? (
              <LoaderCircleIcon className="linvo-inline-spinner size-4" />
            ) : (
              <RefreshCwIcon className="size-4" />
            )}
            <span className="sr-only">Atualizar contatos</span>
          </Button>
        </div>
      </CardHeader>
      <CardContent className="grid gap-3">
        {errorMessage ? (
          <Alert variant="destructive">
            <AlertDescription>{errorMessage}</AlertDescription>
          </Alert>
        ) : null}

        {!activeDomain ? (
          <p className="text-sm text-muted-foreground">
            Abra um site ou CRM em uma aba ativa para ver os contatos daquele dominio.
          </p>
        ) : initialLoading ? (
          <LoadingInfo
            compact
            description="Buscando contatos salvos deste dominio."
            skeletonLines={3}
            title="Carregando contatos"
          />
        ) : customers.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nenhum contato salvo para este dominio ainda.
          </p>
        ) : (
          <>
            <div className="relative">
              <SearchIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="pl-9"
                placeholder="Buscar contatos"
                value={searchQuery}
                onChange={(event) => onSearchQueryChange(event.target.value)}
              />
            </div>

            {loading ? (
              <span className="linvo-refresh-note">
                <LoaderCircleIcon className="linvo-inline-spinner size-3" />
                Sincronizando contatos
              </span>
            ) : null}

            {visibleCustomers.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Nenhum contato encontrado para esta busca.
              </p>
            ) : (
              <ScrollArea className="max-h-[28rem]">
                <ul className="grid gap-2 pr-3">
                  {visibleCustomers.map((customer) => {
                    const favorites = resolveFavoriteFields(customer);

                    return (
                      <li className="linvo-motion-rise" key={customer.id}>
                        <Button
                          className="h-auto min-w-0 justify-start p-3 text-left"
                          type="button"
                          variant="secondary"
                          onClick={() => onSelect(customer.id)}
                        >
                          <span className="grid min-w-0 flex-1 gap-1">
                            <span className="flex min-w-0 items-center gap-2">
                              {customer.isStarred ? (
                                <StarIcon className="size-4 fill-current text-[var(--brand-300)]" />
                              ) : null}
                              <strong className="truncate">
                                {customer.displayName ?? "Cliente sem nome"}
                              </strong>
                            </span>
                            {favorites.length ? (
                              <span className="grid min-w-0 gap-0.5">
                                {favorites.map((favorite) => (
                                  <small
                                    className="truncate text-xs text-muted-foreground"
                                    key={favorite.field}
                                  >
                                    {favorite.label}: {favorite.value}
                                  </small>
                                ))}
                              </span>
                            ) : (
                              <small className="truncate text-xs text-muted-foreground">
                                Sem dados favoritos
                              </small>
                            )}
                          </span>
                        </Button>
                      </li>
                    );
                  })}
                </ul>
              </ScrollArea>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
