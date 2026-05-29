import type {
  AiClientIdentificationResult,
  BulkClientIdentificationRequest,
  ClientIdentificationRequest,
  CustomerSummary,
  PendingClientSummary
} from "@linvo-ai/shared";

import { ClientIdentificationService } from "../src/assist/client-identification.service";
import type { AppConfig } from "../src/config/env.schema";

const config: AppConfig = {
  AI_BASE_URL: "https://example.test",
  AI_MODEL: "test-model",
  DATABASE_URL: "postgresql://example",
  IDENTIFICATION_CONFIDENCE_MIN: 0.72,
  IDENTITY_HASH_SECRET: "identity-secret-for-tests",
  JWT_ACCESS_SECRET: "access-secret-for-tests",
  JWT_REFRESH_SECRET: "refresh-secret-for-tests",
  PASSWORD_PEPPER: "password-pepper-for-tests",
  PORT: 8791
};

const request: ClientIdentificationRequest = {
  capturedAt: new Date().toISOString(),
  domSummary: {
    candidateLabels: ["Davi - 140987001 - Tier A"],
    nearbyHeadings: ["Atendimento"],
    selectedTag: "div"
  },
  manualSelection: {
    label: "Davi - 140987001 - Tier A",
    selectedAt: new Date().toISOString(),
    source: "user",
    textExcerpt: "Davi - 140987001 - Tier A"
  },
  pageTitle: "Painel Nvoip",
  requestId: "req-1",
  selectedText: "Davi - 140987001 - Tier A",
  url: "https://painel.nvoip.com.br/service/140987001"
};

const aiResult: AiClientIdentificationResult = {
  activeClient: {
    identifiers: {},
    name: "Davi"
  },
  case: {
    protocol: "140987001",
    status: "Tier A",
    subject: "Atendimento"
  },
  confidence: 0.91,
  evidence: ["Nome e protocolo visiveis no header."],
  warnings: []
};

const customer: CustomerSummary = {
  cases: [
    {
      id: "22d367e9-53b8-4590-9604-0de0485becab",
      lastSeenAt: new Date().toISOString(),
      protocol: "140987001",
      status: "Tier A"
    }
  ],
  displayName: "Davi",
  id: "62505a68-e0d1-4439-950d-e54271fb15d5",
  lastSeenAt: new Date().toISOString(),
  maskedIdentifiers: { protocol: "140987001" }
};

const pendingClient: PendingClientSummary = {
  case: {
    protocol: "140987001",
    status: "Tier A",
    subject: "Atendimento"
  },
  displayName: "Davi",
  maskedIdentifiers: { protocol: "140987001" }
};

const bulkRequest: BulkClientIdentificationRequest = {
  capturedAt: new Date().toISOString(),
  items: [
    {
      requestId: "bulk-item-1",
      rowIndex: 0,
      rowText: "Departamento De Cobr... 1 551141186267",
      tag: "div",
      tokens: ["Departamento", "Cobr", "551141186267"]
    },
    {
      requestId: "bulk-item-2",
      rowIndex: 1,
      rowText: "Giulliano 1 551141186267",
      tag: "div",
      tokens: ["Giulliano", "551141186267"]
    },
    {
      requestId: "bulk-item-3",
      rowIndex: 2,
      rowText: "Gunther Morais - 48982... 1 551141186267",
      tag: "div",
      tokens: ["Gunther", "Morais", "48982", "551141186267"]
    }
  ],
  listSelection: {
    containerText:
      "Departamento De Cobr... 1 551141186267 Giulliano 1 551141186267 Gunther Morais - 48982... 1 551141186267",
    selectedAt: new Date().toISOString(),
    source: "user"
  },
  pageTitle: "Painel Nvoip",
  requestId: "bulk-1",
  url: "https://painel.nvoip.com.br/service/queue"
};

function createService(overrides: Record<string, unknown> = {}) {
  const aiClient = {
    identifyClient: vi.fn().mockResolvedValue(aiResult)
  };
  const repository = {
    canPersistCandidate: vi.fn().mockReturnValue(true),
    decideBulkIdentification: vi.fn(),
    decidePendingIdentification: vi.fn(),
    findExistingCustomer: vi.fn().mockResolvedValue(null),
    listRecentCustomers: vi.fn().mockResolvedValue([]),
    saveConfirmedIdentification: vi.fn(),
    savePendingIdentification: vi.fn().mockResolvedValue(undefined),
    toPendingClient: vi.fn().mockImplementation((result: AiClientIdentificationResult) => ({
      case: result.case
        ? {
            ...(result.case.protocol ? { protocol: result.case.protocol } : {}),
            ...(result.case.status ? { status: result.case.status } : {}),
            ...(result.case.subject ? { subject: result.case.subject } : {})
          }
        : null,
      ...(result.activeClient?.name ? { displayName: result.activeClient.name } : {}),
      maskedIdentifiers: {
        ...(result.activeClient?.identifiers.phone
          ? { phone: result.activeClient.identifiers.phone }
          : {}),
        ...(result.case?.protocol ? { protocol: result.case.protocol } : {})
      }
    } satisfies PendingClientSummary)),
    ...overrides
  };
  const service = new ClientIdentificationService(
    aiClient as never,
    config,
    repository as never
  );

  return { aiClient, repository, service };
}

