import { Inject, Injectable } from "@nestjs/common";
import type { Prisma } from "@prisma/client";

import {
  canonicalizeProtocol,
  redactSensitiveText,
  type AiClientIdentificationResult,
  type ClientIdentificationRequest,
  type CustomerCaseSummary,
  type CustomerSummary,
  type PendingClientSummary
} from "@linvo-ai/shared";

import type { AppConfig } from "../config/env.schema";
import { APP_CONFIG } from "../config/env.schema";
import { PrismaService } from "../prisma/prisma.service";
import {
  buildDomSignature,
  buildMaskedIdentifiers,
  hashWithSecret,
  isDecidableConfirmationStatus,
  parseAiIdentificationResult,
  parseCustomerFavoriteFields,
  parseDomSignature,
  parseMaskedIdentifiers,
  resolveIdentity,
  toCaseSummary,
  toCustomerSummary,
  toJsonValue,
  toPendingClient,
  type ConfirmationStatusValue,
  type DomSignature
} from "./identification-domain";

type CustomerPersistenceClient = Pick<
  Prisma.TransactionClient,
  "customer" | "customerCase" | "customerDomPattern" | "identificationRun"
>;

interface ConfirmedIdentificationInput {
  aiResult: AiClientIdentificationResult;
  bulkBatchId?: string;
  bulkItemIndex?: number;
  confirmationStatus: "accepted" | "known";
  domain: string;
  durationMs: number | null;
  existingCustomerId?: string;
  request: ClientIdentificationRequest;
  userId: string;
}

interface ConfirmedGraphInput {
  aiResult: AiClientIdentificationResult;
  domain: string;
  domSignature: DomSignature;
  existingCustomerId?: string;
  userId: string;
}

interface RunWriteInput {
  aiResult: AiClientIdentificationResult;
  bulkBatchId?: string;
  bulkItemIndex?: number;
  confirmationStatus: ConfirmationStatusValue;
  confirmedAt?: Date;
  customerCaseId?: string | null;
  customerId?: string | null;
  domain: string;
  domSignature: DomSignature;
  durationMs: number | null;
  request: ClientIdentificationRequest;
  saved: boolean;
  userId: string;
}

interface CustomerUpdateCaseInput {
  caseId?: string | undefined;
  protocol?: string | undefined;
  status?: string | undefined;
  subject?: string | undefined;
}

interface CustomerUpdateIdentifiersInput {
  document?: string | undefined;
  email?: string | undefined;
  phone?: string | undefined;
  protocol?: string | undefined;
}

type CustomerFavoriteFieldValue = CustomerSummary["favoriteFields"][number];

export class IdentificationDecisionConflictError extends Error {
  constructor() {
    super("Identification run has already been decided.");
  }
}

function cleanOptionalText(value: string | undefined): string | null | undefined {
  if (value === undefined) {
    return undefined;
  }

  const cleaned = value.trim();
  return cleaned || null;
}

function mergeMaskedIdentifiers(
  currentValue: unknown,
  updates: CustomerUpdateIdentifiersInput | undefined
) {
  if (!updates) {
    return undefined;
  }

  const current = parseMaskedIdentifiers(currentValue);
  const next = { ...current };

  for (const key of ["document", "email", "phone", "protocol"] as const) {
    const value = cleanOptionalText(updates[key]);

    if (value === undefined) {
      continue;
    }

    if (value === null) {
      delete next[key];
      continue;
    }

    next[key] = value;
  }

  return next;
}

function mergeAiMaskedIdentifiers(
  currentValue: unknown,
  aiResult: AiClientIdentificationResult
) {
  return {
    ...parseMaskedIdentifiers(currentValue),
    ...buildMaskedIdentifiers(aiResult)
  };
}

function normalizeFavoriteFields(
  fields: CustomerFavoriteFieldValue[] | undefined
): CustomerFavoriteFieldValue[] | undefined {
  if (fields === undefined) {
    return undefined;
  }

  return Array.from(new Set(fields)).slice(0, 2);
}

function hasCaseUpdates(input: CustomerUpdateCaseInput | undefined): input is CustomerUpdateCaseInput {
  return Boolean(
    input &&
      (
        input.caseId ||
        input.protocol !== undefined ||
        input.status !== undefined ||
        input.subject !== undefined
      )
  );
}

