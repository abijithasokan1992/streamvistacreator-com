import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type PublicPlan = {
  code: string;
  name: string;
  description: string | null;
  currency: string;
  price_amount: number;
  gst_percent: number;
  billing_cycle: string;
  storage_gb: number | null;
  bandwidth_gb: number | null;
  user_limit: number | null;
  features: string[];
  sort_order: number;
};

/**
 * Reads the public, active, non-archived plans straight from the canonical
 * `plans` table. Anonymous read is allowed by RLS for visible plans, so the
 * public Pricing page can render without auth.
 *
 * Always treat the DB value as the truth — never re-add hardcoded ₹ amounts.
 */
export function usePublicPlans() {
  const [plans, setPlans] = useState<PublicPlan[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("plans")
        .select("code,name,description,currency,price_amount,gst_percent,billing_cycle,storage_gb,bandwidth_gb,user_limit,features,sort_order,is_active,is_archived,visibility")
        .eq("is_active", true)
        .eq("is_archived", false)
        .eq("visibility", "public")
        .order("sort_order", { ascending: true });
      if (cancelled) return;
      if (error) {
        setError(error.message);
        setPlans([]);
      } else {
        setPlans(
          (data ?? []).map((p: any) => ({
            code: p.code,
            name: p.name,
            description: p.description,
            currency: p.currency,
            price_amount: Number(p.price_amount ?? 0),
            gst_percent: Number(p.gst_percent ?? 0),
            billing_cycle: p.billing_cycle,
            storage_gb: p.storage_gb,
            bandwidth_gb: p.bandwidth_gb,
            user_limit: p.user_limit,
            features: Array.isArray(p.features) ? p.features : [],
            sort_order: p.sort_order ?? 0,
          })),
        );
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const byCode = (code: string) => plans?.find((p) => p.code === code) ?? null;

  return { plans, loading, error, byCode };
}

/** Formats price including GST. Returns { base, gst, total, label } in INR. */
export function withGst(price_amount: number, gst_percent: number) {
  const base = price_amount;
  const gst = +(base * (gst_percent / 100)).toFixed(2);
  const total = +(base + gst).toFixed(2);
  const fmt = (n: number) =>
    new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n);
  return { base, gst, total, baseLabel: fmt(base), gstLabel: fmt(gst), totalLabel: fmt(total) };
}
