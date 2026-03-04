import { describe, it, expect } from "@jest/globals";
import { randomId, hashPassword, verifyPassword } from "../../../src/lib/security.js";

describe("randomId", () => {
  it("returns a hex string", () => {
    const id = randomId();
    expect(id).toMatch(/^[0-9a-f]+$/);
  });

  it("returns correct length for default bytes (32)", () => {
    const id = randomId();
    expect(id).toHaveLength(64);
  });

  it("returns correct length for custom bytes", () => {
    const id = randomId(16);
    expect(id).toHaveLength(32);
  });

  it("produces unique values", () => {
    const ids = new Set(Array.from({ length: 10 }, () => randomId()));
    expect(ids.size).toBe(10);
  });
});

describe("hashPassword", () => {
  it("returns an object with salt and hash", () => {
    const result = hashPassword("password123");
    expect(result).toHaveProperty("salt");
    expect(result).toHaveProperty("hash");
    expect(typeof result.salt).toBe("string");
    expect(typeof result.hash).toBe("string");
  });

  it("produces deterministic hash with same salt", () => {
    const first = hashPassword("password123", "fixedsalt");
    const second = hashPassword("password123", "fixedsalt");
    expect(first.hash).toBe(second.hash);
  });

  it("produces different hash with different salt", () => {
    const first = hashPassword("password123", "salt1");
    const second = hashPassword("password123", "salt2");
    expect(first.hash).not.toBe(second.hash);
  });

  it("uses provided salt", () => {
    const result = hashPassword("password123", "mysalt");
    expect(result.salt).toBe("mysalt");
  });

  it("generates random salt when not provided", () => {
    const a = hashPassword("password123");
    const b = hashPassword("password123");
    expect(a.salt).not.toBe(b.salt);
  });
});

describe("verifyPassword", () => {
  it("returns true for correct password, salt, and hash", () => {
    const { salt, hash } = hashPassword("correctPassword");
    expect(verifyPassword("correctPassword", salt, hash)).toBe(true);
  });

  it("returns false for wrong password", () => {
    const { salt, hash } = hashPassword("correctPassword");
    expect(verifyPassword("wrongPassword", salt, hash)).toBe(false);
  });

  it("returns false for wrong salt", () => {
    const { hash } = hashPassword("correctPassword", "originalsalt");
    expect(verifyPassword("correctPassword", "wrongsalt", hash)).toBe(false);
  });
});
