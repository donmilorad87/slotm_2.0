import { describe, it, expect } from "@jest/globals";
import { asObject, safeJsonParse, toInt, toErrorMessage } from "../../../src/lib/payloadParsers.js";

describe("asObject", () => {
  it("returns the same object when given an object", () => {
    const obj = { a: 1 };
    expect(asObject(obj)).toBe(obj);
  });

  it("returns empty object for null", () => {
    expect(asObject(null)).toEqual({});
  });

  it("returns empty object for undefined", () => {
    expect(asObject(undefined)).toEqual({});
  });

  it("returns empty object for string", () => {
    expect(asObject("hello")).toEqual({});
  });

  it("returns empty object for number", () => {
    expect(asObject(42)).toEqual({});
  });

  it("returns array when given an array (arrays are objects)", () => {
    const arr = [1, 2, 3];
    expect(asObject(arr)).toBe(arr);
  });
});

describe("safeJsonParse", () => {
  it("parses valid JSON string", () => {
    expect(safeJsonParse('{"a":1}')).toEqual({ a: 1 });
  });

  it("parses JSON array", () => {
    expect(safeJsonParse("[1,2,3]")).toEqual([1, 2, 3]);
  });

  it("parses JSON primitive string", () => {
    expect(safeJsonParse('"hello"')).toBe("hello");
  });

  it("returns fallback for invalid JSON", () => {
    expect(safeJsonParse("{invalid}", "default")).toBe("default");
  });

  it("returns null fallback by default", () => {
    expect(safeJsonParse("{bad}")).toBeNull();
  });

  it("returns fallback for empty string", () => {
    expect(safeJsonParse("", "empty")).toBe("empty");
  });

  it("returns fallback for non-string (number)", () => {
    expect(safeJsonParse(42, "fallback")).toBe("fallback");
  });

  it("returns fallback for null", () => {
    expect(safeJsonParse(null, "fallback")).toBe("fallback");
  });

  it("returns fallback for undefined", () => {
    expect(safeJsonParse(undefined, "fallback")).toBe("fallback");
  });

  it("returns null fallback for non-string by default", () => {
    expect(safeJsonParse(123)).toBeNull();
  });
});

describe("toInt", () => {
  it("parses valid integer string", () => {
    expect(toInt("42")).toBe(42);
  });

  it("parses negative integer string", () => {
    expect(toInt("-5")).toBe(-5);
  });

  it("returns fallback for 'abc'", () => {
    expect(toInt("abc", 99)).toBe(99);
  });

  it("returns fallback for null", () => {
    expect(toInt(null, 10)).toBe(10);
  });

  it("returns fallback for undefined", () => {
    expect(toInt(undefined, 7)).toBe(7);
  });

  it("returns 0 as default fallback", () => {
    expect(toInt("notanumber")).toBe(0);
  });

  it("truncates float strings", () => {
    expect(toInt("3.9")).toBe(3);
  });

  it("handles number input", () => {
    expect(toInt(42)).toBe(42);
  });
});

describe("toErrorMessage", () => {
  it("extracts message from Error", () => {
    expect(toErrorMessage(new Error("boom"), "fallback")).toBe("boom");
  });

  it("returns fallback for non-Error", () => {
    expect(toErrorMessage("string error", "fallback")).toBe("fallback");
  });

  it("returns fallback for null", () => {
    expect(toErrorMessage(null, "fallback")).toBe("fallback");
  });

  it("returns fallback for undefined", () => {
    expect(toErrorMessage(undefined, "fallback")).toBe("fallback");
  });
});
