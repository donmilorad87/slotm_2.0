/** Shared payload parsing utilities for untrusted input normalization. */

import type { JsonValue } from "../types/domain.js";

export type RawObject = Record<string, unknown>;

/**
 * Narrow an unknown value to an object type.
 * Returns Partial<T> — callers must handle missing fields.
 * All current body interfaces use `?: unknown` fields so Partial<T> === T.
 */
export function asObject<T extends object = RawObject>(value: unknown): Partial<T> {
  if (typeof value === "object" && value !== null) {
    return value as Partial<T>;
  }
  return {};
}

/**
 * Parse a JSON string safely, returning a typed JsonValue.
 * Falls back to the provided default on empty input or parse errors.
 */
export function safeJsonParse(raw: unknown, fallback: JsonValue = null): JsonValue {
  if (typeof raw !== "string" || raw.length === 0) {
    return fallback;
  }
  try {
    return JSON.parse(raw) as JsonValue;
  } catch (_: unknown) {
    return fallback;
  }
}

export function toInt(value: unknown, fallback = 0): number {
  const parsed = Number.parseInt(String(value ?? fallback), 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function toErrorMessage(errorValue: unknown, fallback: string): string {
  if (errorValue instanceof Error && errorValue.message) {
    return errorValue.message;
  }
  return fallback;
}
