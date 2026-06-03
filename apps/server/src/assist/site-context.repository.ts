import { Inject, Injectable } from "@nestjs/common";
import type { Prisma } from "@prisma/client";

import {
  redactSensitiveText,
  siteAgentContextDraftSchema,
  siteAgentContextSummarySchema,
  type SiteAgentContextDraft,
  type SiteAgentContextRegion,
  type SiteAgentContextRegionKind,
  type SiteAgentContextStatus,
  type SiteAgentContextSummary
} from "@linvo-ai/shared";

import { PrismaService } from "../prisma/prisma.service";
import { parseAiIdentificationResult, parseDomSignature, toJsonValue } from "./identification-domain";

type SiteContextRecord = {
  confidence: Prisma.Decimal | number | string;
  createdAt: Date;
  domain: string;
  focusRulesJson: unknown;
  id: string;
  ignoreRulesJson: unknown;
  regionsJson: unknown;
  sourceRequestId: string;
  summary: string;
  updatedAt: Date;
};

export interface SiteContextUpsertResult {
  siteContext: SiteAgentContextSummary | null;
  status: SiteAgentContextStatus;
}

@Injectable()
export class SiteContextRepository {
  constructor(
    @Inject(PrismaService)
    private readonly prisma: PrismaService
  ) {}

  async getByDomain(
    userId: string,
    domain: string
  ): Promise<SiteAgentContextSummary | null> {
    const record = await this.prisma.siteAgentContext.findUnique({
      where: {
        userId_domain: {
          domain,
          userId
        }
      }
    });

    return record ? toSiteContextSummary(record) : null;
  }

  async deleteByDomain(input: {
    domain: string;
    userId: string;
  }): Promise<boolean> {
    const deleted = await this.prisma.siteAgentContext.deleteMany({
      where: {
        domain: input.domain,
        userId: input.userId
      }
    });

    return deleted.count > 0;
  }

  async upsertDraft(input: {
    domain: string;
    draft: SiteAgentContextDraft;
    sourceRequestId: string;
    userId: string;
  }): Promise<SiteContextUpsertResult> {
    const draft = siteAgentContextDraftSchema.parse(input.draft);
    const sourceRun = await this.prisma.identificationRun.findUnique({
      select: { id: true },
      where: {
        userId_requestId: {
          requestId: input.sourceRequestId,
          userId: input.userId
        }
      }
    });
    const existing = await this.prisma.siteAgentContext.findUnique({
      where: {
        userId_domain: {
          domain: input.domain,
          userId: input.userId
        }
      }
    });

    if (!existing) {
      const created = await this.prisma.siteAgentContext.create({
        data: {
          confidence: draft.confidence,
          domain: input.domain,
          focusRulesJson: toJsonValue(draft.focusRules),
          ignoreRulesJson: toJsonValue(draft.ignoreRules),
          regionsJson: toJsonValue(draft.regions),
          sourceRequestId: input.sourceRequestId,
          sourceRunId: sourceRun?.id ?? null,
          summary: draft.summary,
          userId: input.userId
        }
      });

      return {
        siteContext: toSiteContextSummary(created),
        status: "created"
      };
    }

    const current = toSiteContextSummary(existing);

    if (!shouldUpdateContext(current, draft)) {
      return {
        siteContext: current,
        status: "existing"
      };
    }

    const updated = await this.prisma.siteAgentContext.update({
      data: {
        confidence: draft.confidence,
        focusRulesJson: toJsonValue(draft.focusRules),
        ignoreRulesJson: toJsonValue(draft.ignoreRules),
        regionsJson: toJsonValue(draft.regions),
        sourceRequestId: input.sourceRequestId,
        sourceRunId: sourceRun?.id ?? existing.sourceRunId,
        summary: draft.summary
      },
      where: {
        userId_domain: {
          domain: input.domain,
          userId: input.userId
        }
      }
    });

    return {
      siteContext: toSiteContextSummary(updated),
      status: "updated"
    };
  }

