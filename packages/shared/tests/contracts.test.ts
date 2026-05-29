import {
  authLoginRequestSchema,
  authRegisterRequestSchema,
  bulkClientIdentificationDecisionRequestSchema,
  bulkClientIdentificationRequestSchema,
  bulkClientIdentificationResponseSchema,
  clientIdentificationRequestSchema,
  clientIdentificationSuccessResponseSchema
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
});
