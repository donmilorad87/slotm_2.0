import { describe, it, expect } from "@jest/globals";
import { BaseController } from "../../../src/controllers/BaseController.js";
import { createTestUser } from "../helpers/mockFactories.js";

class TestController extends BaseController {
  public testSanitizeRedirectTarget(value: unknown, fallback?: string): string {
    return this.sanitizeRedirectTarget(value, fallback);
  }

  public testQueryString(
    query: Record<string, unknown> | undefined,
    key: string,
  ): string {
    return this.queryString(query, key);
  }

  public testToInt(value: unknown, fallback?: number): number {
    return this.toInt(value, fallback);
  }

  public testUserInitials(user: Parameters<BaseController["userInitials"]>[0]): string {
    return this.userInitials(user);
  }

  public testUserTemplateData(user: Parameters<BaseController["userTemplateData"]>[0]) {
    return this.userTemplateData(user);
  }
}

const ctrl = new TestController();

describe("BaseController.sanitizeRedirectTarget", () => {
  it("returns value when it starts with /", () => {
    expect(ctrl.testSanitizeRedirectTarget("/dashboard")).toBe("/dashboard");
  });

  it("returns fallback for null", () => {
    expect(ctrl.testSanitizeRedirectTarget(null)).toBe("/");
  });

  it("returns fallback for undefined", () => {
    expect(ctrl.testSanitizeRedirectTarget(undefined)).toBe("/");
  });

  it("returns fallback for empty string", () => {
    expect(ctrl.testSanitizeRedirectTarget("")).toBe("/");
  });

  it("returns fallback for non-string", () => {
    expect(ctrl.testSanitizeRedirectTarget(42)).toBe("/");
  });

  it("returns fallback when path does not start with /", () => {
    expect(ctrl.testSanitizeRedirectTarget("http://evil.com")).toBe("/");
  });

  it("returns fallback for protocol-relative URL (//)", () => {
    expect(ctrl.testSanitizeRedirectTarget("//evil.com")).toBe("/");
  });

  it("uses custom fallback", () => {
    expect(ctrl.testSanitizeRedirectTarget(null, "/home")).toBe("/home");
  });

  it("allows deep paths", () => {
    expect(ctrl.testSanitizeRedirectTarget("/a/b/c?x=1")).toBe("/a/b/c?x=1");
  });
});

describe("BaseController.queryString", () => {
  it("returns string value for key", () => {
    expect(ctrl.testQueryString({ name: "hello" }, "name")).toBe("hello");
  });

  it("returns empty string for missing key", () => {
    expect(ctrl.testQueryString({ name: "hello" }, "missing")).toBe("");
  });

  it("returns empty string for undefined query", () => {
    expect(ctrl.testQueryString(undefined, "name")).toBe("");
  });

  it("returns first element when value is array", () => {
    expect(ctrl.testQueryString({ ids: ["a", "b"] }, "ids")).toBe("a");
  });

  it("stringifies non-string values", () => {
    expect(ctrl.testQueryString({ count: 42 }, "count")).toBe("42");
  });

  it("returns empty string for null value", () => {
    expect(ctrl.testQueryString({ key: null }, "key")).toBe("");
  });
});

describe("BaseController.toInt", () => {
  it("parses numeric string", () => {
    expect(ctrl.testToInt("42")).toBe(42);
  });

  it("returns fallback for non-numeric string", () => {
    expect(ctrl.testToInt("abc")).toBe(0);
  });

  it("returns fallback for null", () => {
    expect(ctrl.testToInt(null)).toBe(0);
  });

  it("returns fallback for undefined", () => {
    expect(ctrl.testToInt(undefined)).toBe(0);
  });

  it("uses custom fallback", () => {
    expect(ctrl.testToInt("abc", 5)).toBe(5);
  });

  it("parses negative numbers", () => {
    expect(ctrl.testToInt("-10")).toBe(-10);
  });

  it("truncates decimals", () => {
    expect(ctrl.testToInt("3.9")).toBe(3);
  });
});

describe("BaseController.userInitials", () => {
  it("returns initials from first and last name", () => {
    const user = createTestUser({ firstName: "John", lastName: "Doe" });
    expect(ctrl.testUserInitials(user)).toBe("JD");
  });

  it("returns first two chars of first name when no last name", () => {
    const user = createTestUser({ firstName: "Alice", lastName: null });
    expect(ctrl.testUserInitials(user)).toBe("AL");
  });

  it("returns first two chars of email when no names", () => {
    const user = createTestUser({ firstName: null, lastName: null, email: "z@example.com" });
    expect(ctrl.testUserInitials(user)).toBe("Z@");
  });

  it("uppercases initials", () => {
    const user = createTestUser({ firstName: "jane", lastName: "smith" });
    expect(ctrl.testUserInitials(user)).toBe("JS");
  });

  it("trims whitespace from names", () => {
    const user = createTestUser({ firstName: "  Bob  ", lastName: "  Lee  " });
    expect(ctrl.testUserInitials(user)).toBe("BL");
  });

  it("handles single-char first name without last name", () => {
    const user = createTestUser({ firstName: "X", lastName: null });
    expect(ctrl.testUserInitials(user)).toBe("X");
  });
});

describe("BaseController.userTemplateData", () => {
  it("returns all template fields", () => {
    const user = createTestUser({
      email: "alice@test.com",
      firstName: "Alice",
      lastName: "Wonder",
      profilePicture: "/uploads/pic.jpg",
    });
    const data = ctrl.testUserTemplateData(user);
    expect(data.user_email).toBe("alice@test.com");
    expect(data.user_first_name).toBe("Alice");
    expect(data.user_last_name).toBe("Wonder");
    expect(data.user_profile_picture).toBe("/uploads/pic.jpg");
    expect(data.user_initials).toBe("AW");
  });

  it("returns empty strings for null fields", () => {
    const user = createTestUser({
      firstName: null,
      lastName: null,
      profilePicture: null,
    });
    const data = ctrl.testUserTemplateData(user);
    expect(data.user_first_name).toBe("");
    expect(data.user_last_name).toBe("");
    expect(data.user_profile_picture).toBe("");
  });
});
