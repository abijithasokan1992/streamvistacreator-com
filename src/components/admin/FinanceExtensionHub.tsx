import { useEffect, useMemo, useState } from "react";
import { Loader2, TrendingUp, Upload, FileText, Calculator, Wallet, BarChart3, Landmark, Plus, RefreshCw, CheckCircle2, Play } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import * as F from "@/lib/finance/financeApi";

/**
 * Enterprise finance extension hub. Purely additive on top of the existing
 * billing/Razorpay stack — no invoicing or payment logic is duplicated here.
 * Integrates with Marketplace (deal_memos, deal_payouts) and Distribution Hub
 * (distribution_deliveries, partner_profiles) via foreign keys on revenue_lines.
 */
export default function FinanceExtensionHub() {
  return (
    <div className="glass-strong rounded-3xl border border-border/50 p-6 space-y-4">
      <header className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-primary grid place-items-center glow-primary">
          <TrendingUp className="w-5 h-5 text-primary-foreground" />
        </div>
        <div>
          <h3 className="font-display text-lg font-bold">Revenue, Royalties & Settlements</h3>
          <p className="text-xs text-muted-foreground">
            Import external revenue, compute royalty splits, issue partner statements and settle payouts —
            reusing invoices, deal memos and payouts.
          </p>
        </div>
      </header>

      <Tabs defaultValue="dashboard" className="w-full">
        <TabsList className="flex flex-wrap gap-1 bg-transparent p-0 h-auto">
          <T v="dashboard" icon={<BarChart3 className="w-3.5 h-3.5" />}>Dashboard</T>
          <T v="import" icon={<Upload className="w-3.5 h-3.5" />}>Revenue Import</T>
          <T v="statements" icon={<FileText className="w-3.5 h-3.5" />}>Partner Statements</T>
          <T v="royalty" icon={<Calculator className="w-3.5 h-3.5" />}>Royalty Engine</T>
          <T v="tracking" icon={<Wallet className="w-3.5 h-3.5" />}>Payment Tracking</T>
          <T v="settlements" icon={<Landmark className="w-3.5 h-3.5" />}>Settlements</T>
          <T v="analytics" icon={<TrendingUp className="w-3.5 h-3.5" />}>Analytics</T>
        </TabsList>

        <div className="mt-4">
          <TabsContent value="dashboard"><RevenueDashboard /></TabsContent>
          <TabsContent value="import"><RevenueImport /></TabsContent>
          <TabsContent value="statements"><PartnerStatements /></TabsContent>
          <TabsContent value="royalty"><RoyaltyEngine /></TabsContent>
          <TabsContent value="tracking"><PaymentTracking /></TabsContent>
          <TabsContent value="settlements"><Settlements /></TabsContent>
          <TabsContent value="analytics"><RevenueAnalytics /></TabsContent>
        </div>
      </Tabs>
    </div>
  );
}

function T({ v, icon, children }: { v: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <TabsTrigger value={v} className="text-xs data-[state=active]:bg-primary data-[state=active]:text-primary-foreground gap-1.5">
      {icon} {children}
    </TabsTrigger>
  );
}

