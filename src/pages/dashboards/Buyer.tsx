import { useEffect, useMemo, useState } from "react";
import { Loader2, ShieldCheck, Send, Plus } from "lucide-react";
import { toast } from "sonner";
import RoleDashboardShell from "./RoleDashboardShell";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { AgreementGate } from "@/components/legal/AgreementGate";

type RequestType = "acquisition" | "licensing" | "screener" | "rights_info" | "distribution";

type Row = {
  id: string;
  request_type: RequestType;
  state: string;
  title_query: string | null;
  message: string | null;
  admin_notes: string | null;
  created_at: string;
  updated_at: string;
};

const TYPE_LABEL: Record<RequestType, string> = {
  acquisition: "Acquisition",
  licensing: "Licensing",
  screener: "Screener access",
  rights_info: "Rights info",
  distribution: "Distribution interest",
};

const STATE_LABEL: Record<string, string> = {
  pending_admin_review: "Pending admin review",
  awaiting_creator_review: "Awaiting creator review",
  more_info_required: "More info required",
  rejected: "Rejected",
  approved_for_negotiation: "Approved for negotiation",
  agreement_pending: "Agreement pending",
  delivery_authorized: "Delivery authorized",
  closed: "Closed",
};

const STATE_TONE: Record<string, string> = {
  pending_admin_review: "bg-amber-500/15 text-amber-300 border-amber-500/30",
  awaiting_creator_review: "bg-sky-500/15 text-sky-300 border-sky-500/30",
  more_info_required: "bg-orange-500/15 text-orange-300 border-orange-500/30",
  rejected: "bg-red-500/15 text-red-300 border-red-500/30",
  approved_for_negotiation: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  agreement_pending: "bg-violet-500/15 text-violet-300 border-violet-500/30",
  delivery_authorized: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  closed: "bg-secondary text-muted-foreground border-border/60",
};

