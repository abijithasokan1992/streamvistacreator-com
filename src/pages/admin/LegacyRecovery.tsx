import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Loader2, Send, Mail, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

type PendingRow = { uploader_email: string; film_count: number };
type SendResult = { email: string; count: number; ok: boolean; error?: string };

/**
 * Admin console for the Legacy Film Recovery mailout.
 * - Lists unique emails still needing an invite (server-side RPC restricted to admins)
 * - Sends one email per unique address, dedup guaranteed by `recovery_email_sent_at`
 */
export default function AdminLegacyRecovery() {
  const { user, role } = useAuth();
  const [pending, setPending] = useState<PendingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [results, setResults] = useState<SendResult[]>([]);
  const [sentCount, setSentCount] = useState<number | null>(null);

  const isAdmin = role === "admin" || role === "super_admin";

  const load = async () => {
    setLoading(true);
    const { data, error } = await (supabase as any).rpc("pending_legacy_recovery_emails");
    if (error) { toast.error(error.message); setPending([]); }
    else setPending((data ?? []) as PendingRow[]);
    setLoading(false);
  };

  useEffect(() => { if (user && isAdmin) load(); }, [user?.id, isAdmin]);

  const send = async (dryRun: boolean) => {
    setSending(true);
    setResults([]);
    setSentCount(null);
    try {
      const { data, error } = await supabase.functions.invoke("send-legacy-recovery-emails", {
        body: { dryRun },
      });
      if (error) throw error;
      const res = (data as any) ?? {};
      setResults((res.results ?? []) as SendResult[]);
      setSentCount(res.sent ?? 0);
      toast.success(
        dryRun
          ? `Dry-run OK — ${res.uniqueEmails ?? 0} email(s) queued to send`
          : `Sent ${res.sent ?? 0}, failed ${res.failed ?? 0}`
      );
      await load();
    } catch (e: any) {
      toast.error(e?.message || "Send failed");
    } finally {
      setSending(false);
    }
  };

  if (!user) return null;
  if (!isAdmin) {
    return (
      <main className="min-h-dvh grid place-items-center bg-background text-foreground p-6">
        <p className="text-sm text-muted-foreground">Admin access required.</p>
      </main>
    );
  }

  const totalFilms = pending.reduce((n, r) => n + r.film_count, 0);

  return (
    <main className="min-h-dvh bg-background text-foreground">
      <div className="max-w-4xl mx-auto px-4 md:px-6 py-8 space-y-8">
        <header className="space-y-1">
          <p className="text-[11px] uppercase tracking-[0.25em] text-muted-foreground/70">Admin · Comms</p>
          <h1 className="font-display text-2xl md:text-3xl">Legacy Film Recovery</h1>
          <p className="text-sm text-muted-foreground max-w-2xl">
            Send one personalized recovery invite to every unique uploader email in the legacy
            import staging table. Already-sent addresses are skipped automatically.
          </p>
          <p className="text-xs">
            <Link to="/admin" className="text-accent hover:underline">← Back to admin</Link>
          </p>
        </header>

        <section className="rounded-xl border border-border/60 bg-background/50 p-5 space-y-4">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <p className="text-sm font-semibold">Pending recovery emails</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {loading
                  ? "Loading…"
                  : `${pending.length} unique email${pending.length === 1 ? "" : "s"} · ${totalFilms} film${totalFilms === 1 ? "" : "s"} total`}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                disabled={sending || loading || pending.length === 0}
                onClick={() => send(true)}
                className="px-3 py-1.5 text-xs rounded border border-border hover:bg-secondary/40 disabled:opacity-50"
              >
                Dry run
              </button>
              <button
                disabled={sending || loading || pending.length === 0}
                onClick={() => send(false)}
                className="px-3 py-1.5 text-xs rounded bg-accent text-accent-foreground hover:opacity-90 disabled:opacity-50 inline-flex items-center gap-1.5"
              >
                {sending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                Send now
              </button>
            </div>
          </div>

          {loading ? (
            <div className="py-8 grid place-items-center"><Loader2 className="w-4 h-4 animate-spin text-accent" /></div>
          ) : pending.length === 0 ? (
            <div className="py-8 grid place-items-center text-sm text-muted-foreground gap-2">
              <CheckCircle2 className="w-5 h-5 text-accent" />
              All recovery emails have been sent.
            </div>
          ) : (
            <ul className="divide-y divide-border/50">
              {pending.map((r) => (
                <li key={r.uploader_email} className="py-2.5 flex items-center gap-3 text-sm">
                  <Mail className="w-3.5 h-3.5 text-muted-foreground" />
                  <span className="flex-1 truncate">{r.uploader_email}</span>
                  <span className="text-xs text-muted-foreground">{r.film_count} film{r.film_count === 1 ? "" : "s"}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        {results.length > 0 && (
          <section className="rounded-xl border border-border/60 bg-background/50 p-5 space-y-3">
            <p className="text-sm font-semibold">Last run — {sentCount ?? 0} sent</p>
            <ul className="divide-y divide-border/50">
              {results.map((r, i) => (
                <li key={i} className="py-2 flex items-center gap-3 text-xs">
                  <span className={`w-1.5 h-1.5 rounded-full ${r.ok ? "bg-emerald-400" : "bg-red-400"}`} />
                  <span className="flex-1 truncate">{r.email}</span>
                  <span className="text-muted-foreground">{r.count} film{r.count === 1 ? "" : "s"}</span>
                  <span className={r.ok ? "text-emerald-500" : "text-red-500"}>
                    {r.ok ? "sent" : r.error || "failed"}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </main>
  );
}
