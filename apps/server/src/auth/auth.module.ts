import { Module } from "@nestjs/common";

import { PrismaModule } from "../prisma/prisma.module";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";
import { JwtAuthGuard } from "./jwt-auth.guard";
import { PasswordService } from "./password.service";
import { RefreshTokenService } from "./refresh-token.service";
import { TokenService } from "./token.service";

@Module({
  controllers: [AuthController],
  exports: [JwtAuthGuard, TokenService],
  imports: [PrismaModule],
  providers: [
    AuthService,
    JwtAuthGuard,
    PasswordService,
    RefreshTokenService,
    TokenService
  ]
})
export class AuthModule {}
