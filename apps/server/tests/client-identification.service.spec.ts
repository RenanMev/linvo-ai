import type {
  AiClientIdentificationResult,
  BulkClientIdentificationRequest,
  ClientInfoOpenRequest,
  ClientIdentificationRequest,
  CustomerSummary,
  PendingClientSummary,
  SiteAgentContextDraft,
  SiteAgentContextSummary
} from "@linvo-ai/shared";

import { ClientIdentificationService } from "../src/assist/client-identification.service";
import { IdentificationDecisionConflictError } from "../src/assist/customer.repository";
import type { AppConfig } from "../src/config/env.schema";
import { ApiHttpException } from "../src/http-error";

const config: AppConfig = {
  AI_BASE_URL: "https://example.test",
  AI_MODEL: "test-model",
  CORS_ALLOWED_ORIGINS: ["http://localhost:*"],
  DATABASE_URL: "postgresql://example",
  IDENTIFICATION_CONFIDENCE_MIN: 0.72,
  IDENTITY_HASH_SECRET: "identity-secret-for-tests",
  JWT_ACCESS_SECRET: "access-secret-for-tests",
  JWT_AUDIENCE: "linvo-ai-extension",
  JWT_ISSUER: "linvo-ai-server",
  JWT_REFRESH_SECRET: "refresh-secret-for-tests",
  NODE_ENV: "test",
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
  favoriteFields: ["protocol", "phone"],
  id: "62505a68-e0d1-4439-950d-e54271fb15d5",
  isStarred: false,
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

const siteContext: SiteAgentContextSummary = {
  confidence: 0.88,
  createdAt: new Date().toISOString(),
  domain: "painel.nvoip.com.br",
  focusRules: ["Prefira o chat aberto e o header do atendimento."],
  id: "33333333-3333-4333-8333-333333333333",
  ignoreRules: ["Ignore menus de navegacao e textos da extensao Linvo AI."],
  regions: [
    {
      description: "Sidebar principal com navegacao do sistema.",
      evidence: [],
      kind: "main_sidebar",
      label: "Sidebar principal"
    },
    {
      description: "Lista interna de contatos e filas.",
      evidence: [],
      kind: "contact_list",
      label: "Lista de contatos"
    },
    {
      description: "Chat aberto com o atendimento ativo.",
      evidence: [],
      kind: "active_chat",
      label: "Chat ativo"
    }
  ],
  sourceRequestId: "req-1",
  summary: "A tela possui sidebar, lista interna de contatos, chat ativo e header.",
  updatedAt: new Date().toISOString()
};

const siteContextDraft: SiteAgentContextDraft = {
  confidence: siteContext.confidence,
  focusRules: siteContext.focusRules,
  ignoreRules: siteContext.ignoreRules,
  regions: siteContext.regions,
  summary: siteContext.summary
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

const clientInfoOpenRequest: ClientInfoOpenRequest = {
  capturedAt: new Date().toISOString(),
  pageText: "Atendimento aberto para Davi no protocolo 140987001",
  pageTitle: "Painel Nvoip",
  requestId: "info-1",
  url: "https://painel.nvoip.com.br/service/140987001"
};

function createService(overrides: Record<string, unknown> = {}) {
  const aiClient = {
    analyzeClientIdentification: vi.fn().mockResolvedValue(aiResult),
    enrichClientIdentification: vi.fn().mockResolvedValue(aiResult),
    generateSiteContextDraft: vi.fn().mockResolvedValue(siteContextDraft),
    identifyClient: vi.fn().mockResolvedValue(aiResult),
    selectClientInfo: vi.fn().mockResolvedValue(null),
    validateClientDuplicate: vi.fn().mockResolvedValue({
      confidence: 0.84,
      evidence: ["Nenhum cliente salvo corresponde com seguranca."],
      status: "new",
      warnings: []
    })
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
    updateCustomer: vi.fn(),
    ...overrides
  };
  const siteContextRepository = {
    deleteByDomain: vi.fn().mockResolvedValue(false),
    getByDomain: vi.fn().mockResolvedValue(null),
    upsertDraft: vi.fn().mockResolvedValue({
      siteContext,
      status: "created"
    }),
    upsertFromRun: vi.fn().mockResolvedValue({
      siteContext,
      status: "created"
    })
  };
  const service = new ClientIdentificationService(
    aiClient as never,
    config,
    repository as never,
    siteContextRepository as never
  );

  return { aiClient, repository, service, siteContextRepository };
}

describe("ClientIdentificationService", () => {
  it("opens client info using the AI-selected customer", async () => {
    const { aiClient, service } = createService({
      listRecentCustomers: vi.fn().mockResolvedValue([customer])
    });
    aiClient.selectClientInfo.mockResolvedValue({
      confidence: 0.92,
      customerId: customer.id,
      evidence: ["Nome e protocolo batem com o cliente salvo."],
      status: "ok"
    });

    const response = await service.openClientInfo("user-1", clientInfoOpenRequest);

    expect(response.status).toBe("ok");
    expect(response.status === "ok" ? response.customer.id : null).toBe(customer.id);
    expect(response.status === "ok" ? response.source : null).toBe("llm");
    expect(aiClient.selectClientInfo).toHaveBeenCalledWith({
      customers: [customer],
      request: clientInfoOpenRequest
    });
  });

  it("passes saved site context into client info open prompts", async () => {
    const { aiClient, service, siteContextRepository } = createService({
      listRecentCustomers: vi.fn().mockResolvedValue([customer])
    });
    siteContextRepository.getByDomain.mockResolvedValue(siteContext);
    aiClient.selectClientInfo.mockResolvedValue({
      confidence: 0.92,
      customerId: customer.id,
      evidence: ["Nome e protocolo batem com o cliente salvo."],
      status: "ok"
    });

    await service.openClientInfo("user-1", clientInfoOpenRequest);

    expect(aiClient.selectClientInfo).toHaveBeenCalledWith({
      customers: [customer],
      request: clientInfoOpenRequest,
      siteContext
    });
  });

  it("opens client info with the fallback heuristic when the page matches a saved customer", async () => {
    const { service } = createService({
      listRecentCustomers: vi.fn().mockResolvedValue([customer])
    });

    const response = await service.openClientInfo("user-1", clientInfoOpenRequest);

    expect(response.status).toBe("ok");
    expect(response.status === "ok" ? response.customer.id : null).toBe(customer.id);
    expect(response.status === "ok" ? response.source : null).toBe("heuristic");
  });

  it("returns no_match when no saved customer is reliable enough", async () => {
    const { service } = createService({
      listRecentCustomers: vi.fn().mockResolvedValue([customer])
    });

    const response = await service.openClientInfo("user-1", {
      ...clientInfoOpenRequest,
      pageText: "Fila geral de atendimentos sem dados do cliente"
    });

    expect(response.status).toBe("no_match");
  });

  it("returns pending confirmation without saving a new reliable customer", async () => {
    const { aiClient, repository, service } = createService();

    const response = await service.identify("user-1", request);

    expect(response.saveState).toBe("pending_confirmation");
    expect(response.saved).toBe(false);
    expect(response.pendingClient?.displayName).toBe("Davi");
    expect(aiClient.analyzeClientIdentification).toHaveBeenCalledWith(request);
    expect(aiClient.validateClientDuplicate).toHaveBeenCalledWith(
      expect.objectContaining({
        analysisResult: aiResult,
        candidates: [],
        request
      })
    );
    expect(aiClient.enrichClientIdentification).toHaveBeenCalledWith(
      expect.objectContaining({
        analysisResult: aiResult,
        matchedCustomer: null,
        request
      })
    );
    expect(repository.savePendingIdentification).toHaveBeenCalledWith(
      expect.objectContaining({
        confirmationStatus: "pending_confirmation",
        domain: "painel.nvoip.com.br"
      })
    );
    expect(repository.saveConfirmedIdentification).not.toHaveBeenCalled();
  });

  it("does not create site context for low-confidence identification", async () => {
    const { aiClient, service, siteContextRepository } = createService();
    aiClient.enrichClientIdentification.mockResolvedValue({
      activeClient: null,
      case: null,
      confidence: 0.41,
      evidence: [],
      warnings: []
    });

    const response = await service.identify("user-1", request);

    expect(response.saveState).toBe("low_confidence");
    expect(response.siteContextStatus).toBe("missing");
    expect(siteContextRepository.upsertDraft).not.toHaveBeenCalled();
  });

  it("uses AI duplicate validation to update a matched existing customer", async () => {
    const { aiClient, repository, service } = createService({
      listRecentCustomers: vi.fn().mockResolvedValue([customer]),
      saveConfirmedIdentification: vi.fn().mockResolvedValue({
        caseSummary: customer.cases[0],
        customerSummary: customer
      })
    });
    aiClient.validateClientDuplicate.mockResolvedValue({
      confidence: 0.93,
      customerId: customer.id,
      evidence: ["Mesmo protocolo e nome do cliente salvo."],
      status: "match",
      warnings: []
    });

    const response = await service.identify("user-1", request);

    expect(response.saveState).toBe("known");
    expect(response.saved).toBe(true);
    expect(response.siteContextStatus).toBe("created");
    expect(response.siteContext?.summary).toContain("sidebar");
    expect(response.activeClient?.id).toBe(customer.id);
    expect(aiClient.enrichClientIdentification).toHaveBeenCalledWith(
      expect.objectContaining({
        matchedCustomer: customer
      })
    );
    expect(aiClient.generateSiteContextDraft).toHaveBeenCalledWith(
      expect.objectContaining({
        analysisResult: aiResult,
        request
      })
    );
    expect(repository.saveConfirmedIdentification).toHaveBeenCalledWith(
      expect.objectContaining({
        confirmationStatus: "known",
        existingCustomerId: customer.id
      })
    );
    expect(repository.savePendingIdentification).not.toHaveBeenCalled();
  });

  it("injects saved site context into identification prompts", async () => {
    const { aiClient, service, siteContextRepository } = createService({
      findExistingCustomer: vi.fn().mockResolvedValue(customer),
      listRecentCustomers: vi.fn().mockResolvedValue([customer]),
      saveConfirmedIdentification: vi.fn().mockResolvedValue({
        caseSummary: customer.cases[0],
        customerSummary: customer
      })
    });
    siteContextRepository.getByDomain.mockResolvedValue(siteContext);

    await service.identify("user-1", request);

    expect(aiClient.analyzeClientIdentification).toHaveBeenCalledWith(request, siteContext);
    expect(aiClient.validateClientDuplicate).toHaveBeenCalledWith(
      expect.objectContaining({
        siteContext
      })
    );
    expect(aiClient.enrichClientIdentification).toHaveBeenCalledWith(
      expect.objectContaining({
        siteContext
      })
    );
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
    expect(response.siteContextStatus).toBe("created");
    expect(response.activeClient?.displayName).toBe("Davi");
    expect(repository.savePendingIdentification).not.toHaveBeenCalled();
  });

  it("accepts a pending candidate and returns the updated list", async () => {
    const { repository, service, siteContextRepository } = createService({
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
    expect(response.siteContextStatus).toBe("created");
    expect(response.recentCustomers).toHaveLength(1);
    expect(siteContextRepository.upsertFromRun).toHaveBeenCalledWith({
      requestId: "req-1",
      userId: "user-1"
    });
  });

  it("rejects a pending candidate and returns no active client", async () => {
    const { repository, service } = createService({
      decidePendingIdentification: vi.fn().mockResolvedValue({
        activeClient: null,
        domain: "painel.nvoip.com.br",
        saved: false
      })
    });

    const response = await service.decide("user-1", {
      decision: "reject",
      requestId: "req-1"
    });

    expect(response.saved).toBe(false);
    expect(response.activeClient).toBeNull();
    expect(repository.decidePendingIdentification).toHaveBeenCalledWith({
      decision: "reject",
      requestId: "req-1",
      userId: "user-1"
    });
  });

  it("maps repeated decisions to a conflict response", async () => {
    const { service } = createService({
      decidePendingIdentification: vi.fn().mockRejectedValue(new IdentificationDecisionConflictError())
    });

    try {
      await service.decide("user-1", {
        decision: "accept",
        requestId: "req-1"
      });
      throw new Error("Expected decide to throw.");
    } catch (error) {
      expect(error).toBeInstanceOf(ApiHttpException);
      expect((error as ApiHttpException).getStatus()).toBe(409);
    }
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

  it("updates all editable customer fields", async () => {
    const updatedCustomer: CustomerSummary = {
      ...customer,
      cases: [
        {
          ...customer.cases[0]!,
          protocol: "140987002",
          status: "Em andamento",
          subject: "Suporte tecnico"
        }
      ],
      displayName: "Davi Atualizado",
      maskedIdentifiers: {
        document: "***.***.***-11",
        email: "da***@example.com",
        phone: "(55) *****-1234",
        protocol: "140987002"
      },
      notes: "Cliente prefere WhatsApp."
    };
    const { repository, service } = createService({
      listRecentCustomers: vi.fn().mockResolvedValue([updatedCustomer]),
      updateCustomer: vi.fn().mockResolvedValue({
        customer: updatedCustomer,
        domain: "painel.nvoip.com.br"
      })
    });

    const response = await service.updateCustomer("user-1", {
      case: {
        caseId: customer.cases[0]!.id,
        protocol: "140987002",
        status: "Em andamento",
        subject: "Suporte tecnico"
      },
      customerId: customer.id,
      displayName: "Davi Atualizado",
      maskedIdentifiers: {
        document: "***.***.***-11",
        email: "da***@example.com",
        phone: "(55) *****-1234",
        protocol: "140987002"
      },
      notes: "Cliente prefere WhatsApp."
    });

    expect(response.customer.displayName).toBe("Davi Atualizado");
    expect(response.customer.maskedIdentifiers.phone).toBe("(55) *****-1234");
    expect(response.customer.cases[0]?.subject).toBe("Suporte tecnico");
    expect(repository.updateCustomer).toHaveBeenCalledWith(
      expect.objectContaining({
        case: expect.objectContaining({ protocol: "140987002" }),
        customerId: customer.id,
        maskedIdentifiers: expect.objectContaining({
          email: "da***@example.com"
        }),
        notes: "Cliente prefere WhatsApp.",
        userId: "user-1"
      })
    );
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
