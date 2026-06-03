import type { CustomerSummary } from "@linvo-ai/shared";

import {
  CustomerChatService,
  type CustomerChatStreamEvent
} from "../src/assist/customer-chat.service";

const customer: CustomerSummary = {
  cases: [],
  displayName: "Davi",
  domain: "painel.nvoip.com.br",
  favoriteFields: ["protocol", "phone"],
  id: "62505a68-e0d1-4439-950d-e54271fb15d5",
  isStarred: false,
  lastSeenAt: new Date().toISOString(),
  maskedIdentifiers: { protocol: "140987001" },
  notes: "Cliente prefere WhatsApp."
};

async function* streamText() {
  yield "Cliente ";
  yield "prefere WhatsApp.";
}

describe("CustomerChatService", () => {
  it("streams an assistant response and completes the saved message", async () => {
    const aiClient = {
      streamCustomerChat: vi.fn().mockReturnValue(streamText()),
      summarizeCustomerChat: vi.fn()
    };
    const chatRepository = {
      appendMessage: vi.fn()
        .mockResolvedValueOnce({
          content: "O que lembrar?",
          createdAt: new Date().toISOString(),
          id: "11111111-1111-4111-8111-111111111111",
          role: "user",
          sequence: 1,
          status: "completed"
        })
        .mockResolvedValueOnce({
          content: "",
          createdAt: new Date().toISOString(),
          id: "22222222-2222-4222-8222-222222222222",
          role: "assistant",
          sequence: 2,
          status: "streaming"
        }),
      completeAssistantMessage: vi.fn().mockResolvedValue({
        message: {
          content: "Cliente prefere WhatsApp.",
          createdAt: new Date().toISOString(),
          id: "22222222-2222-4222-8222-222222222222",
          role: "assistant",
          sequence: 2,
          status: "completed"
        },
        messageCountSinceSummary: 2
      }),
      getOrCreateThread: vi.fn().mockResolvedValue({
        id: "thread-1",
        summary: "Resumo anterior."
      }),
      getRecentMessages: vi.fn().mockResolvedValue([]),
      markAssistantMessage: vi.fn(),
      updateSummary: vi.fn()
    };
    const customerRepository = {
      getCustomerDetail: vi.fn().mockResolvedValue(customer)
    };
    const siteContextRepository = {
      getByDomain: vi.fn().mockResolvedValue(null)
    };
    const service = new CustomerChatService(
      aiClient as never,
      chatRepository as never,
      customerRepository as never,
      siteContextRepository as never
    );
    const events: CustomerChatStreamEvent[] = [];

    for await (const event of service.streamResponse({
      customerId: customer.id,
      message: "O que lembrar?",
      userId: "user-1"
    })) {
      events.push(event);
    }

    expect(events.map((event) => event.event)).toEqual([
      "start",
      "delta",
      "delta",
      "complete"
    ]);
    expect(chatRepository.appendMessage).toHaveBeenCalledWith(
      expect.objectContaining({ role: "user", threadId: "thread-1" })
    );
    expect(chatRepository.completeAssistantMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        content: "Cliente prefere WhatsApp.",
        messageId: "22222222-2222-4222-8222-222222222222"
      })
    );
    expect(aiClient.summarizeCustomerChat).not.toHaveBeenCalled();
  });
});
