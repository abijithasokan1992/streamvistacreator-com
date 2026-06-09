// Server-authoritative pricing. Keep in sync with src/components/streamvista/plans.ts
//
// StreamVista Cloud X (June 2026):
//   • free     — 128 GB storage, 500 GB/mo bandwidth (₹10/GB overage)
//   • creator  — 1 TB / month at ₹650 + 18% GST = ₹767 (PAYG: each extra TB at same price)
//
// `topup` is used for Pay-As-You-Go single-shot purchases of 1 TB blocks.
export type Cycle = "creator" | "topup";

export const PLAN_BASE_INR: Record<Cycle, number> = {
  creator: 650,   // per TB, pre-GST
  topup: 650,     // per TB, pre-GST
};

export const GST_RATE = 0.18;

// Valid promo codes (server-side only). Map of code -> discount fraction.
export const PROMO_CODES: Record<string, number> = {
  INDUSTRY100: 0.10,
};

export function computeFinalPricePaise(
  cycle: Cycle,
  promoCode: string | null | undefined,
  quantity: number = 1, // number of TB blocks
): { basePaise: number; subtotalPaise: number; gstPaise: number; finalPaise: number; promoValid: boolean } {
  const base = PLAN_BASE_INR[cycle];
  if (typeof base !== "number") throw new Error("invalid_cycle");
  const qty = Math.max(1, Math.floor(quantity || 1));
  const code = (promoCode || "").trim().toUpperCase();
  const discount = code && PROMO_CODES[code] ? PROMO_CODES[code] : 0;
  const subtotal = Math.round(base * qty * (1 - discount));
  const gst = Math.round(subtotal * GST_RATE);
  const final = subtotal + gst;
  return {
    basePaise: base * qty * 100,
    subtotalPaise: subtotal * 100,
    gstPaise: gst * 100,
    finalPaise: final * 100,
    promoValid: discount > 0,
  };
}
