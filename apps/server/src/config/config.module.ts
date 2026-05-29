import { Global, Module } from "@nestjs/common";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { config as loadDotEnv } from "dotenv";

import { APP_CONFIG, createAppConfig } from "./env.schema";

for (const envPath of [
  resolve(process.cwd(), ".env"),
  resolve(process.cwd(), "..", "..", ".env")
]) {
  if (existsSync(envPath)) {
    loadDotEnv({
      override: false,
      path: envPath
    });
  }
}

@Global()
@Module({
  exports: [APP_CONFIG],
  providers: [
    {
      provide: APP_CONFIG,
      useValue: createAppConfig(process.env)
    }
  ]
})
export class ConfigModule {}
