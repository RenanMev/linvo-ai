import { Inject, Injectable } from "@nestjs/common";

import {
  MAX_CUSTOMER_CHAT_HISTORY_MESSAGES,
  type CustomerChatMessage,
  type CustomerChatMessageStatus,
  type CustomerChatRole
} from "@linvo-ai/shared";

import { PrismaService } from "../prisma/prisma.service";

function toChatMessage(message: {
  content: string;
  createdAt: Date;
  id: string;
  role: string;
  sequence: number;
  status: string;
}): CustomerChatMessage {
  return {
    content: message.content,
    createdAt: message.createdAt.toISOString(),
    id: message.id,
    role: message.role as CustomerChatRole,
    sequence: message.sequence,
    status: message.status as CustomerChatMessageStatus
  };
}

@Injectable()
export class CustomerChatRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async getOrCreateThread(input: {
    customerId: string;
    userId: string;
  }) {
    return this.prisma.customerAiThread.upsert({
      create: {
        customerId: input.customerId,
        userId: input.userId
      },
      update: {},
      where: { customerId: input.customerId }
    });
  }

  async getThread(input: {
    customerId: string;
    userId: string;
  }): Promise<{
    messages: CustomerChatMessage[];
    summary: string | null;
  }> {
    const thread = await this.prisma.customerAiThread.findFirst({
      include: {
        messages: {
          orderBy: { sequence: "desc" },
          take: MAX_CUSTOMER_CHAT_HISTORY_MESSAGES
        }
      },
      where: {
        customerId: input.customerId,
        userId: input.userId
      }
    });

    if (!thread) {
      return {
        messages: [],
        summary: null
      };
    }

    return {
      messages: [...thread.messages].reverse().map(toChatMessage),
      summary: thread.summary
    };
  }

  async getRecentMessages(input: {
    take: number;
    threadId: string;
  }): Promise<CustomerChatMessage[]> {
    const messages = await this.prisma.customerAiMessage.findMany({
      orderBy: { sequence: "desc" },
      take: input.take,
      where: { threadId: input.threadId }
    });

    return messages.reverse().map(toChatMessage);
  }

  async appendMessage(input: {
    content: string;
    countAsCompleted?: boolean;
    role: CustomerChatRole;
    status?: CustomerChatMessageStatus;
    threadId: string;
  }): Promise<CustomerChatMessage> {
    const status = input.status ?? "completed";
    const message = await this.prisma.$transaction(async (transaction) => {
      const aggregate = await transaction.customerAiMessage.aggregate({
        _max: { sequence: true },
        where: { threadId: input.threadId }
      });
      const created = await transaction.customerAiMessage.create({
        data: {
          content: input.content,
          role: input.role,
          sequence: (aggregate._max.sequence ?? 0) + 1,
          status,
          threadId: input.threadId
        }
      });

      if (input.countAsCompleted !== false && status === "completed") {
        await transaction.customerAiThread.update({
          data: { messageCountSinceSummary: { increment: 1 } },
          where: { id: input.threadId }
        });
      }

      return created;
    });

    return toChatMessage(message);
  }

  async completeAssistantMessage(input: {
    content: string;
    messageId: string;
    threadId: string;
  }): Promise<{
    message: CustomerChatMessage;
    messageCountSinceSummary: number;
  }> {
    const result = await this.prisma.$transaction(async (transaction) => {
      const message = await transaction.customerAiMessage.update({
        data: {
          content: input.content,
          status: "completed"
        },
        where: { id: input.messageId }
      });
      const thread = await transaction.customerAiThread.update({
        data: { messageCountSinceSummary: { increment: 1 } },
        where: { id: input.threadId }
      });

      return {
        message,
        messageCountSinceSummary: thread.messageCountSinceSummary
      };
    });

    await this.pruneOldMessages(input.threadId);

    return {
      message: toChatMessage(result.message),
      messageCountSinceSummary: result.messageCountSinceSummary
    };
  }

  async markAssistantMessage(input: {
    content: string;
    messageId: string;
    status: Extract<CustomerChatMessageStatus, "error" | "interrupted">;
  }): Promise<CustomerChatMessage> {
    const message = await this.prisma.customerAiMessage.update({
      data: {
        content: input.content,
        status: input.status
      },
      where: { id: input.messageId }
    });

    await this.pruneOldMessages(message.threadId);

    return toChatMessage(message);
  }

  async updateSummary(input: {
    summary: string;
    threadId: string;
  }): Promise<string | null> {
    const thread = await this.prisma.customerAiThread.update({
      data: {
        messageCountSinceSummary: 0,
        summary: input.summary.trim() || null
      },
      where: { id: input.threadId }
    });

    return thread.summary;
  }

  async clearThread(input: {
    customerId: string;
    userId: string;
  }): Promise<number> {
    const thread = await this.prisma.customerAiThread.findFirst({
      select: { id: true },
      where: {
        customerId: input.customerId,
        userId: input.userId
      }
    });

    if (!thread) {
      return 0;
    }

    const deleted = await this.prisma.$transaction(async (transaction) => {
      const result = await transaction.customerAiMessage.deleteMany({
        where: { threadId: thread.id }
      });
      await transaction.customerAiThread.update({
        data: {
          messageCountSinceSummary: 0,
          summary: null
        },
        where: { id: thread.id }
      });

      return result.count;
    });

    return deleted;
  }

  private async pruneOldMessages(threadId: string): Promise<void> {
    const oldMessages = await this.prisma.customerAiMessage.findMany({
      orderBy: { sequence: "desc" },
      select: { id: true },
      skip: MAX_CUSTOMER_CHAT_HISTORY_MESSAGES,
      where: { threadId }
    });

    if (!oldMessages.length) {
      return;
    }

    await this.prisma.customerAiMessage.deleteMany({
      where: {
        id: { in: oldMessages.map((message) => message.id) }
      }
    });
  }
}
