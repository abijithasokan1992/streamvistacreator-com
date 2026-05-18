export type Cycle = "monthly" | "quarterly" | "yearly";

export interface Plan {
  cycle: Cycle;
  label: string;
  price: number;
  priceLabel: string;
  cadence: string;
  savings?: string;
  badge?: string;
  description: string;
}

export const PLANS: Plan[] = [
  {
    cycle: "monthly",
    label: "Monthly",
    price: 21999,
    priceLabel: "₹21,999",
    cadence: "/month + GST",
    description: "Flexible month-to-month billing. Cancel anytime.",
  },
  {
    cycle: "quarterly",
    label: "Quarterly",
    price: 59999,
    priceLabel: "₹59,999",
    cadence: "/quarter + GST",
    savings: "Save ₹5,998 vs monthly",
    description: "Quarterly billing for active production cycles.",
  },
  {
    cycle: "yearly",
    label: "Yearly",
    price: 219999,
    priceLabel: "₹2,19,999",
    cadence: "/year + GST",
    savings: "Save ₹43,989 vs monthly",
    badge: "Best Value",
    description: "Maximum savings for committed studios and houses.",
  },
];

export const planByCycle = (c: Cycle) => PLANS.find(p => p.cycle === c)!;
