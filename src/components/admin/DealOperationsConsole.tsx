import { useEffect, useMemo, useState } from "react";
import { Loader2, RefreshCw, ShieldCheck, FileText, CreditCard, Truck, Wallet, Flag, AlertTriangle, History, ExternalLink, FileSignature, Activity, Handshake } from "lucide-react";
import { OfferNegotiationThread } from "@/components/licensing/OfferNegotiationThread";
import { LicenseContractsPanel } from "@/components/licensing/LicenseContractsPanel";
import { LicenseLifecyclePanel } from "@/components/licensing/LicenseLifecyclePanel";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";

type Deal = {
  id: string; memo_number: string; title_id: string;
  buyer_org_name: string | null; buyer_contact_email: string | null; buyer_user_id: string | null;
  amount_paise: number | null; currency: string;
  status: string; ops_stage: string;
  approval_status: string; approval_notes: string | null; approved_by: string | null; approved_at: string | null;
  payment_status: string; payment_mode: string | null; paid_amount_paise: number; paid_at: string | null;
  payment_reference: string | null; payment_notes: string | null;
  delivery_status: string; delivered_at: string | null; delivery_notes: string | null;
  close_outcome: string | null; close_reason: string | null; closed_at: string | null;
  platform_share_paise: number | null; owner_share_paise: number | null; owner_share_pct: number | null;
  commercial_request_id: string | null; created_at: string; updated_at: string;
};
type Title = { id: string; title: string; owner_user_id: string };
type Invoice = {
  id: string; invoice_number: string; deal_memo_id: string | null; total_paise: number;
  status: string; currency: string; issued_at: string | null; paid_at: string | null;
};
type Delivery = {
  id: string; deal_memo_id: string; status: string; method: string;
  recipient_email: string | null; share_url: string | null; expires_at: string | null;
  shared_at: string | null; delivered_at: string | null; package_notes: string | null;
};
type Payout = {
  id: string; deal_memo_id: string; beneficiary_type: string; beneficiary_label: string | null;
  beneficiary_email: string | null; basis: string; share_pct: number | null;
  gross_amount_paise: number; payout_amount_paise: number; status: string;
  payment_reference: string | null; paid_at: string | null;
};
type Event = {
  id: string; deal_memo_id: string; kind: string; summary: string | null;
  metadata: any; occurred_at: string;
};

