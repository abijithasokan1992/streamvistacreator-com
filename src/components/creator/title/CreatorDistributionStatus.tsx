import { useEffect, useState } from "react";
import { Loader2, Radio, Lock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

/**
 * CreatorDistributionStatus — read-only summary of distribution activity
 * for the creator's title. Package building, partner dispatch and delivery
 * controls remain Admin-only surfaces; this component never exposes them.
 */
type OfferRow = {
  id: string;
  program_name: string | null;
  status: string;
  revenue_model: string | null;
  rights_holder_share_pct: number | null;
  streamvista_share_pct: number | null;
  term_start_date: string | null;
  term_end_date: string | null;
  updated_at: string;
};

const STATUS_STYLE: Record<string, string> = {
  offered:  "bg-sky-500/10 text-sky-300 border-sky-500/30",
  accepted: "bg-emerald-500/10 text-emerald-300 border-emerald-500/30",
  rejected: "bg-rose-500/10 text-rose-300 border-rose-500/30",
  expired:  "bg-muted/20 text-muted-foreground border-border/40",
};

export function CreatorDistributionStatus({
  titleId, titleStatus,
}: { titleId: string; titleStatus: string }) {
  const [loading, setLoading] = useState(true);
  const [offers, setOffers] = useState<OfferRow[]>([]);
  const unlocked = ["approved", "ready_for_distribution", "published", "locked"].includes(titleStatus);

  useEffect(() => {
    let cancel = false;
    (async () => {
      setLoading(true);
      const { data } = await (supabase as any)
        .from("distribution_program_offers")
        .select("id, program_name, status, revenue_model, rights_holder_share_pct, streamvista_share_pct, term_start_date, term_end_date, updated_at")
        .eq("title_id", titleId)
        .order("updated_at", { ascending: false })
        .limit(10);
      if (!cancel) {
        setOffers((data as OfferRow[]) ?? []);
        setLoading(false);
      }
    })();
    return () => { cancel = true; };
  }, [titleId]);

  return (
    <section className="rounded-lg border border-border/40 bg-card/30 p-4">
      <header className="flex items-center gap-2 mb-3">
        <Radio className="w-4 h-4 text-accent" />
        <h3 className="text-sm font-semibold">Distribution Status</h3>
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground ml-auto">Read-only</span>
      </header>

      {!unlocked && (
        <div className="rounded-md border border-border/40 bg-background/40 p-3 text-xs text-muted-foreground flex items-start gap-2">
          <Lock className="w-3.5 h-3.5 shrink-0 mt-0.5" />
          <div>
            Distribution activity becomes visible once your title is <span className="text-foreground">approved</span>.
            Package building, partner dispatch and delivery are handled by StreamVista Operations — you'll be notified at
            each milestone.
          </div>
        </div>
      )}

      {unlocked && (
        loading ? (
          <div className="grid place-items-center py-6"><Loader2 className="w-4 h-4 animate-spin text-accent" /></div>
        ) : offers.length === 0 ? (
          <p className="text-xs text-muted-foreground">No distribution offers on this title yet. You'll see program name, term and revenue split here as they progress.</p>
        ) : (
          <ul className="space-y-2">
            {offers.map((o) => {
              const cls = STATUS_STYLE[o.status] ?? "bg-muted/20 text-muted-foreground border-border/40";
              return (
                <li key={o.id} className="rounded-md border border-border/40 bg-background/30 p-3 text-xs">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-foreground">{o.program_name ?? "Distribution program"}</span>
                    <span className={`inline-flex items-center rounded border px-1.5 py-0.5 uppercase tracking-wider text-[10px] ${cls}`}>{o.status}</span>
                  </div>
                  <dl className="mt-2 grid grid-cols-2 sm:grid-cols-4 gap-y-1 text-muted-foreground">
                    <dt>Revenue model</dt><dd className="text-foreground">{o.revenue_model ?? "—"}</dd>
                    <dt>Your share</dt><dd className="text-foreground">{o.rights_holder_share_pct != null ? `${o.rights_holder_share_pct}%` : "—"}</dd>
                    <dt>Term start</dt><dd className="text-foreground">{o.term_start_date ?? "—"}</dd>
                    <dt>Term end</dt><dd className="text-foreground">{o.term_end_date ?? "—"}</dd>
                  </dl>
                </li>
              );
            })}
          </ul>
        )
      )}
    </section>
  );
}

export default CreatorDistributionStatus;