  async upsertFromRun(input: {
    requestId: string;
    userId: string;
  }): Promise<SiteContextUpsertResult> {
    const run = await this.prisma.identificationRun.findUnique({
      where: {
        userId_requestId: {
          requestId: input.requestId,
          userId: input.userId
        }
      }
    });

    if (!run?.saved) {
      return {
        siteContext: run ? await this.getByDomain(input.userId, run.domain) : null,
        status: "missing"
      };
    }

    const draft = buildSiteContextDraft({
      aiResult: parseAiIdentificationResult(run.candidateJson),
      domain: run.domain,
      domSignature: parseDomSignature(run.domSignatureJson),
      pageTitle: run.domain
    });

    return this.upsertDraft({
      domain: run.domain,
      draft,
      sourceRequestId: run.requestId,
      userId: input.userId
    });
  }
}

function toSiteContextSummary(record: SiteContextRecord): SiteAgentContextSummary {
  return siteAgentContextSummarySchema.parse({
    confidence: Number(record.confidence),
    createdAt: record.createdAt.toISOString(),
    domain: record.domain,
    focusRules: record.focusRulesJson,
    id: record.id,
    ignoreRules: record.ignoreRulesJson,
    regions: record.regionsJson,
    sourceRequestId: record.sourceRequestId,
    summary: record.summary,
    updatedAt: record.updatedAt.toISOString()
  });
}

function shouldUpdateContext(
  current: SiteAgentContextSummary,
  draft: SiteAgentContextDraft
): boolean {
  const currentKinds = new Set(current.regions.map((region) => region.kind));
  const hasNewRegion = draft.regions.some((region) => !currentKinds.has(region.kind));

  return hasNewRegion || draft.confidence >= current.confidence + 0.05;
}

function hasAny(value: string, patterns: RegExp[]): boolean {
  return patterns.some((pattern) => pattern.test(value));
}

function region(
  kind: SiteAgentContextRegionKind,
  description: string,
  label: string,
  evidence: string[] = []
): SiteAgentContextRegion {
  return {
    description,
    evidence: evidence.map((item) => redactSensitiveText(item)).filter(Boolean).slice(0, 4),
    kind,
    label
  };
}

function uniqueRegions(regions: SiteAgentContextRegion[]): SiteAgentContextRegion[] {
  const seen = new Set<SiteAgentContextRegionKind>();

  return regions.filter((item) => {
    if (seen.has(item.kind)) {
      return false;
    }

    seen.add(item.kind);
    return true;
  });
}