const inr = (paise: number | null | undefined) =>
  paise == null ? "—" : `₹${(Number(paise) / 100).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;

const STAGE_BADGES: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  pending_internal_approval: "bg-amber-500/10 text-amber-600 border-amber-500/30",
  approved: "bg-blue-500/10 text-blue-600 border-blue-500/30",
  invoice_pending: "bg-orange-500/10 text-orange-600 border-orange-500/30",
  invoice_issued: "bg-violet-500/10 text-violet-600 border-violet-500/30",
  payment_pending: "bg-orange-500/10 text-orange-600 border-orange-500/30",
  partially_paid: "bg-amber-500/10 text-amber-600 border-amber-500/30",
  paid: "bg-emerald-500/10 text-emerald-600 border-emerald-500/30",
  delivery_preparing: "bg-cyan-500/10 text-cyan-600 border-cyan-500/30",
  delivered: "bg-emerald-500/10 text-emerald-600 border-emerald-500/30",
  payout_pending: "bg-amber-500/10 text-amber-600 border-amber-500/30",
  payout_marked: "bg-emerald-500/10 text-emerald-600 border-emerald-500/30",
  closed_won: "bg-emerald-600/10 text-emerald-700 border-emerald-600/40",
  closed_lost: "bg-red-500/10 text-red-600 border-red-500/30",
  cancelled: "bg-muted text-muted-foreground",
};

function dealRisk(d: Deal): string | null {
  if (d.ops_stage === "approved" && d.payment_status === "not_started") return "Approved but no invoice/payment yet";
  if (d.payment_status === "paid" && d.delivery_status === "not_started") return "Paid but delivery not started";
  if (d.delivery_status === "delivered" && d.ops_stage !== "payout_marked" && d.ops_stage !== "closed_won")
    return "Delivered but payout intent not marked";
  if (d.close_outcome === "won" && (d.payment_status !== "paid" || d.delivery_status !== "delivered"))
    return "Won but payment or delivery incomplete";
  return null;
}

export default function DealOperationsConsole() {
  const sb = supabase as any;
  const [loading, setLoading] = useState(true);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [titles, setTitles] = useState<Title[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [filter, setFilter] = useState<string>("active");
  const [activeDealId, setActiveDealId] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    const [d, t, i] = await Promise.all([
      sb.rpc("admin_list_deal_memos", { _title_id: null }),
      sb.from("content_titles").select("id,title,owner_user_id").limit(1000),
      sb.from("manual_invoices").select("id,invoice_number,deal_memo_id,total_paise,status,currency,issued_at,paid_at").not("deal_memo_id", "is", null).limit(500),
    ]);
    setDeals((d.data ?? []) as Deal[]);
    setTitles((t.data ?? []) as Title[]);
    setInvoices((i.data ?? []) as Invoice[]);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    if (filter === "all") return deals;
    if (filter === "active") return deals.filter(d => !d.close_outcome);
    if (filter === "awaiting_approval") return deals.filter(d => d.approval_status === "pending");
    if (filter === "invoice_pending") return deals.filter(d => d.approval_status === "approved" && d.payment_status === "not_started");
    if (filter === "unpaid") return deals.filter(d => ["pending","partially_paid"].includes(d.payment_status));
    if (filter === "delivery_pending") return deals.filter(d => d.payment_status === "paid" && d.delivery_status !== "delivered");
    if (filter === "payout_pending") return deals.filter(d => d.delivery_status === "delivered" && !["payout_marked","closed_won"].includes(d.ops_stage));
    if (filter === "at_risk") return deals.filter(d => dealRisk(d) !== null);
    if (filter === "closed") return deals.filter(d => d.close_outcome != null);
    return deals;
  }, [deals, filter]);

  const activeDeal = activeDealId ? deals.find(d => d.id === activeDealId) ?? null : null;

  return (
    <section className="rounded-xl border bg-card">
      <header className="px-5 py-4 border-b flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-primary" />
          <h3 className="font-semibold">Deal Operations — Founder Close Command</h3>
        </div>
        <Button size="sm" variant="ghost" onClick={load}><RefreshCw className="w-4 h-4" /></Button>
      </header>

      <Tabs value={filter} onValueChange={setFilter} className="px-5 pt-4">
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="active">Active</TabsTrigger>
          <TabsTrigger value="awaiting_approval">Awaiting approval</TabsTrigger>
          <TabsTrigger value="invoice_pending">Invoice pending</TabsTrigger>
          <TabsTrigger value="unpaid">Unpaid</TabsTrigger>
          <TabsTrigger value="delivery_pending">Delivery pending</TabsTrigger>
          <TabsTrigger value="payout_pending">Payout pending</TabsTrigger>
          <TabsTrigger value="at_risk">At risk</TabsTrigger>
          <TabsTrigger value="closed">Closed</TabsTrigger>
          <TabsTrigger value="all">All ({deals.length})</TabsTrigger>
        </TabsList>
        <TabsContent value={filter} className="mt-4">
          {loading ? (
            <div className="py-10 text-center text-muted-foreground"><Loader2 className="inline w-4 h-4 animate-spin mr-2" /> Loading…</div>
          ) : filtered.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">No deals in this view.</p>
          ) : (
            <div className="overflow-x-auto pb-5">
              <table className="w-full text-sm">
                <thead className="text-left text-xs text-muted-foreground">
                  <tr className="border-b">
                    <th className="py-2 px-2">Deal</th>
                    <th className="px-2">Title</th>
                    <th className="px-2">Buyer</th>
                    <th className="px-2">Value</th>
                    <th className="px-2">Stage</th>
                    <th className="px-2">Approval</th>
                    <th className="px-2">Payment</th>
                    <th className="px-2">Delivery</th>
                    <th className="px-2">Outcome</th>
                    <th className="px-2">Risk</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(d => {
                    const ttl = titles.find(t => t.id === d.title_id);
                    const risk = dealRisk(d);
                    return (
                      <tr key={d.id} className="border-b last:border-0 cursor-pointer hover:bg-muted/30" onClick={() => setActiveDealId(d.id)}>
                        <td className="py-3 px-2 font-mono text-xs">{d.memo_number}</td>
                        <td className="px-2">{ttl?.title ?? d.title_id.slice(0,8)}</td>
                        <td className="px-2">
                          <div>{d.buyer_org_name ?? "—"}</div>
                          <div className="text-xs text-muted-foreground">{d.buyer_contact_email}</div>
                        </td>
                        <td className="px-2">{inr(d.amount_paise)}</td>
                        <td className="px-2"><Badge variant="outline" className={STAGE_BADGES[d.ops_stage]}>{d.ops_stage}</Badge></td>
                        <td className="px-2 text-xs">{d.approval_status}</td>
                        <td className="px-2 text-xs">{d.payment_status}{d.payment_status === "partially_paid" && ` (${inr(d.paid_amount_paise)})`}</td>
                        <td className="px-2 text-xs">{d.delivery_status}</td>
                        <td className="px-2 text-xs">{d.close_outcome ?? "—"}</td>
                        <td className="px-2 text-xs">
                          {risk ? <Badge variant="outline" className="bg-red-500/10 text-red-600 border-red-500/30 whitespace-normal max-w-[160px] text-[10px]"><AlertTriangle className="w-3 h-3 mr-1 inline" />{risk}</Badge> : "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {activeDeal && (
        <DealDetailDialog
          deal={activeDeal}
          titles={titles}
          invoices={invoices.filter(i => i.deal_memo_id === activeDeal.id)}
          onClose={() => setActiveDealId(null)}
          onChanged={load}
        />
      )}
    </section>
  );
}

function DealDetailDialog({
  deal, titles, invoices, onClose, onChanged,
}: { deal: Deal; titles: Title[]; invoices: Invoice[]; onClose: () => void; onChanged: () => void }) {
  const sb = supabase as any;
  const title = titles.find(t => t.id === deal.title_id);
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [allInvoices, setAllInvoices] = useState<Invoice[]>([]);
  const [busy, setBusy] = useState(false);

  async function loadDetails() {
    const [del, pay, ev, inv] = await Promise.all([
      sb.from("deal_deliveries").select("*").eq("deal_memo_id", deal.id).order("created_at", { ascending: false }),
      sb.from("deal_payouts").select("*").eq("deal_memo_id", deal.id).order("created_at", { ascending: false }),
      sb.from("deal_ops_events").select("*").eq("deal_memo_id", deal.id).order("occurred_at", { ascending: false }).limit(50),
      sb.from("manual_invoices").select("id,invoice_number,deal_memo_id,total_paise,status,currency,issued_at,paid_at").is("deal_memo_id", null).limit(50),
    ]);
    setDeliveries((del.data ?? []) as Delivery[]);
    setPayouts((pay.data ?? []) as Payout[]);
    setEvents((ev.data ?? []) as Event[]);
    setAllInvoices((inv.data ?? []) as Invoice[]);
  }
  useEffect(() => { loadDetails(); }, [deal.id]);

  async function run(name: string, args: any, msg = "Saved") {
    setBusy(true);
    const { error } = await sb.rpc(name, args);
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success(msg);
    onChanged(); loadDetails();
  }

  // ----- Approval form
  const [approvalDecision, setApprovalDecision] = useState(deal.approval_status || "not_required");
  const [approvalNotes, setApprovalNotes] = useState(deal.approval_notes ?? "");

  // ----- Payment form
  const [paymentStatus, setPaymentStatus] = useState(deal.payment_status);
  const [paymentMode, setPaymentMode] = useState(deal.payment_mode ?? "manual_off_platform");
  const [paidAmt, setPaidAmt] = useState<number>(Math.round((deal.paid_amount_paise || 0) / 100));
  const [paymentRef, setPaymentRef] = useState(deal.payment_reference ?? "");
  const [paymentNotes, setPaymentNotes] = useState(deal.payment_notes ?? "");

  // ----- Delivery form (new)
  const [delStatus, setDelStatus] = useState("preparing");
  const [delMethod, setDelMethod] = useState("secure_download");
  const [delEmail, setDelEmail] = useState(deal.buyer_contact_email ?? "");
  const [delUrl, setDelUrl] = useState("");
  const [delNotes, setDelNotes] = useState("");

  // ----- Payout form (new)
  const [poBenefType, setPoBenefType] = useState("creator");
  const [poBenefLabel, setPoBenefLabel] = useState("");
  const [poBenefEmail, setPoBenefEmail] = useState("");
  const [poBasis, setPoBasis] = useState("percentage");
  const [poSharePct, setPoSharePct] = useState<number | "">(deal.owner_share_pct ?? "");
  const [poGross, setPoGross] = useState<number>(Math.round((deal.amount_paise || 0) / 100));
  const [poPayout, setPoPayout] = useState<number>(Math.round((deal.owner_share_paise || 0) / 100));

  // ----- Invoice link
  const [invoiceToLink, setInvoiceToLink] = useState("");

  // ----- Close
  const [closeOutcome, setCloseOutcome] = useState("won");
  const [closeReason, setCloseReason] = useState("");

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 flex-wrap">
            <span className="font-mono text-sm">{deal.memo_number}</span>
            <span>· {title?.title ?? deal.title_id.slice(0,8)}</span>
            <Badge variant="outline" className={STAGE_BADGES[deal.ops_stage]}>{deal.ops_stage}</Badge>
            {dealRisk(deal) && (
              <Badge variant="outline" className="bg-red-500/10 text-red-600 border-red-500/30 text-xs">
                <AlertTriangle className="w-3 h-3 mr-1 inline" /> {dealRisk(deal)}
              </Badge>
            )}
          </DialogTitle>
        </DialogHeader>

        {/* Summary strip */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
          <Stat label="Buyer" value={deal.buyer_org_name ?? deal.buyer_contact_email ?? "—"} />
          <Stat label="Value" value={inr(deal.amount_paise)} />
          <Stat label="Approval" value={deal.approval_status} />
          <Stat label="Payment" value={`${deal.payment_status} ${deal.payment_status === "partially_paid" ? `(${inr(deal.paid_amount_paise)})` : ""}`} />
        </div>

        <Tabs defaultValue="approval" className="mt-2">
          <TabsList className="flex-wrap h-auto">
            <TabsTrigger value="approval"><ShieldCheck className="w-3.5 h-3.5 mr-1" /> Approval</TabsTrigger>
            <TabsTrigger value="invoice"><FileText className="w-3.5 h-3.5 mr-1" /> Invoice & Payment</TabsTrigger>
            <TabsTrigger value="negotiation"><Handshake className="w-3.5 h-3.5 mr-1" /> Negotiation</TabsTrigger>
            <TabsTrigger value="contract"><FileSignature className="w-3.5 h-3.5 mr-1" /> Contract</TabsTrigger>
            <TabsTrigger value="delivery"><Truck className="w-3.5 h-3.5 mr-1" /> Delivery</TabsTrigger>
            <TabsTrigger value="lifecycle"><Activity className="w-3.5 h-3.5 mr-1" /> Lifecycle</TabsTrigger>
            <TabsTrigger value="payout"><Wallet className="w-3.5 h-3.5 mr-1" /> Payout</TabsTrigger>
            <TabsTrigger value="close"><Flag className="w-3.5 h-3.5 mr-1" /> Close</TabsTrigger>
            <TabsTrigger value="timeline"><History className="w-3.5 h-3.5 mr-1" /> Timeline</TabsTrigger>
          </TabsList>

          <TabsContent value="negotiation">
            {deal.commercial_request_id ? (
              <OfferNegotiationThread commercialRequestId={deal.commercial_request_id} party="admin" />
            ) : (
              <p className="text-xs text-muted-foreground">This deal is not linked to a buyer request.</p>
            )}
          </TabsContent>

          <TabsContent value="contract">
            <LicenseContractsPanel dealMemoId={deal.id} titleId={deal.title_id} canManage />
          </TabsContent>

          <TabsContent value="lifecycle">
            <LicenseLifecyclePanel dealMemoId={deal.id} canManage />
          </TabsContent>

          {/* APPROVAL */}
          <TabsContent value="approval" className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Decision</Label>
                <Select value={approvalDecision} onValueChange={setApprovalDecision}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="not_required">Not required</SelectItem>
                    <SelectItem value="pending">Pending review</SelectItem>
                    <SelectItem value="approved">Approve</SelectItem>
                    <SelectItem value="rejected">Reject</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="text-xs text-muted-foreground self-end">
                {deal.approved_at && <>Approved {new Date(deal.approved_at).toLocaleString()}</>}
              </div>
            </div>
            <div><Label>Notes</Label><Textarea rows={3} value={approvalNotes} onChange={e => setApprovalNotes(e.target.value)} /></div>
            <Button disabled={busy} onClick={() => run("admin_deal_set_approval", { _deal_id: deal.id, _decision: approvalDecision, _notes: approvalNotes || null }, "Approval updated")}>Save approval</Button>
          </TabsContent>

          {/* INVOICE & PAYMENT */}
          <TabsContent value="invoice" className="space-y-4">
            <div className="space-y-2">
              <div className="text-xs font-medium text-muted-foreground uppercase">Linked invoices</div>
              {invoices.length === 0 ? (
                <p className="text-sm text-muted-foreground">No invoices linked to this deal yet.</p>
              ) : invoices.map(inv => (
                <div key={inv.id} className="border rounded p-2 flex items-center justify-between text-sm">
                  <div>
                    <div className="font-mono text-xs">{inv.invoice_number}</div>
                    <div className="text-xs text-muted-foreground">{inv.status} · {inr(inv.total_paise)}</div>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => window.open(`/invoice/manual/${inv.id}`, "_blank")}><ExternalLink className="w-3.5 h-3.5" /></Button>
                </div>
              ))}
              <div className="flex gap-2 items-end">
                <div className="flex-1">
                  <Label>Link existing draft invoice</Label>
                  <Select value={invoiceToLink} onValueChange={setInvoiceToLink}>
                    <SelectTrigger><SelectValue placeholder="Pick an unlinked invoice" /></SelectTrigger>
                    <SelectContent>
                      {allInvoices.map(i => <SelectItem key={i.id} value={i.id}>{i.invoice_number} · {inr(i.total_paise)} · {i.status}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <Button disabled={!invoiceToLink || busy} onClick={() => run("admin_deal_link_invoice", { _deal_id: deal.id, _invoice_id: invoiceToLink }, "Invoice linked")}>Link</Button>
              </div>
              <p className="text-[11px] text-muted-foreground">Create new invoices from the Manual Invoice Console, then link them here.</p>
            </div>

            <div className="border-t pt-3 space-y-3">
              <div className="text-xs font-medium text-muted-foreground uppercase flex items-center gap-1"><CreditCard className="w-3.5 h-3.5" /> Record payment</div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Status</Label>
                  <Select value={paymentStatus} onValueChange={setPaymentStatus}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {["not_started","pending","partially_paid","paid","failed","waived","refunded"].map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Mode</Label>
                  <Select value={paymentMode} onValueChange={setPaymentMode}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {["razorpay","bank_transfer","manual_off_platform","waived","other"].map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Paid amount (₹)</Label><Input type="number" value={paidAmt} onChange={e => setPaidAmt(Number(e.target.value) || 0)} /></div>
                <div><Label>Reference / txn id</Label><Input value={paymentRef} onChange={e => setPaymentRef(e.target.value)} /></div>
              </div>
              <div><Label>Notes</Label><Textarea rows={2} value={paymentNotes} onChange={e => setPaymentNotes(e.target.value)} /></div>
              <Button disabled={busy} onClick={() => run("admin_deal_record_payment", {
                _deal_id: deal.id, _status: paymentStatus, _mode: paymentMode,
                _paid_amount_paise: Math.round(paidAmt * 100),
                _reference: paymentRef || null, _notes: paymentNotes || null, _paid_at: null,
              }, "Payment recorded")}>Save payment</Button>
            </div>
          </TabsContent>

          {/* DELIVERY */}
          <TabsContent value="delivery" className="space-y-3">
            {deliveries.length > 0 && (
              <div className="space-y-2">
                <div className="text-xs font-medium text-muted-foreground uppercase">Existing handoffs</div>
                {deliveries.map(dl => (
                  <div key={dl.id} className="border rounded p-3 text-sm space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="outline">{dl.status}</Badge>
                      <Badge variant="outline">{dl.method}</Badge>
                      {dl.recipient_email && <span className="text-xs text-muted-foreground">to {dl.recipient_email}</span>}
                      {dl.share_url && <a href={dl.share_url} target="_blank" rel="noreferrer" className="text-xs underline">link</a>}
                      <div className="ml-auto flex gap-1">
                        <Button size="sm" variant="outline" disabled={busy} onClick={async () => {
                          const objectKey = window.prompt("Auto-mint Oracle PAR — paste object_key (or leave blank to cancel):");
                          if (!objectKey) return;
                          const { data, error } = await (supabase as any).functions.invoke("mint-delivery-par", { body: { delivery_id: dl.id, object_key: objectKey, ttl_hours: 72 } });
                          if (error || (data as any)?.error) { toast.error(((data as any)?.error || error?.message) ?? "Mint failed"); return; }
                          toast.success("Signed delivery URL minted (72h)");
                          loadDetails();
                        }}>Mint signed URL</Button>
                        {dl.status !== "shared" && <Button size="sm" variant="outline" onClick={() => run("admin_deal_upsert_delivery", { _deal_id: deal.id, _delivery_id: dl.id, _status: "shared", _method: null, _recipient_email: null, _share_url: null, _expires_at: null, _package_notes: null, _internal_notes: null, _mark_delivered: false }, "Marked shared")}>Mark shared</Button>}
                        {dl.status !== "delivered" && <Button size="sm" onClick={() => run("admin_deal_upsert_delivery", { _deal_id: deal.id, _delivery_id: dl.id, _status: "delivered", _method: null, _recipient_email: null, _share_url: null, _expires_at: null, _package_notes: null, _internal_notes: null, _mark_delivered: true }, "Marked delivered")}>Mark delivered</Button>}
                      </div>
                    </div>
                    {dl.package_notes && <div className="text-xs text-muted-foreground">{dl.package_notes}</div>}
                    {(dl.shared_at || dl.delivered_at) && (
                      <div className="text-[11px] text-muted-foreground">
                        {dl.shared_at && <>Shared {new Date(dl.shared_at).toLocaleString()} </>}
                        {dl.delivered_at && <> · Delivered {new Date(dl.delivered_at).toLocaleString()}</>}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
            <div className="border-t pt-3 space-y-3">
              <div className="text-xs font-medium text-muted-foreground uppercase">Create delivery handoff</div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Status</Label>
                  <Select value={delStatus} onValueChange={setDelStatus}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {["not_started","preparing","ready","shared","delivered","not_required"].map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Method</Label>
                  <Select value={delMethod} onValueChange={setDelMethod}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {["secure_download","vault_share","screening_only","external_transfer","offline_physical","other"].map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Recipient email</Label><Input value={delEmail} onChange={e => setDelEmail(e.target.value)} /></div>
                <div><Label>Share URL</Label><Input value={delUrl} onChange={e => setDelUrl(e.target.value)} placeholder="signed delivery link" /></div>
              </div>
              <div><Label>Package notes</Label><Textarea rows={2} value={delNotes} onChange={e => setDelNotes(e.target.value)} /></div>
              <Button disabled={busy} onClick={() => run("admin_deal_upsert_delivery", {
                _deal_id: deal.id, _delivery_id: null, _status: delStatus, _method: delMethod,
                _recipient_email: delEmail || null, _share_url: delUrl || null, _expires_at: null,
                _package_notes: delNotes || null, _internal_notes: null,
                _mark_delivered: delStatus === "delivered",
              }, "Delivery created")}>Create handoff</Button>
              <p className="text-[11px] text-muted-foreground">Delivery is the post-payment fulfilment package — separate from screener invites.</p>
            </div>
          </TabsContent>

          {/* PAYOUT */}
          <TabsContent value="payout" className="space-y-3">
            {payouts.length > 0 && (
              <div className="space-y-2">
                <div className="text-xs font-medium text-muted-foreground uppercase">Payout intents</div>
                {payouts.map(po => (
                  <div key={po.id} className="border rounded p-3 text-sm flex items-center justify-between">
                    <div>
                      <div className="font-medium">{po.beneficiary_label ?? po.beneficiary_email ?? po.beneficiary_type}</div>
                      <div className="text-xs text-muted-foreground">{po.basis} {po.share_pct ? `· ${po.share_pct}%` : ""} · {inr(po.payout_amount_paise)} · {po.status}</div>
                      {po.payment_reference && <div className="text-xs text-muted-foreground">ref: {po.payment_reference}</div>}
                    </div>
                    {po.status !== "marked_paid" && (
                      <Button size="sm" onClick={() => run("admin_deal_upsert_payout", {
                        _deal_id: deal.id, _payout_id: po.id,
                        _beneficiary_type: null, _beneficiary_user_id: null, _beneficiary_label: null, _beneficiary_email: null,
                        _basis: null, _share_pct: null, _gross_amount_paise: null, _platform_share_paise: null,
                        _payout_amount_paise: null, _status: null, _reference: null, _notes: null, _mark_paid: true,
                      }, "Marked paid")}>Mark paid</Button>
                    )}
                  </div>
                ))}
              </div>
            )}
            <div className="border-t pt-3 space-y-3">
              <div className="text-xs font-medium text-muted-foreground uppercase">Create payout intent</div>
              <p className="text-[11px] text-muted-foreground">Operational record only — not an accounting ledger entry.</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Beneficiary type</Label>
                  <Select value={poBenefType} onValueChange={setPoBenefType}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {["creator","rights_owner","studio","partner","other"].map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Basis</Label>
                  <Select value={poBasis} onValueChange={setPoBasis}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {["fixed","percentage","revenue_share","minimum_guarantee_share","custom"].map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Beneficiary label</Label><Input value={poBenefLabel} onChange={e => setPoBenefLabel(e.target.value)} placeholder={title ? `Owner of ${title.title}` : ""} /></div>
                <div><Label>Beneficiary email</Label><Input value={poBenefEmail} onChange={e => setPoBenefEmail(e.target.value)} /></div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div><Label>Share %</Label><Input type="number" value={poSharePct} onChange={e => setPoSharePct(e.target.value === "" ? "" : Number(e.target.value))} /></div>
                <div><Label>Gross (₹)</Label><Input type="number" value={poGross} onChange={e => setPoGross(Number(e.target.value) || 0)} /></div>
                <div><Label>Payout amount (₹)</Label><Input type="number" value={poPayout} onChange={e => setPoPayout(Number(e.target.value) || 0)} /></div>
              </div>
              <Button disabled={busy} onClick={() => run("admin_deal_upsert_payout", {
                _deal_id: deal.id, _payout_id: null,
                _beneficiary_type: poBenefType, _beneficiary_user_id: null,
                _beneficiary_label: poBenefLabel || null, _beneficiary_email: poBenefEmail || null,
                _basis: poBasis, _share_pct: poSharePct === "" ? null : Number(poSharePct),
                _gross_amount_paise: Math.round(poGross * 100),
                _platform_share_paise: Math.max(0, Math.round(poGross * 100) - Math.round(poPayout * 100)),
                _payout_amount_paise: Math.round(poPayout * 100),
                _status: "pending", _reference: null, _notes: null, _mark_paid: false,
              }, "Payout intent created")}>Create payout intent</Button>
            </div>
          </TabsContent>

          {/* CLOSE */}
          <TabsContent value="close" className="space-y-3">
            {deal.close_outcome && (
              <div className="text-sm">
                Currently closed as <Badge variant="outline" className={STAGE_BADGES["closed_" + deal.close_outcome] ?? ""}>{deal.close_outcome}</Badge>
                {deal.close_reason && <p className="text-xs text-muted-foreground mt-1">{deal.close_reason}</p>}
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Outcome</Label>
                <Select value={closeOutcome} onValueChange={setCloseOutcome}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="won">Won</SelectItem>
                    <SelectItem value="lost">Lost</SelectItem>
                    <SelectItem value="cancelled">Cancelled</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div><Label>Reason / close notes</Label><Textarea rows={3} value={closeReason} onChange={e => setCloseReason(e.target.value)} /></div>
            <Button disabled={busy} onClick={() => run("admin_deal_close", { _deal_id: deal.id, _outcome: closeOutcome, _reason: closeReason || null }, "Deal closed")}>Close deal</Button>
            {dealRisk(deal) && closeOutcome === "won" && (
              <p className="text-xs text-amber-600"><AlertTriangle className="w-3 h-3 inline mr-1" />This deal still shows operational gaps. Closing as won will not auto-complete them.</p>
            )}
          </TabsContent>

          {/* TIMELINE */}
          <TabsContent value="timeline" className="space-y-2">
            {events.length === 0 ? (
              <p className="text-sm text-muted-foreground">No operational events yet.</p>
            ) : events.map(e => (
              <div key={e.id} className="border-l-2 border-muted pl-3 py-1 text-sm">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs">{e.kind}</span>
                  <span className="text-xs text-muted-foreground">{new Date(e.occurred_at).toLocaleString()}</span>
                </div>
                {e.summary && <div className="text-xs text-muted-foreground">{e.summary}</div>}
              </div>
            ))}
          </TabsContent>
        </Tabs>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border p-2">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="text-sm font-medium truncate">{value}</div>
    </div>
  );
}
