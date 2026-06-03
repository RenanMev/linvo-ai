import { Body, Controller, Get, Inject, Param, Query, Req, Res, UseGuards, Post } from "@nestjs/common";

import {
  bulkClientIdentificationDecisionRequestSchema,
  bulkClientIdentificationRequestSchema,
  clientInfoOpenRequestSchema,
  clientIdentificationDecisionRequestSchema,
  customerChatStreamRequestSchema,
  customerDeleteRequestSchema,
  customerUpdateRequestSchema,
  clientIdentificationRequestSchema,
  siteContextDeleteRequestSchema
} from "@linvo-ai/shared";

import type { AuthenticatedUser } from "../auth/auth.types";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { ApiHttpException } from "../http-error";
import { ClientIdentificationService } from "./client-identification.service";
import { CustomerChatService } from "./customer-chat.service";

interface SseResponse {
  end: () => void;
  flushHeaders?: () => void;
  setHeader: (name: string, value: string) => void;
  write: (chunk: string) => void;
}

function writeSse(response: SseResponse, event: string, data: unknown): void {
  response.write(`event: ${event}\n`);
  response.write(`data: ${JSON.stringify(data)}\n\n`);
}

@Controller("assist")
@UseGuards(JwtAuthGuard)
export class ClientIdentificationController {
  constructor(
    @Inject(ClientIdentificationService)
    private readonly service: ClientIdentificationService,
    @Inject(CustomerChatService)
    private readonly customerChatService: CustomerChatService
  ) {}

  @Post("client-identification")
  identify(@Body() body: unknown, @Req() request: { user: AuthenticatedUser }) {
    const parsed = clientIdentificationRequestSchema.safeParse(body);

    if (!parsed.success) {
      throw new ApiHttpException(400, "INVALID_REQUEST", "Dados invalidos para identificar o cliente.");
    }

    return this.service.identify(request.user.id, parsed.data);
  }

  @Post("client-info/open")
  openClientInfo(@Body() body: unknown, @Req() request: { user: AuthenticatedUser }) {
    const parsed = clientInfoOpenRequestSchema.safeParse(body);

    if (!parsed.success) {
      throw new ApiHttpException(400, "INVALID_REQUEST", "Dados invalidos para abrir informacoes do cliente.");
    }

    return this.service.openClientInfo(request.user.id, parsed.data);
  }

  @Post("client-identification/decision")
  decide(@Body() body: unknown, @Req() request: { user: AuthenticatedUser }) {
    const parsed = clientIdentificationDecisionRequestSchema.safeParse(body);

    if (!parsed.success) {
      throw new ApiHttpException(400, "INVALID_REQUEST", "Decisao invalida.");
    }

    return this.service.decide(request.user.id, parsed.data);
  }

  @Post("client-identification/bulk")
  identifyBulk(@Body() body: unknown, @Req() request: { user: AuthenticatedUser }) {
    const parsed = bulkClientIdentificationRequestSchema.safeParse(body);

    if (!parsed.success) {
      throw new ApiHttpException(400, "INVALID_REQUEST", "Dados invalidos para identificar a lista.");
    }

    return this.service.identifyBulk(request.user.id, parsed.data);
  }

  @Post("client-identification/bulk/decision")
  decideBulk(@Body() body: unknown, @Req() request: { user: AuthenticatedUser }) {
    const parsed = bulkClientIdentificationDecisionRequestSchema.safeParse(body);

    if (!parsed.success) {
      throw new ApiHttpException(400, "INVALID_REQUEST", "Decisao de lote invalida.");
    }

    return this.service.decideBulk(request.user.id, parsed.data);
  }

  @Get("customers")
  listCustomers(
    @Query("domain") domain: string | undefined,
    @Req() request: { user: AuthenticatedUser }
  ) {
    return this.service.listCustomers(
      request.user.id,
      domain?.trim() ? domain.trim().toLowerCase() : undefined
    );
  }

  @Get("customers/:customerId")
  getCustomerDetail(
    @Param("customerId") customerId: string,
    @Req() request: { user: AuthenticatedUser }
  ) {
    const parsed = customerDeleteRequestSchema.safeParse({ customerId });

    if (!parsed.success) {
      throw new ApiHttpException(400, "INVALID_REQUEST", "Cliente invalido.");
    }

    return this.service.getCustomerDetail(request.user.id, parsed.data.customerId);
  }

