import { Module } from "@nestjs/common";

import { AssistModule } from "./assist/assist.module";
import { AuthModule } from "./auth/auth.module";
import { ConfigModule } from "./config/config.module";
import { PrismaModule } from "./prisma/prisma.module";

@Module({
  imports: [ConfigModule, AssistModule, AuthModule, PrismaModule]
})
export class AppModule {}
