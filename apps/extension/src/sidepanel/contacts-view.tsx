import type { CustomerSummary } from "@linvo-ai/shared";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { LoadingInfo } from "@/components/ui/loading-info";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { LoaderCircleIcon, RefreshCwIcon, SaveIcon, Trash2Icon } from "lucide-react";

export interface ContactCaseDraft {
  caseId?: string;
  protocol: string;
  status: string;
  subject: string;
}

export interface ContactIdentifierDrafts {
  document: string;
  email: string;
  phone: string;
  protocol: string;
}

interface ContactsViewProps {
  caseDraft: ContactCaseDraft;
  customers: CustomerSummary[];
  errorMessage: string;
  identifierDrafts: ContactIdentifierDrafts;
  loading: boolean;
  nameDraft: string;
  notesDraft: string;
  deletingCustomerId: string | null;
  onCaseDraftChange: (field: keyof ContactCaseDraft, value: string) => void;
  onDelete: (customer: CustomerSummary) => void;
  onIdentifierDraftChange: (field: keyof ContactIdentifierDrafts, value: string) => void;
  onNameDraftChange: (value: string) => void;
  onNotesDraftChange: (value: string) => void;
  onRefresh: () => void;
  onSave: () => void;
  onSelect: (customerId: string) => void;
  saving: boolean;
  selectedCustomerId: string | null;
}

function identifierText(customer: CustomerSummary): string {
  return (
    customer.maskedIdentifiers.protocol ??
    customer.maskedIdentifiers.phone ??
    customer.maskedIdentifiers.email ??
    customer.maskedIdentifiers.document ??
    "Sem identificador"
  );
}