@Injectable()
export class CustomerRepository {
  constructor(
    @Inject(APP_CONFIG) private readonly config: AppConfig,
    @Inject(PrismaService)
    private readonly prisma: PrismaService
  ) {}

  canPersistCandidate(aiResult: AiClientIdentificationResult, context: string): boolean {
    return resolveIdentity(aiResult, context).kind !== "unknown";
  }

  toPendingClient(aiResult: AiClientIdentificationResult): PendingClientSummary | null {
    return toPendingClient(aiResult);
  }

  async findExistingCustomer(
    userId: string,
    domain: string,
    aiResult: AiClientIdentificationResult,
    context: string
  ): Promise<CustomerSummary | null> {
    const identity = resolveIdentity(aiResult, context);

    if (identity.kind === "unknown") {
      return null;
    }

    const customer = await this.prisma.customer.findUnique({
      include: {
        cases: {
          orderBy: { lastSeenAt: "desc" },
          take: 5
        }
      },
      where: {
        userId_domain_identityHash: {
          domain,
          identityHash: hashWithSecret(
            this.config.IDENTITY_HASH_SECRET,
            `${identity.kind}:${identity.value}`
          ),
          userId
        }
      }
    });

    return customer ? toCustomerSummary(customer) : null;
  }

  async savePendingIdentification(input: {
    aiResult: AiClientIdentificationResult;
    bulkBatchId?: string;
    bulkItemIndex?: number;
    confirmationStatus: "low_confidence" | "pending_confirmation";
    domain: string;
    durationMs: number;
    request: ClientIdentificationRequest;
    userId: string;
  }): Promise<void> {
    const domSignature = buildDomSignature(input.request, input.aiResult);
    await this.writeRun({
      aiResult: input.aiResult,
      ...(input.bulkBatchId ? { bulkBatchId: input.bulkBatchId } : {}),
      ...(typeof input.bulkItemIndex === "number" ? { bulkItemIndex: input.bulkItemIndex } : {}),
      confirmationStatus: input.confirmationStatus,
      domain: input.domain,
      domSignature,
      durationMs: input.durationMs,
      request: input.request,
      saved: false,
      userId: input.userId
    });
  }

  async saveConfirmedIdentification(input: ConfirmedIdentificationInput): Promise<{
    caseSummary: CustomerCaseSummary | null;
    customerSummary: CustomerSummary | null;
  }> {
    return this.prisma.$transaction(async (transaction) => {
      const domSignature = buildDomSignature(input.request, input.aiResult);
      const { caseSummary, customerSummary } = await this.upsertConfirmedGraph(
        {
          aiResult: input.aiResult,
          domain: input.domain,
          domSignature,
          ...(input.existingCustomerId ? { existingCustomerId: input.existingCustomerId } : {}),
          userId: input.userId
        },
        transaction
      );

      await this.writeRun(
        {
          aiResult: input.aiResult,
          ...(input.bulkBatchId ? { bulkBatchId: input.bulkBatchId } : {}),
          ...(typeof input.bulkItemIndex === "number" ? { bulkItemIndex: input.bulkItemIndex } : {}),
          confirmationStatus: input.confirmationStatus,
          customerCaseId: caseSummary?.id ?? null,
          customerId: customerSummary?.id ?? null,
          domain: input.domain,
          domSignature,
          durationMs: input.durationMs,
          request: input.request,
          saved: Boolean(customerSummary),
          userId: input.userId
        },
        transaction
      );

      return { caseSummary, customerSummary };
    });
  }

  async decidePendingIdentification(input: {
    decision: "accept" | "reject";
    requestId: string;
    userId: string;
  }): Promise<{
    activeClient: CustomerSummary | null;
    domain: string;
    saved: boolean;
  } | null> {
    return this.prisma.$transaction((transaction) =>
      this.decidePendingIdentificationWithClient(transaction, input)
    );
  }