export default function BuyerDashboard() {
  const { user } = useAuth();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState<"requests" | "new">("requests");
  const [needsGate, setNeedsGate] = useState(false);

  const [type, setType] = useState<RequestType>("acquisition");
  const [titleQuery, setTitleQuery] = useState("");
  const [titleId, setTitleId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Prefill from ?title_id=… &type=… deep link
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tid = params.get("title_id");
    const t = params.get("type") as RequestType | null;
    if (t && ["acquisition","licensing","screener","rights_info","distribution"].includes(t)) setType(t);
    if (tid) {
      setTitleId(tid);
      setTab("new");
      supabase.from("content_titles").select("title").eq("id", tid).maybeSingle().then(({ data }) => {
        if (data?.title) setTitleQuery(data.title);
      });
    }
  }, []);

  const load = async () => {
    if (!user) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("commercial_requests")
      .select("id,request_type,state,title_query,message,admin_notes,created_at,updated_at")
      .eq("buyer_user_id", user.id)
      .order("created_at", { ascending: false });
    setLoading(false);
    if (error) { toast.error(error.message); return; }
    setRows((data as unknown as Row[]) ?? []);
  };

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [user?.id]);

  const submit = async () => {
    if (!user) return;
    if (!titleQuery.trim()) { toast.error("Title of interest is required."); return; }
    setSubmitting(true);
    const payload: Record<string, unknown> = {
      buyer_user_id: user.id,
      request_type: type,
      title_query: titleQuery.trim(),
      message: message.trim() || null,
      terms: {},
    };
    if (titleId) payload.title_id = titleId;
    const { error } = await supabase.from("commercial_requests").insert(payload as never);
    setSubmitting(false);
    if (error) {
      // Most common cause: NDA not yet accepted by this buyer.
      if (/has_accepted_agreement|policy/i.test(error.message)) {
        setNeedsGate(true);
        return;
      }
      toast.error(error.message);
      return;
    }
    toast.success("Request submitted. Admin will review shortly.");
    setTitleQuery(""); setMessage(""); setType("acquisition"); setTitleId(null);
    setTab("requests");
    load();
  };

  const counts = useMemo(() => {
    const open = rows.filter(r => !["closed", "rejected", "delivery_authorized"].includes(r.state)).length;
    return { total: rows.length, open };
  }, [rows]);

  return (
    <RoleDashboardShell
      expectedRole="buyer"
      title="Buyer"
      subtitle="Submit acquisition, licensing, screener and rights requests. All requests are admin-mediated."
    >
      {needsGate && (
        <AgreementGate
          type="buyer_request_confidentiality"
          onAccepted={() => { setNeedsGate(false); toast.success("NDA accepted. Please resubmit."); }}
          onCancel={() => setNeedsGate(false)}
          context={{ surface: "buyer_dashboard" }}
        />
      )}

      <div className="grid sm:grid-cols-3 gap-3 mb-6">
        <Metric label="Total requests" value={String(counts.total)} />
        <Metric label="Open" value={String(counts.open)} />
        <Metric label="Catalog" value="Coming soon" sub="Browse not yet live" />
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as "requests" | "new")}>
        <TabsList className="grid grid-cols-2 w-full max-w-md">
          <TabsTrigger value="requests">My requests</TabsTrigger>
          <TabsTrigger value="new"><Plus className="w-3.5 h-3.5 mr-1" /> New request</TabsTrigger>
        </TabsList>

        <TabsContent value="requests" className="mt-6">
          {loading ? (
            <div className="py-12 grid place-items-center"><Loader2 className="w-5 h-5 animate-spin text-accent" /></div>
          ) : rows.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border/60 bg-secondary/10 p-10 text-center">
              <h2 className="font-semibold">No requests yet</h2>
              <p className="text-sm text-muted-foreground mt-2">Submit an acquisition, licensing, screener or rights enquiry. Admin reviews every request before looping in the title owner.</p>
              <Button className="mt-5" onClick={() => setTab("new")}><Plus className="w-4 h-4 mr-1.5" /> New request</Button>
            </div>
          ) : (
            <div className="space-y-3">
              {rows.map(r => (
                <details key={r.id} className="rounded-xl border border-border/40 bg-secondary/10 p-4 group">
                  <summary className="cursor-pointer flex flex-wrap items-center gap-2 justify-between list-none">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-secondary/40 border border-border/60">
                          {TYPE_LABEL[r.request_type] ?? r.request_type}
                        </span>
                        <span className={`text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded border ${STATE_TONE[r.state] ?? "bg-secondary text-muted-foreground border-border/60"}`}>
                          {STATE_LABEL[r.state] ?? r.state}
                        </span>
                      </div>
                      <div className="font-medium mt-1.5 truncate">{r.title_query || "Untitled request"}</div>
                      {r.message && <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{r.message}</p>}
                      {r.admin_notes && (
                        <p className="text-xs text-foreground mt-2 border-l-2 border-accent/40 pl-2">
                          <span className="text-[10px] uppercase tracking-wider text-accent">Admin note · </span>
                          {r.admin_notes}
                        </p>
                      )}
                    </div>
                    <div className="text-[10px] text-muted-foreground">
                      Updated {new Date(r.updated_at).toLocaleString()}
                      <span className="ml-2 underline opacity-70 group-open:opacity-100">View timeline</span>
                    </div>
                  </summary>
                  <RequestTimeline requestId={r.id} />
                </details>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="new" className="mt-6">
          <div className="rounded-2xl border border-border/40 bg-secondary/10 p-6 max-w-2xl space-y-4">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <ShieldCheck className="w-4 h-4 text-accent" />
              All commercial requests are reviewed by StreamVista admin before any rights or contact is shared.
            </div>

            <div className="grid gap-1.5">
              <label className="text-[11px] uppercase tracking-wider text-muted-foreground">Request type</label>
              <Select value={type} onValueChange={(v) => setType(v as RequestType)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(Object.keys(TYPE_LABEL) as RequestType[]).map(k => (
                    <SelectItem key={k} value={k}>{TYPE_LABEL[k]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-1.5">
              <label className="text-[11px] uppercase tracking-wider text-muted-foreground">Title of interest</label>
              <Input
                value={titleQuery}
                onChange={(e) => setTitleQuery(e.target.value)}
                placeholder="e.g. 'Crimson Coast (2024)' or short description if you don't know the exact name"
                maxLength={200}
              />
              <p className="text-[10px] text-muted-foreground">Catalog browsing is not live yet — admin will link your request to the correct title.</p>
            </div>

            <div className="grid gap-1.5">
              <label className="text-[11px] uppercase tracking-wider text-muted-foreground">Message to admin (optional)</label>
              <Textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Territory, intended use, timeline, budget range, screener needs, etc."
                rows={5}
                maxLength={2000}
              />
            </div>

            <div className="flex items-center justify-end gap-2">
              <Button variant="ghost" onClick={() => { setTitleQuery(""); setMessage(""); }}>Reset</Button>
              <Button onClick={submit} disabled={submitting || !titleQuery.trim()}>
                {submitting ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Send className="w-4 h-4 mr-1.5" />}
                Submit request
              </Button>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </RoleDashboardShell>
  );
}

function Metric({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-xl border border-border/40 bg-secondary/10 p-4">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="font-display text-2xl mt-1">{value}</div>
      {sub && <div className="text-[10px] text-muted-foreground mt-0.5">{sub}</div>}
    </div>
  );
}

function RequestTimeline({ requestId }: { requestId: string }) {
  const [events, setEvents] = useState<Array<{ id: string; from_state: string | null; to_state: string; note: string | null; created_at: string }>>([]);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from("commercial_request_events")
        .select("id,from_state,to_state,note,created_at")
        .eq("request_id", requestId)
        .order("created_at", { ascending: true });
      if (cancelled) return;
      setLoaded(true);
      if (error) return;
      setEvents((data as never) ?? []);
    })();
    return () => { cancelled = true; };
  }, [requestId]);
  if (!loaded) {
    return <div className="mt-3 text-[11px] text-muted-foreground">Loading timeline…</div>;
  }
  if (events.length === 0) {
    return <div className="mt-3 text-[11px] text-muted-foreground">Submitted · awaiting admin review. No state changes yet.</div>;
  }
  return (
    <ol className="mt-3 space-y-1.5 border-l border-border/40 pl-3">
      {events.map(e => (
        <li key={e.id} className="text-xs">
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{new Date(e.created_at).toLocaleString()}</span>
          <div>
            <span className="text-foreground">{STATE_LABEL[e.to_state] ?? e.to_state}</span>
            {e.from_state && <span className="text-muted-foreground"> · from {STATE_LABEL[e.from_state] ?? e.from_state}</span>}
          </div>
          {e.note && <div className="text-muted-foreground italic">"{e.note}"</div>}
        </li>
      ))}
    </ol>
  );
}
