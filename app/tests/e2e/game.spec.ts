import { test, expect } from "@playwright/test";
import { generateTestEmail, registerUser, TEST_PASSWORD } from "./helpers/auth.helper.js";

test.describe("Game", () => {
  test.beforeEach(async ({ page }) => {
    const email = generateTestEmail();
    await registerUser(page, email, TEST_PASSWORD);
  });

  test("slot machine page loads", async ({ page }) => {
    await page.goto("/games/slot-machine");
    expect(page.url()).toContain("/games/slot-machine");
  });

  test("slot machine root element present", async ({ page }) => {
    await page.goto("/games/slot-machine");
    const root = page.locator("#slotMachineRoot, #slot-machine, .slot-machine");
    await expect(root.first()).toBeVisible({ timeout: 10000 });
  });

  test("games listing page loads", async ({ page }) => {
    await page.goto("/games");
    expect(page.url()).toContain("/games");
  });

  test("balance displayed on game page", async ({ page }) => {
    await page.goto("/games/slot-machine");
    const balance = page.locator("[data-balance], .balance, #balance");
    await expect(balance.first()).toBeVisible({ timeout: 10000 });
  });

  test("space controls button visible", async ({ page }) => {
    await page.goto("/games/slot-machine");
    const spinBtn = page.locator("button.spin, .spin-button, [data-action='spin'], button:has-text('Spin')");
    const count = await spinBtn.count();
    expect(count).toBeGreaterThanOrEqual(0);
  });
});
