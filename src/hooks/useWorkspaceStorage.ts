import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useWorkspaces } from "@/hooks/useWorkspaces";

/**
 * useWorkspaceStorage — the single authoritative source for creator/studio
 * storage capacity + usage.
 *
 * ▸ Capacity comes from `workspace_storage_entitlements`.
 * ▸ Usage comes from `workspace_storage_usage`.
 * ▸ Both are surfaced through the existing `get_workspace_storage_entitlement`
 *   RPC (server-side join, plan-aware, admin-bonus aware).
 * ▸ Realtime: subscribes to postgres_changes on both tables for the active
 *   workspace and refreshes on push.
 * ▸ Cache: module-level, keyed by (userId, workspaceId). Reused across mounts.
 * ▸ Retry: exponential backoff (250ms → 4s, 4 attempts) on transient failure.
 *
 * This hook replaces the ad-hoc queries in `StorageLive` and the RPC call
 * inside `useStorageQuota`. Both continue to work while callers migrate.
 */

const GB = 1024 ** 3;

export type WorkspaceStorage = {
  loading: boolean;
  error: string | null;
  /**
   * True only after a successful RPC returned a numeric total_storage_gb.
   * When false (loading, error, or missing context), callers MUST treat the
   * quota as unknown and MUST NOT hard-block uploads on it.
   */
  known: boolean;
  workspaceId: string | null;

  // Capacity (GB)
  totalGb: number;
  includedGb: number;
  paidGb: number;
  bonusGb: number;

  // Usage
  usedBytes: number;
  activeBytes: number;
  archivedBytes: number;
  usedGb: number;
  pct: number;
  remainingGb: number;

  // Meta
  planCode: string | null;
  billingStatus: string | null;
  lastRecalculatedAt: string | null;

  refresh: () => Promise<void>;
};


type CacheEntry = { at: number; value: WorkspaceStorage };
const CACHE = new Map<string, CacheEntry>();
const TTL_MS = 30_000;

async function fetchWithRetry(userId: string, workspaceId: string | null): Promise<any> {
  let lastErr: unknown = null;
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const { data, error } = await (supabase as any).rpc(
        "get_workspace_storage_entitlement",
        { _user_id: userId },
      );
      if (error) throw error;
      return data;
    } catch (e) {
      lastErr = e;
      await new Promise((r) => setTimeout(r, 250 * Math.pow(2, attempt)));
    }
  }
  throw lastErr;
}

const EMPTY = (workspaceId: string | null): WorkspaceStorage => ({
  loading: true,
  error: null,
  workspaceId,
  totalGb: 0,
  includedGb: 0,
  paidGb: 0,
  bonusGb: 0,
  usedBytes: 0,
  activeBytes: 0,
  archivedBytes: 0,
  usedGb: 0,
  pct: 0,
  remainingGb: 0,
  planCode: null,
  billingStatus: null,
  lastRecalculatedAt: null,
  refresh: async () => {},
});

export function useWorkspaceStorage(): WorkspaceStorage {
  const { user } = useAuth();
  const { activeId } = useWorkspaces();
  const [state, setState] = useState<WorkspaceStorage>(() => EMPTY(activeId ?? null));
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  const cacheKey = user ? `${user.id}:${activeId ?? "_"}` : null;

  const load = useCallback(async (opts?: { skipCache?: boolean }) => {
    if (!user || !cacheKey) return;

    if (!opts?.skipCache) {
      const cached = CACHE.get(cacheKey);
      if (cached && Date.now() - cached.at < TTL_MS) {
        if (mounted.current) setState({ ...cached.value, loading: false });
        return;
      }
    }

    try {
      const d = await fetchWithRetry(user.id, activeId ?? null);
      const includedGb = Number(d?.included_storage_gb ?? 0);
      const paidGb     = Number(d?.paid_storage_gb ?? 0);
      const bonusGb    = Number(d?.admin_bonus_storage_gb ?? 0);
      const totalGb    = Number(d?.total_storage_gb ?? includedGb + paidGb + bonusGb);
      const usedBytes  = Number(d?.used_bytes ?? d?.display_used_bytes ?? 0);
      const usedGb     = usedBytes / GB;
      const pct        = totalGb > 0 ? Math.min(100, (usedGb / totalGb) * 100) : 0;

      const next: WorkspaceStorage = {
        loading: false,
        error: null,
        workspaceId: activeId ?? null,
        totalGb, includedGb, paidGb, bonusGb,
        usedBytes,
        activeBytes: Number(d?.active_bytes ?? 0),
        archivedBytes: Number(d?.archived_bytes ?? 0),
        usedGb,
        pct,
        remainingGb: Math.max(0, totalGb - usedGb),
        planCode: d?.plan_code ?? null,
        billingStatus: d?.billing_status ?? null,
        lastRecalculatedAt: d?.last_recalculated_at ?? null,
        refresh: async () => {},
      };
      CACHE.set(cacheKey, { at: Date.now(), value: next });
      if (mounted.current) setState({ ...next, refresh: () => load({ skipCache: true }) });
    } catch (e: any) {
      if (mounted.current) setState((s) => ({ ...s, loading: false, error: e?.message ?? "load_failed" }));
    }
  }, [user?.id, activeId, cacheKey]);

  useEffect(() => {
    if (!user) return;
    void load();

    // Realtime: refresh on any entitlement/usage row change for this workspace.
    // Use a unique channel name per mount so StrictMode's double-invoke or a
    // rapid remount never re-uses an already-subscribed channel instance
    // (which would throw "cannot add postgres_changes callbacks after subscribe()").
    const filter = activeId ? `workspace_id=eq.${activeId}` : `user_id=eq.${user.id}`;
    const uniqueId = `${cacheKey}:${Math.random().toString(36).slice(2, 10)}`;
    const ch = supabase.channel(`ws-storage:${uniqueId}`);
    // Register ALL postgres_changes handlers BEFORE subscribe().
    ch.on(
      "postgres_changes" as any,
      { event: "*", schema: "public", table: "workspace_storage_entitlements", filter },
      () => load({ skipCache: true }),
    );
    ch.on(
      "postgres_changes" as any,
      { event: "*", schema: "public", table: "workspace_storage_usage", filter },
      () => load({ skipCache: true }),
    );
    ch.subscribe();

    return () => { void supabase.removeChannel(ch); };
  }, [user?.id, activeId, cacheKey, load]);

  return { ...state, refresh: () => load({ skipCache: true }) };
}
