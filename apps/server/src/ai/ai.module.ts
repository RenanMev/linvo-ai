import { Module } from "@nestjs/common";

import { AiClientService } from "./ai-client.service";

@Module({
  exports: [AiClientService],
  providers: [AiClientService]
})
export class AiModule {}
