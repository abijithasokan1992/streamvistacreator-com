/**
 * Distribution section on the Creator sidebar — READ-ONLY status view.
 *
 * After RC1 cleanup, Distribution is an Operations-owned workflow. Creators
 * see delivery status across their titles, but cannot trigger retries,
 * dispatch, or package builds from here. Operational actions live in the
 * Admin surfaces and edge functions gated by role.
 */
import { useEffect, useState } from "react";
import { Loader2, Radio } from "lucide-react";
import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";

const STATUS_TONE: Record<string, string> = {
  queued: "bg-sky-500/15 text-sky-300 border-sky-500/30",
  dispatching: "bg-amber-500/15 text-amber-300 border-amber-500/30",
  retrying: "bg-amber-500/15 text-amber-300 border-amber-500/30",
  delivered: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  failed: "bg-red-500/15 text-red-300 border-red-500/30",
  cancelled: "bg-secondary text-muted-foreground border-border/60",
};

export default function DistributionSection() {
  const { user } = useAuth();
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      // RLS scopes to the caller's owned titles automatically.
      const { data, error: qErr } = await (supabase as any)
        .from("distribution_queue")
        .select("id,status,attempts,max_attempts,partner_id,title_id,last_error,last_error_code,next_retry_at,updated_at")
        .order("updated_at", { ascending: false })
        .limit(100);
      if (qErr) throw qErr;
      const partnerIds = Array.from(new Set((data ?? []).map((r: any) => r.partner_id)));
      const titleIds = Array.from(new Set((data ?? []).map((r: any) => r.title_id)));
      const [{ data: partners }, { data: titles }] = await Promise.all([
        (supabase as any).rpc("list_active_distribution_partners"),
        (supabase as any).from("content_titles").select("id,title").in("id", titleIds.length ? titleIds : ["00000000-0000-0000-0000-000000000000"]),
      ]);
      const pmap = new Map(((partners as any[]) ?? []).filter((p: any) => partnerIds.includes(p.id)).map((p: any) => [p.id, p]));
      const tmap = new Map((titles ?? []).map((t: any) => [t.id, t]));
      setRows((data ?? []).map((r: any) => ({
        ...r,
        partner: pmap.get(r.partner_id),
        title: tmap.get(r.title_id),
      })));
    } catch (e) {
      setError((e as Error).message || "Unable to load distribution status.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void reload(); }, [user?.id]);

  return (
    <section className="space-y-5">
      <header className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h2 className="font-display text-lg flex items-center gap-2"><Radio className="w-4 h-4 text-accent" /> Distribution status</h2>
          <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
            Track partner deliveries across your titles. StreamVista Operations manages packaging, dispatch, and retries — you'll see status updates here as they progress.
          </p>
        </div>
      </header>

      {loading ? (
        <div className="py-12 grid place-items-center"><Loader2 className="w-5 h-5 animate-spin text-accent" /></div>
      ) : rows.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border/50 bg-secondary/10 p-8 text-center text-sm text-muted-foreground">
          No distribution activity yet. Once your title is approved and Operations dispatches to partners, deliveries appear here.
        </div>
      ) : (
        <ul className="space-y-2 list-none">
          {rows.map(r => (
            <li key={r.id} className="rounded-xl border border-border/40 bg-secondary/10 p-3 flex flex-wrap items-center gap-3">
              <Badge className={cn("text-[10px] capitalize border", STATUS_TONE[r.status] ?? "bg-secondary text-muted-foreground border-border/60")}>{r.status}</Badge>
              <Badge variant="outline" className="text-[10px] uppercase">{r.partner?.protocol ?? "—"}</Badge>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium truncate">{r.title?.title ?? "Title"} → {r.partner?.name ?? "Partner"}</div>
                <div className="text-[10px] text-muted-foreground mt-0.5">
                  Attempt {r.attempts}/{r.max_attempts}
                  {r.next_retry_at && <> · retry {new Date(r.next_retry_at).toLocaleString()}</>}
                  {r.last_error && <> · <span className="text-red-300/90">{r.last_error_code}: {r.last_error}</span></>}
                </div>
              </div>
              {r.title_id && (
                <Link
                  to={`/creator?section=titles&titleId=${r.title_id}`}
                  className="text-xs text-accent hover:underline"
                >Open title</Link>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
