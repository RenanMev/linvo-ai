import { Inject, Injectable } from "@nestjs/common";
import { createHmac } from "node:crypto";

import {
  aiClientIdentificationResultSchema,
  canonicalizeProtocol,
  chooseCanonicalIdentity,
  maskDocument,
  maskEmail,
  maskPhone,
  redactSensitiveText,
  type AiClientIdentificationResult,
  type ClientIdentificationRequest,
  type CustomerCaseSummary,
  type CustomerSummary,
  type MaskedIdentifiers,
  type PendingClientSummary
} from "@linvo-ai/shared";

import type { AppConfig } from "../config/env.schema";
import { APP_CONFIG } from "../config/env.schema";
import { PrismaService } from "../prisma/prisma.service";

interface DomSignature {
  anchorText?: string;
  ariaLabel?: string;
  candidateLabels: string[];
  identifierText?: string;
  nameText?: string;
  nearbyHeadings: string[];
  selectedRole?: string;
  selectedTag: string;
  tokens: string[];
}

interface ConfirmedIdentificationInput {
  aiResult: AiClientIdentificationResult;
  bulkBatchId?: string;
  bulkItemIndex?: number;
  confirmationStatus: "accepted" | "known";
  domain: string;
  durationMs: number | null;
  request: ClientIdentificationRequest;
  userId: string;
}

interface ConfirmedGraphInput {
  aiResult: AiClientIdentificationResult;
  domain: string;
  domSignature: DomSignature;
  userId: string;
}

interface RunWriteInput {
  aiResult: AiClientIdentificationResult;
  bulkBatchId?: string;
  bulkItemIndex?: number;
  confirmationStatus: string;
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

function hashWithSecret(secret: string, value: string): string {
  return createHmac("sha256", secret).update(value).digest("base64url");
}

function toIso(value: Date): string {
  return value.toISOString();
}

function compact(value: string | null | undefined, max: number): string | undefined {
  const cleaned = redactSensitiveText(value ?? "").replace(/\s+/g, " ").trim();
  return cleaned ? cleaned.slice(0, max) : undefined;
}

function extractTokens(values: Array<string | undefined>): string[] {
  const seen = new Set<string>();
  const tokens: string[] = [];

  for (const value of values) {
    const matches = value?.match(/[\p{L}\p{N}][\p{L}\p{N}._-]{2,}/gu) ?? [];

    for (const match of matches) {
      const token = match.trim();
      const key = token.toLowerCase();

      if (!seen.has(key)) {
        seen.add(key);
        tokens.push(token.slice(0, 60));
      }

      if (tokens.length >= 18) {
        return tokens;
      }
    }
  }

  return tokens;
}

function firstValue(values: Array<string | undefined>): string | undefined {
  return values.find((value) => value && value.trim());
}

@Injectable()
export class CustomerRepository {
  constructor(
    @Inject(APP_CONFIG) private readonly config: AppConfig,
    @Inject(PrismaService)
    private readonly prisma: PrismaService
  ) {}

  canPersistCandidate(aiResult: AiClientIdentificationResult, context: string): boolean {
    return this.resolveIdentity(aiResult, context).kind !== "unknown";
  }

  toPendingClient(aiResult: AiClientIdentificationResult): PendingClientSummary | null {
    if (!aiResult.activeClient) {
      return null;
    }

    const maskedIdentifiers = this.buildMaskedIdentifiers(aiResult);
    const pendingCase = aiResult.case
      ? {
          ...(aiResult.case.protocol ? { protocol: aiResult.case.protocol } : {}),
          ...(aiResult.case.status ? { status: aiResult.case.status } : {}),
          ...(aiResult.case.subject ? { subject: aiResult.case.subject } : {})
        }
      : null;

    return {
      case: pendingCase && Object.keys(pendingCase).length ? pendingCase : null,
      ...(aiResult.activeClient.name ? { displayName: aiResult.activeClient.name } : {}),
      maskedIdentifiers
    };
  }