describe("ClientIdentificationService", () => {
  it("returns pending confirmation without saving a new reliable customer", async () => {
    const { repository, service } = createService();

    const response = await service.identify("user-1", request);

    expect(response.saveState).toBe("pending_confirmation");
    expect(response.saved).toBe(false);
    expect(response.pendingClient?.displayName).toBe("Davi");
    expect(repository.savePendingIdentification).toHaveBeenCalledWith(
      expect.objectContaining({
        confirmationStatus: "pending_confirmation",
        domain: "painel.nvoip.com.br"
      })
    );
    expect(repository.saveConfirmedIdentification).not.toHaveBeenCalled();
  });

  it("marks known customers as saved without asking again", async () => {
    const { repository, service } = createService({
      findExistingCustomer: vi.fn().mockResolvedValue(customer),
      listRecentCustomers: vi.fn().mockResolvedValue([customer]),
      saveConfirmedIdentification: vi.fn().mockResolvedValue({
        caseSummary: customer.cases[0],
        customerSummary: customer
      })
    });

    const response = await service.identify("user-1", request);

    expect(response.saveState).toBe("known");
    expect(response.saved).toBe(true);
    expect(response.activeClient?.displayName).toBe("Davi");
    expect(repository.savePendingIdentification).not.toHaveBeenCalled();
  });

  it("accepts a pending candidate and returns the updated list", async () => {
    const { repository, service } = createService({
      decidePendingIdentification: vi.fn().mockResolvedValue({
        activeClient: customer,
        domain: "painel.nvoip.com.br",
        saved: true
      }),
      listRecentCustomers: vi.fn().mockResolvedValue([customer])
    });

    const response = await service.decide("user-1", {
      decision: "accept",
      requestId: "req-1"
    });

    expect(response.saved).toBe(true);
    expect(response.activeClient?.displayName).toBe("Davi");
    expect(response.recentCustomers).toHaveLength(1);
  });

  it("returns bulk candidates as pending without creating customers", async () => {
    const { repository, service } = createService();

    const response = await service.identifyBulk("user-1", bulkRequest);

    expect(response.batchId).toBe("bulk-1");
    expect(response.candidates).toHaveLength(3);
    expect(response.candidates.map((candidate) => candidate.saveState)).toEqual([
      "pending_confirmation",
      "pending_confirmation",
      "pending_confirmation"
    ]);
    expect(response.candidates[2]?.maskedIdentifiers.protocol).toBe("48982");
    expect(repository.savePendingIdentification).toHaveBeenCalledTimes(3);
    expect(repository.saveConfirmedIdentification).not.toHaveBeenCalled();
  });

  it("marks bulk candidates as known when they already exist", async () => {
    const { repository, service } = createService({
      findExistingCustomer: vi.fn().mockResolvedValue(customer),
      saveConfirmedIdentification: vi.fn().mockResolvedValue({
        caseSummary: customer.cases[0],
        customerSummary: customer
      })
    });

    const response = await service.identifyBulk("user-1", {
      ...bulkRequest,
      items: [bulkRequest.items[2]!]
    });

    expect(response.candidates[0]?.saveState).toBe("known");
    expect(repository.saveConfirmedIdentification).toHaveBeenCalledWith(
      expect.objectContaining({
        bulkBatchId: "bulk-1",
        bulkItemIndex: 2,
        confirmationStatus: "known"
      })
    );
    expect(repository.savePendingIdentification).not.toHaveBeenCalled();
  });

  it("stores a bulk decision and returns accepted customers", async () => {
    const { repository, service } = createService({
      decideBulkIdentification: vi.fn().mockResolvedValue({
        acceptedCount: 2,
        domain: "painel.nvoip.com.br",
        rejectedCount: 1,
        savedCustomers: [customer]
      }),
      listRecentCustomers: vi.fn().mockResolvedValue([customer])
    });

    const response = await service.decideBulk("user-1", {
      acceptRequestIds: ["bulk-item-1", "bulk-item-2"],
      batchId: "bulk-1",
      rejectRequestIds: ["bulk-item-3"]
    });

    expect(response.acceptedCount).toBe(2);
    expect(response.rejectedCount).toBe(1);
    expect(response.savedCustomers).toHaveLength(1);
  });

  it("returns low confidence for bulk rows without enough identity", async () => {
    const { service } = createService();

    const response = await service.identifyBulk("user-1", {
      ...bulkRequest,
      items: [
        {
          requestId: "bulk-item-low",
          rowIndex: 0,
          rowText: "1 551141186267",
          tag: "div",
          tokens: ["551141186267"]
        }
      ]
    });

    expect(response.candidates[0]?.saveState).toBe("low_confidence");
    expect(response.candidates[0]?.selectedByDefault).toBe(false);
  });
});
