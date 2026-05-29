import { expect, test } from "@playwright/test";

test("crm fixture exposes two contacts and one active conversation", async ({ page }) => {
  await page.goto(`file://${process.cwd().replace(/\\/g, "/")}/tests/e2e/crm-fixture.html`);

  await expect(page.getByText("Cliente A - Maria Silva")).toBeVisible();
  await expect(page.getByText("Cliente B - Bruno Costa")).toBeVisible();
  await expect(page.getByRole("region", { name: "Conversa ativa com Maria Silva" })).toBeVisible();
});
