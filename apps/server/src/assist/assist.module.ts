import { Module } from "@nestjs/common";

import { AiModule } from "../ai/ai.module";
import { AuthModule } from "../auth/auth.module";
import { PrismaModule } from "../prisma/prisma.module";
import { ClientIdentificationController } from "./client-identification.controller";
import { ClientIdentificationService } from "./client-identification.service";
import { CustomerChatRepository } from "./customer-chat.repository";
import { CustomerChatService } from "./customer-chat.service";
import { CustomerRepository } from "./customer.repository";
import { SiteContextRepository } from "./site-context.repository";

@Module({
  controllers: [ClientIdentificationController],
  imports: [AiModule, AuthModule, PrismaModule],
  providers: [
    ClientIdentificationService,
    CustomerChatRepository,
    CustomerChatService,
    CustomerRepository,
    SiteContextRepository
  ]
})
export class AssistModule {}
