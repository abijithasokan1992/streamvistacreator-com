/**
 * Decimal-safe amount helpers. Everything is stored as integer paise/cents
 * to avoid float drift. Input may arrive as "₹ 1,234.50", "1234.5", numbers,
 * or blanks. Out-of-range or non-finite values return null so callers can
 * surface a row error rather than silently coerce.
 */

const MAX_AMOUNT_PAISE = 10n ** 15n; // 10 trillion paise ceiling — well above any realistic statement.

export function parseAmountToMinor(input: unknown): number | null {
  if (input === null || input === undefined) return null;
  if (typeof input === "number") {
    if (!Number.isFinite(input)) return null;
    return roundToMinor(input);
  }
  const raw = String(input).trim();
  if (!raw) return null;
  const negative = /^\(.*\)$/.test(raw) || raw.startsWith("-");
  // Strip currency symbols, commas, parens, spaces, common suffixes.
  const cleaned = raw
    .replace(/[₹$€£¥]/g, "")
    .replace(/[,\s()]/g, "")
    .replace(/^-/, "");
  if (!/^\d+(\.\d+)?$/.test(cleaned)) return null;
  const n = Number(cleaned);
  if (!Number.isFinite(n)) return null;
  const minor = roundToMinor(negative ? -n : n);
  if (minor === null) return null;
  if (BigInt(Math.abs(minor)) > MAX_AMOUNT_PAISE) return null;
  return minor;
}

function roundToMinor(v: number): number | null {
  const scaled = Math.round(v * 100);
  if (!Number.isFinite(scaled)) return null;
  if (Math.abs(scaled) > Number.MAX_SAFE_INTEGER) return null;
  return scaled;
}

export function parseRate(input: unknown): number | null {
  if (input === null || input === undefined) return null;
  const raw = String(input).trim().replace(/%$/, "");
  if (!raw) return null;
  const n = Number(raw);
  if (!Number.isFinite(n)) return null;
  // Accept either 0..1 fraction or 0..100 percent; normalise to fraction.
  const frac = n > 1 ? n / 100 : n;
  if (frac < 0 || frac > 1) return null;
  return frac;
}

export function formatMinorAsINR(paise: number | null | undefined): string {
  if (paise === null || paise === undefined || !Number.isFinite(paise)) return "—";
  const rupees = paise / 100;
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(rupees);
}
