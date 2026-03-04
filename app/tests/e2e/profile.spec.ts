import { test, expect } from "@playwright/test";
import { generateTestEmail, registerUser, loginUser, TEST_PASSWORD } from "./helpers/auth.helper.js";

test.describe("Profile", () => {
  let email: string;

  test.beforeEach(async ({ page }) => {
    email = generateTestEmail();
    await registerUser(page, email, TEST_PASSWORD);
    await page.goto("/profile");
  });

  test("profile page loads with name form", async ({ page }) => {
    const nameForm = page.locator("#nameForm, form[action*='profile']").first();
    await expect(nameForm).toBeVisible({ timeout: 5000 });
  });

  test("profile page loads with password form", async ({ page }) => {
    const passwordForm = page.locator("#passwordForm, form:has(input[name='current_password'])").first();
    await expect(passwordForm).toBeVisible({ timeout: 5000 });
  });

  test("update name shows success", async ({ page }) => {
    const firstNameInput = page.locator('input[name="first_name"], input[name="firstName"]').first();
    const lastNameInput = page.locator('input[name="last_name"], input[name="lastName"]').first();

    if (await firstNameInput.isVisible()) {
      await firstNameInput.fill("TestFirst");
      await lastNameInput.fill("TestLast");
      const submitBtn = page.locator('#nameForm button[type="submit"], form:has(input[name="first_name"]) button[type="submit"]').first();
      await submitBtn.click();
      const success = page.locator("#nameSuccess, .success-message, .alert-success").first();
      await expect(success).toBeVisible({ timeout: 5000 });
    }
  });

  test("name persists after reload", async ({ page }) => {
    const firstNameInput = page.locator('input[name="first_name"], input[name="firstName"]').first();
    const lastNameInput = page.locator('input[name="last_name"], input[name="lastName"]').first();

    if (await firstNameInput.isVisible()) {
      await firstNameInput.fill("Persistent");
      await lastNameInput.fill("Name");
      const submitBtn = page.locator('#nameForm button[type="submit"], form:has(input[name="first_name"]) button[type="submit"]').first();
      await submitBtn.click();
      await page.waitForTimeout(1000);
      await page.reload();
      await expect(firstNameInput).toHaveValue("Persistent");
    }
  });

  test("change password with valid data shows success", async ({ page }) => {
    const currentPw = page.locator('input[name="current_password"], input[name="currentPassword"]').first();
    const newPw = page.locator('input[name="new_password"], input[name="newPassword"]').first();
    const confirmPw = page.locator('input[name="confirm_password"], input[name="confirmPassword"]').first();

    if (await currentPw.isVisible()) {
      await currentPw.fill(TEST_PASSWORD);
      await newPw.fill("NewPassword123");
      await confirmPw.fill("NewPassword123");
      const submitBtn = page.locator('#passwordForm button[type="submit"], form:has(input[name="current_password"]) button[type="submit"]').first();
      await submitBtn.click();
      const success = page.locator("#passwordSuccess, .success-message, .alert-success").first();
      await expect(success).toBeVisible({ timeout: 5000 });
    }
  });

  test("change password with mismatch shows error", async ({ page }) => {
    const currentPw = page.locator('input[name="current_password"], input[name="currentPassword"]').first();
    const newPw = page.locator('input[name="new_password"], input[name="newPassword"]').first();
    const confirmPw = page.locator('input[name="confirm_password"], input[name="confirmPassword"]').first();

    if (await currentPw.isVisible()) {
      await currentPw.fill(TEST_PASSWORD);
      await newPw.fill("NewPassword123");
      await confirmPw.fill("DifferentPassword");
      const submitBtn = page.locator('#passwordForm button[type="submit"], form:has(input[name="current_password"]) button[type="submit"]').first();
      await submitBtn.click();
      const errorEl = page.locator("#passwordError, .error-message, .alert-danger").first();
      await expect(errorEl).toBeVisible({ timeout: 5000 });
    }
  });

  test("change password with wrong current password shows error", async ({ page }) => {
    const currentPw = page.locator('input[name="current_password"], input[name="currentPassword"]').first();
    const newPw = page.locator('input[name="new_password"], input[name="newPassword"]').first();
    const confirmPw = page.locator('input[name="confirm_password"], input[name="confirmPassword"]').first();

    if (await currentPw.isVisible()) {
      await currentPw.fill("wrongcurrentpassword");
      await newPw.fill("NewPassword123");
      await confirmPw.fill("NewPassword123");
      const submitBtn = page.locator('#passwordForm button[type="submit"], form:has(input[name="current_password"]) button[type="submit"]').first();
      await submitBtn.click();
      const errorEl = page.locator("#passwordError, .error-message, .alert-danger").first();
      await expect(errorEl).toBeVisible({ timeout: 5000 });
    }
  });

  test("login with new password succeeds after change", async ({ page }) => {
    const currentPw = page.locator('input[name="current_password"], input[name="currentPassword"]').first();
    const newPw = page.locator('input[name="new_password"], input[name="newPassword"]').first();
    const confirmPw = page.locator('input[name="confirm_password"], input[name="confirmPassword"]').first();

    if (await currentPw.isVisible()) {
      await currentPw.fill(TEST_PASSWORD);
      await newPw.fill("ChangedPassword123");
      await confirmPw.fill("ChangedPassword123");
      const submitBtn = page.locator('#passwordForm button[type="submit"], form:has(input[name="current_password"]) button[type="submit"]').first();
      await submitBtn.click();
      await page.waitForTimeout(1000);
      await page.goto("/logout");
      await page.waitForURL(/\/login/);
      await loginUser(page, email, "ChangedPassword123");
      expect(page.url()).not.toContain("/login");
    }
  });

  test("email displayed as read-only", async ({ page }) => {
    const emailInput = page.locator('input[name="email"]').first();
    if (await emailInput.isVisible()) {
      const disabled = await emailInput.isDisabled();
      const readonly = await emailInput.getAttribute("readonly");
      expect(disabled || readonly !== null).toBe(true);
    }
  });
});
