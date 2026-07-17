/**
 * Idempotency keys for revenue statement imports.
 * Uses a stable deterministic hash of the normalised identifying fields so
 * that re-uploading the same statement or row is detectable server-side
 * without silent overwrite.
 */

function stableStringify(v: unknown): string {
  if (v === null || v === undefined) return "";
  if (typeof v !== "object") return String(v).trim().toLowerCase();
  if (Array.isArray(v)) return "[" + v.map(stableStringify).join(",") + "]";
  const keys = Object.keys(v as Record<string, unknown>).sort();
  return "{" + keys.map((k) => `${k}:${stableStringify((v as any)[k])}`).join(",") + "}";
}

// FNV-1a 64-bit → hex. Deterministic across runtimes without needing crypto.
export function fnv1a64(s: string): string {
  let h = 0xcbf29ce484222325n;
  const prime = 0x100000001b3n;
  const bytes = new TextEncoder().encode(s);
  for (const b of bytes) {
    h ^= BigInt(b);
    h = (h * prime) & 0xffffffffffffffffn;
  }
  return h.toString(16).padStart(16, "0");
}

export interface StatementIdInput {
  sourceType: string; // e.g. "bookmyshow"
  sourceStatementId: string; // provider's statement number
  partnerId?: string | null;
  periodStart?: string | null;
  periodEnd?: string | null;
  currency?: string | null;
}

export function statementIdempotencyKey(inp: StatementIdInput): string {
  return fnv1a64(
    stableStringify({
      s: inp.sourceType,
      i: inp.sourceStatementId,
      p: inp.partnerId ?? "",
      ps: inp.periodStart ?? "",
      pe: inp.periodEnd ?? "",
      c: (inp.currency ?? "INR").toUpperCase(),
    }),
  );
}

export interface RowIdInput {
  statementKey: string;
  titleExternalRef?: string | null;
  occurredOn?: string | null;
  channel?: string | null;
  territory?: string | null;
  units?: number | null;
  grossAmountMinor?: number | null;
  lineIndex?: number | null;
}

export function rowIdempotencyKey(inp: RowIdInput): string {
  return fnv1a64(
    stableStringify({
      k: inp.statementKey,
      t: inp.titleExternalRef ?? "",
      d: inp.occurredOn ?? "",
      ch: inp.channel ?? "",
      tr: inp.territory ?? "",
      u: inp.units ?? "",
      g: inp.grossAmountMinor ?? "",
      x: inp.lineIndex ?? "",
    }),
  );
}
