import { HttpException } from "@nestjs/common";

import type { ApiErrorCode, ApiErrorResponse } from "@linvo-ai/shared";

export class ApiHttpException extends HttpException {
  constructor(statusCode: number, errorCode: ApiErrorCode, message: string, requestId?: string) {
    const response: ApiErrorResponse = {
      errorCode,
      message,
      ...(requestId ? { requestId } : {}),
      status: "error"
    };

    super(response, statusCode);
  }
}
