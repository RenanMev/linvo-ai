import { Body, Controller, Get, Inject, Query, Req, UseGuards, Post } from "@nestjs/common";

import {
  bulkClientIdentificationDecisionRequestSchema,
  bulkClientIdentificationRequestSchema,
  clientIdentificationDecisionRequestSchema,
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
    if (!domain?.trim()) {
      throw new ApiHttpException(400, "INVALID_REQUEST", "Dominio obrigatorio.");
    }

    return this.service.listCustomers(request.user.id, domain.trim().toLowerCase());
  }
}
