import { useEffect, useRef, useState, useCallback } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

/**
 * Live-wired counters for the Media Office dashboard. Subscribes to
 * `content_titles` and `distribution_program_offers` and refetches the
 * affected counter on any change. Keeps last-known values on failure so
 * the UI never flashes zeros.
 *
 * Exposes an explicit `syncError` + `reconnect()` so the UI can show a
 * clear notification and a manual retry button when realtime drops.
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

export type RealtimeSyncStatus = "connecting" | "live" | "error";

export function useLiveAdminCounts() {
  const [counts, setCounts] = useState<AdminCounts>(ZERO);
  const [syncStatus, setSyncStatus] = useState<RealtimeSyncStatus>("connecting");
  const [syncError, setSyncError] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inFlight = useRef(false);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const notifiedRef = useRef(false);
  const nonceRef = useRef(0);

  const refresh = useCallback(async () => {
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
          .in("status", ["offered", "draft"]);
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
  }, []);

  const subscribe = useCallback(() => {
    // Tear down any previous channel before reconnecting.
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }
    setSyncStatus("connecting");
    const nonce = ++nonceRef.current;
    const channel = supabase
      .channel(`media-office-counters-${nonce}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "content_titles" }, () => refresh())
      .on("postgres_changes", { event: "*", schema: "public", table: "distribution_program_offers" }, () => refresh())
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          setSyncStatus("live");
          setSyncError(null);
          notifiedRef.current = false;
        } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
          setSyncStatus("error");
          setSyncError(
            status === "TIMED_OUT"
              ? "Live sync timed out."
              : status === "CHANNEL_ERROR"
              ? "Live sync lost connection to the database."
              : "Live sync channel closed.",
          );
          if (!notifiedRef.current) {
            notifiedRef.current = true;
            toast.error("Live sync interrupted", {
              description: "Counters may be out of date. Tap Retry sync to reconnect.",
            });
          }
        }
      });
    channelRef.current = channel;
  }, [refresh]);

  const reconnect = useCallback(async () => {
    await refresh();
    subscribe();
  }, [refresh, subscribe]);

  useEffect(() => {
    refresh();
    subscribe();
    return () => {
      if (channelRef.current) supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    };
  }, [refresh, subscribe]);

  return {
    counts,
    live: syncStatus === "live",
    syncStatus,
    syncError,
    updatedAt,
    error,
    refresh,
    reconnect,
  };
}