  @Get("customers/:customerId/chat")
  getCustomerChat(
    @Param("customerId") customerId: string,
    @Req() request: { user: AuthenticatedUser }
  ) {
    const parsed = customerDeleteRequestSchema.safeParse({ customerId });

    if (!parsed.success) {
      throw new ApiHttpException(400, "INVALID_REQUEST", "Cliente invalido.");
    }

    return this.customerChatService.getThread(request.user.id, parsed.data.customerId);
  }

  @Post("customers/:customerId/chat/clear")
  clearCustomerChat(
    @Param("customerId") customerId: string,
    @Req() request: { user: AuthenticatedUser }
  ) {
    const parsed = customerDeleteRequestSchema.safeParse({ customerId });

    if (!parsed.success) {
      throw new ApiHttpException(400, "INVALID_REQUEST", "Cliente invalido.");
    }

    return this.customerChatService.clearThread(request.user.id, parsed.data.customerId);
  }

  @Post("customers/:customerId/chat/stream")
  async streamCustomerChat(
    @Param("customerId") customerId: string,
    @Body() body: unknown,
    @Req() request: { user: AuthenticatedUser },
    @Res() response: SseResponse
  ) {
    const parsedCustomer = customerDeleteRequestSchema.safeParse({ customerId });
    const parsedBody = customerChatStreamRequestSchema.safeParse(body);

    if (!parsedCustomer.success || !parsedBody.success) {
      throw new ApiHttpException(400, "INVALID_REQUEST", "Mensagem invalida para o chat.");
    }

    await this.service.getCustomerDetail(request.user.id, parsedCustomer.data.customerId);

    response.setHeader("Content-Type", "text/event-stream; charset=utf-8");
    response.setHeader("Cache-Control", "no-cache, no-transform");
    response.setHeader("Connection", "keep-alive");
    response.flushHeaders?.();

    try {
      for await (const event of this.customerChatService.streamResponse({
        customerId: parsedCustomer.data.customerId,
        message: parsedBody.data.message,
        userId: request.user.id
      })) {
        writeSse(response, event.event, event.data);
      }
    } catch {
      writeSse(response, "error", {
        message: "Nao foi possivel responder sobre o cliente agora."
      });
    }

    response.end();
  }

  @Get("site-context")
  getSiteContext(
    @Query("domain") domain: string | undefined,
    @Req() request: { user: AuthenticatedUser }
  ) {
    if (!domain?.trim()) {
      throw new ApiHttpException(400, "INVALID_REQUEST", "Dominio obrigatorio para carregar contexto.");
    }

    return this.service.getSiteContext(request.user.id, domain);
  }

  @Post("site-context/delete")
  deleteSiteContext(@Body() body: unknown, @Req() request: { user: AuthenticatedUser }) {
    const parsed = siteContextDeleteRequestSchema.safeParse(body);

    if (!parsed.success) {
      throw new ApiHttpException(400, "INVALID_REQUEST", "Dominio invalido para remover contexto.");
    }

    return this.service.deleteSiteContext(request.user.id, parsed.data.domain);
  }

  @Post("customers/update")
  updateCustomer(@Body() body: unknown, @Req() request: { user: AuthenticatedUser }) {
    const parsed = customerUpdateRequestSchema.safeParse(body);

    if (!parsed.success) {
      throw new ApiHttpException(400, "INVALID_REQUEST", "Dados invalidos para atualizar o cliente.");
    }

    return this.service.updateCustomer(request.user.id, parsed.data);
  }

  @Post("customers/delete")
  deleteCustomer(@Body() body: unknown, @Req() request: { user: AuthenticatedUser }) {
    const parsed = customerDeleteRequestSchema.safeParse(body);

    if (!parsed.success) {
      throw new ApiHttpException(400, "INVALID_REQUEST", "Cliente invalido para apagar.");
    }

    return this.service.deleteCustomer(request.user.id, parsed.data.customerId);
  }
}
