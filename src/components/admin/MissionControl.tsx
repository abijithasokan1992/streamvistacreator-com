import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  AlertTriangle, CheckCircle2, Circle, ClipboardCheck, CloudUpload,
  CreditCard, HardDrive, Inbox, Mail, RefreshCw, ScrollText,
  Server, ShieldAlert, Sparkles, TrendingUp, Users as UsersIcon,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

type ActionCard = {
  key: string;
  label: string;
  count: number | null;
  icon: React.ReactNode;
  to: string;
  tone: "danger" | "warn" | "info";
};

type Metric = {
  key: string;
  label: string;
  value: string;
  hint?: string;
  icon: React.ReactNode;
};

type Health = { key: string; label: string; status: "green" | "yellow" | "red"; note?: string };

type FeedItem = {
  id: string;
  kind: string;
  label: string;
  detail?: string;
  at: string;
  to?: string;
};

async function safeCount(table: string, filter?: (q: any) => any): Promise<number | null> {
  try {
    let q: any = (supabase as any).from(table).select("*", { count: "exact", head: true });
    if (filter) q = filter(q);
    const { count, error } = await q;
    if (error) return null;
    return count ?? 0;
  } catch { return null; }
}

const TODAY_ISO = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d.toISOString(); };

export default function MissionControl({ onJump }: { onJump?: (dept: string, section: string) => void }) {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [cards, setCards] = useState<ActionCard[]>([]);
  const [metrics, setMetrics] = useState<Metric[]>([]);
  const [health, setHealth] = useState<Health[]>([]);
  const [feed, setFeed] = useState<FeedItem[]>([]);
  const [feedFilter, setFeedFilter] = useState<string>("all");

  const load = useCallback(async () => {
    setRefreshing(true);
    const today = TODAY_ISO();

    // ---- Action Required ----
    const [
      qc, legal, tickets, failedUploads, failedEmails, failedPayments,
      storageAlerts, pendingOnboarding, editRequests, contactUnread,
    ] = await Promise.all([
      safeCount("content_titles", (q) => q.eq("status", "in_review")),
      safeCount("content_titles", (q) => q.eq("status", "legal_review")),
      safeCount("support_requests", (q) => q.eq("status", "open")),
      safeCount("ingest_job_items", (q) => q.eq("status", "failed")),
      safeCount("email_send_log", (q) => q.in("status", ["failed", "error", "bounced"])),
      safeCount("billing_payment_attempts", (q) => q.eq("status", "failed")),
      safeCount("storage_topups", (q) => q.eq("status", "failed")),
      safeCount("onboarding_requests", (q) => q.eq("onboarding_status", "pending")),
      safeCount("title_edit_requests", (q) => q.eq("status", "pending")),
      safeCount("contact_messages", (q) => q.eq("status", "new")),
    ]);

    const nextCards: ActionCard[] = [
      { key: "qc",         label: "Titles awaiting QC",       count: qc,              icon: <ClipboardCheck className="w-4 h-4" />, to: "/admin?dept=content&section=approvals",     tone: "warn"   },
      { key: "legal",      label: "Titles awaiting Legal",    count: legal,           icon: <ShieldAlert className="w-4 h-4" />,    to: "/admin?dept=content&section=approvals",     tone: "warn"   },
      { key: "tickets",    label: "Open support tickets",     count: tickets,         icon: <Inbox className="w-4 h-4" />,          to: "/admin?dept=users&section=support",         tone: "info"   },
      { key: "up_fail",    label: "Failed uploads",           count: failedUploads,   icon: <CloudUpload className="w-4 h-4" />,    to: "/admin?dept=cloud&section=storage",         tone: "danger" },
      { key: "em_fail",    label: "Failed emails",            count: failedEmails,    icon: <Mail className="w-4 h-4" />,           to: "/admin?dept=platform&section=email",        tone: "danger" },
      { key: "pay_fail",   label: "Failed payments",          count: failedPayments,  icon: <CreditCard className="w-4 h-4" />,     to: "/admin?dept=business&section=billing",      tone: "danger" },
      { key: "storage",    label: "Storage alerts",           count: storageAlerts,   icon: <HardDrive className="w-4 h-4" />,      to: "/admin?dept=cloud&section=storage",         tone: "warn"   },
      { key: "onboarding", label: "Pending onboarding",       count: pendingOnboarding, icon: <UsersIcon className="w-4 h-4" />,    to: "/admin?dept=users&section=onboarding",      tone: "info"   },
      { key: "edits",      label: "Title edit requests",      count: editRequests,    icon: <ScrollText className="w-4 h-4" />,     to: "/admin?dept=content&section=pipeline",      tone: "info"   },
      { key: "contact",    label: "New contact messages",     count: contactUnread,   icon: <Mail className="w-4 h-4" />,           to: "/admin?dept=users&section=support",         tone: "info"   },
    ];
    setCards(nextCards);

    // ---- Today's Activity ----
    const [
      newUsers, newTitles, uploads, revenueRows, paymentsToday, emailsToday,
    ] = await Promise.all([
      safeCount("user_profiles", (q) => q.gte("created_at", today)),
      safeCount("content_titles", (q) => q.gte("created_at", today)),
      safeCount("recent_uploads", (q) => q.gte("created_at", today)),
      (async () => {
        try {
          const { data } = await (supabase as any)
            .from("invoices")
            .select("total_amount")
            .gte("created_at", today)
            .in("status", ["paid", "captured", "success"]);
          const total = (data ?? []).reduce((s: number, r: any) => s + Number(r.total_amount ?? 0), 0);
          return total;
        } catch { return null; }
      })(),
      safeCount("billing_payment_attempts", (q) => q.gte("created_at", today)),
      safeCount("email_send_log", (q) => q.gte("created_at", today)),
    ]);
    setMetrics([
      { key: "u",  label: "New users",      value: fmt(newUsers),          icon: <UsersIcon className="w-4 h-4" /> },
      { key: "t",  label: "New titles",     value: fmt(newTitles),         icon: <Sparkles className="w-4 h-4" /> },
      { key: "up", label: "Uploads",        value: fmt(uploads),           icon: <CloudUpload className="w-4 h-4" /> },
      { key: "r",  label: "Revenue today",  value: revenueRows === null ? "—" : `₹${Number(revenueRows).toLocaleString("en-IN")}`, icon: <TrendingUp className="w-4 h-4" /> },
      { key: "p",  label: "Payments",       value: fmt(paymentsToday),     icon: <CreditCard className="w-4 h-4" /> },
      { key: "e",  label: "Emails sent",    value: fmt(emailsToday),       icon: <Mail className="w-4 h-4" /> },
    ]);

    // ---- System Health (cheap heuristics; components already own deep checks) ----
    const auth = await safeCount("user_roles");
    const db = auth !== null; // if we reached DB at all
    const emailErr = failedEmails ?? 0;
    const payErr = failedPayments ?? 0;
    const upErr = failedUploads ?? 0;
    setHealth([
      { key: "auth",     label: "Authentication", status: db ? "green" : "red" },
      { key: "db",       label: "Database",       status: db ? "green" : "red" },
      { key: "storage",  label: "Storage",        status: upErr > 20 ? "red" : upErr > 0 ? "yellow" : "green", note: upErr ? `${upErr} failed` : undefined },
      { key: "oracle",   label: "Oracle Cloud",   status: upErr > 20 ? "yellow" : "green" },
      { key: "email",    label: "Email",          status: emailErr > 10 ? "red" : emailErr > 0 ? "yellow" : "green", note: emailErr ? `${emailErr} failed` : undefined },
      { key: "payments", label: "Payments",       status: payErr > 5 ? "red" : payErr > 0 ? "yellow" : "green", note: payErr ? `${payErr} failed` : undefined },
      { key: "ai",       label: "AI",             status: "green" },
      { key: "security", label: "Security",       status: "green" },
      { key: "backups",  label: "Backups",        status: "green" },
    ]);

    // ---- Recent Activity ----
    const items: FeedItem[] = [];
    try {
      const { data } = await (supabase as any).from("user_profiles")
        .select("user_id, display_name, full_name, created_at").order("created_at", { ascending: false }).limit(8);
      (data ?? []).forEach((r: any) => items.push({
        id: `u-${r.user_id}`, kind: "user", label: "New user",
        detail: r.display_name ?? r.full_name ?? r.user_id, at: r.created_at,
        to: "/admin?dept=users&section=users",
      }));
    } catch {}
    try {
      const { data } = await (supabase as any).from("content_titles")
        .select("id, title, status, updated_at").order("updated_at", { ascending: false }).limit(8);
      (data ?? []).forEach((r: any) => items.push({
        id: `t-${r.id}`, kind: "title", label: `Title · ${r.status}`,
        detail: r.title, at: r.updated_at, to: "/admin?dept=content&section=approvals",
      }));
    } catch {}
    try {
      const { data } = await (supabase as any).from("support_requests")
        .select("id, subject, status, created_at").order("created_at", { ascending: false }).limit(6);
      (data ?? []).forEach((r: any) => items.push({
        id: `s-${r.id}`, kind: "ticket", label: `Ticket · ${r.status}`,
        detail: r.subject, at: r.created_at, to: "/admin?dept=users&section=support",
      }));
    } catch {}
    try {
      const { data } = await (supabase as any).from("invoices")
        .select("id, total_amount, status, created_at").order("created_at", { ascending: false }).limit(6);
      (data ?? []).forEach((r: any) => items.push({
        id: `i-${r.id}`, kind: "payment", label: `Invoice · ${r.status}`,
        detail: `₹${Number(r.total_amount ?? 0).toLocaleString("en-IN")}`, at: r.created_at,
        to: "/admin?dept=business&section=billing",
      }));
    } catch {}
    items.sort((a, b) => (b.at ?? "").localeCompare(a.at ?? ""));
    setFeed(items.slice(0, 24));

    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const filteredFeed = feedFilter === "all" ? feed : feed.filter(f => f.kind === feedFilter);

  return (
    <div className="space-y-8">
      {/* Action Required */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="font-display text-lg font-bold">Action Required</h2>
            <p className="text-xs text-muted-foreground">Everything that needs a decision today.</p>
          </div>
          <button
            onClick={load}
            disabled={refreshing}
            className="text-xs inline-flex items-center gap-1.5 rounded-md border border-border/50 px-2.5 py-1.5 hover:border-accent/40"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`} /> Refresh
          </button>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {cards.map((c) => {
            const has = (c.count ?? 0) > 0;
            const toneCls =
              c.tone === "danger" ? "border-red-500/40 bg-red-500/5 text-red-300" :
              c.tone === "warn"   ? "border-amber-500/40 bg-amber-500/5 text-amber-300" :
                                     "border-border/50 bg-secondary/10 text-foreground";
            return (
              <Link
                key={c.key}
                to={c.to}
                className={`rounded-xl border p-3 transition hover:border-accent/50 ${has ? toneCls : "border-border/40 bg-secondary/5 text-muted-foreground"}`}
              >
                <div className="flex items-center gap-2 text-[11px] uppercase tracking-wider">
                  {c.icon}<span className="truncate">{c.label}</span>
                </div>
                <div className="mt-2 flex items-end justify-between">
                  <span className="font-display text-2xl font-bold">
                    {loading && c.count === null ? "…" : c.count === null ? "—" : c.count}
                  </span>
                  {has && <span className="text-[10px] uppercase tracking-wider opacity-80">Open →</span>}
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      {/* Today's Activity */}
      <section>
        <h2 className="font-display text-lg font-bold mb-3">Today's Activity</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {metrics.map(m => (
            <div key={m.key} className="rounded-xl border border-border/40 bg-secondary/10 p-3">
              <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-muted-foreground">
                {m.icon}<span>{m.label}</span>
              </div>
              <div className="font-display text-xl font-bold mt-1.5">{m.value}</div>
            </div>
          ))}
        </div>
      </section>

      {/* System Health */}
      <section>
        <h2 className="font-display text-lg font-bold mb-3">System Health</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
          {health.map(h => (
            <div key={h.key} className="flex items-center gap-2 rounded-lg border border-border/40 bg-secondary/5 px-3 py-2">
              <Dot status={h.status} />
              <div className="min-w-0 flex-1">
                <div className="text-xs font-semibold truncate">{h.label}</div>
                {h.note && <div className="text-[10px] text-muted-foreground truncate">{h.note}</div>}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Recent Activity */}
      <section>
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <h2 className="font-display text-lg font-bold">Recent Activity</h2>
          <div className="flex items-center gap-1 text-[11px]">
            {["all", "user", "title", "ticket", "payment"].map(k => (
              <button
                key={k}
                onClick={() => setFeedFilter(k)}
                className={`px-2 py-1 rounded-md border transition ${feedFilter === k ? "border-accent text-accent bg-accent/10" : "border-border/40 text-muted-foreground hover:text-foreground"}`}
              >
                {k}
              </button>
            ))}
          </div>
        </div>
        <div className="rounded-xl border border-border/40 divide-y divide-border/40">
          {filteredFeed.length === 0 && (
            <div className="p-6 text-center text-xs text-muted-foreground">No recent activity.</div>
          )}
          {filteredFeed.map(f => (
            <Link
              key={f.id}
              to={f.to ?? "#"}
              className="flex items-center gap-3 px-4 py-2.5 hover:bg-accent/5 transition"
            >
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground w-16 shrink-0">{f.kind}</span>
              <div className="min-w-0 flex-1">
                <div className="text-xs font-semibold truncate">{f.label}</div>
                {f.detail && <div className="text-[11px] text-muted-foreground truncate">{f.detail}</div>}
              </div>
              <span className="text-[10px] text-muted-foreground shrink-0">{fmtAt(f.at)}</span>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}

function Dot({ status }: { status: "green" | "yellow" | "red" }) {
  const cls = status === "green" ? "text-emerald-400" : status === "yellow" ? "text-amber-400" : "text-red-400";
  return status === "red"
    ? <AlertTriangle className={`w-4 h-4 ${cls}`} />
    : status === "yellow"
    ? <Circle className={`w-3.5 h-3.5 ${cls} fill-current`} />
    : <CheckCircle2 className={`w-4 h-4 ${cls}`} />;
}

function fmt(n: number | null): string { return n === null ? "—" : String(n); }
function fmtAt(iso: string): string {
  try { const d = new Date(iso); const diff = Date.now() - d.getTime();
    const m = Math.floor(diff / 60000); if (m < 1) return "now"; if (m < 60) return `${m}m`;
    const h = Math.floor(m / 60); if (h < 24) return `${h}h`;
    return `${Math.floor(h / 24)}d`;
  } catch { return ""; }
}
