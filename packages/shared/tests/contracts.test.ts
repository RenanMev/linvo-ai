import {
  authLoginRequestSchema,
  authPasswordResetConfirmRequestSchema,
  authPasswordResetRequestResponseSchema,
  authPasswordResetRequestSchema,
  authRegisterRequestSchema,
  bulkClientIdentificationDecisionRequestSchema,
  bulkClientIdentificationRequestSchema,
  bulkClientIdentificationResponseSchema,
  clientInfoOpenApiResponseSchema,
  clientInfoOpenRequestSchema,
  clientIdentificationRequestSchema,
  clientIdentificationSuccessResponseSchema,
  customerChatClearResponseSchema,
  customerChatStreamCompleteEventSchema,
  customerChatStreamDeltaEventSchema,
  customerChatStreamRequestSchema,
  customerChatStreamStartEventSchema,
  customerChatThreadResponseSchema,
  customerDeleteRequestSchema,
  customerDeleteResponseSchema,
  customerDetailResponseSchema,
  customerUpdateRequestSchema,
  customerUpdateResponseSchema,
  customersListResponseSchema,
  siteAgentContextSummarySchema,
  siteContextDeleteRequestSchema,
  siteContextGetResponseSchema
} from "../src";

describe("shared contracts", () => {
  it("validates auth register and login payloads", () => {
    expect(
      authRegisterRequestSchema.parse({
        email: "USER@Example.COM",
        name: "Renan",
        password: "12345678"
      }).email
    ).toBe("user@example.com");

    expect(
      authLoginRequestSchema.safeParse({
        email: "bad",
        password: "123"
      }).success
    ).toBe(false);
  });

  it("validates password reset payloads", () => {
    expect(
      authPasswordResetRequestSchema.parse({
        email: "USER@Example.COM"
      }).email
    ).toBe("user@example.com");

    expect(
      authPasswordResetConfirmRequestSchema.safeParse({
        password: "12345678",
        resetCode: "123456"
      }).success
    ).toBe(true);

    expect(
      authPasswordResetRequestResponseSchema.parse({
        resetCode: "123456",
        status: "ok"
      }).resetCode
    ).toBe("123456");
  });

  it("validates client identification requests", () => {
    const parsed = clientIdentificationRequestSchema.parse({
      capturedAt: new Date().toISOString(),
      manualSelection: {
        selectedAt: new Date().toISOString(),
        source: "user",
        textExcerpt: "Maria Silva TK-1048"
      },
      pageTitle: "CRM",
      requestId: "req-1",
      selectedText: "Maria Silva TK-1048",
      url: "https://crm.example.com/tickets/1048"
    });

    expect(parsed.manualSelection.source).toBe("user");
  });

  it("accepts saved and unsaved identification responses", () => {
    expect(
      clientIdentificationSuccessResponseSchema.safeParse({
        activeClient: null,
        case: null,
        confidence: 0.4,
        domain: "crm.example.com",
        evidence: [],
        pendingClient: null,
        recentCustomers: [],
        requestId: "req-1",
        saveState: "low_confidence",
        saved: false,
        status: "ok",
        warnings: ["Nao confirmado"]
      }).success
    ).toBe(true);
  });

  it("validates site agent context contracts", () => {
    const siteContext = siteAgentContextSummarySchema.parse({
      confidence: 0.88,
      createdAt: "2026-06-03T12:00:00.000Z",
      domain: "painel.nvoip.com.br",
      focusRules: ["Prefira o chat aberto e o header do atendimento."],
      id: "33333333-3333-4333-8333-333333333333",
      ignoreRules: ["Ignore menus de navegacao e textos da extensao."],
      regions: [
        {
          description: "Sidebar principal com navegacao do sistema.",
          kind: "main_sidebar",
          label: "Sidebar principal"
        },
        {
          description: "Lista interna de contatos e filas.",
          kind: "contact_list",
          label: "Lista de contatos"
        },
        {
          description: "Chat aberto com o atendimento ativo.",
          kind: "active_chat",
          label: "Chat ativo"
        }
      ],
      sourceRequestId: "req-1",
      summary: "A tela possui sidebar, lista de contatos e chat ativo.",
      updatedAt: "2026-06-03T12:00:00.000Z"
    });

    expect(siteContext.regions.map((region) => region.kind)).toContain("active_chat");
    expect(
      siteContextGetResponseSchema.safeParse({
        domain: "painel.nvoip.com.br",
        siteContext,
        status: "ok"
      }).success
    ).toBe(true);
    expect(
      siteContextDeleteRequestSchema.parse({
        domain: "painel.nvoip.com.br"
      }).domain
    ).toBe("painel.nvoip.com.br");
  });

  it("validates client info open request and responses", () => {
    const customer = {
      cases: [],
      displayName: "Renan Devs",
      domain: "painel.nvoip.com.br",
      favoriteFields: ["protocol", "phone"],
      id: "11111111-1111-4111-8111-111111111111",
      isStarred: true,
      lastSeenAt: "2026-06-01T12:00:00.000Z",
      maskedIdentifiers: { protocol: "10703030" }
    };
    const request = clientInfoOpenRequestSchema.parse({
      capturedAt: new Date().toISOString(),
      pageText: "Atendimento aberto para Renan Devs protocolo 10703030",
      pageTitle: "Painel Nvoip",
      requestId: "info-1",
      url: "https://painel.nvoip.com.br/atendimento/10703030"
    });

    expect(request.pageText).toContain("Renan Devs");
    expect(
      clientInfoOpenApiResponseSchema.safeParse({
        confidence: 0.85,
        customer,
        customers: [customer],
        domain: "painel.nvoip.com.br",
        evidence: ["Nome e protocolo aparecem na pagina."],
        requestId: "info-1",
        source: "llm",
        status: "ok"
      }).success
    ).toBe(true);
    expect(
      clientInfoOpenApiResponseSchema.safeParse({
        customers: [customer],
        domain: "painel.nvoip.com.br",
        reason: "Nenhum cliente corresponde.",
        requestId: "info-1",
        status: "no_match"
      }).success
    ).toBe(true);
    expect(
      clientInfoOpenApiResponseSchema.safeParse({
        confidence: 0.67,
        customer,
        customers: [customer],
        domain: "painel.nvoip.com.br",
        evidence: [],
        requestId: "info-1",
        source: "llm",
        status: "ok"
      }).success
    ).toBe(false);
  });

  it("validates bulk identification request and response payloads", () => {
    const request = bulkClientIdentificationRequestSchema.parse({
      capturedAt: new Date().toISOString(),
      items: [
        {
          requestId: "bulk-item-1",
          rowIndex: 0,
          rowText: "Giulliano 1 551141186267",
          tag: "div",
          tokens: ["Giulliano", "551141186267"]
        }
      ],
      listSelection: {
        containerText: "Giulliano 1 551141186267",
        selectedAt: new Date().toISOString(),
        source: "user"
      },
      pageTitle: "CRM",
      requestId: "bulk-1",
      url: "https://crm.example.com/list"
    });

    expect(request.items[0]?.rowText).toContain("Giulliano");
    expect(
      bulkClientIdentificationResponseSchema.safeParse({
        batchId: "bulk-1",
        candidates: [
          {
            case: null,
            confidence: 0.76,
            displayName: "Giulliano",
            evidence: ["Nome visivel na linha: Giulliano"],
            maskedIdentifiers: {},
            requestId: "bulk-item-1",
            rowIndex: 0,
            rowText: "Giulliano 1 551141186267",
            saveState: "pending_confirmation",
            selectedByDefault: true,
            warnings: []
          }
        ],
        domain: "crm.example.com",
        recentCustomers: [],
        status: "ok"
      }).success
    ).toBe(true);
    expect(
      bulkClientIdentificationDecisionRequestSchema.parse({
        acceptRequestIds: ["bulk-item-1"],
        batchId: "bulk-1",
        rejectRequestIds: []
      }).acceptRequestIds
    ).toEqual(["bulk-item-1"]);
  });

  it("validates customer delete payloads", () => {
    expect(
      customerDeleteRequestSchema.parse({
        customerId: "11111111-1111-4111-8111-111111111111"
      }).customerId
    ).toBe("11111111-1111-4111-8111-111111111111");

    expect(
      customerDeleteResponseSchema.safeParse({
        customerId: "11111111-1111-4111-8111-111111111111",
        domain: "crm.example.com",
        recentCustomers: [],
        status: "ok"
      }).success
    ).toBe(true);
  });

  it("validates customer list and update payloads", () => {
    const customer = {
      cases: [],
      displayName: "Renan Devs",
      domain: "painel.nvoip.com.br",
      id: "11111111-1111-4111-8111-111111111111",
      lastSeenAt: "2026-06-01T12:00:00.000Z",
      maskedIdentifiers: { protocol: "10703030" },
      notes: "Cliente prefere contato por WhatsApp."
    };

    expect(
      customersListResponseSchema.safeParse({
        customers: [customer],
        status: "ok"
      }).success
    ).toBe(true);

    expect(
      customerDetailResponseSchema.safeParse({
        customer,
        status: "ok"
      }).success
    ).toBe(true);

    expect(
      customerUpdateRequestSchema.safeParse({
        customerId: customer.id,
        case: {
          caseId: "22222222-2222-4222-8222-222222222222",
          protocol: "10703031",
          status: "Em andamento",
          subject: "Suporte tecnico"
        },
        displayName: "Renan Devs Atualizado",
        favoriteFields: ["protocol", "caseStatus"],
        isStarred: false,
        maskedIdentifiers: {
          document: "***.***.***-11",
          email: "re***@example.com",
          phone: "(55) *****-3122",
          protocol: "10703031"
        },
        notes: "Nova observacao"
      }).success
    ).toBe(true);

    expect(
      customerUpdateResponseSchema.safeParse({
        customer,
        customers: [customer],
        domain: "painel.nvoip.com.br",
        status: "ok"
      }).success
    ).toBe(true);
  });

  it("validates customer chat payloads and stream events", () => {
    const message = {
      content: "O cliente prefere WhatsApp.",
      createdAt: "2026-06-03T12:00:00.000Z",
      id: "33333333-3333-4333-8333-333333333333",
      role: "assistant",
      sequence: 2,
      status: "completed"
    };

    expect(
      customerChatThreadResponseSchema.safeParse({
        customerId: "11111111-1111-4111-8111-111111111111",
        messages: [message],
        status: "ok",
        summary: "Cliente prefere WhatsApp."
      }).success
    ).toBe(true);
    expect(
      customerChatStreamRequestSchema.parse({
        message: "O que lembrar deste cliente?"
      }).message
    ).toBe("O que lembrar deste cliente?");
    expect(
      customerChatStreamStartEventSchema.safeParse({
        messageId: "33333333-3333-4333-8333-333333333333"
      }).success
    ).toBe(true);
    expect(customerChatStreamDeltaEventSchema.parse({ text: "Oi" }).text).toBe("Oi");
    expect(
      customerChatStreamCompleteEventSchema.safeParse({
        message,
        summary: "Cliente prefere WhatsApp."
      }).success
    ).toBe(true);
    expect(
      customerChatClearResponseSchema.safeParse({
        customerId: "11111111-1111-4111-8111-111111111111",
        deletedMessages: 2,
        status: "ok"
      }).success
    ).toBe(true);
  });
});
