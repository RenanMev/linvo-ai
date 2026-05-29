import { Module } from "@nestjs/common";

import { AiModule } from "../ai/ai.module";
import { AuthModule } from "../auth/auth.module";
import { PrismaModule } from "../prisma/prisma.module";
import { ClientIdentificationController } from "./client-identification.controller";
import { ClientIdentificationService } from "./client-identification.service";
import { CustomerRepository } from "./customer.repository";

@Module({
  controllers: [ClientIdentificationController],
  imports: [AiModule, AuthModule, PrismaModule],
  providers: [ClientIdentificationService, CustomerRepository]
})
export class AssistModule {}
