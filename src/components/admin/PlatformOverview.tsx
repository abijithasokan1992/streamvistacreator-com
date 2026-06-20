import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import {
  Activity, AlertTriangle, CheckCircle2, Clock, Database, Film,
  HardDrive, Inbox, IndianRupee, Loader2, ShieldAlert, Users, Building2,
  Upload, Layers
} from "lucide-react";

type StatusCounts = Record<string, number>;

const PIPELINE_STAGES: { key: string; label: string }[] = [
  { key: "draft", label: "Draft" },
  { key: "submitted", label: "Submitted" },
  { key: "in_review", label: "In Review" },
  { key: "qc_review", label: "QC Review" },
  { key: "legal_review", label: "Legal Review" },
  { key: "approved", label: "Approved" },
  { key: "ready_for_distribution", label: "Ready For Distribution" },
  { key: "archived", label: "Archived" },
];

export default function PlatformOverview() {
  const [loading, setLoading] = useState(true);
  const [pipeline, setPipeline] = useState<StatusCounts>({});
  const [roleCounts, setRoleCounts] = useState<StatusCounts>({});
  const [orgsCount, setOrgsCount] = useState(0);
  const [storageBytes, setStorageBytes] = useState(0);
  const [storageQuota, setStorageQuota] = useState(0);
  const [revenueThisMonth, setRevenueThisMonth] = useState(0);
  const [revenueLastMonth, setRevenueLastMonth] = useState(0);
  const [invoiceCount, setInvoiceCount] = useState(0);
  const [revenuePending, setRevenuePending] = useState(0);
  const [staleUploads, setStaleUploads] = useState(0);
  const [failedUploads, setFailedUploads] = useState(0);
  const [openOnboarding, setOpenOnboarding] = useState(0);
  const [openDmca, setOpenDmca] = useState(0);
  const [openSupport, setOpenSupport] = useState(0);
  const [pendingApprovals, setPendingApprovals] = useState(0);
  const [dlqEmails, setDlqEmails] = useState(0);

  const load = async () => {
    setLoading(true);
    try {
      const now = new Date();
      const startMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      const startLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString();

      const [titles, roles, orgs, uploads, allocations, invoicesMtd, invoicesLast, subs,
             onboarding, dmca, support, approvals, emailDlq] = await Promise.all([
        supabase.from("content_titles").select("status"),
        supabase.from("user_roles").select("role"),
        supabase.from("organizations").select("id", { count: "exact", head: true }),
        // FIXED: recent_uploads.file_size (not size_bytes)
        supabase.from("recent_uploads").select("status, file_size, created_at"),
        // FIXED: storage_allocations.allocated_gb (not quota_bytes)
        supabase.from("storage_allocations").select("allocated_gb"),
        // CANONICAL revenue source: invoices.total_paise — NOT razorpay raw events.
        supabase.from("invoices").select("total_paise, status").gte("issued_at", startMonth),
        supabase.from("invoices").select("total_paise").gte("issued_at", startLastMonth).lt("issued_at", startMonth),
        supabase.from("subscriptions").select("status"),
        supabase.from("onboarding_requests").select("id", { count: "exact", head: true }).eq("onboarding_status", "pending"),
        supabase.from("dmca_requests").select("id", { count: "exact", head: true }).neq("status", "closed"),
        supabase.from("support_requests").select("id", { count: "exact", head: true }).neq("status", "resolved"),
        supabase.from("content_approvals").select("id", { count: "exact", head: true }).eq("to_status", "submitted"),
        supabase.from("email_send_log").select("id", { count: "exact", head: true }).eq("status", "dlq"),
      ]);

      const pc: StatusCounts = {};
      (titles.data ?? []).forEach((t: any) => { pc[t.status] = (pc[t.status] || 0) + 1; });
      setPipeline(pc);

      const rc: StatusCounts = {};
      (roles.data ?? []).forEach((r: any) => { rc[r.role] = (rc[r.role] || 0) + 1; });
      setRoleCounts(rc);
      setOrgsCount(orgs.count ?? 0);

      let bytes = 0; let stale = 0; let failed = 0;
      const staleCutoff = Date.now() - 30 * 60 * 1000;
      (uploads.data ?? []).forEach((u: any) => {
        if (u.status === "verified") bytes += Number(u.file_size || 0);
        if (u.status === "uploading" && new Date(u.created_at).getTime() < staleCutoff) stale++;
        if (u.status === "failed") failed++;
      });
      setStorageBytes(bytes);
      setStaleUploads(stale);
      setFailedUploads(failed);

      // allocated_gb (integer GB) → bytes for display alongside used bytes
      const quotaBytes = (allocations.data ?? []).reduce(
        (s: number, a: any) => s + Number(a.allocated_gb || 0) * 1024 * 1024 * 1024, 0,
      );
      setStorageQuota(quotaBytes);

      const sumPaise = (rows: any[] | null | undefined) =>
        (rows ?? []).reduce((s: number, r: any) => s + Number(r.total_paise || 0), 0);
      setRevenueThisMonth(sumPaise(invoicesMtd.data) / 100);
      setRevenueLastMonth(sumPaise(invoicesLast.data) / 100);
      setInvoiceCount((invoicesMtd.data ?? []).length);
      setRevenuePending((subs.data ?? []).filter((s: any) => s.status === "past_due" || s.status === "pending").length);

      setOpenOnboarding(onboarding.count ?? 0);
      setOpenDmca(dmca.count ?? 0);
      setOpenSupport(support.count ?? 0);
      setPendingApprovals(approvals.count ?? 0);
      setDlqEmails(emailDlq.count ?? 0);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  if (loading) {
    return <div className="py-20 grid place-items-center"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>;
  }

  const platformStatus =
    dlqEmails > 0 || failedUploads > 5 ? { color: "red", label: "Attention Needed" } :
    staleUploads > 0 || revenuePending > 0 ? { color: "amber", label: "Minor Issues" } :
    { color: "emerald", label: "All Systems Operational" };

  const fmtBytes = (b: number) => {
    if (b > 1e12) return `${(b / 1e12).toFixed(2)} TB`;
    if (b > 1e9) return `${(b / 1e9).toFixed(2)} GB`;
    if (b > 1e6) return `${(b / 1e6).toFixed(1)} MB`;
    return `${b} B`;
  };
  const usagePct = storageQuota > 0 ? Math.min(100, Math.round((storageBytes / storageQuota) * 100)) : 0;
  const totalTitles = Object.values(pipeline).reduce((s, n) => s + n, 0);

  return (
    <div className="space-y-6">
      {/* HERO: Operational heartbeat */}
      <div className="grid lg:grid-cols-3 gap-4">
        {/* Content Pipeline (hero) */}
        <div className="lg:col-span-2 glass rounded-2xl p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Film className="w-5 h-5 text-accent" />
              <h2 className="font-display text-xl font-bold">Content Pipeline</h2>
            </div>
            <div className="text-xs text-muted-foreground">{totalTitles} titles total</div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {PIPELINE_STAGES.map(s => (
              <Link
                key={s.key}
                to={`/admin?tab=content&stage=${s.key}`}
                className="rounded-xl border border-border/40 bg-secondary/30 hover:border-accent/60 hover:bg-secondary/60 transition-all p-3 group"
              >
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{s.label}</div>
                <div className="font-display text-2xl font-bold mt-1 group-hover:text-accent">{pipeline[s.key] ?? 0}</div>
              </Link>
            ))}
          </div>
        </div>

        {/* Platform Status + Action Inbox */}
        <div className="space-y-4">
          <div className="glass rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-3">
              <Activity className="w-4 h-4 text-accent" />
              <div className="text-xs uppercase tracking-wider text-muted-foreground">Platform Status</div>
            </div>
            <div className="flex items-center gap-3">
              <span className={`inline-block w-3 h-3 rounded-full bg-${platformStatus.color}-400 animate-pulse`} />
              <div className="font-display text-lg font-bold">{platformStatus.label}</div>
            </div>
            <ul className="mt-3 space-y-1 text-xs text-muted-foreground">
              <li className="flex items-center gap-2"><CheckCircle2 className="w-3 h-3 text-emerald-400" /> {dlqEmails} email DLQ</li>
              <li className="flex items-center gap-2"><Clock className="w-3 h-3 text-amber-400" /> {staleUploads} stale multipart sessions</li>
              <li className="flex items-center gap-2"><AlertTriangle className="w-3 h-3 text-red-400" /> {failedUploads} failed uploads</li>
            </ul>
          </div>

          <div className="glass rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-3">
              <Inbox className="w-4 h-4 text-accent" />
              <div className="text-xs uppercase tracking-wider text-muted-foreground">Action Inbox</div>
            </div>
            <ul className="space-y-2 text-sm">
              <InboxRow label="Submissions awaiting review" count={pendingApprovals} to="/admin?tab=content" />
              <InboxRow label="Open onboarding approvals" count={openOnboarding} to="/admin?tab=users" />
              <InboxRow label="DMCA requests" count={openDmca} to="/admin?tab=security" />
              <InboxRow label="Support tickets" count={openSupport} to="/admin?tab=ops" />
            </ul>
          </div>
        </div>
      </div>

      {/* Row 2: Business metrics */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <Metric icon={<Building2 className="w-4 h-4" />} label="Organizations" value={orgsCount.toString()} />
        <Metric icon={<Users className="w-4 h-4" />} label="Creators" value={((roleCounts["content_owner"] || 0)).toString()} />
        <Metric icon={<Users className="w-4 h-4" />} label="Studios" value={((roleCounts["studio"] || 0)).toString()} />
        <Metric icon={<Users className="w-4 h-4" />} label="Buyers" value={((roleCounts["buyer"] || 0)).toString()} />
        <Metric
          icon={<HardDrive className="w-4 h-4" />}
          label="Storage"
          value={`${fmtBytes(storageBytes)}${storageQuota > 0 ? ` / ${fmtBytes(storageQuota)}` : ""}`}
          sub={storageQuota > 0 ? `${usagePct}% used` : undefined}
        />
        <Metric
          icon={<IndianRupee className="w-4 h-4" />}
          label="Revenue (this month)"
          value={`₹${revenueThisMonth.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`}
          sub={revenuePending > 0 ? `${revenuePending} pending` : "no pending issues"}
        />
      </div>

      {/* Row 3: Quick drilldowns */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
        <DrilldownCard
          icon={<Upload className="w-4 h-4" />}
          label="Failed uploads"
          count={failedUploads}
          to="/admin?tab=storage"
          tone={failedUploads > 0 ? "red" : "neutral"}
        />
        <DrilldownCard
          icon={<Clock className="w-4 h-4" />}
          label="Stale multipart sessions"
          count={staleUploads}
          to="/admin?tab=storage"
          tone={staleUploads > 0 ? "amber" : "neutral"}
        />
        <DrilldownCard
          icon={<Layers className="w-4 h-4" />}
          label="Open onboarding"
          count={openOnboarding}
          to="/admin?tab=users"
          tone={openOnboarding > 0 ? "amber" : "neutral"}
        />
        <DrilldownCard
          icon={<ShieldAlert className="w-4 h-4" />}
          label="DMCA / support"
          count={openDmca + openSupport}
          to="/admin?tab=security"
          tone={openDmca > 0 ? "red" : "neutral"}
        />
      </div>
    </div>
  );
}

function InboxRow({ label, count, to }: { label: string; count: number; to: string }) {
  return (
    <li>
      <Link to={to} className="flex items-center justify-between gap-2 hover:text-accent transition-colors">
        <span className="text-muted-foreground">{label}</span>
        <span className={`font-mono font-bold ${count > 0 ? "text-accent" : "text-muted-foreground/60"}`}>{count}</span>
      </Link>
    </li>
  );
}

function Metric({ icon, label, value, sub }: { icon: React.ReactNode; label: string; value: string; sub?: string }) {
  return (
    <div className="glass rounded-xl p-4">
      <div className="flex items-center gap-2 text-muted-foreground">
        {icon}
        <div className="text-[10px] uppercase tracking-wider">{label}</div>
      </div>
      <div className="font-display text-xl font-bold mt-2 truncate" title={value}>{value}</div>
      {sub && <div className="text-[10px] text-muted-foreground mt-0.5">{sub}</div>}
    </div>
  );
}

function DrilldownCard({ icon, label, count, to, tone }: { icon: React.ReactNode; label: string; count: number; to: string; tone: "red" | "amber" | "neutral" }) {
  const toneClass =
    tone === "red" ? "border-red-500/40 hover:border-red-400" :
    tone === "amber" ? "border-amber-500/40 hover:border-amber-400" :
    "border-border/40 hover:border-accent/40";
  return (
    <Link to={to} className={`glass rounded-xl p-4 border ${toneClass} transition-all`}>
      <div className="flex items-center gap-2 text-muted-foreground">
        {icon}
        <div className="text-[10px] uppercase tracking-wider">{label}</div>
      </div>
      <div className="font-display text-2xl font-bold mt-2">{count}</div>
    </Link>
  );
}
