import { Inject, Injectable } from "@nestjs/common";

import {
  CLIENT_INFO_OPEN_MIN_CONFIDENCE,
  bulkClientIdentificationDecisionResponseSchema,
  bulkClientIdentificationResponseSchema,
  clientInfoOpenNoMatchResponseSchema,
  clientInfoOpenSuccessResponseSchema,
  clientIdentificationDecisionResponseSchema,
  clientIdentificationSuccessResponseSchema,
  customerUpdateResponseSchema,
  siteContextDeleteResponseSchema,
  siteContextGetResponseSchema,
  type AiClientIdentificationResult,
  type BulkClientIdentificationCandidate,
  type BulkClientIdentificationDecisionRequest,
  type BulkClientIdentificationDecisionResponse,
  type BulkClientIdentificationRequest,
  type BulkClientIdentificationResponse,
  type ClientInfoOpenApiResponse,
  type ClientInfoOpenRequest,
  type ClientIdentificationDecisionRequest,
  type ClientIdentificationDecisionResponse,
  type ClientIdentificationRequest,
  type ClientIdentificationSuccessResponse,
  type CustomerSummary,
  type CustomerUpdateRequest,
  type CustomerUpdateResponse,
  type SiteAgentContextStatus,
  type SiteAgentContextSummary
} from "@linvo-ai/shared";

import { AiClientService, type AiDuplicateValidationResult } from "../ai/ai-client.service";
import type { AppConfig } from "../config/env.schema";
import { APP_CONFIG } from "../config/env.schema";
import { ApiHttpException } from "../http-error";
import { parseBulkIdentificationItems } from "./bulk-identification.parser";
import {
  CustomerRepository,
  IdentificationDecisionConflictError
} from "./customer.repository";
import { buildDomSignature } from "./identification-domain";
import {
  buildSiteContextDraft,
  SiteContextRepository,
  type SiteContextUpsertResult
} from "./site-context.repository";

function compact(value: string | undefined): string {
  return (value ?? "").replace(/\s+/g, " ").trim();
}

