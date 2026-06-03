import { Inject, Injectable } from "@nestjs/common";
import { z } from "zod";

import {
  CLIENT_DUPLICATE_VALIDATION_SYSTEM_PROMPT,
  CLIENT_INFO_OPEN_SYSTEM_PROMPT,
  CLIENT_IDENTIFICATION_ENRICHMENT_SYSTEM_PROMPT,
  CLIENT_IDENTIFICATION_SYSTEM_PROMPT,
  SITE_AGENT_CONTEXT_SYSTEM_PROMPT,
  aiClientIdentificationResultSchema,
  siteAgentContextDraftSchema,
  type AiClientIdentificationResult,
  type ClientInfoOpenRequest,
  type ClientIdentificationRequest,
  type CustomerSummary,
  type SiteAgentContextDraft,
  type SiteAgentContextSummary
} from "@linvo-ai/shared";

import type { AppConfig } from "../config/env.schema";
import { APP_CONFIG } from "../config/env.schema";
import { ApiHttpException } from "../http-error";
import { buildClientInfoOpenUserPrompt } from "./client-info-open.prompt";
import {
  buildClientDuplicateValidationUserPrompt,
  buildClientIdentificationEnrichmentUserPrompt,
  buildClientIdentificationUserPrompt,
  type ClientDuplicateValidationPromptResult
} from "./client-identification.prompt";
import { buildSiteContextUserPrompt } from "./site-context.prompt";

interface ChatCompletionResponse {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
}

const aiDuplicateValidationResultSchema = z.object({
  customerId: z.string().uuid().nullable().optional(),
  confidence: z.number().min(0).max(1),
  evidence: z.array(z.string().trim().min(1).max(240)).max(8).default([]),
  status: z.enum(["match", "new", "uncertain"]),
  warnings: z.array(z.string().trim().min(1).max(180)).max(8).default([])
});

export type AiDuplicateValidationResult = z.infer<
  typeof aiDuplicateValidationResultSchema
>;

const aiClientInfoOpenSelectionSchema = z.union([
  z.object({
    confidence: z.number().min(0).max(1),
    customerId: z.string().uuid(),
    evidence: z.array(z.string().trim().min(1).max(240)).max(8).default([]),
    status: z.literal("ok")
  }),
  z.object({
    reason: z.string().trim().min(1).max(240),
    status: z.literal("no_match")
  })
]);

export type AiClientInfoOpenSelection = z.infer<
  typeof aiClientInfoOpenSelectionSchema
>;

function identificationFailed(requestId: string, message: string): ApiHttpException {
  return new ApiHttpException(502, "IDENTIFICATION_FAILED", message, requestId);
}

function parseJsonObject(value: string): unknown {
  const fenced = value.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1];
  const candidate = fenced ?? value;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");

  if (start < 0 || end <= start) {
    return null;
  }

  try {
    return JSON.parse(candidate.slice(start, end + 1)) as unknown;
  } catch {
    return null;
  }
}

@Injectable()
export class AiClientService {
  constructor(@Inject(APP_CONFIG) private readonly config: AppConfig) {}

  async selectClientInfo(input: {
    customers: CustomerSummary[];
    request: ClientInfoOpenRequest;
    siteContext?: SiteAgentContextSummary | null;
  }): Promise<AiClientInfoOpenSelection | null> {
    if (!this.config.AI_API_KEY) {
      return null;
    }

    try {
      const parsedContent = await this.requestJsonObject({
        messages: [
          { content: CLIENT_INFO_OPEN_SYSTEM_PROMPT, role: "system" },
          { content: buildClientInfoOpenUserPrompt(input), role: "user" }
        ],
        requestId: input.request.requestId,
        timeoutMs: 12_000
      });
      const parsedResult = aiClientInfoOpenSelectionSchema.safeParse(parsedContent);

      if (!parsedResult.success) {
        return null;
      }

      const selection = parsedResult.data;

      if (
        selection.status === "ok" &&
        !input.customers.some((customer) => customer.id === selection.customerId)
      ) {
        return null;
      }

      return selection;
    } catch {
      return null;
    }
  }

  async identifyClient(request: ClientIdentificationRequest): Promise<AiClientIdentificationResult> {
    return this.analyzeClientIdentification(request);
  }

  async analyzeClientIdentification(
    request: ClientIdentificationRequest,
    siteContext?: SiteAgentContextSummary | null
  ): Promise<AiClientIdentificationResult> {
    if (!this.config.AI_API_KEY) {
      throw new ApiHttpException(
        503,
        "AI_UNAVAILABLE",
        "A chave de IA do servidor nao esta configurada.",
        request.requestId
      );
    }

    const userText = buildClientIdentificationUserPrompt(request, siteContext);
    const userContent: unknown = request.screenshotDataUrl
      ? [
          { text: userText, type: "text" },
          { image_url: { url: request.screenshotDataUrl }, type: "image_url" }
        ]
      : userText;

    const parsedContent = await this.requestJsonObject({
      messages: [
        { content: CLIENT_IDENTIFICATION_SYSTEM_PROMPT, role: "system" },
        { content: userContent, role: "user" }
      ],
      requestId: request.requestId,
      timeoutMs: 15_000
    });

    const parsedResult = aiClientIdentificationResultSchema.safeParse(parsedContent);

    if (!parsedResult.success) {
      throw identificationFailed(request.requestId, "A IA retornou dados fora do contrato.");
    }

    return parsedResult.data;
  }

