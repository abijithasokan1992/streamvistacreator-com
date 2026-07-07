import { useEffect, useState } from "react";
import { Loader2, Film, ExternalLink, ShieldCheck, Clock, Eye } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";

type Screener = {
  id: string;
  title_id: string;
  status: string;
  expires_at: string;
  completed: boolean;
  first_opened_at: string | null;
  last_viewed_at: string | null;
  view_count: number;
  max_views: number | null;
  max_progress_pct: number;
  watermark_enabled: boolean;
  nda_required: boolean;
  playback_url: string | null;
  playback_url_expires_at: string | null;
  revoked_at: string | null;
  notes: string | null;
};

type Tab = "approved" | "watched" | "expired";

const STATUS_TONE: Record<string, string> = {
  approved: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  active:   "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  pending:  "bg-amber-500/15 text-amber-300 border-amber-500/30",
  expired:  "bg-secondary text-muted-foreground border-border/60",
  revoked:  "bg-red-500/15 text-red-300 border-red-500/30",
};

function isExpired(s: Screener): boolean {
  return !!s.revoked_at || Date.parse(s.expires_at) < Date.now();
}

export default function ScreenersSection() {
  const { user } = useAuth();
  const [rows, setRows] = useState<Screener[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("approved");

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from("screening_invites")
        .select("id,title_id,status,expires_at,completed,first_opened_at,last_viewed_at,view_count,max_views,max_progress_pct,watermark_enabled,nda_required,playback_url,playback_url_expires_at,revoked_at,notes")
        .eq("buyer_user_id", user.id)
        .order("expires_at", { ascending: false });
      if (cancelled) return;
      setLoading(false);
      setRows((data as unknown as Screener[]) ?? []);
    })();
    return () => { cancelled = true; };
  }, [user]);

  const approved = rows.filter(s => !s.completed && !isExpired(s));
  const watched  = rows.filter(s => s.completed && !isExpired(s));
  const expired  = rows.filter(isExpired);
  const list = tab === "approved" ? approved : tab === "watched" ? watched : expired;

  return (
    <section className="space-y-4">
      <header>
        <h2 className="font-display text-xl">Screeners</h2>
        <p className="text-sm text-muted-foreground">
          Approved screeners are watermarked, time-limited, and every view is logged.
        </p>
      </header>

      <div role="tablist" aria-label="Screener views" className="inline-flex rounded-lg border border-border/50 p-1 bg-secondary/20 text-xs">
        {(["approved", "watched", "expired"] as const).map(t => (
          <button
            key={t}
            role="tab"
            aria-selected={tab === t}
            onClick={() => setTab(t)}
            className={cn(
              "px-3 py-1.5 rounded-md capitalize focus:outline-none focus-visible:ring-2 focus-visible:ring-accent",
              tab === t ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:text-foreground"
            )}
          >
            {t === "approved" ? `Approved (${approved.length})` : t === "watched" ? `Watched (${watched.length})` : `Expired (${expired.length})`}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="py-12 grid place-items-center" role="status" aria-label="Loading screeners">
          <Loader2 className="w-5 h-5 animate-spin text-accent" aria-hidden />
        </div>
      ) : list.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border/60 bg-secondary/10 p-10 text-center">
          <Film className="w-8 h-8 mx-auto text-muted-foreground mb-2" aria-hidden />
          <h3 className="font-semibold">Nothing here</h3>
          <p className="text-sm text-muted-foreground mt-1">
            Approved screeners appear once admin releases them for a request.
          </p>
        </div>
      ) : (
        <ul className="space-y-2 list-none">
          {list.map(s => {
            const expired = isExpired(s);
            const status = s.revoked_at ? "revoked" : expired ? "expired" : s.status;
            const link = s.playback_url && !expired ? s.playback_url : null;
            return (
              <li key={s.id} className="rounded-xl border border-border/40 bg-secondary/10 p-4 flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge className={cn("text-[10px] capitalize border", STATUS_TONE[status] ?? "bg-secondary text-muted-foreground border-border/60")}>
                      {status}
                    </Badge>
                    {s.watermark_enabled && (
                      <Badge variant="outline" className="text-[10px]">
                        <ShieldCheck className="w-3 h-3 mr-1" aria-hidden /> Watermarked
                      </Badge>
                    )}
                    {s.nda_required && <Badge variant="outline" className="text-[10px]">NDA required</Badge>}
                  </div>
                  <div className="text-[11px] text-muted-foreground mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5">
                    <span className="inline-flex items-center gap-1"><Clock className="w-3 h-3" aria-hidden /> Expires {new Date(s.expires_at).toLocaleString()}</span>
                    <span className="inline-flex items-center gap-1"><Eye className="w-3 h-3" aria-hidden /> {s.view_count} view{s.view_count !== 1 ? "s" : ""}{s.max_views ? ` / ${s.max_views}` : ""}</span>
                    {s.last_viewed_at && <span>Last watched {new Date(s.last_viewed_at).toLocaleDateString()}</span>}
                    {s.max_progress_pct > 0 && <span>Progress {s.max_progress_pct}%</span>}
                  </div>
                  {s.notes && <p className="text-xs text-muted-foreground mt-2 line-clamp-2">{s.notes}</p>}
                </div>
                {link && (
                  <Button asChild size="sm" className="min-h-9">
                    <a href={link} target="_blank" rel="noreferrer noopener" aria-label="Open screener">
                      <ExternalLink className="w-3.5 h-3.5 mr-1" aria-hidden /> Watch
                    </a>
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
