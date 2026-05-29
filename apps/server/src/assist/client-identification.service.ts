import { Inject, Injectable } from "@nestjs/common";

import {
  bulkClientIdentificationDecisionResponseSchema,
  bulkClientIdentificationResponseSchema,
  clientIdentificationDecisionResponseSchema,
  clientIdentificationSuccessResponseSchema,
  type BulkClientIdentificationCandidate,
  type BulkClientIdentificationDecisionRequest,
  type BulkClientIdentificationDecisionResponse,
  type BulkClientIdentificationRequest,
  type BulkClientIdentificationResponse,
  type ClientIdentificationDecisionRequest,
  type ClientIdentificationDecisionResponse,
  type ClientIdentificationRequest,
  type ClientIdentificationSuccessResponse
} from "@linvo-ai/shared";

import { AiClientService } from "../ai/ai-client.service";
import type { AppConfig } from "../config/env.schema";
import { APP_CONFIG } from "../config/env.schema";
import { ApiHttpException } from "../http-error";
import { parseBulkIdentificationItems } from "./bulk-identification.parser";
import { CustomerRepository } from "./customer.repository";

@Injectable()
export class ClientIdentificationService {
  constructor(
    @Inject(AiClientService)
    private readonly aiClient: AiClientService,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
    @Inject(CustomerRepository)
    private readonly customerRepository: CustomerRepository
  ) {}

  async identify(
    userId: string,
    request: ClientIdentificationRequest
  ): Promise<ClientIdentificationSuccessResponse> {
    const startedAt = Date.now();
    const domain = new URL(request.url).hostname;
    const aiResult = await this.aiClient.identifyClient(request);
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
    const recentCustomers = await this.customerRepository.listRecentCustomers(userId, domain);

    if (!confident || !this.customerRepository.canPersistCandidate(finalResult, request.selectedText)) {
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
        status: "ok",
        warnings: finalResult.warnings
      });
    }

    const existingCustomer = await this.customerRepository.findExistingCustomer(
      userId,
      domain,
      finalResult,
      request.selectedText
    );

    if (existingCustomer) {
      const { caseSummary, customerSummary } =
        await this.customerRepository.saveConfirmedIdentification({
          aiResult: finalResult,
          confirmationStatus: "known",
          domain,
          durationMs: Date.now() - startedAt,
          request,
          userId
        });
      const updatedRecentCustomers = await this.customerRepository.listRecentCustomers(userId, domain);

      return clientIdentificationSuccessResponseSchema.parse({
        activeClient: customerSummary ?? existingCustomer,
        case: caseSummary,
        confidence: finalResult.confidence,
        domain,
        evidence: finalResult.evidence,
        pendingClient: null,
        recentCustomers: updatedRecentCustomers,
        requestId: request.requestId,
        saveState: "known",
        saved: true,
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
      status: "ok",
      warnings: finalResult.warnings
    });
  }

  async decide(
    userId: string,
    request: ClientIdentificationDecisionRequest
  ): Promise<ClientIdentificationDecisionResponse> {
    const decision = await this.customerRepository.decidePendingIdentification({
      decision: request.decision,
      requestId: request.requestId,
      userId
    });

    if (!decision) {
      throw new ApiHttpException(404, "INVALID_REQUEST", "Identificacao pendente nao encontrada.");
    }

    const recentCustomers = await this.customerRepository.listRecentCustomers(
      userId,
      decision.domain
    );

    return clientIdentificationDecisionResponseSchema.parse({
      activeClient: decision.activeClient,
      decision: request.decision,
      domain: decision.domain,
      recentCustomers,
      requestId: request.requestId,
      saved: decision.saved,
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
    const decision = await this.customerRepository.decideBulkIdentification({
      acceptRequestIds: request.acceptRequestIds,
      batchId: request.batchId,
      rejectRequestIds: request.rejectRequestIds,
      userId
    });

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

  async listCustomers(userId: string, domain: string) {
    return {
      customers: await this.customerRepository.listRecentCustomers(userId, domain),
      domain,
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
}
