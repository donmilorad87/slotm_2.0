import { createHash } from "node:crypto";

import type { BBoxEmu, ParsedTable } from "./model.js";

/** Short stable hash for dedupe keys. */
export function shortHash(input: string): string {
  return createHash("sha1").update(input).digest("hex").slice(0, 12);
}

/**
 * Position (start fraction) and size (fraction) of one track along an axis.
 * Uses the declared track sizes when they are all positive; otherwise falls
 * back to an equal split. PPTX row heights are *minimums* (LibreOffice grows
 * them with content) and are often 0, so the equal-split fallback keeps the
 * result sane instead of collapsing onto one edge.
 */
function axisFraction(
  sizes: readonly number[],
  count: number,
  index: number,
): { start: number; size: number } {
  const usable = sizes.length === count && sizes.every((s) => s > 0);
  if (usable) {
    const total = sizes.reduce((a, b) => a + b, 0);
    const before = sizes.slice(0, index).reduce((a, b) => a + b, 0);
    return { start: before / total, size: (sizes[index] ?? 0) / total };
  }
  return { start: index / count, size: 1 / count };
}

/**
 * Bounding box of a single table cell, derived from the table's bbox and grid
 * geometry, so a finding points at the cell's spot rather than the whole table.
 * Returns the table bbox unchanged if the indices are out of range.
 */
export function cellBBoxEmu(
  tableBbox: BBoxEmu,
  table: ParsedTable,
  rowIndex: number,
  cellIndex: number,
): BBoxEmu {
  const colCount = table.colWidthsEmu.length || table.rows[0]?.cells.length || 1;
  const rowCount = table.rows.length || 1;
  if (rowIndex < 0 || cellIndex < 0 || rowIndex >= rowCount || cellIndex >= colCount) {
    return tableBbox;
  }
  const col = axisFraction(table.colWidthsEmu, colCount, cellIndex);
  const row = axisFraction(
    table.rows.map((r) => r.heightEmu),
    rowCount,
    rowIndex,
  );
  return {
    x: Math.round(tableBbox.x + tableBbox.cx * col.start),
    y: Math.round(tableBbox.y + tableBbox.cy * row.start),
    cx: Math.max(Math.round(tableBbox.cx * col.size), 1),
    cy: Math.max(Math.round(tableBbox.cy * row.size), 1),
  };
}

export function dedupeKey(parts: ReadonlyArray<string | number>): string {
  return shortHash(parts.join("|"));
}
