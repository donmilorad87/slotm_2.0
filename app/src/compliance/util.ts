import { createHash } from "node:crypto";

/** Short stable hash for dedupe keys. */
export function shortHash(input: string): string {
  return createHash("sha1").update(input).digest("hex").slice(0, 12);
}

export function dedupeKey(parts: ReadonlyArray<string | number>): string {
  return shortHash(parts.join("|"));
}