  async findExistingCustomer(
    userId: string,
    domain: string,
    aiResult: AiClientIdentificationResult,
    context: string
  ): Promise<CustomerSummary | null> {
    const identity = this.resolveIdentity(aiResult, context);

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

    return customer ? this.toCustomerSummary(customer) : null;
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
    const domSignature = this.buildDomSignature(input.request, input.aiResult);
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
    const domSignature = this.buildDomSignature(input.request, input.aiResult);
    const { caseSummary, customerSummary } = await this.upsertConfirmedGraph({
      aiResult: input.aiResult,
      domain: input.domain,
      domSignature,
      userId: input.userId
    });

    await this.writeRun({
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
    });

    return { caseSummary, customerSummary };
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
    const run = await this.prisma.identificationRun.findUnique({
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

    if (input.decision === "reject") {
      await this.prisma.identificationRun.update({
        data: {
          confirmationStatus: "rejected",
          confirmedAt: new Date(),
          saved: false
        },
        where: {
          userId_requestId: {
            requestId: input.requestId,
            userId: input.userId
          }
        }
      });

      return {
        activeClient: null,
        domain: run.domain,
        saved: false
      };
    }

    const aiResult = aiClientIdentificationResultSchema.parse(run.candidateJson);
    const domSignature = this.parseDomSignature(run.domSignatureJson);
    const { caseSummary, customerSummary } = await this.upsertConfirmedGraph({
      aiResult,
      domain: run.domain,
      domSignature,
      userId: input.userId
    });

    await this.prisma.identificationRun.update({
      data: {
        confirmationStatus: "accepted",
        confirmedAt: new Date(),
        customerCaseId: caseSummary?.id ?? null,
        customerId: customerSummary?.id ?? null,
        saved: Boolean(customerSummary)
      },
      where: {
        userId_requestId: {
          requestId: input.requestId,
          userId: input.userId
        }
      }
    });

    return {
      activeClient: customerSummary,
      domain: run.domain,
      saved: Boolean(customerSummary)
    };
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
    const runs = await this.prisma.identificationRun.findMany({
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
      const decision = await this.decidePendingIdentification({
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
      const decision = await this.decidePendingIdentification({
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
  }

  async listRecentCustomers(userId: string, domain: string): Promise<CustomerSummary[]> {
    const customers = await this.prisma.customer.findMany({
      include: {
        cases: {
          orderBy: { lastSeenAt: "desc" },
          take: 5
        }
      },
      orderBy: { lastSeenAt: "desc" },
      take: 20,
      where: { domain, userId }
    });

    return customers.map((customer) => this.toCustomerSummary(customer));
  }

  private async upsertConfirmedGraph(input: ConfirmedGraphInput): Promise<{
    caseSummary: CustomerCaseSummary | null;
    customerSummary: CustomerSummary | null;
  }> {
    if (!input.aiResult.activeClient) {
      return { caseSummary: null, customerSummary: null };
    }

    const identity = this.resolveIdentity(input.aiResult, input.domSignature.anchorText ?? "");

    if (identity.kind === "unknown") {
      return { caseSummary: null, customerSummary: null };
    }

    const identityHash = hashWithSecret(
      this.config.IDENTITY_HASH_SECRET,
      `${identity.kind}:${identity.value}`
    );
    const maskedIdentifiers = this.buildMaskedIdentifiers(input.aiResult);
    const customer = await this.prisma.customer.upsert({
      create: {
        confidence: input.aiResult.confidence,
        displayName: input.aiResult.activeClient.name ?? null,
        domain: input.domain,
        identityHash,
        identityKind: identity.kind,
        lastSeenAt: new Date(),
        maskedIdentifiers,
        userId: input.userId
      },
      update: {
        confidence: input.aiResult.confidence,
        displayName: input.aiResult.activeClient.name ?? null,
        lastSeenAt: new Date(),
        maskedIdentifiers
      },
      where: {
        userId_domain_identityHash: {
          domain: input.domain,
          identityHash,
          userId: input.userId
        }
      }
    });

    const customerSummary = this.toCustomerSummary({ ...customer, cases: [] });
    const caseSummary = await this.upsertCase(input, customer.id, identity.value);
    await this.upsertDomPattern(input, customer.id);

    if (caseSummary) {
      customerSummary.cases = [caseSummary];
    }

    return { caseSummary, customerSummary };
  }

  private async upsertCase(
    input: ConfirmedGraphInput,
    customerId: string,
    identityValue: string
  ): Promise<CustomerCaseSummary | null> {
    const protocol = canonicalizeProtocol(input.aiResult.case?.protocol ?? undefined);
    const subject = input.aiResult.case?.subject?.trim();
    const caseKey = protocol ?? (subject ? `${identityValue}:${subject.toLowerCase()}` : null);

    if (!caseKey) {
      return null;
    }

    const customerCase = await this.prisma.customerCase.upsert({
      create: {
        caseHash: hashWithSecret(this.config.IDENTITY_HASH_SECRET, caseKey),
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
          caseHash: hashWithSecret(this.config.IDENTITY_HASH_SECRET, caseKey),
          domain: input.domain,
          userId: input.userId
        }
      }
    });

    return this.toCaseSummary(customerCase);
  }

  private async upsertDomPattern(input: ConfirmedGraphInput, customerId: string): Promise<void> {
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

    await this.prisma.customerDomPattern.upsert({
      create: {
        anchorText: input.domSignature.anchorText ?? null,
        customerId,
        domain: input.domain,
        identifierText: input.domSignature.identifierText ?? null,
        lastSeenAt: new Date(),
        nameText: input.domSignature.nameText ?? null,
        patternHash,
        signatureJson: input.domSignature as any,
        userId: input.userId
      },
      update: {
        anchorText: input.domSignature.anchorText ?? null,
        customerId,
        identifierText: input.domSignature.identifierText ?? null,
        lastSeenAt: new Date(),
        nameText: input.domSignature.nameText ?? null,
        signatureJson: input.domSignature as any
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

  private async writeRun(input: RunWriteInput): Promise<void> {
    const selectedLabel = input.domSignature.anchorText?.slice(0, 160) ?? null;

    await this.prisma.identificationRun.upsert({
      create: {
        bulkBatchId: input.bulkBatchId ?? null,
        bulkItemIndex: input.bulkItemIndex ?? null,
        candidateJson: input.aiResult as any,
        confidence: input.aiResult.confidence,
        confirmationStatus: input.confirmationStatus,
        confirmedAt: input.confirmedAt ?? null,
        customerCaseId: input.customerCaseId ?? null,
        customerId: input.customerId ?? null,
        domSignatureJson: input.domSignature as any,
        domain: input.domain,
        durationMs: input.durationMs,
        evidenceJson: input.aiResult.evidence.map(redactSensitiveText),
        pageUrlHash: hashWithSecret(this.config.IDENTITY_HASH_SECRET, input.request.url),
        requestId: input.request.requestId,
        saved: input.saved,
        selectedLabel,
        userId: input.userId,
        warningsJson: input.aiResult.warnings.map(redactSensitiveText)
      },
      update: {
        bulkBatchId: input.bulkBatchId ?? null,
        bulkItemIndex: input.bulkItemIndex ?? null,
        candidateJson: input.aiResult as any,
        confidence: input.aiResult.confidence,
        confirmationStatus: input.confirmationStatus,
        confirmedAt: input.confirmedAt ?? null,
        customerCaseId: input.customerCaseId ?? null,
        customerId: input.customerId ?? null,
        domSignatureJson: input.domSignature as any,
        durationMs: input.durationMs,
        evidenceJson: input.aiResult.evidence.map(redactSensitiveText),
        saved: input.saved,
        selectedLabel,
        warningsJson: input.aiResult.warnings.map(redactSensitiveText)
      } as any,
      where: {
        userId_requestId: {
          requestId: input.request.requestId,
          userId: input.userId
        }
      }
    });
  }

  private buildDomSignature(
    request: ClientIdentificationRequest,
    aiResult: AiClientIdentificationResult
  ): DomSignature {
    const maskedIdentifiers = this.buildMaskedIdentifiers(aiResult);
    const anchorText = compact(request.manualSelection.label ?? request.selectedText, 240);
    const nameText = compact(aiResult.activeClient?.name ?? request.manualSelection.label, 160);
    const identifierText = compact(
      firstValue([
        maskedIdentifiers.protocol,
        maskedIdentifiers.phone,
        maskedIdentifiers.email,
        maskedIdentifiers.document
      ]),
      160
    );
    const candidateLabels = (request.domSummary?.candidateLabels ?? [])
      .map((value) => compact(value, 160))
      .filter((value): value is string => Boolean(value))
      .slice(0, 12);
    const nearbyHeadings = (request.domSummary?.nearbyHeadings ?? [])
      .map((value) => compact(value, 160))
      .filter((value): value is string => Boolean(value))
      .slice(0, 12);

    return {
      ...(anchorText ? { anchorText } : {}),
      ...(request.domSummary?.ariaLabel ? { ariaLabel: request.domSummary.ariaLabel } : {}),
      candidateLabels,
      ...(identifierText ? { identifierText } : {}),
      ...(nameText ? { nameText } : {}),
      nearbyHeadings,
      ...(request.domSummary?.selectedRole ? { selectedRole: request.domSummary.selectedRole } : {}),
      selectedTag: request.domSummary?.selectedTag ?? "unknown",
      tokens: extractTokens([
        anchorText,
        nameText,
        identifierText,
        ...candidateLabels,
        ...nearbyHeadings
      ])
    };
  }

  private parseDomSignature(value: unknown): DomSignature {
    const raw = typeof value === "object" && value !== null ? value as Record<string, unknown> : {};

    return {
      ...(typeof raw.anchorText === "string" ? { anchorText: raw.anchorText } : {}),
      ...(typeof raw.ariaLabel === "string" ? { ariaLabel: raw.ariaLabel } : {}),
      candidateLabels: Array.isArray(raw.candidateLabels)
        ? raw.candidateLabels.filter((item): item is string => typeof item === "string")
        : [],
      ...(typeof raw.identifierText === "string" ? { identifierText: raw.identifierText } : {}),
      ...(typeof raw.nameText === "string" ? { nameText: raw.nameText } : {}),
      nearbyHeadings: Array.isArray(raw.nearbyHeadings)
        ? raw.nearbyHeadings.filter((item): item is string => typeof item === "string")
        : [],
      ...(typeof raw.selectedRole === "string" ? { selectedRole: raw.selectedRole } : {}),
      selectedTag: typeof raw.selectedTag === "string" ? raw.selectedTag : "unknown",
      tokens: Array.isArray(raw.tokens)
        ? raw.tokens.filter((item): item is string => typeof item === "string")
        : []
    };
  }

  private resolveIdentity(aiResult: AiClientIdentificationResult, context: string) {
    return chooseCanonicalIdentity({
      context: redactSensitiveText(context),
      ...(aiResult.activeClient?.identifiers.document
        ? { document: aiResult.activeClient.identifiers.document }
        : {}),
      ...(aiResult.activeClient?.identifiers.email
        ? { email: aiResult.activeClient.identifiers.email }
        : {}),
      ...(aiResult.activeClient?.name ? { name: aiResult.activeClient.name } : {}),
      ...(aiResult.activeClient?.identifiers.phone
        ? { phone: aiResult.activeClient.identifiers.phone }
        : {}),
      ...(aiResult.case?.protocol ? { protocol: aiResult.case.protocol } : {})
    });
  }

  private buildMaskedIdentifiers(aiResult: AiClientIdentificationResult): MaskedIdentifiers {
    const document = maskDocument(aiResult.activeClient?.identifiers.document);
    const email = maskEmail(aiResult.activeClient?.identifiers.email);
    const phone = maskPhone(aiResult.activeClient?.identifiers.phone);

    return {
      ...(document ? { document } : {}),
      ...(email ? { email } : {}),
      ...(phone ? { phone } : {}),
      ...(aiResult.case?.protocol ? { protocol: aiResult.case.protocol } : {})
    };
  }

  private toCustomerSummary(customer: {
    cases: Array<{
      id: string;
      lastSeenAt: Date;
      protocolDisplay: string | null;
      statusDisplay: string | null;
      subjectDisplay: string | null;
    }>;
    displayName: string | null;
    id: string;
    lastSeenAt: Date;
    maskedIdentifiers: unknown;
  }): CustomerSummary {
    return {
      cases: customer.cases.map((customerCase) => this.toCaseSummary(customerCase)),
      ...(customer.displayName ? { displayName: customer.displayName } : {}),
      id: customer.id,
      lastSeenAt: toIso(customer.lastSeenAt),
      maskedIdentifiers: customer.maskedIdentifiers as MaskedIdentifiers
    };
  }

  private toCaseSummary(customerCase: {
    id: string;
    lastSeenAt: Date;
    protocolDisplay: string | null;
    statusDisplay: string | null;
    subjectDisplay: string | null;
  }): CustomerCaseSummary {
    return {
      id: customerCase.id,
      lastSeenAt: toIso(customerCase.lastSeenAt),
      ...(customerCase.protocolDisplay ? { protocol: customerCase.protocolDisplay } : {}),
      ...(customerCase.statusDisplay ? { status: customerCase.statusDisplay } : {}),
      ...(customerCase.subjectDisplay ? { subject: customerCase.subjectDisplay } : {})
    };
  }
}
