import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  AlertTriangle,
  CheckCircle2,
  Circle,
  ClipboardCheck,
  CloudUpload,
  CreditCard,
  HardDrive,
  Inbox,
  Mail,
  RefreshCw,
  ScrollText,
  ShieldAlert,
  Sparkles,
  TrendingUp,
  Users as UsersIcon,
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
  icon: React.ReactNode;
};

type Health = {
  key: string;
  label: string;
  status: "green" | "yellow" | "red";
  note?: string;
};

async function safeCount(table: string, filter?: (query: any) => any): Promise<number | null> {
  try {
    let query: any = (supabase as any).from(table).select("*", { count: "exact", head: true });
    if (filter) query = filter(query);
    const { count, error } = await query;
    return error ? null : count ?? 0;
  } catch {
    return null;
  }
}

function todayIso(): string {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date.toISOString();
}

export default function MissionControl() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [cards, setCards] = useState<ActionCard[]>([]);
  const [metrics, setMetrics] = useState<Metric[]>([]);
  const [health, setHealth] = useState<Health[]>([]);

  const load = useCallback(async () => {
    setRefreshing(true);
    const today = todayIso();

    const [qc, legal, tickets, failedUploads, failedEmails, failedPayments, storageAlerts, pendingOnboarding, editRequests, contacts] = await Promise.all([
      safeCount("content_titles", (q) => q.eq("status", "in_review")),
      safeCount("content_titles", (q) => q.eq("status", "legal_review")),
      safeCount("support_requests", (q) => q.eq("status", "open")),
      safeCount("ingest_job_items", (q) => q.eq("status", "failed")),
      safeCount("email_send_log", (q) => q.in("status", ["failed", "failed_permanent", "bounced", "dlq", "complained"])),
      safeCount("billing_payment_attempts", (q) => q.eq("status", "failed")),
      safeCount("storage_topups", (q) => q.eq("status", "failed")),
      safeCount("onboarding_requests", (q) => q.eq("onboarding_status", "pending")),
      safeCount("title_edit_requests", (q) => q.eq("status", "pending")),
      safeCount("contact_messages", (q) => q.eq("status", "new")),
    ]);

    setCards([
      { key: "qc", label: "Titles awaiting QC", count: qc, icon: <ClipboardCheck className="w-4 h-4" />, to: "/admin?dept=content&section=approvals", tone: "warn" },
      { key: "legal", label: "Titles awaiting Legal", count: legal, icon: <ShieldAlert className="w-4 h-4" />, to: "/admin?dept=content&section=approvals", tone: "warn" },
      { key: "tickets", label: "Open support tickets", count: tickets, icon: <Inbox className="w-4 h-4" />, to: "/admin?dept=users&section=support", tone: "info" },
      { key: "uploads", label: "Failed uploads", count: failedUploads, icon: <CloudUpload className="w-4 h-4" />, to: "/admin?dept=cloud&section=failed-uploads", tone: "danger" },
      { key: "emails", label: "Failed emails", count: failedEmails, icon: <Mail className="w-4 h-4" />, to: "/admin?dept=platform&section=email-retry-audit", tone: "danger" },
      { key: "payments", label: "Failed payments", count: failedPayments, icon: <CreditCard className="w-4 h-4" />, to: "/admin?dept=business&section=billing", tone: "danger" },
      { key: "storage", label: "Storage alerts", count: storageAlerts, icon: <HardDrive className="w-4 h-4" />, to: "/admin?dept=cloud&section=storage", tone: "warn" },
      { key: "onboarding", label: "Pending onboarding", count: pendingOnboarding, icon: <UsersIcon className="w-4 h-4" />, to: "/admin?dept=users&section=onboarding", tone: "info" },
      { key: "edits", label: "Title edit requests", count: editRequests, icon: <ScrollText className="w-4 h-4" />, to: "/admin?dept=content&section=pipeline", tone: "info" },
      { key: "contacts", label: "New contact messages", count: contacts, icon: <Mail className="w-4 h-4" />, to: "/admin?dept=users&section=support", tone: "info" },
    ]);

    const [newUsers, newTitles, uploadsToday, paymentsToday, emailsToday] = await Promise.all([
      safeCount("user_profiles", (q) => q.gte("created_at", today)),
      safeCount("content_titles", (q) => q.gte("created_at", today)),
      safeCount("recent_uploads", (q) => q.gte("created_at", today)),
      safeCount("billing_payment_attempts", (q) => q.gte("created_at", today)),
      safeCount("email_send_log", (q) => q.gte("created_at", today)),
    ]);

    let revenueToday: number | null = null;
    try {
      const { data, error } = await (supabase as any)
        .from("invoices")
        .select("total_amount")
        .gte("created_at", today)
        .in("status", ["paid", "captured", "success"]);
      if (!error) revenueToday = (data ?? []).reduce((sum: number, row: any) => sum + Number(row.total_amount ?? 0), 0);
    } catch {
      revenueToday = null;
    }

    setMetrics([
      { key: "users", label: "New users", value: formatCount(newUsers), icon: <UsersIcon className="w-4 h-4" /> },
      { key: "titles", label: "New titles", value: formatCount(newTitles), icon: <Sparkles className="w-4 h-4" /> },
      { key: "uploads", label: "Uploads", value: formatCount(uploadsToday), icon: <CloudUpload className="w-4 h-4" /> },
      { key: "revenue", label: "Revenue today", value: revenueToday === null ? "—" : `₹${revenueToday.toLocaleString("en-IN")}`, icon: <TrendingUp className="w-4 h-4" /> },
      { key: "payments", label: "Payments", value: formatCount(paymentsToday), icon: <CreditCard className="w-4 h-4" /> },
      { key: "emails", label: "Emails sent", value: formatCount(emailsToday), icon: <Mail className="w-4 h-4" /> },
    ]);

    const databaseReachable = (await safeCount("user_roles")) !== null;
    const uploadFailures = failedUploads ?? 0;
    const emailFailures = failedEmails ?? 0;
    const paymentFailures = failedPayments ?? 0;

    setHealth([
      { key: "auth", label: "Authentication", status: databaseReachable ? "green" : "red" },
      { key: "database", label: "Database", status: databaseReachable ? "green" : "red" },
      { key: "storage", label: "Storage", status: uploadFailures > 20 ? "red" : uploadFailures > 0 ? "yellow" : "green", note: uploadFailures ? `${uploadFailures} failed` : undefined },
      { key: "email", label: "Email", status: emailFailures > 10 ? "red" : emailFailures > 0 ? "yellow" : "green", note: emailFailures ? `${emailFailures} failed` : undefined },
      { key: "payments", label: "Payments", status: paymentFailures > 5 ? "red" : paymentFailures > 0 ? "yellow" : "green", note: paymentFailures ? `${paymentFailures} failed` : undefined },
    ]);

    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="space-y-8">
      <section>
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="font-display text-lg font-bold">Action Required</h2>
            <p className="text-xs text-muted-foreground">Everything that needs a decision today.</p>
          </div>
          <button onClick={load} disabled={refreshing} className="text-xs inline-flex items-center gap-1.5 rounded-md border border-border/50 px-2.5 py-1.5 hover:border-accent/40">
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`} /> Refresh
          </button>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {cards.map((card) => {
            const hasItems = (card.count ?? 0) > 0;
            const tone = card.tone === "danger" ? "border-red-500/40 bg-red-500/5 text-red-300" : card.tone === "warn" ? "border-amber-500/40 bg-amber-500/5 text-amber-300" : "border-border/50 bg-secondary/10 text-foreground";
            return (
              <Link key={card.key} to={card.to} className={`rounded-xl border p-3 transition hover:border-accent/50 ${hasItems ? tone : "border-border/40 bg-secondary/5 text-muted-foreground"}`}>
                <div className="flex items-center gap-2 text-[11px] uppercase tracking-wider">{card.icon}<span className="truncate">{card.label}</span></div>
                <div className="mt-2 flex items-end justify-between">
                  <span className="font-display text-2xl font-bold">{loading && card.count === null ? "…" : card.count === null ? "—" : card.count}</span>
                  {hasItems && <span className="text-[10px] uppercase tracking-wider opacity-80">Open →</span>}
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      <section>
        <h2 className="font-display text-lg font-bold mb-3">Today's Activity</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {metrics.map((metric) => (
            <div key={metric.key} className="rounded-xl border border-border/40 bg-secondary/10 p-3">
              <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-muted-foreground">{metric.icon}<span>{metric.label}</span></div>
              <div className="font-display text-xl font-bold mt-1.5">{metric.value}</div>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="font-display text-lg font-bold mb-3">System Health</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
          {health.map((item) => (
            <div key={item.key} className="flex items-center gap-2 rounded-lg border border-border/40 bg-secondary/5 px-3 py-2">
              <HealthIcon status={item.status} />
              <div className="min-w-0 flex-1">
                <div className="text-xs font-semibold truncate">{item.label}</div>
                {item.note && <div className="text-[10px] text-muted-foreground truncate">{item.note}</div>}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function HealthIcon({ status }: { status: "green" | "yellow" | "red" }) {
  const className = status === "green" ? "text-emerald-400" : status === "yellow" ? "text-amber-400" : "text-red-400";
  if (status === "red") return <AlertTriangle className={`w-4 h-4 ${className}`} />;
  if (status === "yellow") return <Circle className={`w-3.5 h-3.5 ${className} fill-current`} />;
  return <CheckCircle2 className={`w-4 h-4 ${className}`} />;
}

function formatCount(value: number | null): string {
  return value === null ? "—" : String(value);
}
