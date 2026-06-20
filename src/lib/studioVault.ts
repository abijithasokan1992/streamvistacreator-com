export type StorageClass = "active_vault" | "catalog_vault" | "archive_vault";

export type VaultProduct = {
  id: string;
  code: string;
  name: string;
  storage_class: StorageClass;
  description: string | null;
  short_pitch: string | null;
  badge: string | null;
  sell_price_per_tb_paise: number;
  internal_cost_per_tb_paise: number;
  gst_percent: number;
  min_tb: number;
  max_tb: number;
  default_tb_options: number[];
  billing_modes: string[];
  features: string[];
  visible: boolean;
  self_serve_enabled: boolean;
  enterprise_only: boolean;
  oci_storage_tier: string | null;
  sort_order: number;
};

export type IntervalMonths = 1 | 3 | 6 | 12;

export const INTERVAL_OPTIONS: { months: IntervalMonths; label: string; discountPct: number }[] = [
  { months: 1, label: "Monthly", discountPct: 0 },
  { months: 3, label: "3 months", discountPct: 5 },
  { months: 6, label: "6 months", discountPct: 8 },
  { months: 12, label: "12 months", discountPct: 12 },
];

export const STORAGE_CLASS_META: Record<StorageClass, { label: string; tone: string; accent: string; tagline: string }> = {
  active_vault: {
    label: "Active Vault",
    tone: "text-emerald-300",
    accent: "from-emerald-500/15 to-emerald-500/0 border-emerald-400/30",
    tagline: "Hot working storage — live productions and current post.",
  },
  catalog_vault: {
    label: "Catalog Vault",
    tone: "text-sky-300",
    accent: "from-sky-500/15 to-sky-500/0 border-sky-400/30",
    tagline: "Warm storage for completed titles and studio catalogs.",
  },
  archive_vault: {
    label: "Archive Vault",
    tone: "text-amber-300",
    accent: "from-amber-500/15 to-amber-500/0 border-amber-400/30",
    tagline: "Cold long-term archive — safety copies and DR.",
  },
};

export const fmtINR = (paise: number) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 })
    .format(Math.round(paise / 100));

export const fmtINRDecimal = (paise: number) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 })
    .format(paise / 100);

export function computePricePreview(
  product: Pick<VaultProduct, "sell_price_per_tb_paise" | "gst_percent">,
  tb: number,
  months: IntervalMonths,
) {
  const discount = INTERVAL_OPTIONS.find((o) => o.months === months)?.discountPct ?? 0;
  const subtotal = Math.round(product.sell_price_per_tb_paise * tb * months * (1 - discount / 100));
  const gst = Math.round(subtotal * (product.gst_percent / 100));
  return { subtotal, gst, total: subtotal + gst, discount };
}
