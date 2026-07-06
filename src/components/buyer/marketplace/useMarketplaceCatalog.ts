import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Live marketplace catalog for buyers.
 *
 * Buyers do not have RLS access to `content_titles`; the only rows that RLS
 * allows unauthenticated / non-owner reads on are `featured_films` rows that
 * are already published, active, and within their run window. That is the
 * public marketplace surface, and we use it here.
 */
export type MarketplaceTitle = {
  id: string;
  title: string;
  subtitle: string | null;
  blurb: string | null;
  poster_url: string | null;
  content_type: string | null;
  year: number | null;
  partner: string | null;
  starts_at: string | null;
  ends_at: string | null;
  updated_at: string | null;
};

export function useMarketplaceCatalog() {
  const [rows, setRows] = useState<MarketplaceTitle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("featured_films")
        .select("id,title,subtitle,blurb,poster_url,content_type,year,partner,starts_at,ends_at,updated_at")
        .eq("status", "published")
        .eq("is_active", true)
        .order("sort_order", { ascending: true })
        .order("updated_at", { ascending: false });
      if (cancelled) return;
      setLoading(false);
      if (error) { setError(error.message); return; }
      setRows((data as MarketplaceTitle[]) ?? []);
    })();
    return () => { cancelled = true; };
  }, []);

  return { rows, loading, error };
}
