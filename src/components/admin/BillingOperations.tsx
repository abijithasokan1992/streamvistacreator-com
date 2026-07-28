import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Loader2, RefreshCw, FileText, ExternalLink, ShieldCheck, AlertTriangle } from "lucide-react";

type OrderRow = {
  id: string; app_key: string; source_type: string;
  customer_user_id: string | null; customer_email: string | null;
  amount_total_paise: number; currency: string;
  status: string; payment_method_mode: string;
  invoice_id: string | null; invoice_number: string | null;
  payment_trace_id: string | null; razorpay_order_id: string | null;
  created_at: string; updated_at: string;
};

type ManualRow = {
  submission_id: string; order_id: string; app_key: string; source_type: string;
  customer_user_id: string | null; customer_email: string | null;
  payment_channel: string; amount_paid_paise: number; currency: string;
  utr_or_reference: string | null; bank_name: string | null; paid_at: string | null;
  proof_file_path: string | null; remarks: string | null;
  payer_name: string | null; payer_phone: string | null; payer_email: string | null;
  submission_status: string; order_status: string;
  submitted_at: string; order_total_paise: number;
};

type PMC = {
  id: string; scope_app_key: string | null; scope_product_types: string[];
  rail: string; display_name: string;
  beneficiary_name: string | null; bank_name: string | null;
  account_number: string | null; ifsc: string | null; branch: string | null;
  upi_id: string | null; qr_image_path: string | null;
  instructions: string | null; support_contact: string | null;
  is_enabled: boolean;
};

const STATUS_OPTIONS = ["draft","awaiting_payment","payment_under_review","paid","failed","cancelled","expired","refunded"];
const RAIL_OPTIONS = ["razorpay","bank_transfer","upi_manual","invoice_offline","admin_mark_paid"];
const APP_OPTIONS = ["studio_vault","streamvista_creator","crayons_bridge","crayons_loop"];

