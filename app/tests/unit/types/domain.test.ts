import { describe, it, expect } from "@jest/globals";
import {
  isGameModeName,
  isRewardModeName,
  isTransactionType,
  isTransactionDirection,
  isJwtUserPayload,
} from "../../../src/types/domain.js";

describe("isGameModeName", () => {
  it.each(["numbers", "roman", "fruits", "animals", "emoji"])(
    "returns true for valid mode '%s'",
    (mode) => {
      expect(isGameModeName(mode)).toBe(true);
    },
  );

  it("returns false for invalid string", () => {
    expect(isGameModeName("poker")).toBe(false);
  });

  it("returns false for number", () => {
    expect(isGameModeName(1)).toBe(false);
  });

  it("returns false for null", () => {
    expect(isGameModeName(null)).toBe(false);
  });

  it("returns false for undefined", () => {
    expect(isGameModeName(undefined)).toBe(false);
  });
});

describe("isRewardModeName", () => {
  it("returns true for 'single'", () => {
    expect(isRewardModeName("single")).toBe(true);
  });

  it("returns true for 'multi'", () => {
    expect(isRewardModeName("multi")).toBe(true);
  });

  it("returns false for invalid string", () => {
    expect(isRewardModeName("triple")).toBe(false);
  });

  it("returns false for non-string types", () => {
    expect(isRewardModeName(1)).toBe(false);
    expect(isRewardModeName(null)).toBe(false);
  });
});

describe("isTransactionType", () => {
  it.each([
    "slot_spin_bet",
    "slot_spin_win",
    "slot_minigame_bet",
    "slot_minigame_win",
    "wallet_topup",
  ])("returns true for valid type '%s'", (type) => {
    expect(isTransactionType(type)).toBe(true);
  });

  it("returns false for invalid string", () => {
    expect(isTransactionType("purchase")).toBe(false);
  });

  it("returns false for non-string", () => {
    expect(isTransactionType(42)).toBe(false);
  });
});

describe("isTransactionDirection", () => {
  it("returns true for 'credit'", () => {
    expect(isTransactionDirection("credit")).toBe(true);
  });

  it("returns true for 'debit'", () => {
    expect(isTransactionDirection("debit")).toBe(true);
  });

  it("returns false for invalid string", () => {
    expect(isTransactionDirection("refund")).toBe(false);
  });

  it("returns false for non-string", () => {
    expect(isTransactionDirection(0)).toBe(false);
    expect(isTransactionDirection(null)).toBe(false);
  });
});

describe("isJwtUserPayload", () => {
  it("returns true for valid payload with sub", () => {
    expect(isJwtUserPayload({ sub: "123" })).toBe(true);
  });

  it("returns true for payload with extra fields", () => {
    expect(isJwtUserPayload({ sub: "123", email: "a@b.com", iat: 1000 })).toBe(true);
  });

  it("returns false for null", () => {
    expect(isJwtUserPayload(null)).toBe(false);
  });

  it("returns false for undefined", () => {
    expect(isJwtUserPayload(undefined)).toBe(false);
  });

  it("returns false for missing sub", () => {
    expect(isJwtUserPayload({ email: "a@b.com" })).toBe(false);
  });

  it("returns false for numeric sub", () => {
    expect(isJwtUserPayload({ sub: 123 })).toBe(false);
  });

  it("returns false for string primitive", () => {
    expect(isJwtUserPayload("string")).toBe(false);
  });
});
