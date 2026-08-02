import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export type MissionSignal = {
  key: string;
  label: string;
  count: number;
  dept: string;
  section: string;
  tone: "danger" | "warn" | "info";
  /** Rough seconds per item — feeds "time to clear" estimate. */
  effortSec: number;
};

async function safeCount(table: string, filter?: (q: any) => any): Promise<number> {
  try {
    let q: any = (supabase as any).from(table).select("*", { count: "exact", head: true });
    if (filter) q = filter(q);
    const { count, error } = await q;
    if (error) return 0;
    return count ?? 0;
  } catch { return 0; }
}

let cache: { at: number; signals: MissionSignal[] } | null = null;
const TTL_MS = 60_000;

/**
 * Centralized pending-work snapshot for the single-operator surface.
 * Cached 60s so the AI assistant, Action Center and Mission Control cards
 * don't each hit the DB independently.
 */
export function useMissionSignals(pollMs = 60_000) {
  const { isAdmin, isSuperAdmin, loading: authLoading } = useAuth();
  const authorized = isAdmin || isSuperAdmin;
  const [signals, setSignals] = useState<MissionSignal[]>(cache?.signals ?? []);
  const [loading, setLoading] = useState(!cache && authorized);
  const [lastUpdated, setLastUpdated] = useState<number | null>(cache?.at ?? null);

  const load = useCallback(async (force = false) => {
    // P0 guard: only admins/super_admins may query mission-signal tables.
    // Non-admin callers would generate noisy RLS 401/403 traffic and pull
    // aggregate counts they cannot act on. Return an empty snapshot.
    if (!authorized) {
      setSignals([]); setLastUpdated(Date.now()); setLoading(false);
      return;
    }
    if (!force && cache && Date.now() - cache.at < TTL_MS) {
      setSignals(cache.signals); setLastUpdated(cache.at); setLoading(false);
      return;
    }
    setLoading(true);
    // Authoritative failure counts come from a SECURITY DEFINER RPC that
    // aggregates directly from ingest_job_items (terminal + stale) and
    // dedupes email_send_log by message_id → latest status. No caching,
    // no optimistic UI — force=true bypasses the 60s memoization above.
    const failureCountsPromise = (async () => {
      try {
        const { data, error } = await (supabase as any).rpc("admin_failure_counts", { stale_minutes: 30 });
        if (error) {
          console.warn("[useMissionSignals] admin_failure_counts RPC error", error);
          return { failed_uploads: 0, failed_emails: 0 };
        }
        const row = Array.isArray(data) ? data[0] : data;
        // RPC returns 0 rows for non-admin callers (guarded by has_role in WHERE).
        // Treat missing row as "no signal" rather than a zero count.
        if (!row) return { failed_uploads: 0, failed_emails: 0 };
        return {
          failed_uploads: Number(row?.failed_uploads ?? 0),
          failed_emails: Number(row?.failed_emails ?? 0),
        };
      } catch (e) {
        console.warn("[useMissionSignals] admin_failure_counts threw", e);
        return { failed_uploads: 0, failed_emails: 0 };
      }
    })();
    const [qc, legal, tickets, failures, failedPayments, storageAlerts, pendingOnboarding, editRequests, contactUnread] = await Promise.all([
      safeCount("content_titles", (q) => q.eq("status", "in_review")),
      safeCount("content_titles", (q) => q.eq("status", "legal_review")),
      safeCount("support_requests", (q) => q.eq("status", "open")),
      failureCountsPromise,
      safeCount("billing_payment_attempts", (q) => q.eq("status", "failed")),
      safeCount("storage_topups", (q) => q.eq("status", "failed")),
      safeCount("onboarding_requests", (q) => q.eq("onboarding_status", "pending")),
      safeCount("title_edit_requests", (q) => q.eq("status", "open")),
      safeCount("contact_messages", (q) => q.eq("status", "new")),
    ]);
    const failedUploads = failures.failed_uploads;
    const failedEmails = failures.failed_emails;
    const next: MissionSignal[] = [
      { key: "qc",         label: "Titles awaiting QC",       count: qc,               dept: "content",  section: "approvals",  tone: "warn",   effortSec: 240 },
      { key: "legal",      label: "Titles awaiting Legal",    count: legal,            dept: "content",  section: "approvals",  tone: "warn",   effortSec: 300 },
      { key: "tickets",    label: "Open support tickets",     count: tickets,          dept: "users",    section: "support",    tone: "info",   effortSec: 180 },
      { key: "up_fail",    label: "Failed uploads",           count: failedUploads,    dept: "cloud",    section: "failed-uploads", tone: "danger", effortSec: 60  },
      { key: "em_fail",    label: "Failed emails",            count: failedEmails,     dept: "platform", section: "email",      tone: "danger", effortSec: 30  },
      { key: "pay_fail",   label: "Failed payments",          count: failedPayments,   dept: "business", section: "billing",    tone: "danger", effortSec: 240 },
      { key: "storage",    label: "Storage alerts",           count: storageAlerts,    dept: "cloud",    section: "storage",    tone: "warn",   effortSec: 60  },
      { key: "onboarding", label: "Pending onboarding",       count: pendingOnboarding,dept: "users",    section: "onboarding", tone: "info",   effortSec: 180 },
      { key: "edits",      label: "Title edit requests",      count: editRequests,     dept: "content",  section: "pipeline",   tone: "info",   effortSec: 120 },
      { key: "contact",    label: "New contact messages",     count: contactUnread,    dept: "users",    section: "support",    tone: "info",   effortSec: 120 },
    ];
    cache = { at: Date.now(), signals: next };
    setSignals(next); setLastUpdated(cache.at); setLoading(false);
  }, [authorized]);

  useEffect(() => {
    if (authLoading) return;
    load();
    if (!pollMs || !authorized) return;
    const t = setInterval(() => load(true), pollMs);
    return () => clearInterval(t);
  }, [load, pollMs, authLoading, authorized]);

  const totalOpen = signals.reduce((s, x) => s + x.count, 0);
  const critical = signals.filter(s => s.tone === "danger" && s.count > 0);
  const attention = signals.filter(s => s.tone === "warn" && s.count > 0);
  const info = signals.filter(s => s.tone === "info" && s.count > 0);
  const etaMin = Math.ceil(signals.reduce((s, x) => s + x.count * x.effortSec, 0) / 60);

  const health = (() => {
    if (critical.some(c => c.count >= 5)) return { status: "red" as const, note: "Multiple failures" };
    if (critical.length > 0) return { status: "yellow" as const, note: `${critical.length} failure lane${critical.length > 1 ? "s" : ""}` };
    if (attention.length > 0) return { status: "yellow" as const, note: "Queues building" };
    return { status: "green" as const, note: "All systems nominal" };
  })();

  return { signals, loading, lastUpdated, totalOpen, critical, attention, info, etaMin, health, refresh: () => load(true) };
}
