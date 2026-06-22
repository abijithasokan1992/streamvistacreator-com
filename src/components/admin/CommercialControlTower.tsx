import { useEffect, useMemo, useState } from "react";
import { Loader2, RefreshCw, Inbox, HardDrive, Wrench, Briefcase, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";

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

const SUPPORT_STATUSES = ["open", "in_progress", "resolved", "closed"];

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
            helpText="Founder-assisted plan changes (Creator Pro, Creator Studio, Studio plans, custom)."
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
            helpText="QC, mastering, anti-piracy, delivery prep, ingest / migration."
          />
        </TabsContent>
      </Tabs>
    </section>
  );
}

/* ------------------------------ Support queue ------------------------------ */

function SupportQueue({
  requestTypes,
  emptyLabel,
  helpText,
}: {
  requestTypes: string[];
  emptyLabel: string;
  helpText: string;
}) {
  const [rows, setRows] = useState<SupportRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>("open");
  const [replyDraft, setReplyDraft] = useState<Record<string, string>>({});

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
    setRows((data as unknown as SupportRow[]) ?? []);
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
                      {typeof meta.urgency === "string" && <span>· urgency: {String(meta.urgency)}</span>}
                      <span>· {new Date(r.created_at).toLocaleString()}</span>
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
                  {r.admin_reply && (
                    <div className="text-xs border-l-2 border-accent/40 pl-2 text-foreground">
                      <span className="text-[10px] uppercase tracking-wider text-accent">Current admin note · </span>
                      {r.admin_reply}
                    </div>
                  )}
                  <Textarea
                    rows={2}
                    placeholder="Internal note / reply to user"
                    value={replyDraft[r.id] ?? ""}
                    onChange={e => setReplyDraft(d => ({ ...d, [r.id]: e.target.value }))}
                  />
                  <div className="flex justify-end">
                    <Button size="sm" onClick={() => saveReply(r.id)}>Save reply</Button>
                  </div>
                </div>
              </details>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ----------------------------- Storage queue ------------------------------ */

function StorageBillingQueue() {
  const [topups, setTopups] = useState<TopupRow[]>([]);
  const [subs, setSubs] = useState<SubscriptionRow[]>([]);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    const [t, s] = await Promise.all([
      supabase.from("storage_topups")
        .select("id,user_id,status,tb_added,total_paise,storage_class,source,razorpay_payment_id,created_at")
        .order("created_at", { ascending: false }).limit(50),
      supabase.from("subscriptions")
        .select("id,user_id,status,subscription_type,storage_quantity_tb,cancel_requested_at,current_period_end,created_at")
        .order("created_at", { ascending: false }).limit(50),
    ]);
    setLoading(false);
    if (t.error) toast.error(t.error.message);
    if (s.error) toast.error(s.error.message);
    setTopups((t.data as unknown as TopupRow[]) ?? []);
    setSubs((s.data as unknown as SubscriptionRow[]) ?? []);
  };

  useEffect(() => { load(); }, []);

  const risky = useMemo(() => {
    const failed = topups.filter(t => t.status === "failed" || t.status === "pending").length;
    const cancelling = subs.filter(s => s.cancel_requested_at).length;
    return { failed, cancelling };
  }, [topups, subs]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          Recurring storage subscriptions, top-ups, cancellations pending cycle end. For full inspection use the Business & Revenue tab.
        </p>
        <Button size="sm" variant="outline" onClick={load}><RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} /></Button>
      </div>

      <div className="grid sm:grid-cols-3 gap-3">
        <Metric label="Pending / failed top-ups" value={String(risky.failed)} />
        <Metric label="Cancellations pending cycle end" value={String(risky.cancelling)} />
        <Metric label="Active storage subscriptions" value={String(subs.filter(s => s.status === "active").length)} />
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <div>
          <p className="text-[11px] uppercase tracking-wider text-muted-foreground mb-1.5">Recent storage top-ups</p>
          <div className="rounded-xl border border-border/40 bg-secondary/10 divide-y divide-border/40 max-h-80 overflow-y-auto">
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
          <div className="rounded-xl border border-border/40 bg-secondary/10 divide-y divide-border/40 max-h-80 overflow-y-auto">
            {subs.length === 0 ? <EmptyRow label="No subscriptions." /> : subs.map(s => (
              <div key={s.id} className="p-3 text-xs flex flex-wrap items-center justify-between gap-2">
                <div className="font-mono truncate">{s.user_id.slice(0, 8)}…</div>
                <div>{s.subscription_type ?? "—"}{s.storage_quantity_tb ? ` · ${s.storage_quantity_tb} TB` : ""}</div>
                <div className={`px-1.5 py-0.5 rounded border text-[10px] ${s.status === "active" ? "border-emerald-500/30 text-emerald-300 bg-emerald-500/10" : "border-border/60 text-muted-foreground"}`}>{s.status}</div>
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
                <div className="flex justify-between items-center">
                  {!r.title_id && (
                    <span className="text-[10px] text-amber-300 inline-flex items-center gap-1">
                      <ExternalLink className="w-3 h-3" /> Link to a content_title via Content Pipeline if appropriate.
                    </span>
                  )}
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