const inr = (paise: number) => `₹${(Number(paise || 0) / 100).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmtDate = (d?: string | null) => (d ? new Date(d).toLocaleString() : "—");

function StatusBadge({ s }: { s: string }) {
  const map: Record<string, string> = {
    paid: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
    payment_under_review: "bg-amber-500/15 text-amber-400 border-amber-500/30",
    awaiting_payment: "bg-blue-500/15 text-blue-400 border-blue-500/30",
    failed: "bg-red-500/15 text-red-400 border-red-500/30",
    rejected: "bg-red-500/15 text-red-400 border-red-500/30",
    cancelled: "bg-muted text-muted-foreground border-border",
    expired: "bg-muted text-muted-foreground border-border",
    refunded: "bg-purple-500/15 text-purple-400 border-purple-500/30",
    draft: "bg-muted text-muted-foreground border-border",
    submitted: "bg-amber-500/15 text-amber-400 border-amber-500/30",
    needs_clarification: "bg-orange-500/15 text-orange-400 border-orange-500/30",
    approved: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  };
  return <span className={`inline-flex items-center px-2 py-0.5 text-[10px] rounded border ${map[s] ?? "bg-muted text-muted-foreground border-border"}`}>{s}</span>;
}

export default function BillingOperations() {
  return (
    <Card className="rounded-2xl border-border/40">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-primary" /> Billing & Payments
        </CardTitle>
        <p className="text-xs text-muted-foreground">Orders, payment attempts, manual proof review, and payment settings.</p>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="reviews" className="w-full">
          <TabsList className="grid grid-cols-4 mb-4">
            <TabsTrigger value="reviews">Payments Awaiting Review</TabsTrigger>
            <TabsTrigger value="orders">Orders</TabsTrigger>
            <TabsTrigger value="methods">Payment Settings</TabsTrigger>
            <TabsTrigger value="override">Manual Admin Approval</TabsTrigger>
          </TabsList>
          <TabsContent value="reviews"><PendingReviews /></TabsContent>
          <TabsContent value="orders"><OrdersList /></TabsContent>
          <TabsContent value="methods"><PaymentMethodConfigs /></TabsContent>
          <TabsContent value="override"><AdminOverride /></TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}

// ─── Pending Reviews ────────────────────────────────────
function PendingReviews() {
  const [rows, setRows] = useState<ManualRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [active, setActive] = useState<ManualRow | null>(null);
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [proofUrl, setProofUrl] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase.rpc("admin_pending_manual_reviews", { _limit: 200 });
    if (error) toast.error(error.message); else setRows((data as ManualRow[]) ?? []);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const openProof = async (path: string) => {
    setProofUrl(null);
    const { data, error } = await supabase.functions.invoke("admin-billing-proof-url", { body: { path, expiresIn: 600 } });
    if (error || !data?.url) { toast.error(error?.message || "Failed to sign proof URL"); return; }
    setProofUrl(data.url);
    window.open(data.url, "_blank", "noopener,noreferrer");
  };

  const review = async (action: "approve" | "reject" | "request_clarification") => {
    if (!active) return;
    setBusy(true);
    const { error } = await supabase.rpc("admin_review_manual_payment", {
      _submission_id: active.submission_id, _action: action, _review_notes: notes || null,
    });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success(`Submission ${action}d`);
    setActive(null); setNotes("");
    load();
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">{rows.length} pending submissions</p>
        <Button variant="outline" size="sm" onClick={load} disabled={loading}>
          {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
          <span className="ml-1.5">Refresh</span>
        </Button>
      </div>
      <div className="overflow-x-auto rounded-lg border border-border/40">
        <table className="w-full text-xs">
          <thead className="bg-muted/30">
            <tr>
              <th className="text-left px-3 py-2">Submitted</th>
              <th className="text-left px-3 py-2">Customer</th>
              <th className="text-left px-3 py-2">App</th>
              <th className="text-left px-3 py-2">Channel</th>
              <th className="text-right px-3 py-2">Amount</th>
              <th className="text-left px-3 py-2">UTR</th>
              <th className="text-left px-3 py-2">Status</th>
              <th className="text-right px-3 py-2">Action</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr><td colSpan={8} className="text-center py-6 text-muted-foreground">No pending reviews.</td></tr>
            )}
            {rows.map(r => (
              <tr key={r.submission_id} className="border-t border-border/30">
                <td className="px-3 py-2 whitespace-nowrap">{fmtDate(r.submitted_at)}</td>
                <td className="px-3 py-2">{r.customer_email ?? r.customer_user_id?.slice(0,8)}</td>
                <td className="px-3 py-2">{r.app_key}</td>
                <td className="px-3 py-2">{r.payment_channel}</td>
                <td className="px-3 py-2 text-right">{inr(r.amount_paid_paise)}</td>
                <td className="px-3 py-2 font-mono text-[10px]">{r.utr_or_reference ?? "—"}</td>
                <td className="px-3 py-2"><StatusBadge s={r.submission_status} /></td>
                <td className="px-3 py-2 text-right">
                  <Button size="sm" variant="outline" onClick={() => { setActive(r); setNotes(""); }}>Review</Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Dialog open={!!active} onOpenChange={(o) => { if (!o) { setActive(null); setProofUrl(null); } }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>Review manual payment</DialogTitle></DialogHeader>
          {active && (
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <Field label="Customer" value={active.customer_email ?? active.customer_user_id ?? "—"} />
                <Field label="App / Source" value={`${active.app_key} / ${active.source_type}`} />
                <Field label="Channel" value={active.payment_channel} />
                <Field label="Amount paid" value={inr(active.amount_paid_paise)} />
                <Field label="Order total" value={inr(active.order_total_paise)} />
                <Field label="Bank Reference Number" value={active.utr_or_reference ?? "—"} />
                <Field label="Bank" value={active.bank_name ?? "—"} />
                <Field label="Paid at" value={fmtDate(active.paid_at)} />
                <Field label="Payer name" value={active.payer_name ?? "—"} />
                <Field label="Payer contact" value={[active.payer_phone, active.payer_email].filter(Boolean).join(" / ") || "—"} />
              </div>
              {active.remarks && <div className="text-xs"><span className="text-muted-foreground">Remarks:</span> {active.remarks}</div>}
              {Number(active.amount_paid_paise) !== Number(active.order_total_paise) && (
                <div className="flex items-start gap-2 rounded border border-amber-500/30 bg-amber-500/10 p-2 text-xs">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-400 mt-0.5" />
                  Amount paid does not match order total. Confirm before approving.
                </div>
              )}
              {active.proof_file_path ? (
                <Button variant="outline" size="sm" onClick={() => openProof(active.proof_file_path!)}>
                  <FileText className="w-3 h-3 mr-1" /> Open proof (signed URL)
                </Button>
              ) : (
                <p className="text-xs text-muted-foreground">No proof file attached.</p>
              )}
              {proofUrl && (
                <p className="text-[10px] text-muted-foreground">Proof opened in new tab (expires in 10 min).</p>
              )}
              <div>
                <Label htmlFor="rn" className="text-xs">Review notes (visible to customer / audit)</Label>
                <Textarea id="rn" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
              </div>
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button variant="outline" disabled={busy} onClick={() => review("request_clarification")}>Request clarification</Button>
            <Button variant="destructive" disabled={busy} onClick={() => review("reject")}>Reject</Button>
            <Button disabled={busy} onClick={() => review("approve")}>
              {busy && <Loader2 className="w-3 h-3 animate-spin mr-1" />} Approve & fulfill
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="font-medium break-all">{value}</div>
    </div>
  );
}

// ─── Orders + Attempts ──────────────────────────────────
function OrdersList() {
  const [rows, setRows] = useState<OrderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [app, setApp] = useState<string>("all");
  const [status, setStatus] = useState<string>("all");
  const [rail, setRail] = useState<string>("all");
  const [detail, setDetail] = useState<any | null>(null);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase.rpc("admin_billing_orders_list", {
      _app_key: app === "all" ? null : app,
      _status: status === "all" ? null : status,
      _rail: rail === "all" ? null : rail,
      _limit: 200,
    });
    if (error) toast.error(error.message); else setRows((data as OrderRow[]) ?? []);
    setLoading(false);
  };
  useEffect(() => { load(); }, [app, status, rail]);

  const openDetail = async (id: string) => {
    const { data, error } = await supabase.rpc("admin_billing_order_detail", { _order_id: id });
    if (error) { toast.error(error.message); return; }
    setDetail(data);
  };

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        <FilterSelect label="App" value={app} onChange={setApp} options={["all", ...APP_OPTIONS]} />
        <FilterSelect label="Status" value={status} onChange={setStatus} options={["all", ...STATUS_OPTIONS]} />
        <FilterSelect label="Rail" value={rail} onChange={setRail} options={["all", ...RAIL_OPTIONS]} />
        <div className="flex items-end">
          <Button variant="outline" size="sm" onClick={load} disabled={loading} className="w-full">
            {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
            <span className="ml-1.5">Refresh</span>
          </Button>
        </div>
      </div>
      <div className="overflow-x-auto rounded-lg border border-border/40">
        <table className="w-full text-xs">
          <thead className="bg-muted/30">
            <tr>
              <th className="text-left px-3 py-2">Created</th>
              <th className="text-left px-3 py-2">App / Source</th>
              <th className="text-left px-3 py-2">Customer</th>
              <th className="text-right px-3 py-2">Total</th>
              <th className="text-left px-3 py-2">Rail</th>
              <th className="text-left px-3 py-2">Status</th>
              <th className="text-left px-3 py-2">Invoice</th>
              <th className="text-right px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={8} className="text-center py-6 text-muted-foreground">No orders match.</td></tr>}
            {rows.map(r => (
              <tr key={r.id} className="border-t border-border/30">
                <td className="px-3 py-2 whitespace-nowrap">{fmtDate(r.created_at)}</td>
                <td className="px-3 py-2">{r.app_key}<div className="text-[10px] text-muted-foreground">{r.source_type}</div></td>
                <td className="px-3 py-2">{r.customer_email ?? r.customer_user_id?.slice(0,8) ?? "—"}</td>
                <td className="px-3 py-2 text-right">{inr(r.amount_total_paise)}</td>
                <td className="px-3 py-2">{r.payment_method_mode}</td>
                <td className="px-3 py-2"><StatusBadge s={r.status} /></td>
                <td className="px-3 py-2 font-mono text-[10px]">{r.invoice_number ?? "—"}</td>
                <td className="px-3 py-2 text-right">
                  <Button size="sm" variant="outline" onClick={() => openDetail(r.id)}>Detail</Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Dialog open={!!detail} onOpenChange={(o) => { if (!o) setDetail(null); }}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Order detail</DialogTitle></DialogHeader>
          {detail && (
            <div className="space-y-4 text-xs">
              <Section title="Order" data={detail.order} />
              {detail.invoice && <Section title="Invoice" data={detail.invoice} />}
              {detail.payment_trace && <Section title="Payment Journey" data={detail.payment_trace} />}
              <ListSection title={`Payment Attempts (${detail.attempts?.length ?? 0})`} items={detail.attempts ?? []} keys={["created_at","rail","status","amount_paise","razorpay_order_id","razorpay_payment_id","utr_or_reference","failure_reason"]} />
              <ListSection title={`Manual Submissions (${detail.manual_submissions?.length ?? 0})`} items={detail.manual_submissions ?? []} keys={["created_at","status","payment_channel","amount_paid_paise","utr_or_reference","review_notes"]} />
              <ListSection title={`Ledger Events (${detail.ledger?.length ?? 0})`} items={detail.ledger ?? []} keys={["created_at","event_type","actor_user_id","payload"]} />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function FilterSelect({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: string[] }) {
  return (
    <div>
      <Label className="text-[10px] uppercase">{label}</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
        <SelectContent>{options.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent>
      </Select>
    </div>
  );
}

function Section({ title, data }: { title: string; data: any }) {
  if (!data) return null;
  return (
    <div className="rounded border border-border/40 p-3">
      <div className="font-semibold mb-1.5">{title}</div>
      <pre className="text-[10px] overflow-x-auto whitespace-pre-wrap break-all">{JSON.stringify(data, null, 2)}</pre>
    </div>
  );
}

function ListSection({ title, items, keys }: { title: string; items: any[]; keys: string[] }) {
  return (
    <div className="rounded border border-border/40 p-3">
      <div className="font-semibold mb-1.5">{title}</div>
      {items.length === 0 ? <div className="text-muted-foreground">None.</div> : (
        <div className="space-y-1.5">
          {items.map((it, i) => (
            <div key={i} className="rounded bg-muted/20 p-2">
              <div className="grid grid-cols-2 gap-1">
                {keys.map(k => (
                  <div key={k} className="text-[10px]"><span className="text-muted-foreground">{k}:</span> <span className="font-mono break-all">{typeof it[k] === "object" ? JSON.stringify(it[k]) : String(it[k] ?? "—")}</span></div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Payment Method Configs ─────────────────────────────
function PaymentMethodConfigs() {
  const [rows, setRows] = useState<PMC[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Partial<PMC> | null>(null);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase.from("billing_payment_method_configs").select("*").order("created_at", { ascending: false });
    if (error) toast.error(error.message); else setRows((data as PMC[]) ?? []);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const save = async () => {
    if (!editing) return;
    const payload: any = { ...editing };
    if (!payload.rail || !payload.display_name) { toast.error("Rail and display name are required"); return; }
    if (!payload.scope_product_types) payload.scope_product_types = [];
    let res;
    if (payload.id) {
      const { id, ...rest } = payload;
      res = await supabase.from("billing_payment_method_configs").update(rest).eq("id", id);
    } else {
      res = await supabase.from("billing_payment_method_configs").insert(payload);
    }
    if (res.error) { toast.error(res.error.message); return; }
    toast.success("Saved"); setEditing(null); load();
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this payment method config?")) return;
    const { error } = await supabase.from("billing_payment_method_configs").delete().eq("id", id);
    if (error) toast.error(error.message); else { toast.success("Deleted"); load(); }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">{rows.length} configured</p>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={load}>{loading ? <Loader2 className="w-3 h-3 animate-spin"/> : <RefreshCw className="w-3 h-3"/>}<span className="ml-1.5">Refresh</span></Button>
          <Button size="sm" onClick={() => setEditing({ rail: "bank_transfer", display_name: "Bank Transfer", is_enabled: true, scope_product_types: [] })}>+ Add</Button>
        </div>
      </div>
      <div className="overflow-x-auto rounded-lg border border-border/40">
        <table className="w-full text-xs">
          <thead className="bg-muted/30">
            <tr>
              <th className="text-left px-3 py-2">Display</th>
              <th className="text-left px-3 py-2">Rail</th>
              <th className="text-left px-3 py-2">Scope</th>
              <th className="text-left px-3 py-2">Beneficiary / UPI</th>
              <th className="text-left px-3 py-2">Enabled</th>
              <th className="text-right px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={6} className="text-center py-6 text-muted-foreground">No payment methods configured. Add Bank Transfer / UPI to enable manual payments.</td></tr>}
            {rows.map(r => (
              <tr key={r.id} className="border-t border-border/30">
                <td className="px-3 py-2">{r.display_name}</td>
                <td className="px-3 py-2">{r.rail}</td>
                <td className="px-3 py-2">{r.scope_app_key ?? "all apps"}</td>
                <td className="px-3 py-2 text-[10px]">
                  {r.beneficiary_name && <div>{r.beneficiary_name}</div>}
                  {r.account_number && <div>A/C {r.account_number} · IFSC {r.ifsc}</div>}
                  {r.upi_id && <div>UPI: {r.upi_id}</div>}
                </td>
                <td className="px-3 py-2">{r.is_enabled ? <Badge variant="default">Yes</Badge> : <Badge variant="secondary">No</Badge>}</td>
                <td className="px-3 py-2 text-right space-x-1">
                  <Button size="sm" variant="outline" onClick={() => setEditing(r)}>Edit</Button>
                  <Button size="sm" variant="destructive" onClick={() => remove(r.id)}>Delete</Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Dialog open={!!editing} onOpenChange={(o) => { if (!o) setEditing(null); }}>
        <DialogContent className="max-w-xl max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing?.id ? "Edit" : "Add"} payment method</DialogTitle></DialogHeader>
          {editing && (
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Display name</Label>
                  <Input value={editing.display_name ?? ""} onChange={e => setEditing({ ...editing, display_name: e.target.value })} />
                </div>
                <div>
                  <Label className="text-xs">Rail</Label>
                  <Select value={editing.rail} onValueChange={v => setEditing({ ...editing, rail: v as any })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{RAIL_OPTIONS.filter(r => r !== "razorpay").map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">App scope (blank = all)</Label>
                  <Select value={editing.scope_app_key ?? "_all"} onValueChange={v => setEditing({ ...editing, scope_app_key: v === "_all" ? null : v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="_all">All apps</SelectItem>
                      {APP_OPTIONS.map(a => <SelectItem key={a} value={a}>{a}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-end gap-2">
                  <Label className="text-xs">Enabled</Label>
                  <input type="checkbox" checked={!!editing.is_enabled} onChange={e => setEditing({ ...editing, is_enabled: e.target.checked })} />
                </div>
                <div>
                  <Label className="text-xs">Beneficiary name</Label>
                  <Input value={editing.beneficiary_name ?? ""} onChange={e => setEditing({ ...editing, beneficiary_name: e.target.value })} />
                </div>
                <div>
                  <Label className="text-xs">Bank name</Label>
                  <Input value={editing.bank_name ?? ""} onChange={e => setEditing({ ...editing, bank_name: e.target.value })} />
                </div>
                <div>
                  <Label className="text-xs">Account number</Label>
                  <Input value={editing.account_number ?? ""} onChange={e => setEditing({ ...editing, account_number: e.target.value })} />
                </div>
                <div>
                  <Label className="text-xs">IFSC</Label>
                  <Input value={editing.ifsc ?? ""} onChange={e => setEditing({ ...editing, ifsc: e.target.value })} />
                </div>
                <div>
                  <Label className="text-xs">Branch</Label>
                  <Input value={editing.branch ?? ""} onChange={e => setEditing({ ...editing, branch: e.target.value })} />
                </div>
                <div>
                  <Label className="text-xs">UPI ID</Label>
                  <Input value={editing.upi_id ?? ""} onChange={e => setEditing({ ...editing, upi_id: e.target.value })} />
                </div>
                <div className="col-span-2">
                  <Label className="text-xs">QR image path (storage key)</Label>
                  <Input value={editing.qr_image_path ?? ""} onChange={e => setEditing({ ...editing, qr_image_path: e.target.value })} />
                </div>
                <div className="col-span-2">
                  <Label className="text-xs">Instructions</Label>
                  <Textarea rows={3} value={editing.instructions ?? ""} onChange={e => setEditing({ ...editing, instructions: e.target.value })} />
                </div>
                <div className="col-span-2">
                  <Label className="text-xs">Support / finance contact</Label>
                  <Input value={editing.support_contact ?? ""} onChange={e => setEditing({ ...editing, support_contact: e.target.value })} />
                </div>
              </div>
            </div>
          )}
          <DialogFooter><Button onClick={save}>Save</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Admin override (super admin force-paid) ────────────
function AdminOverride() {
  const [orderId, setOrderId] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const exec = async () => {
    if (!orderId || reason.trim().length < 8) { toast.error("Order id and a reason (8+ chars) are required"); return; }
    if (!confirm("Force this order to PAID and trigger fulfillment? This is audit-logged.")) return;
    setBusy(true);
    const { error, data } = await supabase.rpc("admin_mark_order_paid", { _order_id: orderId, _reason: reason });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Order marked paid + fulfilled");
    console.log("admin_mark_order_paid result", data);
    setOrderId(""); setReason("");
  };
  return (
    <div className="space-y-3 max-w-xl">
      <div className="flex items-start gap-2 rounded border border-amber-500/30 bg-amber-500/10 p-3 text-xs">
        <AlertTriangle className="w-4 h-4 text-amber-400 mt-0.5" />
        <div>
          Super-admin only. Use for exceptional founder-assisted collections where no manual submission was made. Always audit-logged in <code>admin_audit_log</code> and the billing ledger.
        </div>
      </div>
      <div>
        <Label>Billing order id</Label>
        <Input value={orderId} onChange={e => setOrderId(e.target.value)} placeholder="uuid" />
      </div>
      <div>
        <Label>Reason (min 8 chars, mandatory)</Label>
        <Textarea rows={3} value={reason} onChange={e => setReason(e.target.value)} />
      </div>
      <Button onClick={exec} disabled={busy}>{busy && <Loader2 className="w-3 h-3 animate-spin mr-1"/>} Mark paid & fulfill</Button>
    </div>
  );
}
