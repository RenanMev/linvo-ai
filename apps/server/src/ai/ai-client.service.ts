import { Inject, Injectable } from "@nestjs/common";

import {
  CLIENT_IDENTIFICATION_SYSTEM_PROMPT,
  aiClientIdentificationResultSchema,
  type AiClientIdentificationResult,
  type ClientIdentificationRequest
} from "@linvo-ai/shared";

import type { AppConfig } from "../config/env.schema";
import { APP_CONFIG } from "../config/env.schema";
import { ApiHttpException } from "../http-error";
import { buildClientIdentificationUserPrompt } from "./client-identification.prompt";

interface ChatCompletionResponse {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
}

@Injectable()
export class AiClientService {
  constructor(@Inject(APP_CONFIG) private readonly config: AppConfig) {}

  async identifyClient(request: ClientIdentificationRequest): Promise<AiClientIdentificationResult> {
    if (!this.config.AI_API_KEY) {
      throw new ApiHttpException(
        503,
        "AI_UNAVAILABLE",
        "A chave de IA do servidor nao esta configurada.",
        request.requestId
      );
    }

    const userText = buildClientIdentificationUserPrompt(request);
    const userContent: unknown = request.screenshotDataUrl
      ? [
          { text: userText, type: "text" },
          { image_url: { url: request.screenshotDataUrl }, type: "image_url" }
        ]
      : userText;

    const response = await fetch(this.config.AI_BASE_URL, {
      body: JSON.stringify({
        messages: [
          { content: CLIENT_IDENTIFICATION_SYSTEM_PROMPT, role: "system" },
          { content: userContent, role: "user" }
        ],
        model: this.config.AI_MODEL,
        response_format: { type: "json_object" },
        temperature: 0
      }),
      headers: {
        authorization: `Bearer ${this.config.AI_API_KEY}`,
        "content-type": "application/json"
      },
      method: "POST",
      signal: AbortSignal.timeout(15_000)
    });

    if (!response.ok) {
      throw new ApiHttpException(
        502,
        "IDENTIFICATION_FAILED",
        "Nao foi possivel identificar o cliente agora.",
        request.requestId
      );
    }

    const payload = (await response.json()) as ChatCompletionResponse;
    const content = payload.choices?.[0]?.message?.content;

    if (!content) {
      throw new ApiHttpException(
        502,
        "IDENTIFICATION_FAILED",
        "A IA nao retornou uma resposta valida.",
        request.requestId
      );
    }

    try {
      return aiClientIdentificationResultSchema.parse(JSON.parse(content));
    } catch {
      throw new ApiHttpException(
        502,
        "IDENTIFICATION_FAILED",
        "A IA retornou JSON invalido.",
        request.requestId
      );
    }
  }
}
