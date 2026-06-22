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
 * StreamVista Creator — pricing model (Part 11E, June 2026).
 *
 *  • Creator Basic — submission / evaluation plan.
 *      5 GB usable workspace · 1 active title · 1 submission.
 *      Title locks on submit. Lightweight rights intake only.
 *
 *  • Storage add-on — 1 TB recurring blocks at ₹767/mo (incl 18% GST),
 *      stackable, billed monthly via Razorpay. Stacks on top of any plan.
 *
 * Advanced rights cockpit, delivery profile tooling, and commercial program
 * structuring are admin-led after submission, not Basic features.
 */
export const PLANS: Plan[] = [
  {
    cycle: "free",
    label: "Creator Basic",
    price: 0,
    priceLabel: "₹0",
    cadence: "/forever",
    storageLabel: "5 GB workspace",
    bandwidthLabel: "Submission & evaluation plan",
    badge: "Free",
    description: "Submit one title for evaluation. 5 GB workspace for poster, trailer and a lightweight master. Title locks on submit; further edits via admin reopen.",
    features: [
      "5 GB included workspace",
      "1 active title · 1 submission",
      "Post-submission title lock",
      "Lightweight rights intake",
      "Add 1 TB storage anytime for masters & archives",
    ],
  },
  {
    cycle: "creator",
    label: "Creator · +1 TB Storage",
    price: 650,
    priceLabel: "₹767",
    cadence: "/TB · /month incl GST",
    badge: "Recurring add-on",
    storageLabel: "+1 TB cinema-grade storage",
    bandwidthLabel: "Stackable monthly blocks",
    savings: "Stack multiple blocks · cancel anytime",
    description: "1 TB recurring storage block at ₹650 + 18% GST = ₹767/month. Stack as many blocks as you need. Quota updates after verified payment.",
    features: [
      "+1 TB per block (1024 GB)",
      "Recurring monthly billing via Razorpay",
      "Stackable — buy more blocks anytime",
      "Camera-to-cloud ingest · frame-accurate review",
      "Cancel at end of cycle",
    ],
  },
];

export const planByCycle = (c: Cycle) => PLANS.find(p => p.cycle === c)!;

/** Price per extra TB (incl GST) for storage add-on blocks. */
export const PAYG_TB_INR = 767;
export const PAYG_TB_BASE_INR = 650;
/** Creator Basic included workspace storage (GB). Real hard cap unless paid add-on or admin grant. */
export const FREE_STORAGE_GB = 5;
export const FREE_BANDWIDTH_GB = 500;
export const FREE_BANDWIDTH_OVERAGE_INR_PER_GB = 10;