  async decideBulkIdentification(input: {
    acceptRequestIds: string[];
    batchId: string;
    rejectRequestIds: string[];
    userId: string;
  }): Promise<{
    acceptedCount: number;
    domain: string;
    rejectedCount: number;
    savedCustomers: CustomerSummary[];
  } | null> {
    return this.prisma.$transaction(async (transaction) => {
      const runs = await transaction.identificationRun.findMany({
        orderBy: { bulkItemIndex: "asc" },
        where: {
          bulkBatchId: input.batchId,
          userId: input.userId
        }
      });

      if (!runs.length) {
        return null;
      }

      const runIds = new Set(runs.map((run) => run.requestId));
      const acceptIds = new Set(input.acceptRequestIds.filter((requestId) => runIds.has(requestId)));
      const rejectIds = new Set(
        input.rejectRequestIds.filter(
          (requestId) => runIds.has(requestId) && !acceptIds.has(requestId)
        )
      );
      const savedCustomers: CustomerSummary[] = [];
      let acceptedCount = 0;
      let rejectedCount = 0;

      for (const requestId of acceptIds) {
        const decision = await this.decidePendingIdentificationWithClient(transaction, {
          decision: "accept",
          requestId,
          userId: input.userId
        });

        if (decision?.saved && decision.activeClient) {
          savedCustomers.push(decision.activeClient);
          acceptedCount += 1;
        }
      }

      for (const requestId of rejectIds) {
        const decision = await this.decidePendingIdentificationWithClient(transaction, {
          decision: "reject",
          requestId,
          userId: input.userId
        });

        if (decision) {
          rejectedCount += 1;
        }
      }

      return {
        acceptedCount,
        domain: runs[0]?.domain ?? "",
        rejectedCount,
        savedCustomers
      };
    });
  }

  async listRecentCustomers(userId: string, domain?: string): Promise<CustomerSummary[]> {
    const customers = await this.prisma.customer.findMany({
      include: {
        cases: {
          orderBy: { lastSeenAt: "desc" },
          take: 5
        }
      },
      orderBy: [
        { isStarred: "desc" },
        { lastSeenAt: "desc" }
      ],
      take: 100,
      where: {
        ...(domain ? { domain } : {}),
        userId
      }
    });

    return customers.map((customer) => toCustomerSummary(customer));
  }

  async getCustomerDetail(input: {
    customerId: string;
    userId: string;
  }): Promise<CustomerSummary | null> {
    const customer = await this.prisma.customer.findFirst({
      include: {
        cases: {
          orderBy: { lastSeenAt: "desc" },
          take: 5
        }
      },
      where: {
        id: input.customerId,
        userId: input.userId
      }
    });

    return customer ? toCustomerSummary(customer) : null;
  }

  async updateCustomer(input: {
    case?: CustomerUpdateCaseInput;
    customerId: string;
    displayName?: string;
    favoriteFields?: CustomerFavoriteFieldValue[];
    isStarred?: boolean;
    maskedIdentifiers?: CustomerUpdateIdentifiersInput;
    notes?: string;
    userId: string;
  }): Promise<{ customer: CustomerSummary; domain: string } | null> {
    const customer = await this.prisma.customer.findFirst({
      select: {
        domain: true,
        id: true,
        maskedIdentifiers: true
      },
      where: {
        id: input.customerId,
        userId: input.userId
      }
    });

    if (!customer) {
      return null;
    }

    const maskedIdentifiers = mergeMaskedIdentifiers(
      customer.maskedIdentifiers,
      input.maskedIdentifiers
    );
    const favoriteFields = normalizeFavoriteFields(input.favoriteFields);
    const updated = await this.prisma.$transaction(async (transaction) => {
      const data: Prisma.CustomerUpdateInput = {};

      if (hasCaseUpdates(input.case)) {
        await this.updateCustomerCase(transaction, {
          customerId: customer.id,
          domain: customer.domain,
          input: input.case,
          userId: input.userId
        });
      }

      if (input.displayName !== undefined) {
        const displayName = cleanOptionalText(input.displayName);

        if (displayName !== undefined) {
          data.displayName = displayName;
        }
      }

      if (maskedIdentifiers !== undefined) {
        data.maskedIdentifiers = toJsonValue(maskedIdentifiers);
      }

      if (favoriteFields !== undefined) {
        data.favoriteFieldsJson = toJsonValue(parseCustomerFavoriteFields(favoriteFields));
      }

      if (input.isStarred !== undefined) {
        data.isStarred = input.isStarred;
      }

      if (input.notes !== undefined) {
        data.notes = input.notes.trim() || null;
      }

      await transaction.customer.update({
        data,
        where: { id: customer.id }
      });

      return transaction.customer.findUniqueOrThrow({
        include: {
          cases: {
            orderBy: { lastSeenAt: "desc" },
            take: 5
          }
        },
        where: { id: customer.id }
      });
    });

    return {
      customer: toCustomerSummary(updated),
      domain: updated.domain
    };
  }

