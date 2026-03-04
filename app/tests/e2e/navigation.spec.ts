import { test, expect } from "@playwright/test";
import { generateTestEmail, registerUser, TEST_PASSWORD } from "./helpers/auth.helper.js";

test.describe("Navigation", () => {
  let email: string;

  test.beforeEach(async ({ page }) => {
    email = generateTestEmail();
    await registerUser(page, email, TEST_PASSWORD);
  });

  test("topbar avatar is visible after login", async ({ page }) => {
    const avatar = page.locator(".topbar__avatar, .navbar__avatar, .user-avatar");
    await expect(avatar.first()).toBeVisible({ timeout: 5000 });
  });

  test("clicking avatar opens dropdown", async ({ page }) => {
    const avatar = page.locator(".topbar__avatar, .navbar__avatar, .user-avatar");
    await avatar.first().click();
    const dropdown = page.locator(".topbar__dropdown, .navbar__dropdown, .user-dropdown");
    await expect(dropdown.first()).toBeVisible({ timeout: 3000 });
  });

  test("dropdown has Profile link", async ({ page }) => {
    const avatar = page.locator(".topbar__avatar, .navbar__avatar, .user-avatar");
    await avatar.first().click();
    const profileLink = page.locator('a[href*="/profile"]');
    await expect(profileLink.first()).toBeVisible();
  });

  test("dropdown has Wallet link", async ({ page }) => {
    const avatar = page.locator(".topbar__avatar, .navbar__avatar, .user-avatar");
    await avatar.first().click();
    const walletLink = page.locator('a[href*="/wallet"]');
    await expect(walletLink.first()).toBeVisible();
  });

  test("profile link navigates to /profile", async ({ page }) => {
    await page.goto("/profile");
    expect(page.url()).toContain("/profile");
  });

  test("wallet link navigates to /wallet", async ({ page }) => {
    await page.goto("/wallet");
    expect(page.url()).toContain("/wallet");
  });

  test("games link navigates to /games", async ({ page }) => {
    await page.goto("/games");
    expect(page.url()).toContain("/games");
  });
});
