import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Live marketplace catalog for buyers.
 *
 * Source: `buyer_list_marketplace_titles()` RPC. The RPC is SECURITY DEFINER
 * and returns rows only when the caller is an authenticated, verified buyer
 * (entity_profiles.verification_status = 'verified'), has accepted the buyer
 * NDA (legal_acceptances.agreement_type = 'buyer_request_confidentiality'),
 * and is not suspended. Any other caller receives an empty set — fail-closed.
 *
 * Titles returned satisfy: content_titles.status = 'ready_for_distribution'
 * AND title_commercial_profiles.published_to_buyers = true AND at least one
 * commercial channel (screener/license/acquisition/distribution) is open.
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

type RpcRow = {
  id: string;
  title: string;
  synopsis: string | null;
  language: string | null;
  genre: string | null;
  duration_minutes: number | null;
  kind: string | null;
  metadata_year: number | null;
  commercial_status: string | null;
  screener_available: boolean;
  licensing_nonexclusive_available: boolean;
  licensing_exclusive_available: boolean;
  acquisition_available: boolean;
  distribution_partnership_available: boolean;
  buyer_facing_summary: string | null;
  poster_url: string | null;
  updated_at: string | null;
};

function normalize(row: RpcRow): MarketplaceTitle {
  const blurb =
    (row.buyer_facing_summary && row.buyer_facing_summary.trim()) ||
    (row.synopsis ? row.synopsis.slice(0, 240) : null) ||
    null;
  return {
    id: row.id,
    title: row.title,
    // No equivalent source in content_titles/title_commercial_profiles.
    subtitle: null,
    blurb,
    // Buyer-safe signed URL surface not exposed in Batch 1.
    poster_url: row.poster_url,
    // Derived from content_titles.kind (film/series/season/episode/collection_entry).
    content_type: row.kind,
    // Derived from content_titles.metadata->>'year' when present.
    year: row.metadata_year,
    // No reliable partner registry on content_titles; documented gap.
    partner: null,
    // Editorial run window was a featured_films concept; no equivalent.
    starts_at: null,
    ends_at: null,
    updated_at: row.updated_at,
  };
}

export function useMarketplaceCatalog() {
  const [rows, setRows] = useState<MarketplaceTitle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data, error } = await supabase.rpc("buyer_list_marketplace_titles");
      if (cancelled) return;
      setLoading(false);
      if (error) {
        setError(error.message);
        setRows([]);
        return;
      }
      setError(null);
      setRows(((data ?? []) as RpcRow[]).map(normalize));
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return { rows, loading, error };
}