  private async updateCustomerCase(
    client: Pick<Prisma.TransactionClient, "customerCase">,
    input: {
      customerId: string;
      domain: string;
      input: CustomerUpdateCaseInput;
      userId: string;
    }
  ): Promise<void> {
    const protocolDisplay = cleanOptionalText(input.input.protocol);
    const statusDisplay = cleanOptionalText(input.input.status);
    const subjectDisplay = cleanOptionalText(input.input.subject);

    if (input.input.caseId) {
      const existing = await client.customerCase.findFirst({
        select: { id: true },
        where: {
          customerId: input.customerId,
          id: input.input.caseId,
          userId: input.userId
        }
      });

      if (!existing) {
        return;
      }

      await client.customerCase.update({
        data: {
          ...(protocolDisplay !== undefined ? { protocolDisplay } : {}),
          ...(statusDisplay !== undefined ? { statusDisplay } : {}),
          ...(subjectDisplay !== undefined ? { subjectDisplay } : {})
        },
        where: { id: existing.id }
      });
      return;
    }

    const caseKey = [
      protocolDisplay,
      subjectDisplay,
      statusDisplay,
      input.customerId
    ].find((value) => value && value.trim()) ?? input.customerId;
    const caseHash = hashWithSecret(this.config.IDENTITY_HASH_SECRET, caseKey);

    await client.customerCase.upsert({
      create: {
        caseHash,
        caseKind: protocolDisplay ? "protocol" : "subject_context",
        confidence: 1,
        customerId: input.customerId,
        domain: input.domain,
        lastSeenAt: new Date(),
        protocolDisplay: protocolDisplay ?? null,
        statusDisplay: statusDisplay ?? null,
        subjectDisplay: subjectDisplay ?? null,
        userId: input.userId
      },
      update: {
        customerId: input.customerId,
        ...(protocolDisplay !== undefined ? { protocolDisplay } : {}),
        ...(statusDisplay !== undefined ? { statusDisplay } : {}),
        ...(subjectDisplay !== undefined ? { subjectDisplay } : {})
      },
      where: {
        userId_domain_caseHash: {
          caseHash,
          domain: input.domain,
          userId: input.userId
        }
      }
    });
  }

  async deleteCustomer(input: {
    customerId: string;
    userId: string;
  }): Promise<{ domain: string } | null> {
    const customer = await this.prisma.customer.findFirst({
      select: { domain: true, id: true },
      where: {
        id: input.customerId,
        userId: input.userId
      }
    });

    if (!customer) {
      return null;
    }

    await this.prisma.customer.delete({
      where: { id: customer.id }
    });

    return { domain: customer.domain };
  }

  private async decidePendingIdentificationWithClient(
    client: CustomerPersistenceClient,
    input: {
      decision: "accept" | "reject";
      requestId: string;
      userId: string;
    }
  ): Promise<{
    activeClient: CustomerSummary | null;
    domain: string;
    saved: boolean;
  } | null> {
    const run = await client.identificationRun.findUnique({
      where: {
        userId_requestId: {
          requestId: input.requestId,
          userId: input.userId
        }
      }
    });

    if (!run) {
      return null;
    }

    if (!isDecidableConfirmationStatus(run.confirmationStatus)) {
      throw new IdentificationDecisionConflictError();
    }

    const confirmedAt = new Date();
    const updated = await client.identificationRun.updateMany({
      data: {
        confirmationStatus: input.decision === "reject" ? "rejected" : "accepted",
        confirmedAt,
        saved: false
      },
      where: {
        confirmationStatus: { in: ["low_confidence", "pending_confirmation"] },
        id: run.id
      }
    });

    if (updated.count !== 1) {
      throw new IdentificationDecisionConflictError();
    }

    if (input.decision === "reject") {
      return {
        activeClient: null,
        domain: run.domain,
        saved: false
      };
    }

    const aiResult = parseAiIdentificationResult(run.candidateJson);
    const domSignature = parseDomSignature(run.domSignatureJson);
    const { caseSummary, customerSummary } = await this.upsertConfirmedGraph(
      {
        aiResult,
        domain: run.domain,
        domSignature,
        userId: input.userId
      },
      client
    );

    await client.identificationRun.update({
      data: {
        customerCaseId: caseSummary?.id ?? null,
        customerId: customerSummary?.id ?? null,
        saved: Boolean(customerSummary)
      },
      where: { id: run.id }
    });

    return {
      activeClient: customerSummary,
      domain: run.domain,
      saved: Boolean(customerSummary)
    };
  }

