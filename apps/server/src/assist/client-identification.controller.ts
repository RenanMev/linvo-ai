import { Body, Controller, Get, Inject, Query, Req, UseGuards, Post } from "@nestjs/common";

import {
  bulkClientIdentificationDecisionRequestSchema,
  bulkClientIdentificationRequestSchema,
  clientInfoOpenRequestSchema,
  clientIdentificationDecisionRequestSchema,
  customerDeleteRequestSchema,
  customerUpdateRequestSchema,
  clientIdentificationRequestSchema
} from "@linvo-ai/shared";

import type { AuthenticatedUser } from "../auth/auth.types";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { ApiHttpException } from "../http-error";
import { ClientIdentificationService } from "./client-identification.service";

@Controller("assist")
@UseGuards(JwtAuthGuard)
export class ClientIdentificationController {
  constructor(
    @Inject(ClientIdentificationService)
    private readonly service: ClientIdentificationService
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
