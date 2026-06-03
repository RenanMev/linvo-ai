import type {
  CustomerChatMessage,
  CustomerFavoriteField,
  CustomerSummary
} from "@linvo-ai/shared";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { LoadingInfo } from "@/components/ui/loading-info";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import {
  ArrowLeftIcon,
  BotIcon,
  LoaderCircleIcon,
  PencilIcon,
  SaveIcon,
  SendIcon,
  StarIcon,
  Trash2Icon,
  XIcon
} from "lucide-react";
import { useState } from "react";

import {
  FAVORITE_FIELD_OPTIONS,
  resolveFavoriteFields
} from "./customer-favorites";

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

export interface ContactDetailDraft {
  caseDraft: ContactCaseDraft;
  favoriteFields: Array<CustomerFavoriteField | "">;
  identifiers: ContactIdentifierDrafts;
  name: string;
  notes: string;
}

interface ContactDetailViewProps {
  chatDraft: string;
  chatError: string;
  chatLoading: boolean;
  chatMessages: CustomerChatMessage[];
  chatSending: boolean;
  chatStreamingText: string;
  chatSummary: string | null;
  customer: CustomerSummary | null;
  deleting: boolean;
  draft: ContactDetailDraft;
  editing: boolean;
  onBack: () => void;
  onCancelEdit: () => void;
  onCaseDraftChange: (field: keyof ContactCaseDraft, value: string) => void;
  onChatDraftChange: (value: string) => void;
  onClearChat: () => void;
  onDelete: () => void;
  onEdit: () => void;
  onFavoriteFieldChange: (index: number, value: CustomerFavoriteField | "") => void;
  onIdentifierDraftChange: (field: keyof ContactIdentifierDrafts, value: string) => void;
  onNameDraftChange: (value: string) => void;
  onNotesDraftChange: (value: string) => void;
  onSave: () => void;
  onSendChat: () => void;
  onStarToggle: () => void;
  saving: boolean;
  starSaving: boolean;
}

type DetailTab = "info" | "ai";

function formatDate(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString("pt-BR");
}

function chatMessageClass(message: CustomerChatMessage): string {
  return message.role === "user"
    ? "justify-self-end bg-[var(--brand-500)] text-[var(--text-on-brand)]"
    : "justify-self-start bg-muted text-foreground";
}

