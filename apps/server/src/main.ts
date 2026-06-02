import "reflect-metadata";

import { Controller, Get, Inject, Module } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import type { NestExpressApplication } from "@nestjs/platform-express";

import { AppModule } from "./app.module";
import { createCorsOrigin } from "./config/cors";
import type { AppConfig } from "./config/env.schema";
import { APP_CONFIG } from "./config/env.schema";

@Controller()
class HealthController {
  @Get("health")
  health() {
    return {
      status: "ok"
    };
  }
}

@Module({
  controllers: [HealthController],
  imports: [AppModule]
})
class RootModule {
  constructor(@Inject(APP_CONFIG) readonly config: AppConfig) {}
}

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(RootModule, {
    bodyParser: false
  });
  const config = app.get<AppConfig>(APP_CONFIG);
  app.useBodyParser("json", { limit: "4mb" });
  app.useBodyParser("urlencoded", { extended: true, limit: "4mb" });
  app.enableCors({
    origin: createCorsOrigin(config)
  });
  await app.listen(config.PORT, "127.0.0.1");
}

void bootstrap();
