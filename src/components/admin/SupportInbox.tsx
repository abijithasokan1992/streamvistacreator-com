import { useEffect, useMemo, useState } from "react";
import { Loader2, Inbox, Send, CheckCircle2, Mail, Crown, FileText, RotateCcw, CircleDot } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface Req {
  id: string;
  user_id: string;
  request_type: string;
  subject: string;
  message: string;
  status: string;
  admin_reply: string | null;
  user_email?: string | null;
  metadata?: Record<string, any> | null;
  created_at: string;
  invoice?: { id: string; invoice_number: string; total_paise: number; status: string } | null;
}

const STATUSES = ["open", "in_progress", "resolved", "closed"];
type Filter = "all" | "open" | "resolved";

const isResolved = (s: string) => s === "resolved" || s === "closed";

const statusDot = (s: string) =>
  isResolved(s) ? "bg-emerald-500" : s === "in_progress" ? "bg-amber-400" : "bg-sky-400";

export default function SupportInbox() {
  const [rows, setRows] = useState<Req[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [filter, setFilter] = useState<Filter>("open");

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("support_requests")
      .select("*, invoice:invoices!invoices_support_request_id_fkey(id,invoice_number,total_paise,status)")
      .order("created_at", { ascending: false });
    setLoading(false);
    if (error) return toast.error(error.message);
    const normalized = ((data as any[]) ?? []).map((r) => ({
      ...r,
      invoice: Array.isArray(r.invoice) ? (r.invoice[0] ?? null) : r.invoice ?? null,
    })) as Req[];
    setRows(normalized);
  };

  useEffect(() => { load(); }, []);

  const update = async (id: string, patch: { admin_reply?: string; status?: string }) => {
    const { error } = await supabase.from("support_requests").update(patch).eq("id", id);
    if (error) return toast.error(error.message);
    setRows((r) => r.map((x) => (x.id === id ? { ...x, ...patch } as Req : x)));
    toast.success("Updated");
  };

  const sendReply = async (r: Req) => {
    const reply = (drafts[r.id] ?? r.admin_reply ?? "").trim();
    if (!reply) return toast.error("Write a reply first");
    setBusyId(r.id);
    const t = toast.loading("Sending reply…");
    try {
      await update(r.id, { admin_reply: reply, status: "resolved" });
      const { data, error } = await supabase.functions.invoke("admin-support-reply", {
        body: { requestId: r.id, reply },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      toast.success("Reply emailed & ticket resolved", { id: t });
    } catch (e: any) {
      toast.error(e?.message || "Could not send email reply", { id: t });
    } finally {
      setBusyId(null);
    }
  };

  const counts = useMemo(() => ({
    all: rows.length,
    open: rows.filter((r) => !isResolved(r.status)).length,
    resolved: rows.filter((r) => isResolved(r.status)).length,
  }), [rows]);

  const visible = useMemo(() => {
    if (filter === "all") return rows;
    if (filter === "open") return rows.filter((r) => !isResolved(r.status));
    return rows.filter((r) => isResolved(r.status));
  }, [rows, filter]);

  return (
    <div className="glass rounded-2xl p-6 space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        <Inbox className="w-5 h-5 text-accent" />
        <h2 className="font-display text-xl font-bold">Support &amp; Service Requests</h2>
        <span className="text-xs text-muted-foreground">({counts.all})</span>
        <div className="ml-auto inline-flex rounded-lg border border-border/60 p-0.5 text-xs">
          {(["open", "resolved", "all"] as Filter[]).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 h-8 rounded-md capitalize transition-colors ${
                filter === f ? "bg-secondary text-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {f} <span className="opacity-60 ml-1">{counts[f]}</span>
            </button>
          ))}
        </div>
      </div>
      <p className="text-[11px] text-muted-foreground -mt-2">
        Reply once — we email the user and close the ticket. Resolved tickets are read-only; reopen to reply again.
      </p>

      {loading ? (
        <div className="py-10 grid place-items-center"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>
      ) : visible.length === 0 ? (
        <p className="text-sm text-muted-foreground py-8 text-center">
          {filter === "open" ? "Inbox zero. Nothing waiting on you." : "No tickets in this view."}
        </p>
      ) : (
        <div className="space-y-3">
          {visible.map((r) => {
            const busy = busyId === r.id;
            const resolved = isResolved(r.status);
            return (
              <div
                key={r.id}
                className={`border rounded-xl p-4 transition-colors ${
                  resolved ? "border-border/40 bg-secondary/10" : "border-border/60"
                }`}
              >
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={`inline-block w-2 h-2 rounded-full ${statusDot(r.status)}`} />
                      <div className="font-semibold truncate">{r.subject}</div>
                    </div>
                    <div className="text-xs text-muted-foreground capitalize mt-0.5">
                      <span className="uppercase tracking-wider text-[10px] font-mono-tech">{r.status.replace("_", " ")}</span>
                      <span className="opacity-50"> · </span>
                      {r.request_type}
                      <span className="opacity-50"> · </span>
                      {new Date(r.created_at).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
                      {r.user_email && <span className="ml-2 inline-flex items-center gap-1"><Mail className="w-3 h-3" /> {r.user_email}</span>}
                    </div>
                  </div>
                  {!resolved && (
                    <select
                      value={r.status}
                      onChange={(e) => update(r.id, { status: e.target.value })}
                      className="h-9 px-2 rounded-md bg-secondary/50 border border-border text-xs"
                    >
                      {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                  )}
                </div>

                <p className="text-sm mt-2 whitespace-pre-wrap text-foreground/90">{r.message}</p>

                {/* Structured upgrade metadata */}
                {r.metadata?.kind === "creator_upgrade" && (
                  <div className="mt-3 rounded-lg border border-accent/30 bg-accent/5 p-3 text-xs space-y-1">
                    <div className="inline-flex items-center gap-1.5 font-semibold text-foreground">
                      <Crown className="w-3.5 h-3.5 text-accent" /> Creator upgrade request
                    </div>
                    <div><span className="text-muted-foreground">Requested:</span> <b>{r.metadata.requested_package_name}</b> <span className="text-muted-foreground">({r.metadata.requested_package_key})</span></div>
                    <div><span className="text-muted-foreground">Current plan:</span> {r.metadata.current_plan_name ?? "—"}</div>
                    <div><span className="text-muted-foreground">Titles:</span> {r.metadata.current_title_count ?? "—"} · <span className="text-muted-foreground">Storage:</span> {r.metadata.current_storage_gb ?? "—"} GB</div>
                    <div className="pt-1 border-t border-border/40 mt-2">
                      <span className="text-muted-foreground">Invoice:</span>{" "}
                      {r.invoice ? (
                        <a href={`/invoice/${r.invoice.id}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-accent hover:underline">
                          <FileText className="w-3 h-3" /> {r.invoice.invoice_number} · ₹{(r.invoice.total_paise / 100).toFixed(2)} · {r.invoice.status}
                        </a>
                      ) : (
                        <span className="text-amber-400">Not issued yet</span>
                      )}
                    </div>
                  </div>
                )}

                {resolved ? (
                  // ── Read-only resolved view ─────────────────────────────
                  <div className="mt-3 space-y-2">
                    {r.admin_reply && (
                      <div className="rounded-lg border border-border/40 bg-background/40 px-3 py-2 text-xs">
                        <div className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground mb-1">Your reply</div>
                        <p className="whitespace-pre-wrap text-foreground/85">{r.admin_reply}</p>
                      </div>
                    )}
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        onClick={() => update(r.id, { status: "open" })}
                        className="h-8 px-3 rounded-md border border-border hover:bg-secondary text-xs font-medium inline-flex items-center gap-1.5"
                      >
                        <RotateCcw className="w-3 h-3" /> Reopen ticket
                      </button>
                      {r.invoice && (
                        <a
                          href={`/invoice/${r.invoice.id}`}
                          target="_blank"
                          rel="noreferrer"
                          className="h-8 px-3 rounded-md border border-border hover:bg-secondary text-xs font-medium inline-flex items-center gap-1.5"
                        >
                          <FileText className="w-3 h-3" /> View invoice
                        </a>
                      )}
                    </div>
                  </div>
                ) : (
                  // ── Active reply composer ───────────────────────────────
                  <div className="mt-3 space-y-2">
                    <textarea
                      defaultValue={r.admin_reply ?? ""}
                      rows={3}
                      onChange={(e) => setDrafts((d) => ({ ...d, [r.id]: e.target.value }))}
                      placeholder="Write a reply — sent via email when you hit Send & Resolve."
                      className="w-full px-3 py-2 rounded-md bg-secondary/50 border border-border text-sm"
                    />
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        onClick={() => sendReply(r)}
                        disabled={busy}
                        className="h-9 px-4 rounded-lg bg-gradient-primary text-primary-foreground text-xs font-semibold glow-primary flex items-center gap-2 disabled:opacity-60"
                      >
                        {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                        Send &amp; Resolve
                      </button>
                      <button
                        onClick={() => update(r.id, { admin_reply: drafts[r.id] ?? r.admin_reply ?? "" })}
                        disabled={busy}
                        className="h-9 px-3 rounded-lg border border-border hover:bg-secondary text-xs font-medium flex items-center gap-1.5"
                      >
                        <Send className="w-3 h-3" /> Save draft
                      </button>
                      <span className="text-[11px] text-muted-foreground ml-auto inline-flex items-center gap-1">
                        <CircleDot className="w-3 h-3" /> Visible in user's account
                      </span>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
