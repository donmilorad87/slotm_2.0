import { test, expect } from "@playwright/test";
import { generateTestEmail, registerUser, TEST_PASSWORD } from "./helpers/auth.helper.js";

test.describe("Wallet", () => {
  test.beforeEach(async ({ page }) => {
    const email = generateTestEmail();
    await registerUser(page, email, TEST_PASSWORD);
    await page.goto("/wallet");
  });

  test("wallet page loads with balance display", async ({ page }) => {
    const balance = page.locator("#walletBalance, .wallet-balance, [data-balance]");
    await expect(balance.first()).toBeVisible({ timeout: 5000 });
  });

  test("quick topup buttons are visible", async ({ page }) => {
    const buttons = page.locator(".wallet-topup-btn, .topup-btn, button[data-amount]");
    const count = await buttons.count();
    expect(count).toBeGreaterThanOrEqual(1);
  });

  test("custom topup form present", async ({ page }) => {
    const form = page.locator("#customTopupForm, form:has(input[name='amount'])");
    const amountInput = page.locator("input[name='amount'], input[name='custom_amount']");
    const visible = (await form.count()) > 0 || (await amountInput.count()) > 0;
    expect(visible).toBe(true);
  });

  test("transaction history section present", async ({ page }) => {
    const txSection = page.locator("#walletTransactionsBody, .transaction-history, .transactions-list, table");
    await expect(txSection.first()).toBeVisible({ timeout: 5000 });
  });

  test("new user shows balance", async ({ page }) => {
    const balance = page.locator("#walletBalance, .wallet-balance, [data-balance]");
    const text = await balance.first().textContent();
    expect(text).toBeDefined();
  });
});