export function ContactsView({
  caseDraft,
  customers,
  errorMessage,
  identifierDrafts,
  loading,
  nameDraft,
  notesDraft,
  deletingCustomerId,
  onCaseDraftChange,
  onDelete,
  onIdentifierDraftChange,
  onNameDraftChange,
  onNotesDraftChange,
  onRefresh,
  onSave,
  onSelect,
  saving,
  selectedCustomerId
}: ContactsViewProps) {
  const selectedCustomer =
    customers.find((customer) => customer.id === selectedCustomerId) ?? customers[0] ?? null;
  const initialLoading = loading && customers.length === 0;

  return (
    <Card className="linvo-motion-rise">
      <CardHeader className="flex items-center justify-between gap-3">
        <CardTitle className="text-base">Contatos</CardTitle>
        <div className="flex items-center gap-2">
          <Badge variant="linvo">{customers.length}</Badge>
          <Button disabled={loading} size="sm" type="button" variant="secondary" onClick={onRefresh}>
            {loading ? (
              <LoaderCircleIcon className="linvo-inline-spinner size-4" />
            ) : (
              <RefreshCwIcon className="size-4" />
            )}
            {loading ? "Atualizando" : "Atualizar"}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="grid gap-3">

      {errorMessage ? (
        <Alert variant="destructive">
          <AlertDescription>{errorMessage}</AlertDescription>
        </Alert>
      ) : null}

      {initialLoading ? (
        <LoadingInfo
          compact
          description="Buscando clientes salvos e mantendo sua selecao pronta."
          skeletonLines={3}
          title="Carregando contatos"
        />
      ) : customers.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhum contato salvo ainda. Identifique ou adicione clientes para montar sua base.</p>
      ) : (
        <div className="grid gap-3">
          {loading ? (
            <span className="linvo-refresh-note">
              <LoaderCircleIcon className="linvo-inline-spinner size-3" />
              Sincronizando contatos salvos
            </span>
          ) : null}
          <ScrollArea className="max-h-56">
          <ul className="grid gap-2 pr-3">
            {customers.map((customer) => {
              const isDeleting = deletingCustomerId === customer.id;

              return (
                <li className="linvo-motion-rise" key={customer.id}>
                  <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2">
                    <Button
                      className="h-auto min-w-0 justify-start p-3 text-left"
                      disabled={isDeleting}
                      type="button"
                      variant={selectedCustomer?.id === customer.id ? "outline" : "secondary"}
                      onClick={() => onSelect(customer.id)}
                    >
                      <span className="grid min-w-0 gap-0.5">
                        <strong className="truncate">{customer.displayName ?? "Cliente sem nome"}</strong>
                        <small className="truncate text-xs text-muted-foreground">{identifierText(customer)}</small>
                        <span className="truncate text-xs text-muted-foreground">{customer.domain ?? "Dominio nao informado"}</span>
                      </span>
                    </Button>
                    <Button
                      aria-label={`Delete ${customer.displayName ?? "Cliente sem nome"}`}
                      disabled={isDeleting}
                      size="icon"
                      type="button"
                      variant="destructive"
                      onClick={() => onDelete(customer)}
                    >
                      {isDeleting ? (
                        <LoaderCircleIcon className="linvo-inline-spinner size-4" />
                      ) : (
                        <Trash2Icon className="size-4" />
                      )}
                      <span className="sr-only">{isDeleting ? "Apagando" : "Delete"}</span>
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
          </ScrollArea>

          {selectedCustomer ? (
            <article className="linvo-motion-rise grid gap-4 rounded-lg border bg-muted/30 p-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs text-muted-foreground">Contato selecionado</p>
                  <h3 className="font-semibold">{selectedCustomer.displayName ?? "Cliente sem nome"}</h3>
                </div>
                <Button
                  disabled={saving || deletingCustomerId === selectedCustomer.id}
                  size="sm"
                  type="button"
                  variant="destructive"
                  onClick={() => onDelete(selectedCustomer)}
                >
                  {deletingCustomerId === selectedCustomer.id ? (
                    <LoaderCircleIcon className="linvo-inline-spinner size-4" />
                  ) : (
                    <Trash2Icon className="size-4" />
                  )}
                  {deletingCustomerId === selectedCustomer.id ? "Apagando" : "Delete"}
                </Button>
              </div>

              <Field>
                <FieldLabel htmlFor="contact-name">Nome do contato</FieldLabel>
                <Input
                  id="contact-name"
                  value={nameDraft}
                  onChange={(event) => onNameDraftChange(event.target.value)}
                />
              </Field>

              <div className="grid grid-cols-2 gap-3">
                <Field>
                  <FieldLabel htmlFor="contact-phone">Telefone</FieldLabel>
                  <Input
                    id="contact-phone"
                    inputMode="tel"
                    value={identifierDrafts.phone}
                    onChange={(event) => onIdentifierDraftChange("phone", event.target.value)}
                  />
                </Field>

                <Field>
                  <FieldLabel htmlFor="contact-email">Email</FieldLabel>
                  <Input
                    id="contact-email"
                    inputMode="email"
                    value={identifierDrafts.email}
                    onChange={(event) => onIdentifierDraftChange("email", event.target.value)}
                  />
                </Field>

                <Field>
                  <FieldLabel htmlFor="contact-document">Documento</FieldLabel>
                  <Input
                    id="contact-document"
                    value={identifierDrafts.document}
                    onChange={(event) => onIdentifierDraftChange("document", event.target.value)}
                  />
                </Field>

                <Field>
                  <FieldLabel htmlFor="contact-protocol">Protocolo</FieldLabel>
                  <Input
                    id="contact-protocol"
                    value={identifierDrafts.protocol}
                    onChange={(event) => onIdentifierDraftChange("protocol", event.target.value)}
                  />
                </Field>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Field>
                  <FieldLabel htmlFor="case-protocol">Protocolo do caso</FieldLabel>
                  <Input
                    id="case-protocol"
                    value={caseDraft.protocol}
                    onChange={(event) => onCaseDraftChange("protocol", event.target.value)}
                  />
                </Field>

                <Field>
                  <FieldLabel htmlFor="case-status">Status do caso</FieldLabel>
                  <Input
                    id="case-status"
                    value={caseDraft.status}
                    onChange={(event) => onCaseDraftChange("status", event.target.value)}
                  />
                </Field>

                <Field className="col-span-2">
                  <FieldLabel htmlFor="case-subject">Assunto do caso</FieldLabel>
                  <Input
                    id="case-subject"
                    value={caseDraft.subject}
                    onChange={(event) => onCaseDraftChange("subject", event.target.value)}
                  />
                </Field>
              </div>

              <Field>
                <FieldLabel htmlFor="contact-notes">Informacoes / observacoes</FieldLabel>
                <Textarea
                  id="contact-notes"
                  placeholder="Adicione detalhes importantes, combinados, preferencias ou contexto do atendimento."
                  value={notesDraft}
                  onChange={(event) => onNotesDraftChange(event.target.value)}
                />
              </Field>

              <Separator />
              <dl className="grid grid-cols-[96px_1fr] gap-x-3 gap-y-1 text-sm">
                <dt className="text-muted-foreground">Ultimo contato</dt>
                <dd>{new Date(selectedCustomer.lastSeenAt).toLocaleString("pt-BR")}</dd>
                <dt className="text-muted-foreground">Dominio</dt>
                <dd>{selectedCustomer.domain ?? "Dominio nao informado"}</dd>
              </dl>

              <Button
                disabled={saving}
                type="button"
                variant="linvo"
                onClick={onSave}
              >
                {saving ? (
                  <LoaderCircleIcon className="linvo-inline-spinner size-4" />
                ) : (
                  <SaveIcon className="size-4" />
                )}
                {saving ? "Salvando..." : "Salvar informacoes"}
              </Button>
            </article>
          ) : null}
        </div>
      )}
      </CardContent>
    </Card>
  );
}
