import { describe, it, expect } from "@jest/globals";
import { parseCookies, serializeCookie } from "../../../src/lib/cookies.js";

describe("parseCookies", () => {
  it("parses a single cookie", () => {
    expect(parseCookies("name=value")).toEqual({ name: "value" });
  });

  it("parses multiple cookies", () => {
    const result = parseCookies("a=1; b=2; c=3");
    expect(result).toEqual({ a: "1", b: "2", c: "3" });
  });

  it("returns empty object for null", () => {
    expect(parseCookies(null)).toEqual({});
  });

  it("returns empty object for undefined", () => {
    expect(parseCookies(undefined)).toEqual({});
  });

  it("returns empty object for empty string", () => {
    expect(parseCookies("")).toEqual({});
  });

  it("handles URL-encoded values", () => {
    const result = parseCookies("name=hello%20world");
    expect(result.name).toBe("hello world");
  });

  it("handles URL-encoded keys", () => {
    const result = parseCookies("my%20key=value");
    expect(result["my key"]).toBe("value");
  });

  it("handles cookies with = in value", () => {
    const result = parseCookies("token=abc=def");
    expect(result.token).toBe("abc=def");
  });

  it("skips empty segments", () => {
    const result = parseCookies("a=1;; ;b=2");
    expect(result).toEqual({ a: "1", b: "2" });
  });

  it("skips entries without =", () => {
    const result = parseCookies("a=1; invalid; b=2");
    expect(result).toEqual({ a: "1", b: "2" });
  });

  it("trims whitespace around pairs but preserves spaces in key/value", () => {
    const result = parseCookies("  a = 1 ;  b = 2  ");
    expect(result).toHaveProperty("a ");
    expect(result["a "]).toBe(" 1");
  });

  it("handles single cookie without spaces", () => {
    expect(parseCookies("session=abc123")).toEqual({ session: "abc123" });
  });
});

describe("serializeCookie", () => {
  it("serializes basic name=value", () => {
    const result = serializeCookie("name", "value");
    expect(result).toBe("name=value");
  });

  it("URL-encodes name and value", () => {
    const result = serializeCookie("my name", "hello world");
    expect(result).toContain("my%20name=hello%20world");
  });

  it("includes Max-Age when provided", () => {
    const result = serializeCookie("a", "b", { maxAge: 3600 });
    expect(result).toContain("Max-Age=3600");
  });

  it("floors Max-Age to integer", () => {
    const result = serializeCookie("a", "b", { maxAge: 3600.7 });
    expect(result).toContain("Max-Age=3600");
  });

  it("includes Path when provided", () => {
    const result = serializeCookie("a", "b", { path: "/" });
    expect(result).toContain("Path=/");
  });

  it("includes HttpOnly when true", () => {
    const result = serializeCookie("a", "b", { httpOnly: true });
    expect(result).toContain("HttpOnly");
  });

  it("excludes HttpOnly when false or absent", () => {
    const result = serializeCookie("a", "b", {});
    expect(result).not.toContain("HttpOnly");
  });

  it("includes SameSite", () => {
    const result = serializeCookie("a", "b", { sameSite: "Strict" });
    expect(result).toContain("SameSite=Strict");
  });

  it("includes Secure when true", () => {
    const result = serializeCookie("a", "b", { secure: true });
    expect(result).toContain("Secure");
  });

  it("combines all options", () => {
    const result = serializeCookie("token", "xyz", {
      maxAge: 7200,
      path: "/",
      httpOnly: true,
      sameSite: "Lax",
      secure: true,
    });
    expect(result).toContain("token=xyz");
    expect(result).toContain("Max-Age=7200");
    expect(result).toContain("Path=/");
    expect(result).toContain("HttpOnly");
    expect(result).toContain("SameSite=Lax");
    expect(result).toContain("Secure");
  });

  it("uses semicolon-space delimiter", () => {
    const result = serializeCookie("a", "b", { httpOnly: true, secure: true });
    expect(result).toBe("a=b; HttpOnly; Secure");
  });
});
