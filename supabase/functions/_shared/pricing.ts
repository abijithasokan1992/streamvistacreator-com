// Server-authoritative pricing. Keep in sync with src/components/streamvista/plans.ts
export type Cycle = "monthly" | "quarterly" | "yearly";

export const PLAN_PRICES: Record<Cycle, number> = {
  monthly: 21999,
  quarterly: 59999,
  yearly: 219999,
};

export const GST_RATE = 0.18;

// Valid promo codes (server-side only). Map of code -> discount fraction.
export const PROMO_CODES: Record<string, number> = {
  INDUSTRY100: 0.1,
};

export function computeFinalPricePaise(
  cycle: Cycle,
  promoCode: string | null | undefined,
): { basePaise: number; subtotalPaise: number; gstPaise: number; finalPaise: number; promoValid: boolean } {
  const base = PLAN_PRICES[cycle];
  if (typeof base !== "number") throw new Error("invalid_cycle");
  const code = (promoCode || "").trim().toUpperCase();
  const discount = code && PROMO_CODES[code] ? PROMO_CODES[code] : 0;
  const subtotal = Math.round(base * (1 - discount));
  const gst = Math.round(subtotal * GST_RATE);
  const final = subtotal + gst;
  return {
    basePaise: base * 100,
    subtotalPaise: subtotal * 100,
    gstPaise: gst * 100,
    finalPaise: final * 100,
    promoValid: discount > 0,
  };
}
