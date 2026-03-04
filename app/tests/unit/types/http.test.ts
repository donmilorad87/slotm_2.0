import { describe, it, expect } from "@jest/globals";
import { hasAuthenticatedUser } from "../../../src/types/http.js";

describe("hasAuthenticatedUser", () => {
  it("returns true when request has auth.user", () => {
    const req = {
      auth: {
        user: { id: 1, email: "test@example.com" },
        token: "jwt-token",
        payload: { sub: 1 },
        invalidToken: false,
      },
    };
    expect(hasAuthenticatedUser(req as any)).toBe(true);
  });

  it("returns false when request has no auth", () => {
    const req = {};
    expect(hasAuthenticatedUser(req as any)).toBe(false);
  });

  it("returns false when auth exists but user is null", () => {
    const req = {
      auth: {
        user: null,
        token: null,
        payload: null,
        invalidToken: true,
      },
    };
    expect(hasAuthenticatedUser(req as any)).toBe(false);
  });

  it("returns false when auth exists but user is undefined", () => {
    const req = {
      auth: {
        token: "jwt-token",
        payload: { sub: 1 },
        invalidToken: false,
      },
    };
    expect(hasAuthenticatedUser(req as any)).toBe(false);
  });

  it("returns false when auth is undefined", () => {
    const req = { auth: undefined };
    expect(hasAuthenticatedUser(req as any)).toBe(false);
  });
});
