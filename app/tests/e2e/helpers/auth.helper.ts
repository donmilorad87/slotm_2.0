import type { Page } from "@playwright/test";

export const TEST_PASSWORD = "Test123456";

export function generateTestEmail(): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).slice(2, 8);
  return `test-${timestamp}-${random}@e2e.test`;
}

export async function registerUser(
  page: Page,
  email: string,
  password: string,
): Promise<void> {
  await page.goto("/register");
  await page.fill('input[name="email"]', email);
  await page.fill('input[name="password"]', password);
  const confirmInput = page.locator('input[name="password_confirm"], input[name="confirmPassword"]');
  if (await confirmInput.isVisible()) {
    await confirmInput.fill(password);
  }
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/(home|games|profile)?$/);
}

export async function loginUser(
  page: Page,
  email: string,
  password: string,
): Promise<void> {
  await page.goto("/login");
  await page.fill('input[name="email"]', email);
  await page.fill('input[name="password"]', password);
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/(home|games|profile)?$/);
}
