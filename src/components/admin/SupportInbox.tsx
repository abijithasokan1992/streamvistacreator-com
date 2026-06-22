import { useEffect, useState } from "react";
import { Loader2, Inbox, Send, CheckCircle2, Mail, Crown, FileText } from "lucide-react";
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

export default function SupportInbox() {
  const [rows, setRows] = useState<Req[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("support_requests")
      .select("*, invoice:invoices!invoices_support_request_id_fkey(id,invoice_number,total_paise,status)")
      .order("created_at", { ascending: false });
    setLoading(false);
    if (error) return toast.error(error.message);
    // invoice comes back as array from PostgREST embed — flatten to first
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

  /** 1-click: save reply, mark resolved, email user via Resend edge function. */
  const sendReply = async (r: Req) => {
    const reply = (drafts[r.id] ?? r.admin_reply ?? "").trim();
    if (!reply) return toast.error("Write a reply first");
    setBusyId(r.id);
    const t = toast.loading("Sending reply…");
    try {
      // 1. Persist reply + mark resolved
      await update(r.id, { admin_reply: reply, status: "resolved" });

      // 2. Dispatch email via existing Resend infrastructure
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

  return (
    <div className="glass rounded-2xl p-6 space-y-4">
      <div className="flex items-center gap-2">
        <Inbox className="w-5 h-5 text-accent" />
        <h2 className="font-display text-xl font-bold">Support &amp; Service Requests</h2>
        <span className="text-xs text-muted-foreground">({rows.length})</span>
      </div>
      <p className="text-[11px] text-muted-foreground -mt-2">
        One-click: write a reply, hit <b className="text-foreground">Send &amp; Resolve</b> — we email the user via Resend and close the ticket.
      </p>
      {loading ? (
        <div className="py-10 grid place-items-center"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>
      ) : rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">No requests yet.</p>
      ) : (
        <div className="space-y-3">
          {rows.map((r) => {
            const busy = busyId === r.id;
            return (
              <div key={r.id} className="border border-border/60 rounded-xl p-4">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div>
                    <div className="font-semibold">{r.subject}</div>
                    <div className="text-xs text-muted-foreground capitalize">
                      {r.request_type} · {new Date(r.created_at).toLocaleString()}
                      {r.user_email && <span className="ml-2 inline-flex items-center gap-1"><Mail className="w-3 h-3" /> {r.user_email}</span>}
                    </div>
                  </div>
                  <select value={r.status} onChange={(e) => update(r.id, { status: e.target.value })}
                    className="h-9 px-2 rounded-md bg-secondary/50 border border-border text-xs">
                    {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <p className="text-sm mt-2 whitespace-pre-wrap">{r.message}</p>

                {/* Structured upgrade metadata (creator managed model) */}
                {r.metadata?.kind === "creator_upgrade" && (
                  <div className="mt-3 rounded-lg border border-accent/30 bg-accent/5 p-3 text-xs space-y-1">
                    <div className="inline-flex items-center gap-1.5 font-semibold text-foreground">
                      <Crown className="w-3.5 h-3.5 text-accent" /> Creator upgrade request
                    </div>
                    <div><span className="text-muted-foreground">Requested package:</span> <b>{r.metadata.requested_package_name}</b> <span className="text-muted-foreground">({r.metadata.requested_package_key})</span></div>
                    <div><span className="text-muted-foreground">Current plan:</span> {r.metadata.current_plan_name ?? "—"}</div>
                    <div><span className="text-muted-foreground">Titles:</span> {r.metadata.current_title_count ?? "—"} · <span className="text-muted-foreground">Storage used:</span> {r.metadata.current_storage_gb ?? "—"} GB</div>
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

                <div className="mt-3 space-y-2">
                  <textarea
                    defaultValue={r.admin_reply ?? ""}
                    rows={3}
                    onChange={(e) => setDrafts(d => ({ ...d, [r.id]: e.target.value }))}
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
                    <span className="text-[11px] text-muted-foreground ml-auto">Reply is visible in the user's account.</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
