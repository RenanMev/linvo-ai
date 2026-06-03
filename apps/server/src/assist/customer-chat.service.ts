import { Inject, Injectable } from "@nestjs/common";

import {
  MAX_CUSTOMER_CHAT_PROMPT_MESSAGES,
  customerChatClearResponseSchema,
  customerChatThreadResponseSchema,
  type CustomerSummary,
  type CustomerChatMessage
} from "@linvo-ai/shared";

import { AiClientService } from "../ai/ai-client.service";
import { ApiHttpException } from "../http-error";
import { CustomerChatRepository } from "./customer-chat.repository";
import { CustomerRepository } from "./customer.repository";
import { SiteContextRepository } from "./site-context.repository";

export type CustomerChatStreamEvent =
  | { data: { messageId: string }; event: "start" }
  | { data: { text: string }; event: "delta" }
  | { data: { message: CustomerChatMessage; summary: string | null }; event: "complete" }
  | { data: { message: string }; event: "error" };

@Injectable()
export class CustomerChatService {
  constructor(
    @Inject(AiClientService)
    private readonly aiClient: AiClientService,
    @Inject(CustomerChatRepository)
    private readonly chatRepository: CustomerChatRepository,
    @Inject(CustomerRepository)
    private readonly customerRepository: CustomerRepository,
    @Inject(SiteContextRepository)
    private readonly siteContextRepository: SiteContextRepository
  ) {}

  async getThread(userId: string, customerId: string) {
    await this.getCustomerOrThrow(userId, customerId);
    const thread = await this.chatRepository.getThread({ customerId, userId });

    return customerChatThreadResponseSchema.parse({
      customerId,
      messages: thread.messages,
      status: "ok",
      summary: thread.summary
    });
  }

  async clearThread(userId: string, customerId: string) {
    await this.getCustomerOrThrow(userId, customerId);
    const deletedMessages = await this.chatRepository.clearThread({
      customerId,
      userId
    });

    return customerChatClearResponseSchema.parse({
      customerId,
      deletedMessages,
      status: "ok"
    });
  }

  async *streamResponse(input: {
    customerId: string;
    message: string;
    userId: string;
  }): AsyncGenerator<CustomerChatStreamEvent> {
    const customer = await this.getCustomerOrThrow(input.userId, input.customerId);
    const thread = await this.chatRepository.getOrCreateThread({
      customerId: input.customerId,
      userId: input.userId
    });
    const previousMessages = await this.chatRepository.getRecentMessages({
      take: MAX_CUSTOMER_CHAT_PROMPT_MESSAGES,
      threadId: thread.id
    });
    await this.chatRepository.appendMessage({
      content: input.message,
      role: "user",
      threadId: thread.id
    });
    const assistantMessage = await this.chatRepository.appendMessage({
      content: "",
      countAsCompleted: false,
      role: "assistant",
      status: "streaming",
      threadId: thread.id
    });
    const siteContext = customer.domain
      ? await this.siteContextRepository.getByDomain(input.userId, customer.domain)
      : null;
    const requestId = `customer-chat:${input.customerId}:${Date.now()}`;
    let content = "";

    yield {
      data: { messageId: assistantMessage.id },
      event: "start"
    };

    try {
      for await (const delta of this.aiClient.streamCustomerChat({
        customer,
        messages: previousMessages,
        requestId,
        siteContext,
        summary: thread.summary,
        userMessage: input.message
      })) {
        content += delta;
        yield {
          data: { text: delta },
          event: "delta"
        };
      }

      if (!content.trim()) {
        await this.chatRepository.markAssistantMessage({
          content: "",
          messageId: assistantMessage.id,
          status: "error"
        });
        yield {
          data: { message: "A IA nao retornou uma resposta valida." },
          event: "error"
        };
        return;
      }

      const completed = await this.chatRepository.completeAssistantMessage({
        content,
        messageId: assistantMessage.id,
        threadId: thread.id
      });
      let summary = thread.summary;

      if (completed.messageCountSinceSummary >= 10) {
        summary = await this.updateSummary({
          customer,
          existingSummary: thread.summary,
          requestId,
          threadId: thread.id
        });
      }

      yield {
        data: {
          message: completed.message,
          summary
        },
        event: "complete"
      };
    } catch (error) {
      await this.chatRepository.markAssistantMessage({
        content,
        messageId: assistantMessage.id,
        status: content.trim() ? "interrupted" : "error"
      });
      yield {
        data: {
          message:
            error instanceof Error && error.message
              ? error.message
              : "Nao foi possivel responder sobre o cliente agora."
        },
        event: "error"
      };
    }
  }

  private async getCustomerOrThrow(userId: string, customerId: string) {
    const customer = await this.customerRepository.getCustomerDetail({
      customerId,
      userId
    });

    if (!customer) {
      throw new ApiHttpException(404, "INVALID_REQUEST", "Cliente nao encontrado.");
    }

    return customer;
  }

  private async updateSummary(input: {
    customer: CustomerSummary;
    existingSummary: string | null;
    requestId: string;
    threadId: string;
  }): Promise<string | null> {
    try {
      const messages = await this.chatRepository.getRecentMessages({
        take: 20,
        threadId: input.threadId
      });
      const summary = await this.aiClient.summarizeCustomerChat({
        customer: input.customer,
        existingSummary: input.existingSummary,
        messages,
        requestId: input.requestId
      });

      return this.chatRepository.updateSummary({
        summary,
        threadId: input.threadId
      });
    } catch {
      return input.existingSummary;
    }
  }
}