function normalizeText(value: string | undefined): string {
  return compact(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function onlyDigits(value: string | undefined): string {
  return (value ?? "").replace(/\D/g, "");
}

function scoreInfoCustomer(request: ClientInfoOpenRequest, customer: CustomerSummary): {
  evidence: string[];
  score: number;
} {
  const haystack = normalizeText(request.pageText);
  const digits = onlyDigits(request.pageText);
  const evidence: string[] = [];
  let score = 0;

  const addTextMatch = (value: string | undefined, points: number, label: string) => {
    const normalized = normalizeText(value);

    if (normalized.length >= 3 && haystack.includes(normalized)) {
      score += points;
      evidence.push(label);
    }
  };
  const addDigitTailMatch = (value: string | undefined, points: number, label: string) => {
    const tail = onlyDigits(value).slice(-4);

    if (tail.length >= 4 && digits.includes(tail)) {
      score += points;
      evidence.push(label);
    }
  };

  addTextMatch(customer.displayName, 0.42, "Nome do cliente aparece na pagina.");
  addTextMatch(customer.maskedIdentifiers.protocol, 0.38, "Protocolo salvo aparece na pagina.");
  addTextMatch(customer.maskedIdentifiers.email, 0.24, "Email salvo aparece na pagina.");
  addTextMatch(customer.maskedIdentifiers.document, 0.24, "Documento salvo aparece na pagina.");
  addDigitTailMatch(customer.maskedIdentifiers.phone, 0.38, "Telefone salvo aparece na pagina.");
  addDigitTailMatch(customer.maskedIdentifiers.document, 0.26, "Documento salvo aparece na pagina.");

  for (const customerCase of customer.cases.slice(0, 3)) {
    addTextMatch(customerCase.protocol, 0.34, "Protocolo de caso salvo aparece na pagina.");
    addTextMatch(customerCase.subject, 0.12, "Assunto de caso salvo aparece na pagina.");
  }

  return {
    evidence: evidence.slice(0, 4),
    score: Math.min(1, score)
  };
}

@Injectable()
export class ClientIdentificationService {
  constructor(
    @Inject(AiClientService)
    private readonly aiClient: AiClientService,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
    @Inject(CustomerRepository)
    private readonly customerRepository: CustomerRepository,
    @Inject(SiteContextRepository)
    private readonly siteContextRepository: SiteContextRepository
  ) {}

  async openClientInfo(
    userId: string,
    request: ClientInfoOpenRequest
  ): Promise<ClientInfoOpenApiResponse> {
    const domain = new URL(request.url).hostname.toLowerCase();
    const customers = await this.customerRepository.listRecentCustomers(userId, domain);
    const siteContext = await this.siteContextRepository.getByDomain(userId, domain);

    if (customers.length === 0) {
      return clientInfoOpenNoMatchResponseSchema.parse({
        customers,
        domain,
        reason: "Nenhum cliente identificado foi encontrado para esta pagina.",
        requestId: request.requestId,
        status: "no_match"
      });
    }

    const aiSelection = await this.aiClient.selectClientInfo({
      customers,
      request,
      ...(siteContext ? { siteContext } : {})
    });

    if (aiSelection?.status === "no_match") {
      return clientInfoOpenNoMatchResponseSchema.parse({
        customers,
        domain,
        reason: aiSelection.reason,
        requestId: request.requestId,
        status: "no_match"
      });
    }

    if (aiSelection?.status === "ok") {
      const customer = customers.find((item) => item.id === aiSelection.customerId);

      if (customer && aiSelection.confidence >= CLIENT_INFO_OPEN_MIN_CONFIDENCE) {
        return clientInfoOpenSuccessResponseSchema.parse({
          confidence: aiSelection.confidence,
          customer,
          customers,
          domain,
          evidence: aiSelection.evidence,
          requestId: request.requestId,
          source: "llm",
          status: "ok"
        });
      }
    }

    const ranked = customers
      .map((customer) => ({
        customer,
        ...scoreInfoCustomer(request, customer)
      }))
      .sort((left, right) => right.score - left.score);
    const best = ranked[0];

    if (!best || best.score < CLIENT_INFO_OPEN_MIN_CONFIDENCE) {
      return clientInfoOpenNoMatchResponseSchema.parse({
        customers,
        domain,
        reason: "Nao foi possivel escolher um cliente salvo com confianca suficiente.",
        requestId: request.requestId,
        status: "no_match"
      });
    }

    return clientInfoOpenSuccessResponseSchema.parse({
      confidence: best.score,
      customer: best.customer,
      customers,
      domain,
      evidence: best.evidence.length
        ? best.evidence
        : ["Cliente salvo corresponde ao contexto visivel."],
      requestId: request.requestId,
      source: "heuristic",
      status: "ok"
    });
  }

  async identify(
    userId: string,
    request: ClientIdentificationRequest
  ): Promise<ClientIdentificationSuccessResponse> {
    const startedAt = Date.now();
    const domain = new URL(request.url).hostname.toLowerCase();
    const existingSiteContext = await this.siteContextRepository.getByDomain(userId, domain);
    const baseContextState = this.toSiteContextState(existingSiteContext);
    const analysisResult = existingSiteContext
      ? await this.aiClient.analyzeClientIdentification(request, existingSiteContext)
      : await this.aiClient.analyzeClientIdentification(request);
    const recentCustomers = await this.customerRepository.listRecentCustomers(userId, domain);
    const duplicateValidation = await this.aiClient.validateClientDuplicate({
      analysisResult,
      candidates: recentCustomers,
      request,
      ...(existingSiteContext ? { siteContext: existingSiteContext } : {})
    });
    const aiMatchedCustomer = this.customerFromDuplicateValidation(
      duplicateValidation,
      recentCustomers
    );
    const exactExistingCustomer = aiMatchedCustomer
      ? null
      : await this.customerRepository.findExistingCustomer(
          userId,
          domain,
          analysisResult,
          request.selectedText
        );
    let matchedCustomer = aiMatchedCustomer ?? exactExistingCustomer;
    const enrichedDuplicateValidation = this.enrichDuplicateValidation(
      duplicateValidation,
      matchedCustomer
    );
    const aiResult = await this.aiClient.enrichClientIdentification({
      analysisResult,
      duplicateValidation: enrichedDuplicateValidation,
      matchedCustomer,
      request,
      ...(existingSiteContext ? { siteContext: existingSiteContext } : {})
    });
    const confident = aiResult.confidence >= this.config.IDENTIFICATION_CONFIDENCE_MIN;
    const finalResult = confident
      ? aiResult
      : {
          ...aiResult,
          warnings: [
            ...aiResult.warnings,
            "Nao foi possivel confirmar o cliente com confianca suficiente."
          ]
        };
    const persistable = this.customerRepository.canPersistCandidate(finalResult, request.selectedText);

    if (confident && persistable && !matchedCustomer) {
      matchedCustomer = await this.customerRepository.findExistingCustomer(
        userId,
        domain,
        finalResult,
        request.selectedText
      );
    }

    if (!confident || !persistable) {
      await this.customerRepository.savePendingIdentification({
        aiResult: finalResult,
        confirmationStatus: "low_confidence",
        domain,
        durationMs: Date.now() - startedAt,
        request,
        userId
      });

      return clientIdentificationSuccessResponseSchema.parse({
        activeClient: null,
        case: null,
        confidence: finalResult.confidence,
        domain,
        evidence: finalResult.evidence,
        pendingClient: null,
        recentCustomers,
        requestId: request.requestId,
        saveState: "low_confidence",
        saved: false,
        siteContext: baseContextState.siteContext,
        siteContextStatus: baseContextState.siteContextStatus,
        status: "ok",
        warnings: finalResult.warnings
      });
    }

    if (matchedCustomer) {
      const { caseSummary, customerSummary } =
        await this.customerRepository.saveConfirmedIdentification({
          aiResult: finalResult,
          confirmationStatus: "known",
          domain,
          durationMs: Date.now() - startedAt,
          existingCustomerId: matchedCustomer.id,
          request,
          userId
        });
      const updatedRecentCustomers = await this.customerRepository.listRecentCustomers(userId, domain);
      const contextState = await this.upsertSiteContextForConfirmed({
        aiResult: finalResult,
        domain,
        request,
        userId
      });

      return clientIdentificationSuccessResponseSchema.parse({
        activeClient: customerSummary ?? matchedCustomer,
        case: caseSummary,
        confidence: finalResult.confidence,
        domain,
        evidence: finalResult.evidence,
        pendingClient: null,
        recentCustomers: updatedRecentCustomers,
        requestId: request.requestId,
        saveState: "known",
        saved: true,
        siteContext: contextState.siteContext,
        siteContextStatus: contextState.siteContextStatus,
        status: "ok",
        warnings: finalResult.warnings
      });
    }

    await this.customerRepository.savePendingIdentification({
      aiResult: finalResult,
      confirmationStatus: "pending_confirmation",
      domain,
      durationMs: Date.now() - startedAt,
      request,
      userId
    });

    return clientIdentificationSuccessResponseSchema.parse({
      activeClient: null,
      case: null,
      confidence: finalResult.confidence,
      domain,
      evidence: finalResult.evidence,
      pendingClient: this.customerRepository.toPendingClient(finalResult),
      recentCustomers,
      requestId: request.requestId,
      saveState: "pending_confirmation",
      saved: false,
      siteContext: baseContextState.siteContext,
      siteContextStatus: baseContextState.siteContextStatus,
      status: "ok",
      warnings: finalResult.warnings
    });
  }

  async decide(
    userId: string,
    request: ClientIdentificationDecisionRequest
  ): Promise<ClientIdentificationDecisionResponse> {
    const decision = await this.withDecisionConflictHandling(() =>
      this.customerRepository.decidePendingIdentification({
        decision: request.decision,
        requestId: request.requestId,
        userId
      })
    );

    if (!decision) {
      throw new ApiHttpException(404, "INVALID_REQUEST", "Identificacao pendente nao encontrada.");
    }

    const recentCustomers = await this.customerRepository.listRecentCustomers(
      userId,
      decision.domain
    );
    const contextState = decision.saved
      ? await this.upsertSiteContextFromRun(userId, request.requestId, decision.domain)
      : this.toSiteContextState(
          await this.siteContextRepository.getByDomain(userId, decision.domain)
        );

    return clientIdentificationDecisionResponseSchema.parse({
      activeClient: decision.activeClient,
      decision: request.decision,
      domain: decision.domain,
      recentCustomers,
      requestId: request.requestId,
      saved: decision.saved,
      siteContext: contextState.siteContext,
      siteContextStatus: contextState.siteContextStatus,
      status: "ok"
    });
  }

  async identifyBulk(
    userId: string,
    request: BulkClientIdentificationRequest
  ): Promise<BulkClientIdentificationResponse> {
    const startedAt = Date.now();
    const domain = new URL(request.url).hostname;
    const parsedItems = parseBulkIdentificationItems(request.items);
    const rowLabels = request.items.map((item) => item.rowText.slice(0, 160)).slice(0, 12);
    const candidates: BulkClientIdentificationCandidate[] = [];

    for (const parsed of parsedItems) {
      const itemRequest = this.toBulkItemClientRequest(request, parsed.item, rowLabels);
      const confident = parsed.aiResult.confidence >= this.config.IDENTIFICATION_CONFIDENCE_MIN;
      const persistable = this.customerRepository.canPersistCandidate(
        parsed.aiResult,
        parsed.item.rowText
      );
      const finalResult = confident && persistable
        ? parsed.aiResult
        : {
            ...parsed.aiResult,
            warnings: [
              ...parsed.aiResult.warnings,
              "Candidato mantido para revisao; evidencia insuficiente para salvar agora."
            ]
          };
      const pendingSummary = this.customerRepository.toPendingClient(finalResult);

      if (!confident || !persistable) {
        await this.customerRepository.savePendingIdentification({
          aiResult: finalResult,
          bulkBatchId: request.requestId,
          bulkItemIndex: parsed.item.rowIndex,
          confirmationStatus: "low_confidence",
          domain,
          durationMs: Date.now() - startedAt,
          request: itemRequest,
          userId
        });

        candidates.push({
          case: pendingSummary?.case ?? null,
          confidence: finalResult.confidence,
          ...(pendingSummary?.displayName ? { displayName: pendingSummary.displayName } : {}),
          evidence: finalResult.evidence,
          maskedIdentifiers: pendingSummary?.maskedIdentifiers ?? {},
          requestId: parsed.item.requestId,
          rowIndex: parsed.item.rowIndex,
          rowText: parsed.item.rowText,
          saveState: "low_confidence",
          selectedByDefault: false,
          warnings: finalResult.warnings
        });
        continue;
      }

      const existingCustomer = await this.customerRepository.findExistingCustomer(
        userId,
        domain,
        finalResult,
        parsed.item.rowText
      );

      if (existingCustomer) {
        await this.customerRepository.saveConfirmedIdentification({
          aiResult: finalResult,
          bulkBatchId: request.requestId,
          bulkItemIndex: parsed.item.rowIndex,
          confirmationStatus: "known",
          domain,
          durationMs: Date.now() - startedAt,
          request: itemRequest,
          userId
        });

        candidates.push({
          case: pendingSummary?.case ?? existingCustomer.cases[0] ?? null,
          confidence: finalResult.confidence,
          customerId: existingCustomer.id,
          ...(existingCustomer.displayName ? { displayName: existingCustomer.displayName } : {}),
          evidence: finalResult.evidence,
          maskedIdentifiers: existingCustomer.maskedIdentifiers,
          requestId: parsed.item.requestId,
          rowIndex: parsed.item.rowIndex,
          rowText: parsed.item.rowText,
          saveState: "known",
          selectedByDefault: false,
          warnings: finalResult.warnings
        });
        continue;
      }

      await this.customerRepository.savePendingIdentification({
        aiResult: finalResult,
        bulkBatchId: request.requestId,
        bulkItemIndex: parsed.item.rowIndex,
        confirmationStatus: "pending_confirmation",
        domain,
        durationMs: Date.now() - startedAt,
        request: itemRequest,
        userId
      });

      candidates.push({
        case: pendingSummary?.case ?? null,
        confidence: finalResult.confidence,
        ...(pendingSummary?.displayName ? { displayName: pendingSummary.displayName } : {}),
        evidence: finalResult.evidence,
        maskedIdentifiers: pendingSummary?.maskedIdentifiers ?? {},
        requestId: parsed.item.requestId,
        rowIndex: parsed.item.rowIndex,
        rowText: parsed.item.rowText,
        saveState: "pending_confirmation",
        selectedByDefault: true,
        warnings: finalResult.warnings
      });
    }

    const recentCustomers = await this.customerRepository.listRecentCustomers(userId, domain);

    return bulkClientIdentificationResponseSchema.parse({
      batchId: request.requestId,
      candidates,
      domain,
      recentCustomers,
      status: "ok"
    });
  }

  async decideBulk(
    userId: string,
    request: BulkClientIdentificationDecisionRequest
  ): Promise<BulkClientIdentificationDecisionResponse> {
    const decision = await this.withDecisionConflictHandling(() =>
      this.customerRepository.decideBulkIdentification({
        acceptRequestIds: request.acceptRequestIds,
        batchId: request.batchId,
        rejectRequestIds: request.rejectRequestIds,
        userId
      })
    );

    if (!decision) {
      throw new ApiHttpException(404, "INVALID_REQUEST", "Lote de identificacao nao encontrado.");
    }

    const recentCustomers = await this.customerRepository.listRecentCustomers(
      userId,
      decision.domain
    );

    return bulkClientIdentificationDecisionResponseSchema.parse({
      acceptedCount: decision.acceptedCount,
      domain: decision.domain,
      recentCustomers,
      rejectedCount: decision.rejectedCount,
      savedCustomers: decision.savedCustomers,
      status: "ok"
    });
  }

  async listCustomers(userId: string, domain?: string) {
    return {
      customers: await this.customerRepository.listRecentCustomers(userId, domain),
      ...(domain ? { domain } : {}),
      status: "ok" as const
    };
  }

  async getSiteContext(userId: string, domain: string) {
    const normalizedDomain = domain.trim().toLowerCase();

    return siteContextGetResponseSchema.parse({
      domain: normalizedDomain,
      siteContext: await this.siteContextRepository.getByDomain(userId, normalizedDomain),
      status: "ok"
    });
  }

  async deleteSiteContext(userId: string, domain: string) {
    const normalizedDomain = domain.trim().toLowerCase();

    return siteContextDeleteResponseSchema.parse({
      deleted: await this.siteContextRepository.deleteByDomain({
        domain: normalizedDomain,
        userId
      }),
      domain: normalizedDomain,
      status: "ok"
    });
  }

  async updateCustomer(
    userId: string,
    request: CustomerUpdateRequest
  ): Promise<CustomerUpdateResponse> {
    const updated = await this.customerRepository.updateCustomer({
      ...(request.case !== undefined ? { case: request.case } : {}),
      customerId: request.customerId,
      ...(request.displayName !== undefined ? { displayName: request.displayName } : {}),
      ...(request.maskedIdentifiers !== undefined
        ? { maskedIdentifiers: request.maskedIdentifiers }
        : {}),
      ...(request.notes !== undefined ? { notes: request.notes } : {}),
      userId
    });

    if (!updated) {
      throw new ApiHttpException(404, "INVALID_REQUEST", "Cliente nao encontrado.");
    }

    return customerUpdateResponseSchema.parse({
      customer: updated.customer,
      customers: await this.customerRepository.listRecentCustomers(userId),
      domain: updated.domain,
      status: "ok"
    });
  }

  async deleteCustomer(userId: string, customerId: string) {
    const deleted = await this.customerRepository.deleteCustomer({
      customerId,
      userId
    });

    if (!deleted) {
      throw new ApiHttpException(404, "INVALID_REQUEST", "Cliente nao encontrado.");
    }

    return {
      customerId,
      domain: deleted.domain,
      recentCustomers: await this.customerRepository.listRecentCustomers(userId, deleted.domain),
      status: "ok" as const
    };
  }

  private toBulkItemClientRequest(
    request: BulkClientIdentificationRequest,
    item: BulkClientIdentificationRequest["items"][number],
    rowLabels: string[]
  ): ClientIdentificationRequest {
    return {
      capturedAt: request.capturedAt,
      domSummary: {
        ...(item.ariaLabel ? { ariaLabel: item.ariaLabel } : {}),
        candidateLabels: rowLabels,
        nearbyHeadings: request.listSelection.label ? [request.listSelection.label] : [],
        ...(item.role ? { selectedRole: item.role } : {}),
        selectedTag: item.tag
      },
      manualSelection: {
        ...(item.boundingBox ? { boundingBox: item.boundingBox } : {}),
        label: item.rowText.slice(0, 160),
        selectedAt: request.listSelection.selectedAt,
        source: "user",
        textExcerpt: item.rowText
      },
      pageTitle: request.pageTitle,
      requestId: item.requestId,
      selectedText: item.rowText,
      surroundingText: request.listSelection.containerText,
      url: request.url
    };
  }

  private customerFromDuplicateValidation(
    validation: AiDuplicateValidationResult,
    candidates: CustomerSummary[]
  ): CustomerSummary | null {
    if (
      validation.status !== "match" ||
      !validation.customerId ||
      validation.confidence < this.config.IDENTIFICATION_CONFIDENCE_MIN
    ) {
      return null;
    }

    return candidates.find((customer) => customer.id === validation.customerId) ?? null;
  }

  private enrichDuplicateValidation(
    validation: AiDuplicateValidationResult,
    matchedCustomer: CustomerSummary | null
  ): AiDuplicateValidationResult {
    if (!matchedCustomer || validation.status === "match") {
      return validation;
    }

    return {
      ...validation,
      confidence: Math.max(validation.confidence, this.config.IDENTIFICATION_CONFIDENCE_MIN),
      customerId: matchedCustomer.id,
      evidence: [
        ...validation.evidence,
        "Cliente existente encontrado por identidade canonica no banco."
      ],
      status: "match"
    };
  }

  private toSiteContextState(siteContext: SiteAgentContextSummary | null): {
    siteContext: SiteAgentContextSummary | null;
    siteContextStatus: SiteAgentContextStatus;
  } {
    return {
      siteContext,
      siteContextStatus: siteContext ? "existing" : "missing"
    };
  }

  private async upsertSiteContextForConfirmed(input: {
    aiResult: AiClientIdentificationResult;
    domain: string;
    request: ClientIdentificationRequest;
    userId: string;
  }): Promise<{
    siteContext: SiteAgentContextSummary | null;
    siteContextStatus: SiteAgentContextStatus;
  }> {
    try {
      const fallbackDraft = buildSiteContextDraft({
        aiResult: input.aiResult,
        domain: input.domain,
        domSignature: buildDomSignature(input.request, input.aiResult),
        pageTitle: input.request.pageTitle,
        selectedText: input.request.selectedText,
        ...(input.request.surroundingText
          ? { surroundingText: input.request.surroundingText }
          : {})
      });
      const aiDraft = await this.aiClient.generateSiteContextDraft({
        analysisResult: input.aiResult,
        fallbackDraft,
        request: input.request
      });
      const result = await this.siteContextRepository.upsertDraft({
        domain: input.domain,
        draft: aiDraft,
        sourceRequestId: input.request.requestId,
        userId: input.userId
      });

      return this.fromUpsertResult(result);
    } catch {
      return {
        siteContext: await this.siteContextRepository.getByDomain(input.userId, input.domain),
        siteContextStatus: "unavailable"
      };
    }
  }

  private async upsertSiteContextFromRun(
    userId: string,
    requestId: string,
    domain: string
  ): Promise<{
    siteContext: SiteAgentContextSummary | null;
    siteContextStatus: SiteAgentContextStatus;
  }> {
    try {
      return this.fromUpsertResult(await this.siteContextRepository.upsertFromRun({
        requestId,
        userId
      }));
    } catch {
      return {
        siteContext: await this.siteContextRepository.getByDomain(userId, domain),
        siteContextStatus: "unavailable"
      };
    }
  }

  private fromUpsertResult(result: SiteContextUpsertResult): {
    siteContext: SiteAgentContextSummary | null;
    siteContextStatus: SiteAgentContextStatus;
  } {
    return {
      siteContext: result.siteContext,
      siteContextStatus: result.status
    };
  }

  private async withDecisionConflictHandling<T>(operation: () => Promise<T>): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      if (error instanceof IdentificationDecisionConflictError) {
        throw new ApiHttpException(409, "INVALID_REQUEST", "Identificacao ja decidida.");
      }

      throw error;
    }
  }
}