// ============================================================================
// Dashboard
// ============================================================================
function RevenueDashboard() {
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<Awaited<ReturnType<typeof F.getRevenueSummary>> | null>(null);
  const load = async () => {
    setLoading(true);
    try { setSummary(await F.getRevenueSummary(90)); }
    catch (e: any) { toast.error(e.message); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  if (loading || !summary) return <div className="text-sm text-muted-foreground inline-flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Loading…</div>;

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button variant="outline" size="sm" onClick={load}><RefreshCw className="w-3.5 h-3.5 mr-1" /> Refresh</Button>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Stat label="Gross revenue · 90d" value={F.fmtINR(summary.total_gross_paise)} tone="ok" />
        <Stat label="Net revenue · 90d" value={F.fmtINR(summary.total_net_paise)} tone="primary" />
        <Stat label="Outstanding payouts" value={F.fmtINR(summary.outstanding_payouts_paise)} tone="warn" />
        <Stat label="Paid payouts" value={F.fmtINR(summary.paid_payouts_paise)} tone="muted" />
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <Panel title="Revenue by channel">
          {summary.by_channel.length === 0 ? <Empty text="No revenue yet" /> :
            <div className="space-y-1.5">
              {summary.by_channel.map((r) => (
                <div key={r.channel} className="flex items-center justify-between text-sm">
                  <span className="capitalize">{r.channel}</span>
                  <span className="tabular-nums font-medium">{F.fmtINR(r.gross_paise)}</span>
                </div>
              ))}
            </div>
          }
        </Panel>
        <Panel title="Monthly trend">
          {summary.by_month.length === 0 ? <Empty text="No revenue yet" /> :
            <div className="space-y-1.5">
              {summary.by_month.slice(-6).map((r) => (
                <div key={r.month} className="flex items-center justify-between text-sm">
                  <span>{r.month}</span>
                  <span className="tabular-nums font-medium">{F.fmtINR(r.gross_paise)}</span>
                </div>
              ))}
            </div>
          }
        </Panel>
      </div>
    </div>
  );
}

// ============================================================================
// Revenue Import
// ============================================================================
function RevenueImport() {
  const [imports, setImports] = useState<F.RevenueImport[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ source_type: "ott_report", source_label: "", period_start: "", period_end: "", currency: "INR" });
  const [csv, setCsv] = useState("");
  const [selected, setSelected] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try { setImports(await F.listRevenueImports()); }
    catch (e: any) { toast.error(e.message); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const createAndPush = async () => {
    try {
      const id = await F.createRevenueImport(form);
      // Parse CSV: title_id,channel,territory,gross_paise,fee_paise,occurred_on
      const rows = csv.split(/\r?\n/).map((l) => l.trim()).filter(Boolean).filter((l) => !l.startsWith("#"));
      const lines = rows.map((line) => {
        const [title_id, channel, territory, gross, fee, occurred_on, units] = line.split(",").map((x) => x?.trim());
        return {
          title_id: title_id || null,
          channel: channel || null,
          territory: territory || null,
          gross_amount_paise: Number(gross || 0),
          platform_fee_paise: Number(fee || 0),
          net_amount_paise: Number(gross || 0) - Number(fee || 0),
          occurred_on: occurred_on || null,
          units: units ? Number(units) : null,
        };
      });
      if (lines.length) await F.addRevenueLines(id, lines);
      toast.success(`Imported ${lines.length} lines`);
      setCsv("");
      setSelected(id);
      await load();
    } catch (e: any) { toast.error(e.message); }
  };

  return (
    <div className="space-y-4">
      <Panel title="Create new import">
        <div className="grid md:grid-cols-5 gap-2">
          <Select value={form.source_type} onValueChange={(v) => setForm({ ...form, source_type: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ott_report">OTT report</SelectItem>
              <SelectItem value="theatrical">Theatrical</SelectItem>
              <SelectItem value="distributor_csv">Distributor CSV</SelectItem>
              <SelectItem value="marketplace">Marketplace</SelectItem>
              <SelectItem value="distribution_hub">Distribution Hub</SelectItem>
              <SelectItem value="manual">Manual entry</SelectItem>
            </SelectContent>
          </Select>
          <Input placeholder="Source label (e.g. Netflix Q3)" value={form.source_label} onChange={(e) => setForm({ ...form, source_label: e.target.value })} />
          <Input type="date" value={form.period_start} onChange={(e) => setForm({ ...form, period_start: e.target.value })} />
          <Input type="date" value={form.period_end} onChange={(e) => setForm({ ...form, period_end: e.target.value })} />
          <Input placeholder="Currency" value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })} />
        </div>
        <Label className="text-xs mt-3 block text-muted-foreground">CSV lines (title_id,channel,territory,gross_paise,fee_paise,occurred_on,units)</Label>
        <Textarea rows={5} placeholder="uuid-of-title,svod,IN,50000,5000,2026-06-01,1200" value={csv} onChange={(e) => setCsv(e.target.value)} className="font-mono text-xs" />
        <div className="flex justify-end mt-2">
          <Button onClick={createAndPush} size="sm"><Plus className="w-3.5 h-3.5 mr-1" /> Save import</Button>
        </div>
      </Panel>

      <Panel title="Recent imports">
        {loading ? <Loader /> : imports.length === 0 ? <Empty text="No imports yet" /> :
          <Table>
            <TableHeader><TableRow>
              <TableHead>Source</TableHead><TableHead>Period</TableHead>
              <TableHead className="text-right">Lines</TableHead>
              <TableHead className="text-right">Gross</TableHead>
              <TableHead>Status</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {imports.map((r) => (
                <TableRow key={r.id} className={selected === r.id ? "bg-primary/5" : ""}>
                  <TableCell><div className="font-medium">{r.source_label ?? r.source_type}</div><div className="text-xs text-muted-foreground">{r.source_type}</div></TableCell>
                  <TableCell className="text-xs">{r.period_start ?? "—"} → {r.period_end ?? "—"}</TableCell>
                  <TableCell className="text-right tabular-nums">{r.line_count}</TableCell>
                  <TableCell className="text-right tabular-nums">{F.fmtINR(r.gross_amount_paise)}</TableCell>
                  <TableCell><Badge variant="outline">{r.status}</Badge></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        }
      </Panel>
    </div>
  );
}

// ============================================================================
// Partner Statements
// ============================================================================
function PartnerStatements() {
  const [rows, setRows] = useState<F.PartnerStatement[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ partner_id: "", period_start: "", period_end: "" });
  const load = async () => { setLoading(true); try { setRows(await F.listPartnerStatements()); } catch (e: any) { toast.error(e.message); } finally { setLoading(false); } };
  useEffect(() => { load(); }, []);
  const generate = async () => {
    if (!form.period_start || !form.period_end) return toast.error("Select a period");
    try {
      await F.generatePartnerStatement({
        partner_id: form.partner_id || null,
        period_start: form.period_start, period_end: form.period_end,
      });
      toast.success("Statement generated");
      setForm({ partner_id: "", period_start: "", period_end: "" });
      load();
    } catch (e: any) { toast.error(e.message); }
  };
  return (
    <div className="space-y-4">
      <Panel title="Generate statement">
        <div className="grid md:grid-cols-4 gap-2">
          <Input placeholder="Partner ID (optional)" value={form.partner_id} onChange={(e) => setForm({ ...form, partner_id: e.target.value })} />
          <Input type="date" value={form.period_start} onChange={(e) => setForm({ ...form, period_start: e.target.value })} />
          <Input type="date" value={form.period_end} onChange={(e) => setForm({ ...form, period_end: e.target.value })} />
          <Button size="sm" onClick={generate}><Plus className="w-3.5 h-3.5 mr-1" />Generate</Button>
        </div>
      </Panel>
      <Panel title="Issued statements">
        {loading ? <Loader /> : rows.length === 0 ? <Empty text="No statements yet" /> :
          <Table>
            <TableHeader><TableRow><TableHead>Number</TableHead><TableHead>Period</TableHead><TableHead className="text-right">Gross</TableHead><TableHead className="text-right">Net</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
            <TableBody>{rows.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="font-mono text-xs">{r.statement_number}</TableCell>
                <TableCell className="text-xs">{r.period_start} → {r.period_end}</TableCell>
                <TableCell className="text-right tabular-nums">{F.fmtINR(r.gross_paise)}</TableCell>
                <TableCell className="text-right tabular-nums">{F.fmtINR(r.net_paise)}</TableCell>
                <TableCell><Badge variant="outline">{r.status}</Badge></TableCell>
              </TableRow>))}
            </TableBody>
          </Table>
        }
      </Panel>
    </div>
  );
}

// ============================================================================
// Royalty Engine
// ============================================================================
function RoyaltyEngine() {
  const [rules, setRules] = useState<F.RoyaltyRule[]>([]);
  const [runs, setRuns] = useState<F.RoyaltyRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [ruleForm, setRuleForm] = useState({ scope: "title" as F.RoyaltyRule["scope"], title_id: "", deal_memo_id: "", partner_id: "", beneficiary_type: "creator", beneficiary_label: "", share_pct: 50 });
  const [runForm, setRunForm] = useState({ run_label: "", period_start: "", period_end: "" });
  const [selectedRun, setSelectedRun] = useState<string | null>(null);
  const [allocs, setAllocs] = useState<F.RoyaltyAllocation[]>([]);

  const load = async () => {
    setLoading(true);
    try {
      const [r, ru] = await Promise.all([F.listRoyaltyRules(), F.listRoyaltyRuns()]);
      setRules(r); setRuns(ru);
    } catch (e: any) { toast.error(e.message); } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const saveRule = async () => {
    try {
      await F.upsertRoyaltyRule({
        scope: ruleForm.scope,
        title_id: ruleForm.title_id || null,
        deal_memo_id: ruleForm.deal_memo_id || null,
        partner_id: ruleForm.partner_id || null,
        beneficiary_type: ruleForm.beneficiary_type,
        beneficiary_label: ruleForm.beneficiary_label || null,
        share_pct: Number(ruleForm.share_pct),
      });
      toast.success("Rule saved");
      load();
    } catch (e: any) { toast.error(e.message); }
  };
  const createRun = async () => {
    if (!runForm.run_label || !runForm.period_start || !runForm.period_end) return toast.error("Fill all fields");
    try { await F.createRoyaltyRun(runForm); toast.success("Run created"); setRunForm({ run_label: "", period_start: "", period_end: "" }); load(); }
    catch (e: any) { toast.error(e.message); }
  };
  const compute = async (id: string) => { try { const r = await F.computeRoyaltyRun(id); toast.success(`Computed ${r.line_count} allocations`); load(); openRun(id); } catch (e: any) { toast.error(e.message); } };
  const approve = async (id: string) => { try { await F.approveRoyaltyRun(id); toast.success("Approved"); load(); } catch (e: any) { toast.error(e.message); } };
  const openRun = async (id: string) => { setSelectedRun(id); try { setAllocs(await F.listAllocationsForRun(id)); } catch (e: any) { toast.error(e.message); } };

  return (
    <div className="space-y-4">
      <div className="grid md:grid-cols-2 gap-4">
        <Panel title="Add royalty rule">
          <div className="grid grid-cols-2 gap-2">
            <Select value={ruleForm.scope} onValueChange={(v: any) => setRuleForm({ ...ruleForm, scope: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="title">Title</SelectItem>
                <SelectItem value="deal">Deal</SelectItem>
                <SelectItem value="partner">Partner</SelectItem>
                <SelectItem value="global">Global</SelectItem>
              </SelectContent>
            </Select>
            <Input placeholder="Beneficiary type" value={ruleForm.beneficiary_type} onChange={(e) => setRuleForm({ ...ruleForm, beneficiary_type: e.target.value })} />
            {ruleForm.scope === "title" && <Input placeholder="Title ID" value={ruleForm.title_id} onChange={(e) => setRuleForm({ ...ruleForm, title_id: e.target.value })} />}
            {ruleForm.scope === "deal" && <Input placeholder="Deal memo ID" value={ruleForm.deal_memo_id} onChange={(e) => setRuleForm({ ...ruleForm, deal_memo_id: e.target.value })} />}
            {ruleForm.scope === "partner" && <Input placeholder="Partner ID" value={ruleForm.partner_id} onChange={(e) => setRuleForm({ ...ruleForm, partner_id: e.target.value })} />}
            <Input placeholder="Beneficiary label" value={ruleForm.beneficiary_label} onChange={(e) => setRuleForm({ ...ruleForm, beneficiary_label: e.target.value })} />
            <Input type="number" placeholder="Share %" value={ruleForm.share_pct} onChange={(e) => setRuleForm({ ...ruleForm, share_pct: Number(e.target.value) })} />
          </div>
          <div className="mt-2 flex justify-end"><Button size="sm" onClick={saveRule}><Plus className="w-3.5 h-3.5 mr-1" />Save rule</Button></div>
        </Panel>
        <Panel title="New royalty run">
          <div className="grid grid-cols-2 gap-2">
            <Input placeholder="Label (e.g. Q3 2026)" value={runForm.run_label} onChange={(e) => setRunForm({ ...runForm, run_label: e.target.value })} className="col-span-2" />
            <Input type="date" value={runForm.period_start} onChange={(e) => setRunForm({ ...runForm, period_start: e.target.value })} />
            <Input type="date" value={runForm.period_end} onChange={(e) => setRunForm({ ...runForm, period_end: e.target.value })} />
          </div>
          <div className="mt-2 flex justify-end"><Button size="sm" onClick={createRun}><Plus className="w-3.5 h-3.5 mr-1" />Create run</Button></div>
        </Panel>
      </div>

      <Panel title={`Active rules (${rules.length})`}>
        {loading ? <Loader /> : rules.length === 0 ? <Empty text="No rules configured" /> :
          <Table>
            <TableHeader><TableRow><TableHead>Scope</TableHead><TableHead>Beneficiary</TableHead><TableHead className="text-right">Share</TableHead><TableHead>Active</TableHead></TableRow></TableHeader>
            <TableBody>{rules.map((r) => (
              <TableRow key={r.id}>
                <TableCell><Badge variant="outline" className="capitalize">{r.scope}</Badge></TableCell>
                <TableCell>{r.beneficiary_label ?? r.beneficiary_type}</TableCell>
                <TableCell className="text-right tabular-nums">{Number(r.share_pct).toFixed(2)}%</TableCell>
                <TableCell>{r.active ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : "—"}</TableCell>
              </TableRow>))}
            </TableBody>
          </Table>
        }
      </Panel>

      <Panel title="Runs">
        {runs.length === 0 ? <Empty text="No runs yet" /> :
          <Table>
            <TableHeader><TableRow><TableHead>Label</TableHead><TableHead>Period</TableHead><TableHead className="text-right">Allocated</TableHead><TableHead>Status</TableHead><TableHead></TableHead></TableRow></TableHeader>
            <TableBody>{runs.map((r) => (
              <TableRow key={r.id} className={selectedRun === r.id ? "bg-primary/5" : ""}>
                <TableCell className="font-medium">{r.run_label}</TableCell>
                <TableCell className="text-xs">{r.period_start} → {r.period_end}</TableCell>
                <TableCell className="text-right tabular-nums">{F.fmtINR(r.allocated_paise)}</TableCell>
                <TableCell><Badge variant="outline">{r.status}</Badge></TableCell>
                <TableCell className="text-right space-x-1">
                  <Button size="sm" variant="outline" onClick={() => openRun(r.id)}>View</Button>
                  {r.status === "draft" && <Button size="sm" onClick={() => compute(r.id)}><Play className="w-3.5 h-3.5 mr-1" />Compute</Button>}
                  {r.status === "computed" && <Button size="sm" onClick={() => approve(r.id)}><CheckCircle2 className="w-3.5 h-3.5 mr-1" />Approve</Button>}
                </TableCell>
              </TableRow>))}
            </TableBody>
          </Table>
        }
      </Panel>

      {selectedRun && allocs.length > 0 && (
        <Panel title={`Allocations for selected run (${allocs.length})`}>
          <Table>
            <TableHeader><TableRow><TableHead>Beneficiary</TableHead><TableHead className="text-right">Share</TableHead><TableHead className="text-right">Allocated</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
            <TableBody>{allocs.map((a) => (
              <TableRow key={a.id}>
                <TableCell>{a.beneficiary_label ?? a.beneficiary_type}</TableCell>
                <TableCell className="text-right tabular-nums">{a.share_pct != null ? `${Number(a.share_pct).toFixed(2)}%` : "—"}</TableCell>
                <TableCell className="text-right tabular-nums">{F.fmtINR(a.allocated_paise)}</TableCell>
                <TableCell><Badge variant="outline">{a.status}</Badge></TableCell>
              </TableRow>))}
            </TableBody>
          </Table>
        </Panel>
      )}
    </div>
  );
}

// ============================================================================
// Payment Tracking – reuses existing deal_payouts + invoices, adds unified view
// ============================================================================
function PaymentTracking() {
  const [payouts, setPayouts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => { (async () => {
    setLoading(true);
    const { supabase } = await import("@/integrations/supabase/client");
    const [{ data: p }] = await Promise.all([
      supabase.from("deal_payouts").select("id,beneficiary_label,beneficiary_type,payout_amount_paise,status,paid_at,payment_reference,created_at").order("created_at", { ascending: false }).limit(50),
    ]);
    setPayouts(p ?? []); setLoading(false);
  })(); }, []);
  return (
    <Panel title="Deal payout status">
      {loading ? <Loader /> : payouts.length === 0 ? <Empty text="No payouts logged" /> :
        <Table>
          <TableHeader><TableRow><TableHead>Beneficiary</TableHead><TableHead className="text-right">Amount</TableHead><TableHead>Reference</TableHead><TableHead>Status</TableHead><TableHead>Paid at</TableHead></TableRow></TableHeader>
          <TableBody>{payouts.map((r) => (
            <TableRow key={r.id}>
              <TableCell>{r.beneficiary_label ?? r.beneficiary_type}</TableCell>
              <TableCell className="text-right tabular-nums">{F.fmtINR(r.payout_amount_paise)}</TableCell>
              <TableCell className="text-xs font-mono">{r.payment_reference ?? "—"}</TableCell>
              <TableCell><Badge variant="outline">{r.status}</Badge></TableCell>
              <TableCell className="text-xs">{r.paid_at ? new Date(r.paid_at).toLocaleDateString() : "—"}</TableCell>
            </TableRow>))}
          </TableBody>
        </Table>
      }
    </Panel>
  );
}

// ============================================================================
// Settlements
// ============================================================================
function Settlements() {
  const [rows, setRows] = useState<F.Settlement[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ beneficiary_type: "partner", beneficiary_label: "", amount_paise: 0, method: "bank_transfer", scheduled_for: "" });
  const load = async () => { setLoading(true); try { setRows(await F.listSettlements()); } catch (e: any) { toast.error(e.message); } finally { setLoading(false); } };
  useEffect(() => { load(); }, []);
  const create = async () => {
    if (!form.beneficiary_label || !form.amount_paise) return toast.error("Fill beneficiary + amount");
    try {
      await F.createSettlement({
        beneficiary_type: form.beneficiary_type,
        beneficiary_label: form.beneficiary_label,
        amount_paise: form.amount_paise,
        method: form.method,
        scheduled_for: form.scheduled_for || null,
      });
      toast.success("Settlement queued");
      setForm({ beneficiary_type: "partner", beneficiary_label: "", amount_paise: 0, method: "bank_transfer", scheduled_for: "" });
      load();
    } catch (e: any) { toast.error(e.message); }
  };
  const markPaid = async (id: string) => { try { await F.markSettlementPaid(id); toast.success("Marked paid"); load(); } catch (e: any) { toast.error(e.message); } };

  return (
    <div className="space-y-4">
      <Panel title="Queue settlement">
        <div className="grid md:grid-cols-5 gap-2">
          <Select value={form.beneficiary_type} onValueChange={(v) => setForm({ ...form, beneficiary_type: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="creator">Creator</SelectItem>
              <SelectItem value="partner">Partner</SelectItem>
              <SelectItem value="platform">Platform</SelectItem>
              <SelectItem value="custom">Custom</SelectItem>
            </SelectContent>
          </Select>
          <Input placeholder="Beneficiary label" value={form.beneficiary_label} onChange={(e) => setForm({ ...form, beneficiary_label: e.target.value })} />
          <Input type="number" placeholder="Amount (paise)" value={form.amount_paise || ""} onChange={(e) => setForm({ ...form, amount_paise: Number(e.target.value) })} />
          <Select value={form.method} onValueChange={(v) => setForm({ ...form, method: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="bank_transfer">Bank transfer</SelectItem>
              <SelectItem value="razorpay_payout">Razorpay payout</SelectItem>
              <SelectItem value="upi">UPI</SelectItem>
              <SelectItem value="wire">Wire</SelectItem>
              <SelectItem value="manual">Manual</SelectItem>
            </SelectContent>
          </Select>
          <Input type="date" value={form.scheduled_for} onChange={(e) => setForm({ ...form, scheduled_for: e.target.value })} />
        </div>
        <div className="mt-2 flex justify-end"><Button size="sm" onClick={create}><Plus className="w-3.5 h-3.5 mr-1" />Queue</Button></div>
      </Panel>
      <Panel title="Recent settlements">
        {loading ? <Loader /> : rows.length === 0 ? <Empty text="No settlements yet" /> :
          <Table>
            <TableHeader><TableRow><TableHead>Number</TableHead><TableHead>Beneficiary</TableHead><TableHead className="text-right">Amount</TableHead><TableHead>Method</TableHead><TableHead>Status</TableHead><TableHead></TableHead></TableRow></TableHeader>
            <TableBody>{rows.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="font-mono text-xs">{r.settlement_number}</TableCell>
                <TableCell>{r.beneficiary_label ?? r.beneficiary_type}</TableCell>
                <TableCell className="text-right tabular-nums">{F.fmtINR(r.amount_paise)}</TableCell>
                <TableCell className="text-xs">{r.method}</TableCell>
                <TableCell><Badge variant="outline">{r.status}</Badge></TableCell>
                <TableCell className="text-right">
                  {r.status !== "paid" && <Button size="sm" variant="outline" onClick={() => markPaid(r.id)}>Mark paid</Button>}
                </TableCell>
              </TableRow>))}
            </TableBody>
          </Table>
        }
      </Panel>
    </div>
  );
}

// ============================================================================
// Revenue Analytics
// ============================================================================
function RevenueAnalytics() {
  const [summary, setSummary] = useState<Awaited<ReturnType<typeof F.getRevenueSummary>> | null>(null);
  const [days, setDays] = useState(180);
  useEffect(() => { (async () => { try { setSummary(await F.getRevenueSummary(days)); } catch (e: any) { toast.error(e.message); } })(); }, [days]);
  const max = useMemo(() => Math.max(1, ...(summary?.by_month.map((m) => m.gross_paise) ?? [1])), [summary]);

  if (!summary) return <Loader />;
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Label className="text-xs">Window</Label>
        <Select value={String(days)} onValueChange={(v) => setDays(Number(v))}>
          <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="30">30 days</SelectItem>
            <SelectItem value="90">90 days</SelectItem>
            <SelectItem value="180">180 days</SelectItem>
            <SelectItem value="365">365 days</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <Panel title="Monthly gross revenue">
        {summary.by_month.length === 0 ? <Empty text="No revenue yet" /> :
          <div className="space-y-2">
            {summary.by_month.map((m) => (
              <div key={m.month} className="space-y-1">
                <div className="flex justify-between text-xs"><span>{m.month}</span><span className="tabular-nums">{F.fmtINR(m.gross_paise)}</span></div>
                <div className="h-2 rounded-full bg-secondary/40 overflow-hidden">
                  <div className="h-full bg-gradient-primary" style={{ width: `${(m.gross_paise / max) * 100}%` }} />
                </div>
              </div>
            ))}
          </div>
        }
      </Panel>
      <div className="grid md:grid-cols-2 gap-4">
        <Panel title="Channel mix">
          {summary.by_channel.map((c) => (
            <div key={c.channel} className="flex justify-between text-sm py-0.5">
              <span className="capitalize">{c.channel}</span>
              <span className="tabular-nums">{F.fmtINR(c.gross_paise)}</span>
            </div>
          ))}
        </Panel>
        <Panel title="Payout status">
          <div className="flex justify-between text-sm"><span>Outstanding</span><span className="tabular-nums text-amber-300">{F.fmtINR(summary.outstanding_payouts_paise)}</span></div>
          <div className="flex justify-between text-sm"><span>Paid</span><span className="tabular-nums text-emerald-300">{F.fmtINR(summary.paid_payouts_paise)}</span></div>
        </Panel>
      </div>
    </div>
  );
}

// ============================================================================
// Shared primitives
// ============================================================================
function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-border/60 bg-secondary/20 p-4 space-y-2">
      <div className="text-xs uppercase tracking-wider text-muted-foreground font-medium">{title}</div>
      {children}
    </div>
  );
}
function Stat({ label, value, tone }: { label: string; value: string; tone: "primary" | "warn" | "ok" | "muted" }) {
  const cls = tone === "primary" ? "border-primary/40 bg-primary/5 text-primary"
    : tone === "warn" ? "border-amber-500/40 bg-amber-500/5 text-amber-300"
    : tone === "ok" ? "border-emerald-500/40 bg-emerald-500/5 text-emerald-300"
    : "border-border/60 bg-secondary/30 text-muted-foreground";
  return (
    <div className={`rounded-2xl border p-3 ${cls}`}>
      <div className="text-[10px] uppercase tracking-wider opacity-80">{label}</div>
      <div className="mt-1 text-xl font-display font-bold text-foreground tabular-nums">{value}</div>
    </div>
  );
}
function Loader() { return <div className="text-sm text-muted-foreground inline-flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Loading…</div>; }
function Empty({ text }: { text: string }) { return <div className="text-sm text-muted-foreground py-4 text-center">{text}</div>; }
