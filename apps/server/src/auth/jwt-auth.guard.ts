import { Inject, Injectable } from "@nestjs/common";
import type { CanActivate, ExecutionContext } from "@nestjs/common";

import { ApiHttpException } from "../http-error";
import { TokenService } from "./token.service";

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(@Inject(TokenService) private readonly tokenService: TokenService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<{
      headers: Record<string, string | string[] | undefined>;
      user?: unknown;
    }>();
    const rawHeader = request.headers.authorization;
    const authorization = Array.isArray(rawHeader) ? rawHeader[0] : rawHeader;
    const token = authorization?.startsWith("Bearer ")
      ? authorization.slice("Bearer ".length)
      : "";
    const user = token ? this.tokenService.verifyAccessToken(token) : null;

    if (!user) {
      throw new ApiHttpException(401, "AUTH_REQUIRED", "Entre novamente para continuar.");
    }

    request.user = user;
    return true;
  }
}