  private async upsertConfirmedGraph(
    input: ConfirmedGraphInput,
    client: CustomerPersistenceClient
  ): Promise<{
    caseSummary: CustomerCaseSummary | null;
    customerSummary: CustomerSummary | null;
  }> {
    const activeClient = input.aiResult.activeClient;

    if (!activeClient) {
      return { caseSummary: null, customerSummary: null };
    }

    const identity = resolveIdentity(input.aiResult, input.domSignature.anchorText ?? "");
    const existingCustomerId = input.existingCustomerId;

    if (identity.kind === "unknown" && !existingCustomerId) {
      return { caseSummary: null, customerSummary: null };
    }

    const identityValue = identity.kind === "unknown"
      ? existingCustomerId!
      : identity.value;
    const now = new Date();
    const customer = existingCustomerId
      ? await (async () => {
          const existing = await client.customer.findFirst({
            where: {
              domain: input.domain,
              id: existingCustomerId,
              userId: input.userId
            }
          });

          if (!existing) {
            return null;
          }

          return client.customer.update({
            data: {
              confidence: input.aiResult.confidence,
              displayName: activeClient.name ?? existing.displayName,
              lastSeenAt: now,
              maskedIdentifiers: toJsonValue(
                mergeAiMaskedIdentifiers(existing.maskedIdentifiers, input.aiResult)
              )
            },
            where: { id: existing.id }
          });
        })()
      : await (async () => {
          if (identity.kind === "unknown") {
            return null;
          }

          const identityHash = hashWithSecret(
            this.config.IDENTITY_HASH_SECRET,
            `${identity.kind}:${identity.value}`
          );
          const existing = await client.customer.findUnique({
            where: {
              userId_domain_identityHash: {
                domain: input.domain,
                identityHash,
                userId: input.userId
              }
            }
          });

          if (existing) {
            return client.customer.update({
              data: {
                confidence: input.aiResult.confidence,
                displayName: activeClient.name ?? existing.displayName,
                lastSeenAt: now,
                maskedIdentifiers: toJsonValue(
                  mergeAiMaskedIdentifiers(existing.maskedIdentifiers, input.aiResult)
                )
              },
              where: { id: existing.id }
            });
          }

          return client.customer.create({
            data: {
              confidence: input.aiResult.confidence,
              displayName: activeClient.name ?? null,
              domain: input.domain,
              identityHash,
              identityKind: identity.kind,
              lastSeenAt: now,
              maskedIdentifiers: toJsonValue(buildMaskedIdentifiers(input.aiResult)),
              userId: input.userId
            }
          });
        })();

    if (!customer) {
      return {
        caseSummary: null,
        customerSummary: null
      };
    }

    const customerSummary = toCustomerSummary({ ...customer, cases: [] });
    const caseSummary = await this.upsertCase(input, customer.id, identityValue, client);
    await this.upsertDomPattern(input, customer.id, client);

    if (caseSummary) {
      customerSummary.cases = [caseSummary];
    }

    return { caseSummary, customerSummary };
  }

  private async upsertCase(
    input: ConfirmedGraphInput,
    customerId: string,
    identityValue: string,
    client: CustomerPersistenceClient
  ): Promise<CustomerCaseSummary | null> {
    const protocol = canonicalizeProtocol(input.aiResult.case?.protocol ?? undefined);
    const subject = input.aiResult.case?.subject?.trim();
    const caseKey = protocol ?? (subject ? `${identityValue}:${subject.toLowerCase()}` : null);

    if (!caseKey) {
      return null;
    }

    const caseHash = hashWithSecret(this.config.IDENTITY_HASH_SECRET, caseKey);
    const customerCase = await client.customerCase.upsert({
      create: {
        caseHash,
        caseKind: protocol ? "protocol" : "subject_context",
        confidence: input.aiResult.confidence,
        customerId,
        domain: input.domain,
        lastSeenAt: new Date(),
        protocolDisplay: input.aiResult.case?.protocol ?? null,
        statusDisplay: input.aiResult.case?.status ?? null,
        subjectDisplay: subject ?? null,
        userId: input.userId
      },
      update: {
        confidence: input.aiResult.confidence,
        customerId,
        lastSeenAt: new Date(),
        protocolDisplay: input.aiResult.case?.protocol ?? null,
        statusDisplay: input.aiResult.case?.status ?? null,
        subjectDisplay: subject ?? null
      },
      where: {
        userId_domain_caseHash: {
          caseHash,
          domain: input.domain,
          userId: input.userId
        }
      }
    });

    return toCaseSummary(customerCase);
  }