export function buildSiteContextDraft(input: {
  aiResult?: { confidence?: number } | null;
  domain: string;
  domSignature?: {
    anchorText?: string;
    ariaLabel?: string;
    candidateLabels: string[];
    nearbyHeadings: string[];
    selectedRole?: string;
    selectedTag: string;
    tokens: string[];
  };
  pageTitle: string;
  selectedText?: string;
  surroundingText?: string;
}): SiteAgentContextDraft {
  const text = [
    input.domain,
    input.pageTitle,
    input.selectedText,
    input.surroundingText,
    input.domSignature?.ariaLabel,
    input.domSignature?.anchorText,
    ...(input.domSignature?.candidateLabels ?? []),
    ...(input.domSignature?.nearbyHeadings ?? []),
    ...(input.domSignature?.tokens ?? [])
  ].filter(Boolean).join(" ");
  const normalized = text.toLowerCase();
  const regions: SiteAgentContextRegion[] = [];

  if (hasAny(normalized, [/painel/, /controle/, /conversas/, /atendimento/, /crm/, /chamados/, /logs/, /e-mail/])) {
    regions.push(region(
      "main_sidebar",
      "Sidebar principal do sistema, normalmente na lateral esquerda, com navegacao entre modulos como painel, conversas, atendimento, CRM e chamados.",
      "Sidebar principal",
      ["Painel de Controle", "Conversas", "Atendimento", "CRM", "Chamados"]
    ));
  }

  if ((input.domSignature?.candidateLabels.length ?? 0) > 0 || hasAny(normalized, [/fila/, /contatos?/, /meus atendimentos/, /finalizados?/])) {
    regions.push(region(
      "contact_list",
      "Lista interna de contatos ou atendimentos, usada para alternar entre conversas e filas; ela pode mostrar outros clientes que nao sao o chat aberto.",
      "Lista de contatos",
      input.domSignature?.candidateLabels ?? []
    ));
  }

  if (hasAny(normalized, [/chat/, /conversa/, /mensagem/, /whatsapp/, /transferiu/, /atendimento aberto/]) || input.domSignature?.selectedRole === "region") {
    regions.push(region(
      "active_chat",
      "Area do chat ou atendimento ativo, onde aparecem as mensagens e o cliente atualmente aberto.",
      "Chat ativo",
      [input.domSignature?.ariaLabel, input.domSignature?.anchorText].filter((item): item is string => Boolean(item))
    ));
  }

  if ((input.domSignature?.nearbyHeadings.length ?? 0) > 0 || hasAny(normalized, [/header/, /cabecalho/, /encerrar chat/])) {
    regions.push(region(
      "header",
      "Cabecalho do atendimento, geralmente acima da conversa, com nome do cliente, identificadores, acoes e status do chat.",
      "Header do atendimento",
      input.domSignature?.nearbyHeadings ?? []
    ));
  }

  if (hasAny(normalized, [/encerrar/, /template/, /novo atendimento/, /transferir/, /ligar/, /email/, /whatsapp/])) {
    regions.push(region(
      "action_bar",
      "Barra de acoes do atendimento, com comandos operacionais como encerrar chat, enviar template, canais e mais opcoes.",
      "Acoes do atendimento",
      ["Encerrar chat", "Enviar template", "Novo atendimento"]
    ));
  }

  if (!regions.length) {
    regions.push(region(
      "conversation_area",
      "Area principal do atendimento selecionado pelo usuario, usada como referencia primaria para o agente.",
      "Area selecionada",
      [input.domSignature?.anchorText, input.domSignature?.ariaLabel].filter((item): item is string => Boolean(item))
    ));
  }

  const unique = uniqueRegions(regions);
  const summary = [
    `Neste dominio (${input.domain}), o sistema organiza o atendimento em regioes operacionais.`,
    unique.some((item) => item.kind === "main_sidebar")
      ? "A sidebar principal fica na lateral esquerda e concentra a navegacao do sistema."
      : "A navegacao do sistema deve ser tratada como contexto de fundo.",
    unique.some((item) => item.kind === "contact_list")
      ? "Ao lado dela pode existir uma lista interna de contatos/filas com varios clientes."
      : "Listas de contatos podem aparecer como contexto auxiliar.",
    unique.some((item) => item.kind === "active_chat")
      ? "O chat ou atendimento aberto e a area de foco para identificar o cliente atual."
      : "A selecao manual do atendente continua sendo o principal sinal de foco.",
    unique.some((item) => item.kind === "header")
      ? "O header do atendimento costuma reunir nome, identificadores, canal, status e acoes."
      : "Cabecalhos proximos devem ser usados como apoio, nao como unico sinal."
  ].join(" ");

  return siteAgentContextDraftSchema.parse({
    confidence: Math.min(0.96, Math.max(0.58, (input.aiResult?.confidence ?? 0.72) - 0.08 + unique.length * 0.03)),
    focusRules: [
      "Priorize o chat aberto, o header do atendimento e a selecao manual para decidir quem e o cliente ativo.",
      "Use a lista interna de contatos apenas como apoio; ela pode conter outros clientes que nao estao abertos.",
      "Quando houver conflito entre lista lateral e chat aberto, prefira o atendimento aberto."
    ],
    ignoreRules: [
      "Ignore menus de navegacao, atalhos do sistema e textos da propria extensao Linvo AI.",
      "Ignore contatos visiveis em listas laterais quando nao forem o item selecionado ou o chat aberto.",
      "Nao use botoes operacionais como encerrar chat, enviar template ou filtros como identidade do cliente."
    ],
    regions: unique,
    summary
  });
}
