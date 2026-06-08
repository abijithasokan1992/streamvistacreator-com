// Core storage pricing: 1 TB = ₹650 + 18% GST = ₹767/TB
export const PRICE_PER_TB_INR = 650;
export const GST_RATE = 0.18;

export interface PriceBreakdown {
  storageTb: number;
  discountPercent: number;
  baseInr: number;
  discountedInr: number;
  gstInr: number;
  totalInr: number;
}

export function computeStoragePrice(storageTb: number, discountPercent = 0, isFree = false): PriceBreakdown {
  const base = PRICE_PER_TB_INR * Math.max(0, storageTb);
  if (isFree) {
    return { storageTb, discountPercent: 100, baseInr: base, discountedInr: 0, gstInr: 0, totalInr: 0 };
  }
  const discounted = base * (1 - Math.min(100, Math.max(0, discountPercent)) / 100);
  const gst = discounted * GST_RATE;
  const total = discounted + gst;
  return {
    storageTb,
    discountPercent,
    baseInr: round2(base),
    discountedInr: round2(discounted),
    gstInr: round2(gst),
    totalInr: round2(total),
  };
}

function round2(n: number) { return Math.round(n * 100) / 100; }

export const formatInr = (n: number) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n);