  private async upsertDomPattern(
    input: ConfirmedGraphInput,
    customerId: string,
    client: CustomerPersistenceClient
  ): Promise<void> {
    const patternHash = hashWithSecret(
      this.config.IDENTITY_HASH_SECRET,
      JSON.stringify({
        anchorText: input.domSignature.anchorText ?? "",
        domain: input.domain,
        identifierText: input.domSignature.identifierText ?? "",
        nameText: input.domSignature.nameText ?? "",
        selectedTag: input.domSignature.selectedTag,
        tokens: input.domSignature.tokens.slice(0, 8)
      })
    );

    await client.customerDomPattern.upsert({
      create: {
        anchorText: input.domSignature.anchorText ?? null,
        customerId,
        domain: input.domain,
        identifierText: input.domSignature.identifierText ?? null,
        lastSeenAt: new Date(),
        nameText: input.domSignature.nameText ?? null,
        patternHash,
        signatureJson: toJsonValue(input.domSignature),
        userId: input.userId
      },
      update: {
        anchorText: input.domSignature.anchorText ?? null,
        customerId,
        identifierText: input.domSignature.identifierText ?? null,
        lastSeenAt: new Date(),
        nameText: input.domSignature.nameText ?? null,
        signatureJson: toJsonValue(input.domSignature)
      },
      where: {
        userId_domain_patternHash: {
          domain: input.domain,
          patternHash,
          userId: input.userId
        }
      }
    });
  }

  private async writeRun(
    input: RunWriteInput,
    client: CustomerPersistenceClient = this.prisma
  ): Promise<void> {
    const selectedLabel = input.domSignature.anchorText?.slice(0, 160) ?? null;

    await client.identificationRun.upsert({
      create: {
        bulkBatchId: input.bulkBatchId ?? null,
        bulkItemIndex: input.bulkItemIndex ?? null,
        candidateJson: toJsonValue(input.aiResult),
        confidence: input.aiResult.confidence,
        confirmationStatus: input.confirmationStatus,
        confirmedAt: input.confirmedAt ?? null,
        customerCaseId: input.customerCaseId ?? null,
        customerId: input.customerId ?? null,
        domSignatureJson: toJsonValue(input.domSignature),
        domain: input.domain,
        durationMs: input.durationMs,
        evidenceJson: toJsonValue(input.aiResult.evidence.map(redactSensitiveText)),
        pageUrlHash: hashWithSecret(this.config.IDENTITY_HASH_SECRET, input.request.url),
        requestId: input.request.requestId,
        saved: input.saved,
        selectedLabel,
        userId: input.userId,
        warningsJson: toJsonValue(input.aiResult.warnings.map(redactSensitiveText))
      },
      update: {
        bulkBatchId: input.bulkBatchId ?? null,
        bulkItemIndex: input.bulkItemIndex ?? null,
        candidateJson: toJsonValue(input.aiResult),
        confidence: input.aiResult.confidence,
        confirmationStatus: input.confirmationStatus,
        confirmedAt: input.confirmedAt ?? null,
        customerCaseId: input.customerCaseId ?? null,
        customerId: input.customerId ?? null,
        domSignatureJson: toJsonValue(input.domSignature),
        durationMs: input.durationMs,
        evidenceJson: toJsonValue(input.aiResult.evidence.map(redactSensitiveText)),
        saved: input.saved,
        selectedLabel,
        warningsJson: toJsonValue(input.aiResult.warnings.map(redactSensitiveText))
      },
      where: {
        userId_requestId: {
          requestId: input.request.requestId,
          userId: input.userId
        }
      }
    });
  }
}
