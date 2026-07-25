import { useEffect, useState } from "react";
import { Loader2, BarChart3, RefreshCw, Users, Film, Building2, ShoppingBag, Receipt, Eye, Wallet, ShieldAlert, FileDown, Printer } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";

/**
 * Finance / management / audit reporting console.
 *
 * Three sections, each backed by simple aggregate reads against existing tables:
 *   • Finance summary  (audit_readonly / finance_reports)
 *   • Management view  (management_reports)
 *   • Audit log feed   (audit_readonly)
 *
 * Read-only by design — there is no mutation surface on this page.
 */

type FinSummary = {
  invoices_30d_count: number;
  invoices_30d_total_inr: number;
  manual_invoices_outstanding: number;
  active_subscriptions: number;
  refunds_30d_total_inr: number;
};

type MgmtSummary = {
  total_users: number;
  creators: number;
  studios: number;
  buyers: number;
  active_titles: number;
  pending_review: number;
};

type AuditLogRow = {
  id: string;
  action: string;
  admin_user_id: string | null;
  target_user_id: string | null;
  created_at: string;
};


const fmtINR = (n: number) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n || 0);

const SINCE_30D = () => new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

export default function AdminReportsConsole() {
  const [loading, setLoading] = useState(true);
  const [fin, setFin] = useState<FinSummary | null>(null);
  const [mgmt, setMgmt] = useState<MgmtSummary | null>(null);
  const [audit, setAudit] = useState<AuditLogRow[]>([]);

  const load = async () => {
    setLoading(true);
    const since = SINCE_30D();

    const [
      inv30d, manualOpen, subs, refunds30d,
      profiles, roles,
      titles, pendingReview,
      auditLog,
    ] = await Promise.all([
      supabase.from("invoices").select("total_paise").gte("created_at", since).eq("status", "paid"),
      supabase.from("manual_invoices").select("id", { count: "exact", head: true }).in("status", ["sent", "overdue"]),
      supabase.from("subscriptions").select("id", { count: "exact", head: true }).eq("status", "active"),
      supabase.from("invoices").select("total_paise").gte("created_at", since).eq("status", "refunded"),
      supabase.from("user_profiles").select("user_id", { count: "exact", head: true }),
      supabase.from("user_roles").select("user_id, role"),
      supabase.from("content_titles").select("id", { count: "exact", head: true }),
      (supabase.from("content_titles").select("id", { count: "exact", head: true }) as any).in("status", ["submitted", "in_review"]),
      supabase.from("admin_audit_log").select("id, action, admin_user_id, target_user_id, created_at").order("created_at", { ascending: false }).limit(50),
    ]);


    const invTotal = (inv30d.data ?? []).reduce((s: number, r: any) => s + Number(r.total_paise ?? 0), 0) / 100;
    const refundsTotal = (refunds30d.data ?? []).reduce((s: number, r: any) => s + Number(r.total_paise ?? 0), 0) / 100;

    const rolesData = (roles.data ?? []) as { user_id: string; role: string }[];
    const setBy = (role: string) => new Set(rolesData.filter((r) => r.role === role).map((r) => r.user_id)).size;

    setFin({
      invoices_30d_count: (inv30d.data ?? []).length,
      invoices_30d_total_inr: invTotal,
      manual_invoices_outstanding: manualOpen.count ?? 0,
      active_subscriptions: subs.count ?? 0,
      refunds_30d_total_inr: refundsTotal,
    });
    setMgmt({
      total_users: profiles.count ?? 0,
      creators: setBy("content_owner") + setBy("creator"),
      studios: setBy("studio"),
      buyers: setBy("buyer") + setBy("client"),
      active_titles: titles.count ?? 0,
      pending_review: pendingReview.count ?? 0,
    });
    setAudit((auditLog.data ?? []) as AuditLogRow[]);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  return (
    <div className="space-y-8">
      <div className="glass-strong rounded-3xl border border-border/50 p-6 space-y-5">
        <header className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-primary grid place-items-center glow-primary">
              <BarChart3 className="w-5 h-5 text-primary-foreground" />
            </div>
            <div>
              <h3 className="font-display text-lg font-bold">Reports &amp; Audit</h3>
              <p className="text-xs text-muted-foreground">
                Finance reports, management summary and audit log. Read-only.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => exportCsv(fin, mgmt, audit)} disabled={loading || !fin || !mgmt}>
              <FileDown className="w-4 h-4 mr-1" /> CSV
            </Button>
            <Button variant="outline" size="sm" onClick={() => exportPdf(fin, mgmt, audit)} disabled={loading || !fin || !mgmt}>
              <Printer className="w-4 h-4 mr-1" /> PDF
            </Button>
            <Button variant="outline" size="sm" onClick={load} disabled={loading}>
              <RefreshCw className={`w-4 h-4 mr-1 ${loading ? "animate-spin" : ""}`} /> Refresh
            </Button>
          </div>
        </header>

        {loading || !fin || !mgmt ? (
          <div className="text-muted-foreground inline-flex items-center gap-2 text-sm">
            <Loader2 className="w-4 h-4 animate-spin" /> Loading reports…
          </div>
        ) : (
          <>
            <section>
              <h4 className="text-[11px] uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1">
                <Wallet className="w-3.5 h-3.5" /> Finance · last 30 days
              </h4>
              <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
                <Stat label="Invoices issued"      value={String(fin.invoices_30d_count)}      icon={<Receipt className="w-4 h-4" />} />
                <Stat label="Invoiced total"       value={fmtINR(fin.invoices_30d_total_inr)}  icon={<Receipt className="w-4 h-4" />} tone="ok" />
                <Stat label="Manual outstanding"   value={String(fin.manual_invoices_outstanding)} icon={<ShieldAlert className="w-4 h-4" />} tone="warn" />
                <Stat label="Active subscriptions" value={String(fin.active_subscriptions)}     icon={<Users className="w-4 h-4" />} tone="primary" />
                <Stat label="Refunds total"        value={fmtINR(fin.refunds_30d_total_inr)}    icon={<Wallet className="w-4 h-4" />} tone="muted" />
              </div>
            </section>

            <section>
              <h4 className="text-[11px] uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1">
                <Eye className="w-3.5 h-3.5" /> Management summary
              </h4>
              <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
                <Stat label="Total users"     value={String(mgmt.total_users)}     icon={<Users className="w-4 h-4" />} tone="primary" />
                <Stat label="Creators"        value={String(mgmt.creators)}        icon={<Film className="w-4 h-4" />} />
                <Stat label="Studios"         value={String(mgmt.studios)}         icon={<Building2 className="w-4 h-4" />} />
                <Stat label="Buyers"          value={String(mgmt.buyers)}          icon={<ShoppingBag className="w-4 h-4" />} />
                <Stat label="Active titles"   value={String(mgmt.active_titles)}   icon={<Film className="w-4 h-4" />} tone="ok" />
                <Stat label="Pending review"  value={String(mgmt.pending_review)}  icon={<ShieldAlert className="w-4 h-4" />} tone="warn" />
              </div>
            </section>
          </>
        )}
      </div>

      <div className="glass-strong rounded-3xl border border-border/50 p-6 space-y-3">
        <header className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-primary grid place-items-center glow-primary">
            <ShieldAlert className="w-5 h-5 text-primary-foreground" />
          </div>
          <div>
            <h3 className="font-display text-lg font-bold">Audit log</h3>
            <p className="text-xs text-muted-foreground">Most recent admin activity. Read-only.</p>
          </div>
        </header>
        {audit.length === 0 ? (
          <div className="text-sm text-muted-foreground italic">No audit entries yet.</div>
        ) : (
          <div className="rounded-2xl border border-border/40 divide-y divide-border/40 max-h-[480px] overflow-y-auto">
            {audit.map((row) => (
              <div key={row.id} className="p-3 text-xs grid sm:grid-cols-[160px_1fr] gap-2">
                <div className="text-muted-foreground tabular-nums">
                  {new Date(row.created_at).toLocaleString()}
                </div>
                <div className="min-w-0">
                  <div className="font-mono text-[12px] text-foreground">{row.action}</div>
                  <div className="text-[10px] text-muted-foreground font-mono truncate">
                    actor: {row.admin_user_id?.slice(0, 8) ?? "—"}
                    {row.target_user_id && <> · target: {row.target_user_id.slice(0, 8)}</>}
                  </div>
                </div>

              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value, icon, tone = "muted" }: { label: string; value: string; icon: React.ReactNode; tone?: "primary"|"warn"|"ok"|"muted" }) {
  const toneCls =
    tone === "primary" ? "border-primary/40 bg-primary/5 text-primary"
    : tone === "warn"  ? "border-amber-500/40 bg-amber-500/5 text-amber-300"
    : tone === "ok"    ? "border-emerald-500/40 bg-emerald-500/5 text-emerald-300"
    : "border-border/60 bg-secondary/30 text-muted-foreground";
  return (
    <div className={`rounded-2xl border p-3 ${toneCls}`}>
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider opacity-80">
        {icon} {label}
      </div>
      <div className="mt-1 text-xl font-display font-bold text-foreground tabular-nums">{value}</div>
    </div>
  );
}

function csvEscape(v: unknown): string {
  const s = v == null ? "" : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function downloadBlob(content: string, filename: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function exportCsv(fin: FinSummary | null, mgmt: MgmtSummary | null, audit: AuditLogRow[]) {
  if (!fin || !mgmt) return;
  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
  const lines: string[] = [];
  lines.push("StreamVista — Reports & Audit Summary");
  lines.push(`Generated,${new Date().toISOString()}`);
  lines.push("");
  lines.push("Section,Metric,Value");
  lines.push(`Finance (30d),Invoices issued,${fin.invoices_30d_count}`);
  lines.push(`Finance (30d),Invoiced total (INR),${fin.invoices_30d_total_inr}`);
  lines.push(`Finance (30d),Manual outstanding,${fin.manual_invoices_outstanding}`);
  lines.push(`Finance (30d),Active subscriptions,${fin.active_subscriptions}`);
  lines.push(`Finance (30d),Refunds total (INR),${fin.refunds_30d_total_inr}`);
  lines.push(`Management,Total users,${mgmt.total_users}`);
  lines.push(`Management,Creators,${mgmt.creators}`);
  lines.push(`Management,Studios,${mgmt.studios}`);
  lines.push(`Management,Buyers,${mgmt.buyers}`);
  lines.push(`Management,Active titles,${mgmt.active_titles}`);
  lines.push(`Management,Pending review,${mgmt.pending_review}`);
  lines.push("");
  lines.push("Audit log");
  lines.push("Timestamp,Action,Actor,Target");
  for (const r of audit) {
    lines.push([r.created_at, r.action, r.admin_user_id ?? "", r.target_user_id ?? ""].map(csvEscape).join(","));
  }
  downloadBlob(lines.join("\r\n"), `streamvista-audit-${stamp}.csv`, "text/csv;charset=utf-8");
  toast({ title: "CSV exported", description: "Downloaded to your device." });
}

function exportPdf(fin: FinSummary | null, mgmt: MgmtSummary | null, audit: AuditLogRow[]) {
  if (!fin || !mgmt) return;
  const esc = (s: unknown) => String(s ?? "").replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]!));
  const row = (k: string, v: string) => `<tr><td>${esc(k)}</td><td style="text-align:right">${esc(v)}</td></tr>`;
  const auditRows = audit.map(r => `<tr>
    <td>${esc(new Date(r.created_at).toLocaleString())}</td>
    <td style="font-family:monospace">${esc(r.action)}</td>
    <td style="font-family:monospace;font-size:10px">${esc(r.admin_user_id?.slice(0,8) ?? "—")}</td>
    <td style="font-family:monospace;font-size:10px">${esc(r.target_user_id?.slice(0,8) ?? "—")}</td>
  </tr>`).join("");
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>StreamVista Audit Report</title>
<style>
  body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#111;padding:32px;max-width:900px;margin:auto}
  h1{margin:0 0 4px;font-size:22px}
  .muted{color:#666;font-size:12px;margin-bottom:24px}
  h2{font-size:14px;text-transform:uppercase;letter-spacing:.08em;margin:24px 0 8px;color:#333}
  table{width:100%;border-collapse:collapse;font-size:12px}
  th,td{border-bottom:1px solid #e5e5e5;padding:6px 8px;text-align:left}
  th{background:#f7f7f7;font-weight:600}
  @media print { body{padding:16px} }
</style></head><body>
<h1>StreamVista — Reports &amp; Audit Summary</h1>
<div class="muted">Generated ${esc(new Date().toLocaleString())}</div>
<h2>Finance · last 30 days</h2>
<table><tbody>
  ${row("Invoices issued", String(fin.invoices_30d_count))}
  ${row("Invoiced total (INR)", fmtINR(fin.invoices_30d_total_inr))}
  ${row("Manual outstanding", String(fin.manual_invoices_outstanding))}
  ${row("Active subscriptions", String(fin.active_subscriptions))}
  ${row("Refunds total (INR)", fmtINR(fin.refunds_30d_total_inr))}
</tbody></table>
<h2>Management summary</h2>
<table><tbody>
  ${row("Total users", String(mgmt.total_users))}
  ${row("Creators", String(mgmt.creators))}
  ${row("Studios", String(mgmt.studios))}
  ${row("Buyers", String(mgmt.buyers))}
  ${row("Active titles", String(mgmt.active_titles))}
  ${row("Pending review", String(mgmt.pending_review))}
</tbody></table>
<h2>Audit log (${audit.length})</h2>
<table><thead><tr><th>Timestamp</th><th>Action</th><th>Actor</th><th>Target</th></tr></thead>
<tbody>${auditRows || '<tr><td colspan="4" style="color:#888;font-style:italic">No entries</td></tr>'}</tbody></table>
<script>window.addEventListener('load',()=>{setTimeout(()=>window.print(),250)});</script>
</body></html>`;
  const w = window.open("", "_blank", "width=900,height=1000");
  if (!w) { toast({ title: "Pop-up blocked", description: "Allow pop-ups to export PDF.", variant: "destructive" }); return; }
  w.document.open(); w.document.write(html); w.document.close();
  toast({ title: "PDF ready", description: "Use the print dialog → Save as PDF." });
}
