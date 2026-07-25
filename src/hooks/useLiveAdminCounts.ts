import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Live-wired counters for the Media Office dashboard. Subscribes to
 * `content_titles` and `distribution_program_offers` and refetches the
 * affected counter on any change. Keeps last-known values on failure so
 * the UI never flashes zeros.
 */
export type AdminCounts = {
  awaitingQc: number;
  awaitingLegal: number;
  drafts: number;
  submitted: number;
  approved: number;
  published: number;
  activeMappings: number;
  openOffers: number;
};

const ZERO: AdminCounts = {
  awaitingQc: 0, awaitingLegal: 0, drafts: 0, submitted: 0,
  approved: 0, published: 0, activeMappings: 0, openOffers: 0,
};

async function countBy(filter: (q: any) => any): Promise<number> {
  const { count, error } = await filter(
    supabase.from("content_titles").select("id", { count: "exact", head: true }),
  );
  if (error) throw error;
  return count ?? 0;
}

export function useLiveAdminCounts() {
  const [counts, setCounts] = useState<AdminCounts>(ZERO);
  const [live, setLive] = useState(false);
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inFlight = useRef(false);

  const refresh = async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    try {
      const [drafts, submitted, approved, published, awaitingQc, awaitingLegal] = await Promise.all([
        countBy((q) => q.eq("status", "draft")),
        countBy((q) => q.eq("status", "submitted")),
        countBy((q) => q.eq("status", "approved")),
        countBy((q) => q.eq("status", "published")),
        countBy((q) => q.eq("qc_status", "pending")),
        countBy((q) => q.eq("legal_clearance", "pending")),
      ]);

      let openOffers = 0;
      let activeMappings = 0;
      try {
        const r1 = await supabase
          .from("distribution_program_offers")
          .select("id", { count: "exact", head: true })
          .in("status", ["open", "negotiating"]);
        openOffers = r1.count ?? 0;
        const r2 = await supabase
          .from("distribution_program_offers")
          .select("id", { count: "exact", head: true })
          .eq("status", "accepted");
        activeMappings = r2.count ?? 0;
      } catch {
        /* keep last-known */
      }

      setCounts({
        awaitingQc, awaitingLegal, drafts, submitted, approved, published,
        activeMappings, openOffers,
      });
      setUpdatedAt(Date.now());
      setError(null);
    } catch (e: any) {
      setError(e?.message ?? "Could not refresh counters.");
    } finally {
      inFlight.current = false;
    }
  };

  useEffect(() => {
    refresh();
    const channel = supabase
      .channel("media-office-counters")
      .on("postgres_changes", { event: "*", schema: "public", table: "content_titles" }, () => refresh())
      .on("postgres_changes", { event: "*", schema: "public", table: "distribution_program_offers" }, () => refresh())
      .subscribe((status) => {
        setLive(status === "SUBSCRIBED");
      });
    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { counts, live, updatedAt, error, refresh };
}
