/**
 * Distribution Offers Console (Admin)
 *
 * Authoring + lifecycle UI for public.distribution_program_offers.
 * Status flow: draft → offered → accepted | rejected | cancelled | expired
 *
 * RLS: admins have full access (dpo_admin_all). Writes go directly
 * to the table from the admin role.
 */
import { useEffect, useMemo, useState } from "react";
import { Loader2, Plus, RefreshCw, Send, Ban, FileEdit, CheckCircle2, XCircle } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  applyProductionFilterByTitleIdColumn,
  applyProductionFilterToTitlesQuery,
} from "@/lib/operations/productionFilters";
import { fetchQuarantinedTitleIds } from "@/lib/operations/useQuarantinedTitleIds";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { notify } from "@/lib/notify";

type OfferStatus = "draft" | "offered" | "accepted" | "rejected" | "expired" | "cancelled";

type Offer = {
  id: string;
  title_id: string | null;
  workspace_id: string | null;
  creator_user_id: string | null;
  status: OfferStatus;
  program_name: string;
  rights_scope_json: any;
  channel_scope_json: any;
  territory_scope_json: any;
  term_years: number | null;
  term_start_date: string | null;
  term_end_date: string | null;
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
  created_at: string;
};

type TitleLite = { id: string; title: string; creator_user_id: string | null; workspace_id: string | null };

const STATUS_COLOR: Record<OfferStatus, string> = {
  draft: "bg-muted text-muted-foreground border-border",
  offered: "bg-blue-500/10 text-blue-600 border-blue-500/30",
  accepted: "bg-emerald-500/10 text-emerald-600 border-emerald-500/30",
  rejected: "bg-red-500/10 text-red-600 border-red-500/30",
  expired: "bg-amber-500/10 text-amber-600 border-amber-500/30",
  cancelled: "bg-muted text-muted-foreground border-border",
};

const EMPTY_FORM = {
  title_id: "",
  program_name: "",
  rights_scope: "VOD streaming",
  channel_scope: "Web, iOS, Android",
  territory_scope: "India",
  term_years: 2,
  is_non_exclusive: true,
  revenue_model: "rev_share",
  platform_share_pct: 50,
  streamvista_share_pct: 20,
  rights_holder_share_pct: 30,
  termination_notice_days: 30,
  termination_fee_amount: 0,
  termination_fee_currency: "INR",
  legal_text_snapshot: "",
};

