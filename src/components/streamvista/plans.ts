export type Cycle = "free" | "creator";

export interface Plan {
  cycle: Cycle;
  label: string;
  price: number;            // base INR (pre-GST)
  priceLabel: string;
  cadence: string;
  storageLabel: string;
  bandwidthLabel: string;
  features: string[];
  savings?: string;
  badge?: string;
  description: string;
}

/**
 * StreamVista Cloud X — simplified pricing (June 2026)
 *
 *  • Free        — 128 GB storage, 500 GB / month bandwidth (overage ₹10/GB).
 *  • Creator     — 1 TB at ₹650 + 18% GST = ₹767/month with Pay-As-You-Go:
 *                  each TB you cross adds the next 1 TB at the same price.
 *
 * The old Monthly / Quarterly / Yearly tiers have been retired.
 */
export const PLANS: Plan[] = [
  {
    cycle: "free",
    label: "Basic Free",
    price: 0,
    priceLabel: "₹0",
    cadence: "/forever",
    storageLabel: "128 GB storage",
    bandwidthLabel: "500 GB / mo bandwidth",
    badge: "Free for life",
    description: "Get started instantly. Pay only if your monthly bandwidth crosses 500 GB (₹10 / GB).",
    features: [
      "128 GB cloud storage",
      "500 GB / month bandwidth",
      "Secure share links (password + expiry)",
      "Client review portal",
      "Bandwidth overage at ₹10 / GB only if exceeded",
    ],
  },
  {
    cycle: "creator",
    label: "Creator",
    price: 650,
    priceLabel: "₹650",
    cadence: "/TB · /month + GST",
    badge: "Pay-As-You-Go",
    storageLabel: "1 TB · scales automatically",
    bandwidthLabel: "Unmetered review bandwidth",
    savings: "Auto top-up · next TB at ₹767",
    description: "1 TB cinema-grade storage at ₹650 + 18% GST = ₹767/month. Cross 1 TB and the next TB unlocks automatically at the same price. No commitments.",
    features: [
      "1 TB cinema-grade storage",
      "Auto Pay-As-You-Go — each extra TB adds at ₹767",
      "Free parking for finished projects",
      "Multi-studio routing",
      "Camera-to-cloud ingest",
      "Frame-accurate client review",
      "Priority Razorpay / UPI checkout",
    ],
  },
];

export const planByCycle = (c: Cycle) => PLANS.find(p => p.cycle === c)!;

/** Price per extra TB (incl GST) for PAYG top-ups. */
export const PAYG_TB_INR = 767;
export const PAYG_TB_BASE_INR = 650;
export const FREE_STORAGE_GB = 128;
export const FREE_BANDWIDTH_GB = 500;
export const FREE_BANDWIDTH_OVERAGE_INR_PER_GB = 10;