export function ContactDetailView({
  chatDraft,
  chatError,
  chatLoading,
  chatMessages,
  chatSending,
  chatStreamingText,
  chatSummary,
  customer,
  deleting,
  draft,
  editing,
  onBack,
  onCancelEdit,
  onCaseDraftChange,
  onChatDraftChange,
  onClearChat,
  onDelete,
  onEdit,
  onFavoriteFieldChange,
  onIdentifierDraftChange,
  onNameDraftChange,
  onNotesDraftChange,
  onSave,
  onSendChat,
  onStarToggle,
  saving,
  starSaving
}: ContactDetailViewProps) {
  const [tab, setTab] = useState<DetailTab>("info");
  const latestCase = customer?.cases[0] ?? null;
  const resolvedFavorites = customer ? resolveFavoriteFields(customer) : [];

  if (!customer) {
    return (
      <Card className="linvo-motion-rise">
        <CardHeader>
          <CardTitle className="text-base">Contato</CardTitle>
        </CardHeader>
        <CardContent>
          <LoadingInfo
            compact
            description="Carregando dados do contato."
            skeletonLines={3}
            title="Abrindo contato"
          />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="linvo-motion-rise">
      <CardHeader className="grid gap-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex min-w-0 items-start gap-2">
            <Button size="icon" type="button" variant="ghost" onClick={onBack}>
              <ArrowLeftIcon className="size-4" />
              <span className="sr-only">Voltar</span>
            </Button>
            <div className="grid min-w-0 gap-1">
              <CardTitle className="truncate text-base">
                {customer.displayName ?? "Cliente sem nome"}
              </CardTitle>
              <span className="truncate text-xs text-muted-foreground">
                {customer.domain ?? "Dominio nao informado"}
              </span>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <Button
              disabled={starSaving}
              size="icon"
              type="button"
              variant={customer.isStarred ? "secondary" : "ghost"}
              onClick={onStarToggle}
            >
              {starSaving ? (
                <LoaderCircleIcon className="linvo-inline-spinner size-4" />
              ) : (
                <StarIcon
                  className={
                    customer.isStarred
                      ? "size-4 fill-current text-[var(--brand-300)]"
                      : "size-4"
                  }
                />
              )}
              <span className="sr-only">Alternar estrela</span>
            </Button>
            {editing ? (
              <Button
                disabled={saving}
                size="icon"
                type="button"
                variant="ghost"
                onClick={onCancelEdit}
              >
                <XIcon className="size-4" />
                <span className="sr-only">Cancelar</span>
              </Button>
            ) : (
              <Button size="icon" type="button" variant="ghost" onClick={onEdit}>
                <PencilIcon className="size-4" />
                <span className="sr-only">Editar</span>
              </Button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 rounded-md bg-muted p-1">
          <Button
            size="sm"
            type="button"
            variant={tab === "info" ? "secondary" : "ghost"}
            onClick={() => setTab("info")}
          >
            Info
          </Button>
          <Button
            size="sm"
            type="button"
            variant={tab === "ai" ? "secondary" : "ghost"}
            onClick={() => setTab("ai")}
          >
            <BotIcon className="size-4" />
            IA
          </Button>
        </div>
      </CardHeader>

      <CardContent className="grid gap-4">
        {tab === "info" ? (
          editing ? (
            <>
              <Field>
                <FieldLabel htmlFor="contact-detail-name">Nome</FieldLabel>
                <Input
                  id="contact-detail-name"
                  value={draft.name}
                  onChange={(event) => onNameDraftChange(event.target.value)}
                />
              </Field>

              <div className="grid grid-cols-2 gap-3">
                <Field>
                  <FieldLabel htmlFor="contact-detail-phone">Telefone</FieldLabel>
                  <Input
                    id="contact-detail-phone"
                    inputMode="tel"
                    value={draft.identifiers.phone}
                    onChange={(event) => onIdentifierDraftChange("phone", event.target.value)}
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="contact-detail-email">Email</FieldLabel>
                  <Input
                    id="contact-detail-email"
                    inputMode="email"
                    value={draft.identifiers.email}
                    onChange={(event) => onIdentifierDraftChange("email", event.target.value)}
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="contact-detail-document">Documento</FieldLabel>
                  <Input
                    id="contact-detail-document"
                    value={draft.identifiers.document}
                    onChange={(event) => onIdentifierDraftChange("document", event.target.value)}
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="contact-detail-protocol">Protocolo</FieldLabel>
                  <Input
                    id="contact-detail-protocol"
                    value={draft.identifiers.protocol}
                    onChange={(event) => onIdentifierDraftChange("protocol", event.target.value)}
                  />
                </Field>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Field>
                  <FieldLabel htmlFor="contact-detail-case-protocol">Protocolo do caso</FieldLabel>
                  <Input
                    id="contact-detail-case-protocol"
                    value={draft.caseDraft.protocol}
                    onChange={(event) => onCaseDraftChange("protocol", event.target.value)}
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="contact-detail-case-status">Status do caso</FieldLabel>
                  <Input
                    id="contact-detail-case-status"
                    value={draft.caseDraft.status}
                    onChange={(event) => onCaseDraftChange("status", event.target.value)}
                  />
                </Field>
                <Field className="col-span-2">
                  <FieldLabel htmlFor="contact-detail-case-subject">Assunto do caso</FieldLabel>
                  <Input
                    id="contact-detail-case-subject"
                    value={draft.caseDraft.subject}
                    onChange={(event) => onCaseDraftChange("subject", event.target.value)}
                  />
                </Field>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {[0, 1].map((index) => (
                  <Field key={index}>
                    <FieldLabel>Favorito {index + 1}</FieldLabel>
                    <Select
                      value={draft.favoriteFields[index] || "__none"}
                      onValueChange={(value) =>
                        onFavoriteFieldChange(
                          index,
                          value === "__none" ? "" : value as CustomerFavoriteField
                        )
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none">Nenhum</SelectItem>
                        {FAVORITE_FIELD_OPTIONS.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                ))}
              </div>

              <Field>
                <FieldLabel htmlFor="contact-detail-notes">Informacoes / observacoes</FieldLabel>
                <Textarea
                  id="contact-detail-notes"
                  value={draft.notes}
                  onChange={(event) => onNotesDraftChange(event.target.value)}
                />
              </Field>

              <Button disabled={saving} type="button" variant="linvo" onClick={onSave}>
                {saving ? (
                  <LoaderCircleIcon className="linvo-inline-spinner size-4" />
                ) : (
                  <SaveIcon className="size-4" />
                )}
                {saving ? "Salvando..." : "Salvar informacoes"}
              </Button>
            </>
          ) : (
            <>
              {resolvedFavorites.length ? (
                <div className="flex flex-wrap gap-2">
                  {resolvedFavorites.map((favorite) => (
                    <Badge key={favorite.field} variant="linvo">
                      {favorite.label}: {favorite.value}
                    </Badge>
                  ))}
                </div>
              ) : null}

              <dl className="grid grid-cols-[104px_1fr] gap-x-3 gap-y-1 text-sm">
                <dt className="text-muted-foreground">Telefone</dt>
                <dd>{customer.maskedIdentifiers.phone ?? "Nao informado"}</dd>
                <dt className="text-muted-foreground">Email</dt>
                <dd className="truncate">{customer.maskedIdentifiers.email ?? "Nao informado"}</dd>
                <dt className="text-muted-foreground">Documento</dt>
                <dd>{customer.maskedIdentifiers.document ?? "Nao informado"}</dd>
                <dt className="text-muted-foreground">Protocolo</dt>
                <dd>{customer.maskedIdentifiers.protocol ?? latestCase?.protocol ?? "Nao informado"}</dd>
                <dt className="text-muted-foreground">Caso</dt>
                <dd>{latestCase?.subject ?? "Nao informado"}</dd>
                <dt className="text-muted-foreground">Status</dt>
                <dd>{latestCase?.status ?? "Nao informado"}</dd>
                <dt className="text-muted-foreground">Ultimo contato</dt>
                <dd>{formatDate(customer.lastSeenAt)}</dd>
              </dl>

              <Separator />

              <div className="grid gap-1 text-sm">
                <span className="text-muted-foreground">Informacoes / observacoes</span>
                <p className="whitespace-pre-wrap">
                  {customer.notes ?? "Nenhuma observacao salva."}
                </p>
              </div>

              <Button
                disabled={deleting || saving}
                type="button"
                variant="destructive"
                onClick={onDelete}
              >
                {deleting ? (
                  <LoaderCircleIcon className="linvo-inline-spinner size-4" />
                ) : (
                  <Trash2Icon className="size-4" />
                )}
                {deleting ? "Apagando..." : "Apagar contato"}
              </Button>
            </>
          )
        ) : (
          <div className="grid gap-3">
            {chatError ? (
              <Alert variant="destructive">
                <AlertDescription>{chatError}</AlertDescription>
              </Alert>
            ) : null}

            {chatSummary ? (
              <div className="rounded-md border bg-muted/30 p-3 text-sm">
                <span className="block text-xs text-muted-foreground">Resumo</span>
                <p className="mt-1 whitespace-pre-wrap">{chatSummary}</p>
              </div>
            ) : null}

            {chatLoading ? (
              <LoadingInfo
                compact
                description="Carregando memoria do cliente."
                skeletonLines={3}
                title="Carregando conversa"
              />
            ) : (
              <ScrollArea className="max-h-72 rounded-md border bg-muted/20 p-3">
                <div className="grid gap-2">
                  {chatMessages.length === 0 && !chatStreamingText ? (
                    <p className="text-sm text-muted-foreground">Nenhuma conversa salva.</p>
                  ) : null}
                  {chatMessages.map((message) => (
                    <div
                      className={`max-w-[88%] rounded-md px-3 py-2 text-sm ${chatMessageClass(message)}`}
                      key={message.id}
                    >
                      <p className="whitespace-pre-wrap">{message.content}</p>
                      {message.status !== "completed" ? (
                        <small className="mt-1 block opacity-75">{message.status}</small>
                      ) : null}
                    </div>
                  ))}
                  {chatStreamingText ? (
                    <div className="max-w-[88%] justify-self-start rounded-md bg-muted px-3 py-2 text-sm text-foreground">
                      <p className="whitespace-pre-wrap">{chatStreamingText}</p>
                    </div>
                  ) : null}
                </div>
              </ScrollArea>
            )}

            <Field>
              <FieldLabel htmlFor="contact-chat-message">Mensagem</FieldLabel>
              <Textarea
                id="contact-chat-message"
                disabled={chatSending}
                value={chatDraft}
                onChange={(event) => onChatDraftChange(event.target.value)}
              />
            </Field>

            <div className="grid grid-cols-[1fr_auto] gap-2">
              <Button
                disabled={chatSending || !chatDraft.trim()}
                type="button"
                variant="linvo"
                onClick={onSendChat}
              >
                {chatSending ? (
                  <LoaderCircleIcon className="linvo-inline-spinner size-4" />
                ) : (
                  <SendIcon className="size-4" />
                )}
                {chatSending ? "Enviando..." : "Enviar"}
              </Button>
              <Button
                disabled={chatSending || chatLoading || chatMessages.length === 0}
                type="button"
                variant="outline"
                onClick={onClearChat}
              >
                Limpar
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
