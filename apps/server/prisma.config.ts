import "dotenv/config";

import { defineConfig } from "prisma/config";

export default defineConfig({
  datasource: {
    url:
      process.env.DATABASE_URL ??
      "postgresql://linvo_ai:linvo_ai_dev@127.0.0.1:54329/linvo_ai"
  },
  migrations: {
    path: "prisma/migrations"
  },
  schema: "prisma/schema.prisma"
});
