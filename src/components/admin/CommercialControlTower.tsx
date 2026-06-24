import { useEffect, useMemo, useState } from "react";
import { Loader2, RefreshCw, Inbox, HardDrive, Wrench, Briefcase, ExternalLink, FileText, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { InvoiceEditor } from "./ManualInvoiceConsole";

type SupportRow = {
  id: string;
  user_id: string;
  request_type: string;
  subject: string;
  message: string;
  status: string;
  admin_reply: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
};

type CommercialRow = {
  id: string;
  request_type: string;
  state: string;
  buyer_user_id: string;
  owner_user_id: string | null;
  title_id: string | null;
  title_query: string | null;
  message: string | null;
  admin_notes: string | null;
  interest_summary?: string | null;
  terms?: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
};

type TopupRow = {
  id: string;
  user_id: string;
  status: string;
  tb_added: number;
  total_paise: number | null;
  storage_class: string | null;
  source: string;
  razorpay_payment_id: string | null;
  created_at: string;
};

type SubscriptionRow = {
  id: string;
  user_id: string;
  status: string;
  subscription_type: string | null;
  storage_quantity_tb: number | null;
  cancel_requested_at: string | null;
  current_period_end: string | null;
  created_at: string;
};

const COMMERCIAL_STATES = [
  "pending_admin_review",
  "awaiting_creator_review",
  "more_info_required",
  "rejected",
  "approved_for_negotiation",
  "agreement_pending",
  "delivery_authorized",
  "closed",
];

const SUPPORT_STATUSES = ["open", "in_progress", "reviewing", "quoted", "approved", "provisioned", "rejected", "cancelled", "resolved", "closed"];

export default function CommercialControlTower() {
  return (
    <section className="rounded-2xl border border-border/40 bg-secondary/5 p-5 space-y-5">
      <div>
        <h2 className="font-display text-2xl font-bold">Commercial Control Tower</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Operate the four commercial queues in one place: plan upgrades, storage billing,
          buyer commercial requests, and paid operator services.
        </p>
      </div>

      <Tabs defaultValue="plan">
        <TabsList className="grid grid-cols-2 md:grid-cols-4 gap-1.5 w-full">
          <TabsTrigger value="plan"><Briefcase className="w-3.5 h-3.5 mr-1.5" /> Plan / Upgrade</TabsTrigger>
          <TabsTrigger value="storage"><HardDrive className="w-3.5 h-3.5 mr-1.5" /> Storage billing</TabsTrigger>
          <TabsTrigger value="commercial"><Inbox className="w-3.5 h-3.5 mr-1.5" /> Buyer requests</TabsTrigger>
          <TabsTrigger value="service"><Wrench className="w-3.5 h-3.5 mr-1.5" /> Service requests</TabsTrigger>
        </TabsList>

        <TabsContent value="plan" className="mt-5">
          <SupportQueue
            requestTypes={["plan_upgrade", "upgrade"]}
            emptyLabel="No plan / upgrade requests."
            helpText="Founder-assisted plan changes (Creator Pro, Creator Studio, Studio plans, custom). Quote → invoice → provision."
            showFinance
            showProvision
          />
        </TabsContent>

        <TabsContent value="storage" className="mt-5">
          <StorageBillingQueue />
        </TabsContent>

        <TabsContent value="commercial" className="mt-5">
          <CommercialQueue />
        </TabsContent>

        <TabsContent value="service" className="mt-5">
          <SupportQueue
            requestTypes={["service"]}
            emptyLabel="No paid service requests."
            helpText="QC, mastering, anti-piracy, delivery prep, ingest / migration. Bill via founder-assisted invoice."
            showFinance
          />
        </TabsContent>
      </Tabs>
    </section>
  );
}

/* ------------------------------ Support queue ------------------------------ */

type LinkedInvoice = {
  id: string; invoice_number: string; status: string; total_paise: number;
  document_type: string; payment_link_url: string | null;
};

function SupportQueue({
  requestTypes,
  emptyLabel,
  helpText,
  showFinance = false,
  showProvision = false,
}: {
  requestTypes: string[];
  emptyLabel: string;
  helpText: string;
  showFinance?: boolean;
  showProvision?: boolean;
}) {
  const [rows, setRows] = useState<SupportRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>("open");
  const [replyDraft, setReplyDraft] = useState<Record<string, string>>({});
  const [invoicesByReq, setInvoicesByReq] = useState<Record<string, LinkedInvoice[]>>({});
  const [editorReq, setEditorReq] = useState<SupportRow | null>(null);
  const [provisionReq, setProvisionReq] = useState<SupportRow | null>(null);

  const load = async () => {
    setLoading(true);
    let q = supabase
      .from("support_requests")
      .select("*")
      .in("request_type", requestTypes)
      .order("created_at", { ascending: false })
      .limit(100);
    if (statusFilter !== "all") q = q.eq("status", statusFilter);
    const { data, error } = await q;
    setLoading(false);
    if (error) { toast.error(error.message); return; }
    const list = (data as unknown as SupportRow[]) ?? [];
    setRows(list);
    if (showFinance && list.length) {
      const ids = list.map(r => r.id);
      const { data: inv } = await (supabase as any)
        .from("manual_invoices")
        .select("id,invoice_number,status,total_paise,document_type,payment_link_url,support_request_id")
        .in("support_request_id", ids);
      const map: Record<string, LinkedInvoice[]> = {};
      (inv ?? []).forEach((x: any) => {
        if (!x.support_request_id) return;
        (map[x.support_request_id] ??= []).push(x);
      });
      setInvoicesByReq(map);
    }
  };

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [statusFilter]);

  const updateStatus = async (id: string, status: string) => {
    const { error } = await supabase.from("support_requests").update({ status }).eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Status updated");
    setRows(r => r.map(x => x.id === id ? { ...x, status } : x));
  };

  const saveReply = async (id: string) => {
    const reply = (replyDraft[id] ?? "").trim();
    if (!reply) return;
    const { error } = await supabase.from("support_requests").update({ admin_reply: reply, status: "in_progress" }).eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Reply saved");
    setRows(r => r.map(x => x.id === id ? { ...x, admin_reply: reply, status: "in_progress" } : x));
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">{helpText}</p>
        <div className="flex items-center gap-2">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="h-9 w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              {SUPPORT_STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button size="sm" variant="outline" onClick={load}><RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} /></Button>
        </div>
      </div>

      {loading ? (
        <div className="py-10 grid place-items-center"><Loader2 className="w-5 h-5 animate-spin text-accent" /></div>
      ) : rows.length === 0 ? (
        <EmptyRow label={emptyLabel} />
      ) : (
        <div className="space-y-2">
          {rows.map(r => {
            const meta = (r.metadata ?? {}) as Record<string, unknown>;
            const linked = invoicesByReq[r.id] ?? [];
            return (
              <details key={r.id} className="rounded-xl border border-border/40 bg-secondary/10 p-3">
                <summary className="cursor-pointer flex flex-wrap items-center gap-2 justify-between">
                  <div className="min-w-0">
                    <div className="text-sm font-medium truncate">{r.subject}</div>
                    <div className="text-[10px] text-muted-foreground mt-0.5 flex flex-wrap gap-2">
                      <span>{r.request_type}</span>
                      <span>· {r.status}</span>
                      {typeof meta.surface === "string" && <span>· surface: {String(meta.surface)}</span>}
                      {typeof meta.service_kind === "string" && <span>· {String(meta.service_kind)}</span>}
                      {typeof meta.target_plan === "string" && <span>· plan: {String(meta.target_plan)}</span>}
                      {typeof meta.requested_plan === "string" && <span>· wants: {String(meta.requested_plan)}</span>}
                      {typeof meta.urgency === "string" && <span>· urgency: {String(meta.urgency)}</span>}
                      <span>· {new Date(r.created_at).toLocaleString()}</span>
                      {linked.length > 0 && <span>· {linked.length} invoice(s)</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Select value={r.status} onValueChange={(s) => updateStatus(r.id, s)}>
                      <SelectTrigger className="h-8 w-32 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {SUPPORT_STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </summary>

                <div className="mt-3 grid gap-3 text-sm">
                  <p className="whitespace-pre-wrap text-foreground/90">{r.message}</p>
                  <div className="grid sm:grid-cols-2 gap-2 text-[11px] text-muted-foreground">
                    <div>User UUID: <code className="font-mono text-foreground/80">{r.user_id}</code></div>
                    {typeof meta.requested_plan === "string" && <div>Requested plan: {String(meta.requested_plan)}</div>}
                    {typeof meta.storage_need_tb === "number" && <div>Storage need: {String(meta.storage_need_tb)} TB</div>}
                    {typeof meta.team_size === "number" && <div>Team size: {String(meta.team_size)}</div>}
                  </div>
                  {r.admin_reply && (
                    <div className="text-xs border-l-2 border-accent/40 pl-2 text-foreground">
                      <span className="text-[10px] uppercase tracking-wider text-accent">Current admin note · </span>
                      {r.admin_reply}
                    </div>
                  )}

                  {linked.length > 0 && (
                    <div className="rounded-lg border border-border/30 bg-background/40 p-2 space-y-1">
                      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Linked invoices</div>
                      {linked.map(inv => (
                        <div key={inv.id} className="flex items-center justify-between text-xs">
                          <a className="font-mono hover:underline" href={`/invoice/manual/${inv.id}`} target="_blank" rel="noreferrer">{inv.invoice_number}</a>
                          <span className="text-muted-foreground">{inv.document_type}</span>
                          <span className="font-mono">₹{(inv.total_paise / 100).toLocaleString("en-IN")}</span>
                          <span className={`px-1.5 py-0.5 rounded text-[10px] uppercase ${inv.status === "paid" ? "bg-emerald-500/15 text-emerald-600" : "bg-secondary/40"}`}>{inv.status}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  <Textarea
                    rows={2}
                    placeholder="Internal note / reply to user"
                    value={replyDraft[r.id] ?? ""}
                    onChange={e => setReplyDraft(d => ({ ...d, [r.id]: e.target.value }))}
                  />
                  <div className="flex flex-wrap justify-end gap-2">
                    <Button size="sm" variant="outline" onClick={() => saveReply(r.id)}>Save reply</Button>
                    {showFinance && (
                      <Button size="sm" variant="outline" onClick={() => setEditorReq(r)}>
                        <FileText className="w-3.5 h-3.5 mr-1" /> Create invoice / quote
                      </Button>
                    )}
                    {showProvision && (
                      <Button size="sm" onClick={() => setProvisionReq(r)}>
                        <ShieldCheck className="w-3.5 h-3.5 mr-1" /> Provision plan
                      </Button>
                    )}
                  </div>
                </div>
              </details>
            );
          })}
        </div>
      )}

      {editorReq && (
        <RequestInvoiceLauncher
          req={editorReq}
          onClose={() => setEditorReq(null)}
          onSaved={() => { setEditorReq(null); load(); }}
        />
      )}
      {provisionReq && (
        <ProvisionPlanDialog
          req={provisionReq}
          onClose={() => setProvisionReq(null)}
          onSaved={() => { setProvisionReq(null); load(); }}
        />
      )}
    </div>
  );
}

function RequestInvoiceLauncher({ req, onClose, onSaved }: { req: SupportRow; onClose: () => void; onSaved: () => void }) {
  const meta = (req.metadata ?? {}) as Record<string, unknown>;
  const surface = typeof meta.surface === "string" ? String(meta.surface) : "creator";
  return (
    <InvoiceEditor
      open={true}
      onOpenChange={(o) => { if (!o) onClose(); }}
      editing={null}
      onSaved={onSaved}
      presetUserId={req.user_id}
      presetRequestId={req.id}
      presetSurface={surface}
    />
  );
}

function ProvisionPlanDialog({ req, onClose, onSaved }: { req: SupportRow; onClose: () => void; onSaved: () => void }) {
  const meta = (req.metadata ?? {}) as Record<string, unknown>;
  const surface = typeof meta.surface === "string" ? String(meta.surface) : "creator";
  const requestedPlan = typeof meta.requested_plan === "string" ? String(meta.requested_plan) : "";
  const [planTier, setPlanTier] = useState<string>(surface === "studio" ? "studio" : "pro");
  const [studioPkg, setStudioPkg] = useState<string>(requestedPlan || "Studio Custom");
  const [storageGb, setStorageGb] = useState<number>(0);
  const [expiresAt, setExpiresAt] = useState<string>("");
  const [notes, setNotes] = useState<string>(requestedPlan ? `Requested: ${requestedPlan}` : "");
  const [busy, setBusy] = useState(false);

  const apply = async () => {
    setBusy(true);
    if (surface === "studio") {
      const { error } = await (supabase as any).rpc("admin_provision_studio_plan", {
        _user_id: req.user_id,
        _support_request_id: req.id,
        _package_label: studioPkg,
        _notes: notes || null,
      });
      setBusy(false);
      if (error) return toast.error(error.message);
      toast.success("Studio plan recorded");
    } else {
      const { error } = await (supabase as any).rpc("admin_provision_creator_plan", {
        _user_id: req.user_id,
        _support_request_id: req.id,
        _plan_tier: planTier,
        _storage_grant_gb: storageGb || 0,
        _grant_expires_at: expiresAt || null,
        _notes: notes || null,
      });
      setBusy(false);
      if (error) return toast.error(error.message);
      toast.success(`Creator account moved to ${planTier}`);
    }
    onSaved();
  };

  return (
    <Dialog open={true} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Provision plan · {surface}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 text-sm">
          <div className="text-xs text-muted-foreground">
            Request: <strong className="text-foreground">{req.subject}</strong> · user <code className="font-mono">{req.user_id.slice(0, 8)}…</code>
            {requestedPlan && <> · requested <strong>{requestedPlan}</strong></>}
          </div>
          {surface === "studio" ? (
            <div>
              <Label className="text-xs">Approved package / plan label</Label>
              <Input value={studioPkg} onChange={e => setStudioPkg(e.target.value)} placeholder="e.g. Studio Pro Annual" />
            </div>
          ) : (
            <>
              <div>
                <Label className="text-xs">Approved Creator plan tier</Label>
                <Select value={planTier} onValueChange={setPlanTier}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="free">Free (Basic)</SelectItem>
                    <SelectItem value="creator">Creator (legacy)</SelectItem>
                    <SelectItem value="pro">Creator Pro</SelectItem>
                    <SelectItem value="studio">Creator Studio</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Included storage grant (GB)</Label>
                  <Input type="number" value={storageGb} onChange={e => setStorageGb(Number(e.target.value))} placeholder="0 = no extra grant" />
                </div>
                <div>
                  <Label className="text-xs">Grant expires (optional)</Label>
                  <Input type="datetime-local" value={expiresAt} onChange={e => setExpiresAt(e.target.value)} />
                </div>
              </div>
            </>
          )}
          <div>
            <Label className="text-xs">Provisioning notes</Label>
            <Textarea rows={2} value={notes} onChange={e => setNotes(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={apply} disabled={busy}>{busy && <Loader2 className="w-3 h-3 mr-1 animate-spin" />} Apply &amp; mark provisioned</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ----------------------------- Storage queue ------------------------------ */

type StorageRiskRow = {
  user_id: string;
  email: string | null;
  full_name: string | null;
  plan_tier: string | null;
  used_gb: number;
  total_gb: number;
  projected_total_gb: number;
  over_quota: boolean;
  projected_over_quota: boolean;
  active_blocks: number;
  cancelling_tb: number;
  halted_blocks: number;
  next_period_end: string | null;
  monthly_paise: number;
};

function StorageBillingQueue() {
  const [topups, setTopups] = useState<TopupRow[]>([]);
  const [subs, setSubs] = useState<SubscriptionRow[]>([]);
  const [risk, setRisk] = useState<StorageRiskRow[]>([]);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    const [t, s, r] = await Promise.all([
      supabase.from("storage_topups")
        .select("id,user_id,status,tb_added,total_paise,storage_class,source,razorpay_payment_id,created_at")
        .order("created_at", { ascending: false }).limit(50),
      supabase.from("subscriptions")
        .select("id,user_id,status,subscription_type,storage_quantity_tb,cancel_requested_at,current_period_end,created_at")
        .eq("subscription_type", "creator_storage")
        .order("created_at", { ascending: false }).limit(50),
      (supabase as any).rpc("admin_list_creator_storage_risk"),
    ]);
    setLoading(false);
    if (t.error) toast.error(t.error.message);
    if (s.error) toast.error(s.error.message);
    if (r.error) toast.error(r.error.message);
    setTopups((t.data as unknown as TopupRow[]) ?? []);
    setSubs((s.data as unknown as SubscriptionRow[]) ?? []);
    setRisk((r.data as unknown as StorageRiskRow[]) ?? []);
  };

  useEffect(() => { load(); }, []);

  const counts = useMemo(() => {
    const halted = subs.filter(s => s.status === "halted" || s.status === "paused").length;
    const cancelling = subs.filter(s => s.cancel_requested_at).length;
    const failedTopups = topups.filter(t => t.status === "failed" || t.status === "pending").length;
    const overQuota = risk.filter(r => r.over_quota).length;
    const projectedOver = risk.filter(r => !r.over_quota && r.projected_over_quota).length;
    return { halted, cancelling, failedTopups, overQuota, projectedOver };
  }, [topups, subs, risk]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          Self-serve recurring storage: active subscriptions, halted / failed renewals, scheduled cancellations, and accounts currently — or about to be — over quota.
        </p>
        <Button size="sm" variant="outline" onClick={load}><RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} /></Button>
      </div>

      <div className="grid sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <Metric label="Active storage subs" value={String(subs.filter(s => s.status === "active").length)} />
        <Metric label="Cancel @ cycle end" value={String(counts.cancelling)} />
        <Metric label="Halted / paused" value={String(counts.halted)} />
        <Metric label="Over quota now" value={String(counts.overQuota)} />
        <Metric label="Over quota after cancel" value={String(counts.projectedOver)} />
      </div>

      <div>
        <p className="text-[11px] uppercase tracking-wider text-muted-foreground mb-1.5">At-risk accounts</p>
        <div className="rounded-xl border border-border/40 bg-secondary/10 divide-y divide-border/40 max-h-96 overflow-y-auto">
          {risk.length === 0 ? <EmptyRow label="No creators with storage activity yet." /> : risk.map(r => {
            const flag = r.over_quota ? { label: "OVER QUOTA", cls: "border-red-500/40 text-red-300 bg-red-500/10" }
              : r.halted_blocks > 0 ? { label: "HALTED", cls: "border-amber-500/40 text-amber-300 bg-amber-500/10" }
              : r.projected_over_quota ? { label: "OVER AFTER CANCEL", cls: "border-amber-500/40 text-amber-300 bg-amber-500/10" }
              : r.cancelling_tb > 0 ? { label: "CANCEL SCHEDULED", cls: "border-border/60 text-muted-foreground" }
              : { label: "OK", cls: "border-emerald-500/30 text-emerald-300 bg-emerald-500/10" };
            return (
              <div key={r.user_id} className="p-3 text-xs grid grid-cols-12 gap-2 items-center">
                <div className="col-span-3 min-w-0">
                  <div className="truncate font-medium text-foreground">{r.email || r.full_name || r.user_id.slice(0, 8) + "…"}</div>
                  <div className="text-[10px] text-muted-foreground truncate">{r.plan_tier ?? "—"} · {r.user_id.slice(0, 8)}…</div>
                </div>
                <div className="col-span-3">
                  <div>{r.used_gb} GB / {r.total_gb} GB</div>
                  {r.cancelling_tb > 0 && (
                    <div className="text-[10px] text-amber-300">→ {r.projected_total_gb} GB after {r.cancelling_tb} TB cancels</div>
                  )}
                </div>
                <div className="col-span-2">
                  <div>{r.active_blocks} block{r.active_blocks === 1 ? "" : "s"}</div>
                  {r.halted_blocks > 0 && <div className="text-[10px] text-amber-300">{r.halted_blocks} halted</div>}
                </div>
                <div className="col-span-2 text-muted-foreground">
                  {r.next_period_end ? new Date(r.next_period_end).toLocaleDateString() : "—"}
                  {r.monthly_paise > 0 && <div className="text-[10px]">₹{Math.round(r.monthly_paise / 100).toLocaleString("en-IN")}/mo</div>}
                </div>
                <div className="col-span-2 flex justify-end">
                  <span className={`px-1.5 py-0.5 rounded border text-[10px] ${flag.cls}`}>{flag.label}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <div>
          <p className="text-[11px] uppercase tracking-wider text-muted-foreground mb-1.5">Recent storage top-ups</p>
          <div className="rounded-xl border border-border/40 bg-secondary/10 divide-y divide-border/40 max-h-64 overflow-y-auto">
            {topups.length === 0 ? <EmptyRow label="No top-ups." /> : topups.map(t => (
              <div key={t.id} className="p-3 text-xs flex flex-wrap items-center justify-between gap-2">
                <div className="font-mono truncate">{t.user_id.slice(0, 8)}…</div>
                <div>{t.tb_added} TB · {t.storage_class ?? t.source}</div>
                <div>₹{Math.round((t.total_paise ?? 0) / 100).toLocaleString("en-IN")}</div>
                <div className={`px-1.5 py-0.5 rounded border text-[10px] ${t.status === "succeeded" ? "border-emerald-500/30 text-emerald-300 bg-emerald-500/10" : t.status === "failed" ? "border-red-500/30 text-red-300 bg-red-500/10" : "border-amber-500/30 text-amber-300 bg-amber-500/10"}`}>{t.status}</div>
                <div className="text-muted-foreground">{new Date(t.created_at).toLocaleDateString()}</div>
              </div>
            ))}
          </div>
        </div>
        <div>
          <p className="text-[11px] uppercase tracking-wider text-muted-foreground mb-1.5">Recurring subscriptions</p>
          <div className="rounded-xl border border-border/40 bg-secondary/10 divide-y divide-border/40 max-h-64 overflow-y-auto">
            {subs.length === 0 ? <EmptyRow label="No subscriptions." /> : subs.map(s => (
              <div key={s.id} className="p-3 text-xs flex flex-wrap items-center justify-between gap-2">
                <div className="font-mono truncate">{s.user_id.slice(0, 8)}…</div>
                <div>{s.subscription_type ?? "—"}{s.storage_quantity_tb ? ` · ${s.storage_quantity_tb} TB` : ""}</div>
                <div className={`px-1.5 py-0.5 rounded border text-[10px] ${s.status === "active" ? "border-emerald-500/30 text-emerald-300 bg-emerald-500/10" : s.status === "halted" || s.status === "paused" ? "border-amber-500/30 text-amber-300 bg-amber-500/10" : "border-border/60 text-muted-foreground"}`}>{s.status}</div>
                {s.cancel_requested_at && <div className="text-amber-300 text-[10px]">cancel @ cycle end</div>}
                <div className="text-muted-foreground">{s.current_period_end ? new Date(s.current_period_end).toLocaleDateString() : ""}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------------------------- Commercial queue ---------------------------- */

function CommercialQueue() {
  const [rows, setRows] = useState<CommercialRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [stateFilter, setStateFilter] = useState<string>("pending_admin_review");
  const [noteDraft, setNoteDraft] = useState<Record<string, string>>({});

  const load = async () => {
    setLoading(true);
    let q = supabase
      .from("commercial_requests")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100);
    if (stateFilter !== "all") q = q.eq("state", stateFilter as never);
    const { data, error } = await q;
    setLoading(false);
    if (error) { toast.error(error.message); return; }
    setRows((data as unknown as CommercialRow[]) ?? []);
  };

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [stateFilter]);

  const setState = async (id: string, state: string) => {
    const { error } = await supabase.from("commercial_requests").update({ state } as never).eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("State updated");
    setRows(r => r.map(x => x.id === id ? { ...x, state } : x));
  };

  const saveNote = async (id: string) => {
    const note = (noteDraft[id] ?? "").trim();
    if (!note) return;
    const { error } = await supabase.from("commercial_requests").update({ admin_notes: note } as never).eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Note saved");
    setRows(r => r.map(x => x.id === id ? { ...x, admin_notes: note } : x));
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          Buyer acquisition / licensing / screener / rights / distribution requests. Admin is the broker.
        </p>
        <div className="flex items-center gap-2">
          <Select value={stateFilter} onValueChange={setStateFilter}>
            <SelectTrigger className="h-9 w-56"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All states</SelectItem>
              {COMMERCIAL_STATES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button size="sm" variant="outline" onClick={load}><RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} /></Button>
        </div>
      </div>

      {loading ? (
        <div className="py-10 grid place-items-center"><Loader2 className="w-5 h-5 animate-spin text-accent" /></div>
      ) : rows.length === 0 ? (
        <EmptyRow label="No commercial requests in this state." />
      ) : (
        <div className="space-y-2">
          {rows.map(r => (
            <details key={r.id} className="rounded-xl border border-border/40 bg-secondary/10 p-3">
              <summary className="cursor-pointer flex flex-wrap items-center gap-2 justify-between">
                <div className="min-w-0">
                  <div className="text-sm font-medium truncate">
                    {r.title_query || (r.title_id ? `Title ${r.title_id.slice(0, 8)}…` : "Untitled")}
                    <span className="ml-2 text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-secondary/40 border border-border/60">{r.request_type}</span>
                  </div>
                  <div className="text-[10px] text-muted-foreground mt-0.5">
                    Buyer {r.buyer_user_id.slice(0, 8)}… · {!r.title_id && <span className="text-amber-300">unlinked</span>}
                    {r.title_id && <> · linked title</>}
                    · {new Date(r.created_at).toLocaleString()}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Select value={r.state} onValueChange={(s) => setState(r.id, s)}>
                    <SelectTrigger className="h-8 w-48 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {COMMERCIAL_STATES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </summary>

              <div className="mt-3 grid gap-3 text-sm">
                {r.message && <p className="whitespace-pre-wrap text-foreground/90">{r.message}</p>}
                {r.admin_notes && (
                  <div className="text-xs border-l-2 border-accent/40 pl-2 text-foreground">
                    <span className="text-[10px] uppercase tracking-wider text-accent">Admin note · </span>
                    {r.admin_notes}
                  </div>
                )}
                <Textarea
                  rows={2}
                  placeholder="Admin note (visible to buyer)"
                  value={noteDraft[r.id] ?? ""}
                  onChange={e => setNoteDraft(d => ({ ...d, [r.id]: e.target.value }))}
                />
                <LinkTitleRow row={r} onLinked={(tid) => setRows(rs => rs.map(x => x.id === r.id ? { ...x, title_id: tid } : x))} />
                <div className="flex justify-end items-center">
                  <Button size="sm" onClick={() => saveNote(r.id)} className="ml-auto">Save note</Button>
                </div>
              </div>
            </details>
          ))}
        </div>
      )}
    </div>
  );
}

/* --------------------------------- atoms --------------------------------- */

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border/40 bg-secondary/10 p-3">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="font-display text-xl mt-1">{value}</div>
    </div>
  );
}

function EmptyRow({ label }: { label: string }) {
  return <div className="p-6 text-center text-xs text-muted-foreground">{label}</div>;
}

function LinkTitleRow({ row, onLinked }: { row: CommercialRow; onLinked: (titleId: string | null) => void }) {
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<{ id: string; title: string }[]>([]);
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);

  const doSearch = async (q: string) => {
    setSearch(q);
    if (q.trim().length < 2) { setResults([]); return; }
    const { data } = await supabase
      .from("content_titles")
      .select("id,title")
      .ilike("title", `%${q.trim()}%`)
      .limit(10);
    setResults((data as { id: string; title: string }[]) ?? []);
  };

  const link = async (titleId: string | null) => {
    setBusy(true);
    const { error } = await supabase.from("commercial_requests").update({ title_id: titleId } as never).eq("id", row.id);
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success(titleId ? "Linked to title" : "Unlinked");
    onLinked(titleId);
    setOpen(false);
  };

  return (
    <div className="rounded-lg border border-border/30 bg-background/40 p-2 space-y-2">
      <div className="flex items-center justify-between gap-2 text-xs">
        <div className="flex items-center gap-2">
          <ExternalLink className="w-3 h-3 text-muted-foreground" />
          <span className="text-muted-foreground">Title link:</span>
          {row.title_id ? (
            <code className="font-mono text-foreground/80">{row.title_id.slice(0, 8)}…</code>
          ) : (
            <span className="text-amber-300">unlinked</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {row.title_id && <Button size="sm" variant="ghost" onClick={() => link(null)} disabled={busy}>Unlink</Button>}
          <Button size="sm" variant="outline" onClick={() => setOpen(o => !o)}>{open ? "Close" : "Link / change"}</Button>
        </div>
      </div>
      {open && (
        <div className="space-y-2">
          <Input
            className="h-8 text-xs"
            placeholder={`Search title (try "${row.title_query ?? ""}")…`}
            value={search}
            onChange={e => doSearch(e.target.value)}
          />
          {results.length > 0 && (
            <div className="rounded border border-border/40 divide-y divide-border/30 max-h-40 overflow-y-auto">
              {results.map(t => (
                <button
                  key={t.id}
                  className="w-full text-left p-2 text-xs hover:bg-secondary/30 flex items-center justify-between gap-2"
                  onClick={() => link(t.id)}
                  disabled={busy}
                >
                  <span className="truncate">{t.title}</span>
                  <span className="font-mono text-[10px] text-muted-foreground">{t.id.slice(0, 8)}…</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
