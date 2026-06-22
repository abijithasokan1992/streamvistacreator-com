/**
 * Creator-side distribution offer list.
 *
 * Mounted as a sub-card inside the Storage & Billing section. Reads
 * distribution_program_offers scoped to creator_user_id = auth.uid()
 * via the dpo_owner_read policy, and writes accept/reject transitions
 * through dpo_owner_accept (offered → accepted | rejected).
 */
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, CheckCircle2, XCircle, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { notify } from "@/lib/notify";

type Offer = {
  id: string;
  title_id: string | null;
  status: "draft" | "offered" | "accepted" | "rejected" | "expired" | "cancelled";
  program_name: string;
  rights_scope_json: any;
  channel_scope_json: any;
  territory_scope_json: any;
  term_years: number | null;
  is_non_exclusive: boolean;
  revenue_model: string | null;
  platform_share_pct: number | null;
  streamvista_share_pct: number | null;
  rights_holder_share_pct: number | null;
  termination_notice_days: number | null;
  termination_fee_amount: number | null;
  termination_fee_currency: string | null;
  legal_text_snapshot: string | null;
  offered_at: string | null;
  accepted_at: string | null;
  rejected_at: string | null;
  offered_by_admin: string | null;
};

const STATUS_COLOR: Record<string, string> = {
  offered: "bg-blue-500/10 text-blue-600 border-blue-500/30",
  accepted: "bg-emerald-500/10 text-emerald-600 border-emerald-500/30",
  rejected: "bg-red-500/10 text-red-600 border-red-500/30",
  expired: "bg-amber-500/10 text-amber-600 border-amber-500/30",
  cancelled: "bg-muted text-muted-foreground border-border",
};

function describe(json: any): string {
  if (!json) return "—";
  if (typeof json === "string") return json;
  return json.description ?? JSON.stringify(json);
}

export default function CreatorDistributionOffers() {
  const sb = supabase as any;
  const [offers, setOffers] = useState<Offer[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<Offer | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [titleMap, setTitleMap] = useState<Record<string, string>>({});

  async function load() {
    setLoading(true);
    const { data } = await sb
      .from("distribution_program_offers")
      .select("*")
      .neq("status", "draft")
      .order("created_at", { ascending: false })
      .limit(50);
    const rows: Offer[] = data ?? [];
    setOffers(rows);
    const titleIds = Array.from(new Set(rows.map((o) => o.title_id).filter(Boolean)));
    if (titleIds.length) {
      const { data: ts } = await sb.from("content_titles").select("id,title").in("id", titleIds);
      const m: Record<string, string> = {};
      (ts ?? []).forEach((t: any) => { m[t.id] = t.title; });
      setTitleMap(m);
    }
    setLoading(false);
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  async function decide(o: Offer, accept: boolean) {
    setBusy(o.id);
    const next = accept ? "accepted" : "rejected";
    const stamp: any = { status: next };
    if (accept) stamp.accepted_at = new Date().toISOString();
    else stamp.rejected_at = new Date().toISOString();
    const { error } = await sb.from("distribution_program_offers").update(stamp).eq("id", o.id);
    setBusy(null);
    if (error) { toast.error(error.message); return; }
    toast.success(accept ? "Offer accepted" : "Offer rejected");
    if (o.offered_by_admin) {
      await notify(o.offered_by_admin, accept ? "offer_accepted" : "offer_rejected",
        `Creator ${accept ? "accepted" : "rejected"} offer: ${o.program_name}`,
        `Title: ${titleMap[o.title_id ?? ""] ?? "—"}`);
    }
    setView(null);
    await load();
  }

  return (
    <div className="rounded-2xl border border-border/40 p-5 bg-card/40">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="font-semibold">Distribution Offers</h3>
          <p className="text-xs text-muted-foreground">Programs offered by StreamVista for your titles.</p>
        </div>
      </div>
      {loading ? (
        <div className="py-6 flex justify-center"><Loader2 className="w-4 h-4 animate-spin" /></div>
      ) : offers.length === 0 ? (
        <p className="text-xs text-muted-foreground py-4">No distribution offers yet.</p>
      ) : (
        <div className="space-y-2">
          {offers.map((o) => (
            <div key={o.id} className="flex items-center justify-between rounded-lg border border-border/30 p-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium text-sm">{o.program_name}</span>
                  <Badge variant="outline" className={STATUS_COLOR[o.status] ?? ""}>{o.status}</Badge>
                </div>
                <div className="text-xs text-muted-foreground mt-0.5 truncate">
                  {titleMap[o.title_id ?? ""] ?? "—"} · {o.term_years ?? "?"} yrs · {o.is_non_exclusive ? "non-exclusive" : "exclusive"} · RH {Number(o.rights_holder_share_pct ?? 0)}%
                </div>
              </div>
              <div className="flex gap-1.5 shrink-0">
                <Button size="sm" variant="outline" onClick={() => setView(o)}><FileText className="w-3 h-3 mr-1" />Details</Button>
                {o.status === "offered" && (
                  <>
                    <Button size="sm" variant="outline" onClick={() => decide(o, false)} disabled={busy === o.id}><XCircle className="w-3 h-3 mr-1" />Reject</Button>
                    <Button size="sm" onClick={() => decide(o, true)} disabled={busy === o.id}><CheckCircle2 className="w-3 h-3 mr-1" />Accept</Button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={!!view} onOpenChange={(v) => !v && setView(null)}>
        <DialogContent className="max-w-xl max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{view?.program_name}</DialogTitle></DialogHeader>
          {view && (
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-3 text-xs">
                <Row k="Title" v={titleMap[view.title_id ?? ""] ?? "—"} />
                <Row k="Status" v={view.status} />
                <Row k="Term" v={`${view.term_years ?? "—"} yrs`} />
                <Row k="Exclusivity" v={view.is_non_exclusive ? "Non-exclusive" : "Exclusive"} />
                <Row k="Rights scope" v={describe(view.rights_scope_json)} />
                <Row k="Channels" v={describe(view.channel_scope_json)} />
                <Row k="Territory" v={describe(view.territory_scope_json)} />
                <Row k="Revenue model" v={view.revenue_model ?? "—"} />
                <Row k="Platform share" v={`${Number(view.platform_share_pct ?? 0)}%`} />
                <Row k="StreamVista share" v={`${Number(view.streamvista_share_pct ?? 0)}%`} />
                <Row k="Your share" v={`${Number(view.rights_holder_share_pct ?? 0)}%`} />
                <Row k="Notice" v={`${view.termination_notice_days ?? "—"} days`} />
                <Row k="Termination fee" v={`${view.termination_fee_amount ?? 0} ${view.termination_fee_currency ?? ""}`} />
              </div>
              {view.legal_text_snapshot && (
                <div>
                  <div className="text-xs uppercase tracking-wider text-muted-foreground mb-1">Terms</div>
                  <pre className="text-xs whitespace-pre-wrap rounded border border-border/40 p-3 bg-muted/20 max-h-60 overflow-y-auto">{view.legal_text_snapshot}</pre>
                </div>
              )}
            </div>
          )}
          {view?.status === "offered" && (
            <DialogFooter>
              <Button variant="outline" onClick={() => decide(view, false)} disabled={busy === view.id}>Reject</Button>
              <Button onClick={() => decide(view, true)} disabled={busy === view.id}>Accept offer</Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div><div className="text-muted-foreground uppercase tracking-wider text-[10px]">{k}</div><div className="mt-0.5">{v}</div></div>
  );
}