export default function DistributionOffersConsole() {
  const sb = supabase as any;
  const [loading, setLoading] = useState(true);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [titles, setTitles] = useState<TitleLite[]>([]);
  const [openCreate, setOpenCreate] = useState(false);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    const [oRes, tRes] = await Promise.all([
      sb.from("distribution_program_offers").select("*").order("created_at", { ascending: false }).limit(200),
      sb.from("content_titles").select("id,title,creator_user_id,workspace_id").order("title").limit(500),
    ]);
    if (oRes.error) toast.error(oRes.error.message);
    setOffers(oRes.data ?? []);
    setTitles(tRes.data ?? []);
    setLoading(false);
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  function resetForm() {
    setForm({ ...EMPTY_FORM });
    setEditingId(null);
  }

  function openEdit(o: Offer) {
    setEditingId(o.id);
    setForm({
      title_id: o.title_id ?? "",
      program_name: o.program_name ?? "",
      rights_scope: typeof o.rights_scope_json === "string" ? o.rights_scope_json : JSON.stringify(o.rights_scope_json ?? ""),
      channel_scope: typeof o.channel_scope_json === "string" ? o.channel_scope_json : JSON.stringify(o.channel_scope_json ?? ""),
      territory_scope: typeof o.territory_scope_json === "string" ? o.territory_scope_json : JSON.stringify(o.territory_scope_json ?? ""),
      term_years: o.term_years ?? 1,
      is_non_exclusive: !!o.is_non_exclusive,
      revenue_model: o.revenue_model ?? "rev_share",
      platform_share_pct: Number(o.platform_share_pct ?? 0),
      streamvista_share_pct: Number(o.streamvista_share_pct ?? 0),
      rights_holder_share_pct: Number(o.rights_holder_share_pct ?? 0),
      termination_notice_days: o.termination_notice_days ?? 30,
      termination_fee_amount: Number(o.termination_fee_amount ?? 0),
      termination_fee_currency: o.termination_fee_currency ?? "INR",
      legal_text_snapshot: o.legal_text_snapshot ?? "",
    });
    setOpenCreate(true);
  }

  async function save(asOffered: boolean) {
    if (!form.title_id || !form.program_name) {
      toast.error("Pick a title and enter a program name");
      return;
    }
    const t = titles.find((x) => x.id === form.title_id);
    if (!t) { toast.error("Title not found"); return; }
    const payload: any = {
      title_id: form.title_id,
      workspace_id: t.workspace_id,
      creator_user_id: t.creator_user_id,
      program_name: form.program_name,
      rights_scope_json: { description: form.rights_scope },
      channel_scope_json: { description: form.channel_scope },
      territory_scope_json: { description: form.territory_scope },
      term_years: Number(form.term_years) || null,
      is_non_exclusive: !!form.is_non_exclusive,
      revenue_model: form.revenue_model,
      platform_share_pct: Number(form.platform_share_pct) || 0,
      streamvista_share_pct: Number(form.streamvista_share_pct) || 0,
      rights_holder_share_pct: Number(form.rights_holder_share_pct) || 0,
      termination_notice_days: Number(form.termination_notice_days) || 0,
      termination_fee_amount: Number(form.termination_fee_amount) || 0,
      termination_fee_currency: form.termination_fee_currency,
      legal_text_snapshot: form.legal_text_snapshot || null,
      status: asOffered ? "offered" : "draft",
      offered_at: asOffered ? new Date().toISOString() : null,
    };
    setBusy("save");
    let res;
    if (editingId) {
      res = await sb.from("distribution_program_offers").update(payload).eq("id", editingId).select().single();
    } else {
      const { data: { user } } = await sb.auth.getUser();
      res = await sb.from("distribution_program_offers").insert({ ...payload, offered_by_admin: user?.id ?? null }).select().single();
    }
    setBusy(null);
    if (res.error) { toast.error(res.error.message); return; }
    toast.success(asOffered ? "Offer issued to creator" : "Draft saved");
    if (asOffered && t.creator_user_id) {
      await notify(t.creator_user_id, "offer_issued",
        `Distribution offer issued: ${form.program_name}`,
        `An offer for "${t.title}" is awaiting your review in Storage & Billing → Distribution Offers.`);
    }
    setOpenCreate(false);
    resetForm();
    await load();
  }

  async function transition(o: Offer, next: OfferStatus) {
    setBusy(o.id);
    const stamp: any = { status: next };
    if (next === "offered") stamp.offered_at = new Date().toISOString();
    if (next === "cancelled") stamp.rejected_at = new Date().toISOString();
    const { error } = await sb.from("distribution_program_offers").update(stamp).eq("id", o.id);
    setBusy(null);
    if (error) { toast.error(error.message); return; }
    toast.success(`Marked ${next}`);
    if (next === "offered" && o.creator_user_id) {
      await notify(o.creator_user_id, "offer_issued",
        `Distribution offer issued: ${o.program_name}`,
        `An offer is awaiting your review.`);
    }
    if (next === "cancelled" && o.creator_user_id) {
      await notify(o.creator_user_id, "offer_rejected",
        `Offer withdrawn: ${o.program_name}`,
        `Admin withdrew this offer.`);
    }
    await load();
  }

  const stats = useMemo(() => {
    const s: Record<string, number> = { draft: 0, offered: 0, accepted: 0, rejected: 0, expired: 0, cancelled: 0 };
    for (const o of offers) s[o.status] = (s[o.status] ?? 0) + 1;
    return s;
  }, [offers]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Distribution Program Offers</h2>
          <p className="text-xs text-muted-foreground">Author, issue and track distribution offers to creators.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={load}><RefreshCw className="w-3.5 h-3.5 mr-1.5" />Refresh</Button>
          <Button size="sm" onClick={() => { resetForm(); setOpenCreate(true); }}><Plus className="w-3.5 h-3.5 mr-1.5" />New offer</Button>
        </div>
      </div>

      <div className="grid grid-cols-3 md:grid-cols-6 gap-2 text-xs">
        {Object.entries(stats).map(([k, v]) => (
          <div key={k} className="rounded-lg border border-border/40 p-2.5">
            <div className="text-muted-foreground uppercase tracking-wider text-[10px]">{k}</div>
            <div className="text-lg font-semibold mt-0.5">{v}</div>
          </div>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-10"><Loader2 className="w-4 h-4 animate-spin" /></div>
      ) : offers.length === 0 ? (
        <p className="text-sm text-muted-foreground py-6 text-center">No offers yet.</p>
      ) : (
        <div className="overflow-auto rounded-lg border border-border/40">
          <table className="w-full text-sm">
            <thead className="bg-muted/30 text-xs uppercase tracking-wider text-muted-foreground">
              <tr><th className="text-left p-2.5">Program</th><th className="text-left p-2.5">Title</th><th className="text-left p-2.5">Status</th><th className="text-left p-2.5">Term</th><th className="text-left p-2.5">Splits</th><th className="text-right p-2.5">Actions</th></tr>
            </thead>
            <tbody>
              {offers.map((o) => {
                const t = titles.find((x) => x.id === o.title_id);
                return (
                  <tr key={o.id} className="border-t border-border/30">
                    <td className="p-2.5"><div className="font-medium">{o.program_name}</div><div className="text-[10px] text-muted-foreground">{new Date(o.created_at).toLocaleDateString()}</div></td>
                    <td className="p-2.5">{t?.title ?? "—"}</td>
                    <td className="p-2.5"><Badge variant="outline" className={STATUS_COLOR[o.status]}>{o.status}</Badge></td>
                    <td className="p-2.5">{o.term_years ?? "—"} yrs{o.is_non_exclusive ? " · non-excl" : " · excl"}</td>
                    <td className="p-2.5 text-xs">P {Number(o.platform_share_pct ?? 0)}% · SV {Number(o.streamvista_share_pct ?? 0)}% · RH {Number(o.rights_holder_share_pct ?? 0)}%</td>
                    <td className="p-2.5 text-right space-x-1">
                      {o.status === "draft" && (
                        <>
                          <Button size="sm" variant="outline" onClick={() => openEdit(o)} disabled={busy === o.id}><FileEdit className="w-3 h-3 mr-1" />Edit</Button>
                          <Button size="sm" onClick={() => transition(o, "offered")} disabled={busy === o.id}><Send className="w-3 h-3 mr-1" />Issue</Button>
                        </>
                      )}
                      {o.status === "offered" && (
                        <Button size="sm" variant="outline" onClick={() => transition(o, "cancelled")} disabled={busy === o.id}><Ban className="w-3 h-3 mr-1" />Withdraw</Button>
                      )}
                      {o.status === "accepted" && <span className="inline-flex items-center text-emerald-600 text-xs"><CheckCircle2 className="w-3 h-3 mr-1" />Accepted {o.accepted_at && new Date(o.accepted_at).toLocaleDateString()}</span>}
                      {o.status === "rejected" && <span className="inline-flex items-center text-red-600 text-xs"><XCircle className="w-3 h-3 mr-1" />Rejected {o.rejected_at && new Date(o.rejected_at).toLocaleDateString()}</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={openCreate} onOpenChange={(v) => { setOpenCreate(v); if (!v) resetForm(); }}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editingId ? "Edit offer" : "New distribution offer"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Title</Label>
              <Select value={form.title_id} onValueChange={(v) => setForm((f) => ({ ...f, title_id: v }))}>
                <SelectTrigger><SelectValue placeholder="Pick a title" /></SelectTrigger>
                <SelectContent>{titles.map((t) => <SelectItem key={t.id} value={t.id}>{t.title}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Program name</Label><Input value={form.program_name} onChange={(e) => setForm((f) => ({ ...f, program_name: e.target.value }))} placeholder="e.g. India SVOD 24mo" /></div>
            <div className="grid grid-cols-3 gap-2">
              <div><Label>Rights scope</Label><Input value={form.rights_scope} onChange={(e) => setForm((f) => ({ ...f, rights_scope: e.target.value }))} /></div>
              <div><Label>Channel scope</Label><Input value={form.channel_scope} onChange={(e) => setForm((f) => ({ ...f, channel_scope: e.target.value }))} /></div>
              <div><Label>Territory</Label><Input value={form.territory_scope} onChange={(e) => setForm((f) => ({ ...f, territory_scope: e.target.value }))} /></div>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div><Label>Term (years)</Label><Input type="number" value={form.term_years} onChange={(e) => setForm((f) => ({ ...f, term_years: Number(e.target.value) }))} /></div>
              <div><Label>Exclusivity</Label>
                <Select value={form.is_non_exclusive ? "non" : "ex"} onValueChange={(v) => setForm((f) => ({ ...f, is_non_exclusive: v === "non" }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="non">Non-exclusive</SelectItem><SelectItem value="ex">Exclusive</SelectItem></SelectContent>
                </Select>
              </div>
              <div><Label>Revenue model</Label>
                <Select value={form.revenue_model} onValueChange={(v) => setForm((f) => ({ ...f, revenue_model: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="rev_share">Revenue share</SelectItem>
                    <SelectItem value="flat_fee">Flat fee</SelectItem>
                    <SelectItem value="mg_plus_share">MG + share</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div><Label>Platform %</Label><Input type="number" value={form.platform_share_pct} onChange={(e) => setForm((f) => ({ ...f, platform_share_pct: Number(e.target.value) }))} /></div>
              <div><Label>StreamVista %</Label><Input type="number" value={form.streamvista_share_pct} onChange={(e) => setForm((f) => ({ ...f, streamvista_share_pct: Number(e.target.value) }))} /></div>
              <div><Label>Rights holder %</Label><Input type="number" value={form.rights_holder_share_pct} onChange={(e) => setForm((f) => ({ ...f, rights_holder_share_pct: Number(e.target.value) }))} /></div>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div><Label>Notice (days)</Label><Input type="number" value={form.termination_notice_days} onChange={(e) => setForm((f) => ({ ...f, termination_notice_days: Number(e.target.value) }))} /></div>
              <div><Label>Termination fee</Label><Input type="number" value={form.termination_fee_amount} onChange={(e) => setForm((f) => ({ ...f, termination_fee_amount: Number(e.target.value) }))} /></div>
              <div><Label>Currency</Label><Input value={form.termination_fee_currency} onChange={(e) => setForm((f) => ({ ...f, termination_fee_currency: e.target.value }))} /></div>
            </div>
            <div><Label>Legal terms (snapshot shown to creator)</Label><Textarea rows={4} value={form.legal_text_snapshot} onChange={(e) => setForm((f) => ({ ...f, legal_text_snapshot: e.target.value }))} /></div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => save(false)} disabled={busy === "save"}>Save draft</Button>
            <Button onClick={() => save(true)} disabled={busy === "save"}>{busy === "save" ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save & issue"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