  async validateClientDuplicate(input: {
    analysisResult: AiClientIdentificationResult;
    candidates: CustomerSummary[];
    request: ClientIdentificationRequest;
    siteContext?: SiteAgentContextSummary | null;
  }): Promise<AiDuplicateValidationResult> {
    const parsedContent = await this.requestJsonObject({
      messages: [
        { content: CLIENT_DUPLICATE_VALIDATION_SYSTEM_PROMPT, role: "system" },
        { content: buildClientDuplicateValidationUserPrompt(input), role: "user" }
      ],
      requestId: input.request.requestId,
      timeoutMs: 12_000
    });
    const parsedResult = aiDuplicateValidationResultSchema.safeParse(parsedContent);

    if (!parsedResult.success) {
      throw identificationFailed(input.request.requestId, "A IA retornou validacao de duplicidade invalida.");
    }

    const result = parsedResult.data;

    if (
      result.status === "match" &&
      (
        !result.customerId ||
        !input.candidates.some((customer) => customer.id === result.customerId)
      )
    ) {
      return {
        ...result,
        customerId: null,
        status: "uncertain",
        warnings: [
          ...result.warnings,
          "A IA apontou um cliente fora da lista de candidatos."
        ]
      };
    }

    return result;
  }

  async enrichClientIdentification(input: {
    analysisResult: AiClientIdentificationResult;
    duplicateValidation: ClientDuplicateValidationPromptResult;
    matchedCustomer: CustomerSummary | null;
    request: ClientIdentificationRequest;
    siteContext?: SiteAgentContextSummary | null;
  }): Promise<AiClientIdentificationResult> {
    const parsedContent = await this.requestJsonObject({
      messages: [
        { content: CLIENT_IDENTIFICATION_ENRICHMENT_SYSTEM_PROMPT, role: "system" },
        { content: buildClientIdentificationEnrichmentUserPrompt(input), role: "user" }
      ],
      requestId: input.request.requestId,
      timeoutMs: 15_000
    });
    const parsedResult = aiClientIdentificationResultSchema.safeParse(parsedContent);

    if (!parsedResult.success) {
      throw identificationFailed(input.request.requestId, "A IA retornou enriquecimento fora do contrato.");
    }

    return parsedResult.data;
  }

  async generateSiteContextDraft(input: {
    analysisResult: AiClientIdentificationResult;
    fallbackDraft: SiteAgentContextDraft;
    request: ClientIdentificationRequest;
  }): Promise<SiteAgentContextDraft> {
    const userText = buildSiteContextUserPrompt(input);
    const userContent: unknown = input.request.screenshotDataUrl
      ? [
          { text: userText, type: "text" },
          { image_url: { url: input.request.screenshotDataUrl }, type: "image_url" }
        ]
      : userText;
    const parsedContent = await this.requestJsonObject({
      messages: [
        { content: SITE_AGENT_CONTEXT_SYSTEM_PROMPT, role: "system" },
        { content: userContent, role: "user" }
      ],
      requestId: input.request.requestId,
      timeoutMs: 12_000
    });
    const parsedResult = siteAgentContextDraftSchema.safeParse(parsedContent);

    if (!parsedResult.success) {
      throw identificationFailed(input.request.requestId, "A IA retornou contexto do site fora do contrato.");
    }

    return parsedResult.data;
  }

  private async requestJsonObject(input: {
    messages: Array<{ content: unknown; role: "system" | "user" }>;
    requestId: string;
    timeoutMs: number;
  }): Promise<unknown> {
    if (!this.config.AI_API_KEY) {
      throw new ApiHttpException(
        503,
        "AI_UNAVAILABLE",
        "A chave de IA do servidor nao esta configurada.",
        input.requestId
      );
    }

    let response: Response;

    try {
      response = await fetch(this.config.AI_BASE_URL, {
        body: JSON.stringify({
          messages: input.messages,
          model: this.config.AI_MODEL,
          response_format: { type: "json_object" },
          temperature: 0
        }),
        headers: {
          authorization: `Bearer ${this.config.AI_API_KEY}`,
          "content-type": "application/json"
        },
        method: "POST",
        signal: AbortSignal.timeout(input.timeoutMs)
      });
    } catch {
      throw identificationFailed(input.requestId, "Nao foi possivel contatar a IA agora.");
    }

    if (!response.ok) {
      throw identificationFailed(input.requestId, "Nao foi possivel identificar o cliente agora.");
    }

    let payload: ChatCompletionResponse;

    try {
      payload = (await response.json()) as ChatCompletionResponse;
    } catch {
      throw identificationFailed(input.requestId, "A IA retornou uma resposta invalida.");
    }

    const content = payload.choices?.[0]?.message?.content;

    if (!content) {
      throw identificationFailed(input.requestId, "A IA nao retornou uma resposta valida.");
    }

    const parsedContent = parseJsonObject(content);

    if (!parsedContent) {
      throw identificationFailed(input.requestId, "A IA retornou JSON invalido.");
    }

    return parsedContent;
  }
}
