import { test, expect } from "@playwright/test";
import { generateTestEmail, registerUser, loginUser, TEST_PASSWORD } from "./helpers/auth.helper.js";

test.describe("Authentication", () => {
  test("register with valid credentials redirects to home", async ({ page }) => {
    const email = generateTestEmail();
    await registerUser(page, email, TEST_PASSWORD);
    expect(page.url()).not.toContain("/register");
  });

  test("register with duplicate email shows error", async ({ page }) => {
    const email = generateTestEmail();
    await registerUser(page, email, TEST_PASSWORD);
    await page.goto("/register");
    await page.fill('input[name="email"]', email);
    await page.fill('input[name="password"]', TEST_PASSWORD);
    const confirmInput = page.locator('input[name="password_confirm"], input[name="confirmPassword"]');
    if (await confirmInput.isVisible()) {
      await confirmInput.fill(TEST_PASSWORD);
    }
    await page.click('button[type="submit"]');
    const errorEl = page.locator("#authError, .auth-error, .error-message");
    await expect(errorEl.first()).toBeVisible({ timeout: 5000 });
  });

  test("register with short password shows error", async ({ page }) => {
    await page.goto("/register");
    await page.fill('input[name="email"]', generateTestEmail());
    await page.fill('input[name="password"]', "12345");
    const confirmInput = page.locator('input[name="password_confirm"], input[name="confirmPassword"]');
    if (await confirmInput.isVisible()) {
      await confirmInput.fill("12345");
    }
    await page.click('button[type="submit"]');
    const errorEl = page.locator("#authError, .auth-error, .error-message");
    await expect(errorEl.first()).toBeVisible({ timeout: 5000 });
  });

  test("login with valid credentials redirects to home", async ({ page }) => {
    const email = generateTestEmail();
    await registerUser(page, email, TEST_PASSWORD);
    await page.goto("/login");
    await loginUser(page, email, TEST_PASSWORD);
    expect(page.url()).not.toContain("/login");
  });

  test("login with wrong password shows error", async ({ page }) => {
    const email = generateTestEmail();
    await registerUser(page, email, TEST_PASSWORD);
    await page.goto("/login");
    await page.fill('input[name="email"]', email);
    await page.fill('input[name="password"]', "wrongpassword");
    await page.click('button[type="submit"]');
    const errorEl = page.locator("#authError, .auth-error, .error-message");
    await expect(errorEl.first()).toBeVisible({ timeout: 5000 });
  });

  test("logout redirects to login", async ({ page }) => {
    const email = generateTestEmail();
    await registerUser(page, email, TEST_PASSWORD);
    await page.goto("/logout");
    await page.waitForURL(/\/login/);
    expect(page.url()).toContain("/login");
  });

  test("protected route without auth redirects to login", async ({ page }) => {
    await page.goto("/wallet");
    await page.waitForURL(/\/login/);
    expect(page.url()).toContain("/login");
  });

  test("login with next param redirects to target", async ({ page }) => {
    const email = generateTestEmail();
    await registerUser(page, email, TEST_PASSWORD);
    await page.goto("/login?next=/wallet");
    await page.fill('input[name="email"]', email);
    await page.fill('input[name="password"]', TEST_PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/wallet/);
    expect(page.url()).toContain("/wallet");
  });

  test("register page has link to login", async ({ page }) => {
    await page.goto("/register");
    const loginLink = page.locator('a[href*="/login"]');
    await expect(loginLink.first()).toBeVisible();
  });
});
