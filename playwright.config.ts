import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  use: {
    headless: true,
    viewport: {
      height: 800,
      width: 1280
    }
  }
});
