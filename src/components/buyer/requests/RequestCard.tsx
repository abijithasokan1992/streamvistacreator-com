import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { STATE_LABEL, STATE_TONE, CATEGORY_LABEL, type Row } from "./shared";
import { Clock } from "lucide-react";
import { OfferNegotiationThread } from "@/components/licensing/OfferNegotiationThread";
import { RightsMatrixTable } from "@/components/licensing/RightsMatrixTable";

function StateBadge({ state }: { state: string }) {
  return (
    <span
      className={`text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded border whitespace-nowrap ${
        STATE_TONE[state] ?? "bg-secondary text-muted-foreground border-border/60"
      }`}
    >
      {STATE_LABEL[state] ?? state}
    </span>
  );
}

function MiniChip({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-[10px] px-1.5 py-0.5 rounded bg-secondary/40 border border-border/50">
      {children}
    </span>
  );
}

function DetailBlock({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-border/30 bg-background/30 p-3">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">{label}</div>
      {children}
    </div>
  );
}

function DetailItem({ k, v }: { k: string; v?: string | null }) {
  if (!v) return null;
  return (
    <li className="flex items-start justify-between gap-2">
      <span className="text-muted-foreground">{k}</span>
      <span className="text-right text-foreground/90">{v}</span>
    </li>
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
    return <div className="text-[11px] text-muted-foreground">Loading…</div>;
  }
  if (events.length === 0) {
    return <div className="text-[11px] text-muted-foreground">Submitted · awaiting admin review.</div>;
  }
  return (
    <ol className="space-y-1.5 border-l border-border/40 pl-3">
      {events.map(e => (
        <li key={e.id} className="text-xs">
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
            {new Date(e.created_at).toLocaleString()}
          </span>
          <div>
            <span className="text-foreground">{STATE_LABEL[e.to_state] ?? e.to_state}</span>
            {e.from_state && (
              <span className="text-muted-foreground"> · from {STATE_LABEL[e.from_state] ?? e.from_state}</span>
            )}
          </div>
          {e.note && <div className="text-muted-foreground italic">"{e.note}"</div>}
        </li>
      ))}
    </ol>
  );
}

export function RequestCard({ row }: { row: Row }) {
  const t = row.terms ?? {};
  const cat = t.category ? CATEGORY_LABEL[t.category] : row.request_type;
  return (
    <details className="rounded-xl border border-border/40 bg-secondary/10 p-4 group focus-within:ring-2 focus-within:ring-accent/40">
      <summary className="cursor-pointer flex flex-wrap items-center gap-2 justify-between list-none">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="outline" className="text-[10px] uppercase tracking-wider">{cat}</Badge>
            <StateBadge state={row.state} />
            {t.urgency && t.urgency !== "Standard" && (
              <Badge className="text-[10px] bg-orange-500/20 text-orange-200 border-orange-500/30">
                {t.urgency}
              </Badge>
            )}
          </div>
          <div className="font-medium mt-1.5 truncate">{row.title_query || "Untitled brief"}</div>
          <div className="flex flex-wrap gap-1.5 mt-1.5">
            {t.territory && <MiniChip>{t.territory}</MiniChip>}
            {t.rights_category && <MiniChip>{t.rights_category}</MiniChip>}
            {t.exclusivity && <MiniChip>{t.exclusivity}</MiniChip>}
            {t.term_bucket && <MiniChip>{t.term_bucket}</MiniChip>}
            {t.languages?.map(l => <MiniChip key={l}>{l}</MiniChip>)}
          </div>
          {row.admin_notes && (
            <p className="text-xs text-foreground mt-2 border-l-2 border-accent/40 pl-2">
              <span className="text-[10px] uppercase tracking-wider text-accent">Admin · </span>
              {row.admin_notes}
            </p>
          )}
        </div>
        <div className="text-[10px] text-muted-foreground flex items-center gap-1.5">
          <Clock className="w-3 h-3" />
          {new Date(row.updated_at).toLocaleString()}
        </div>
      </summary>
      <div className="mt-3 grid sm:grid-cols-2 gap-3 text-xs">
        <DetailBlock label="Commercial summary">
          <ul className="space-y-1">
            <DetailItem k="Type" v={cat} />
            <DetailItem k="Territory" v={t.territory} />
            <DetailItem k="Rights" v={t.rights_category} />
            <DetailItem k="Platform" v={t.platform_type} />
            <DetailItem k="Exclusivity" v={t.exclusivity} />
            <DetailItem k="Term" v={t.term_bucket} />
            <DetailItem k="Screener" v={t.screener_needed ? "Requested" : "Not required"} />
            <DetailItem k="NDA" v={t.nda_ready ? "Ready" : "Not yet"} />
            {t.notes && <DetailItem k="Note" v={t.notes} />}
          </ul>
        </DetailBlock>
        <DetailBlock label="Timeline">
          <RequestTimeline requestId={row.id} />
        </DetailBlock>
      </div>
      <div className="mt-3 grid gap-3">
        <OfferNegotiationThread commercialRequestId={row.id} party="buyer" />
        {row.title_id && <RightsMatrixTable titleId={row.title_id} />}
      </div>
    </details>
  );
}

export { StateBadge };
