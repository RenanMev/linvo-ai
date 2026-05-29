import { Body, Controller, Get, Headers, Inject, Post, Req, UseGuards } from "@nestjs/common";

import {
  authLoginRequestSchema,
  authLogoutRequestSchema,
  authRefreshRequestSchema,
  authRegisterRequestSchema
} from "@linvo-ai/shared";

import { ApiHttpException } from "../http-error";
import type { AuthenticatedUser } from "./auth.types";
import { AuthService } from "./auth.service";
import { JwtAuthGuard } from "./jwt-auth.guard";

function parseBody<T>(schema: { safeParse: (value: unknown) => { success: true; data: T } | { success: false } }, body: unknown): T {
  const parsed = schema.safeParse(body);

  if (!parsed.success) {
    throw new ApiHttpException(400, "INVALID_REQUEST", "Dados invalidos.");
  }

  return parsed.data;
}

@Controller("auth")
export class AuthController {
  constructor(@Inject(AuthService) private readonly authService: AuthService) {}

  @Post("register")
  register(@Body() body: unknown, @Headers("user-agent") userAgent?: string) {
    return this.authService.register(parseBody(authRegisterRequestSchema, body), userAgent);
  }

  @Post("login")
  login(@Body() body: unknown, @Headers("user-agent") userAgent?: string) {
    return this.authService.login(parseBody(authLoginRequestSchema, body), userAgent);
  }

  @Post("refresh")
  async refresh(@Body() body: unknown) {
    const input = parseBody(authRefreshRequestSchema, body);
    return {
      status: "ok" as const,
      tokens: await this.authService.refresh(input.refreshToken)
    };
  }

  @Post("logout")
  async logout(@Body() body: unknown) {
    const input = parseBody(authLogoutRequestSchema, body);
    await this.authService.logout(input.refreshToken);
    return { status: "ok" as const };
  }

  @Get("me")
  @UseGuards(JwtAuthGuard)
  async me(@Req() request: { user: AuthenticatedUser }) {
    return {
      status: "ok" as const,
      user: await this.authService.me(request.user.id)
    };
  }
}
