import { useEffect, useMemo, useState } from "react";
import { Loader2, RefreshCw, FileText, Layers, ShieldAlert, Plus, Save, Link2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";

type Title = {
  id: string;
  title: string;
  owner_user_id: string;
  status: string;
  language: string | null;
};

type Profile = {
  id?: string;
  title_id: string;
  owner_user_id: string;
  commercial_status: string;
  available_for_screeners: boolean;
  available_for_nonexclusive_license: boolean;
  available_for_exclusive_license: boolean;
  available_for_acquisition: boolean;
  available_for_distribution_partnership: boolean;
  rights_status_summary: string | null;
  legal_clearance_summary: string | null;
  delivery_readiness_summary: string | null;
  chain_of_title_notes: string | null;
  buyer_facing_summary: string | null;
  admin_internal_notes: string | null;
  published_to_buyers: boolean;
};

type Rights = {
  id: string;
  title_id: string;
  right_category: string;
  territory: string;
  language: string;
  exclusivity: string;
  status: string;
  term_start: string | null;
  term_end: string | null;
  notes: string | null;
  committed_deal_id: string | null;
};

type Deal = {
  id: string;
  memo_number: string;
  title_id: string;
  buyer_user_id: string | null;
  buyer_org_name: string | null;
  commercial_request_id: string | null;
  deal_type: string;
  status: string;
  right_category: string | null;
  territory: string | null;
  language: string | null;
  exclusivity: string | null;
  term_start: string | null;
  term_end: string | null;
  amount_paise: number | null;
  currency: string;
  payment_terms: string | null;
  internal_notes: string | null;
  buyer_facing_memo: string | null;
  created_at: string;
};

type Request = {
  id: string;
  request_type: string;
  state: string;
  buyer_user_id: string;
  title_id: string | null;
  title_query: string | null;
  message: string | null;
  created_at: string;
};

const COMMERCIAL_STATUSES = ["not_open", "screening_only", "licensing_open", "acquisition_open", "invite_only", "internal_hold"];
const RIGHT_CATEGORIES = ["screening", "digital_ott", "satellite_tv", "theatrical", "airline_nontheatrical", "remake_adaptation", "dubbing_derivative", "distribution_representation", "acquisition"];
const EXCLUSIVITIES = ["exclusive", "non_exclusive", "hold", "unavailable"];
const RIGHT_STATUSES = ["available", "hold", "sold", "blocked"];
const DEAL_TYPES = ["licensing", "screener", "acquisition", "distribution_representation", "rights_information"];
const DEAL_STATUSES = ["draft", "screening_requested", "screening_shared", "negotiating", "offer_sent", "won", "lost", "expired", "cancelled"];

export default function TitleCommercialOpsConsole() {
  const [titles, setTitles] = useState<Title[]>([]);
  const [profilesByTitle, setProfilesByTitle] = useState<Record<string, Profile>>({});
  const [dealCounts, setDealCounts] = useState<Record<string, { active: number; won: number; total: number }>>({});
  const [requestCounts, setRequestCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedTitle, setSelectedTitle] = useState<Title | null>(null);

  const load = async () => {
    setLoading(true);
    const [tRes, pRes, dRes, rRes] = await Promise.all([
      supabase.from("content_titles").select("id,title,owner_user_id,status,language").order("created_at", { ascending: false }).limit(200),
      (supabase as any).rpc("admin_list_title_commercial_profiles"),
      (supabase as any).from("deal_memos").select("id,title_id,status"),
      supabase.from("commercial_requests").select("id,title_id"),
    ]);
    setLoading(false);
    if (tRes.error) return toast.error(tRes.error.message);
    setTitles((tRes.data as Title[]) ?? []);
    const pMap: Record<string, Profile> = {};
    (pRes.data ?? []).forEach((p: Profile) => { pMap[p.title_id] = p; });
    setProfilesByTitle(pMap);
    const dMap: Record<string, { active: number; won: number; total: number }> = {};
    (dRes.data ?? []).forEach((d: { title_id: string; status: string }) => {
      const e = (dMap[d.title_id] ??= { active: 0, won: 0, total: 0 });
      e.total += 1;
      if (d.status === "won") e.won += 1;
      else if (!["lost", "expired", "cancelled"].includes(d.status)) e.active += 1;
    });
    setDealCounts(dMap);
    const rMap: Record<string, number> = {};
    (rRes.data ?? []).forEach((r: { title_id: string | null }) => {
      if (r.title_id) rMap[r.title_id] = (rMap[r.title_id] ?? 0) + 1;
    });
    setRequestCounts(rMap);
  };

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return titles;
    return titles.filter(t => t.title.toLowerCase().includes(q));
  }, [titles, search]);

  return (
    <section className="rounded-2xl border border-border/40 bg-secondary/5 p-5 space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-2xl font-bold flex items-center gap-2">
            <Layers className="w-5 h-5" /> Title Commercial Ops
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Package each title: commercial status, rights availability matrix, buyer demand and deal memos.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Input placeholder="Search titles…" value={search} onChange={e => setSearch(e.target.value)} className="h-9 w-56" />
          <Button size="sm" variant="outline" onClick={load}>
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="py-10 grid place-items-center"><Loader2 className="w-5 h-5 animate-spin text-accent" /></div>
      ) : filtered.length === 0 ? (
        <div className="p-8 text-center text-xs text-muted-foreground">No titles.</div>
      ) : (
        <div className="rounded-xl border border-border/40 bg-background/40 divide-y divide-border/40 max-h-[600px] overflow-y-auto">
          {filtered.map(t => {
            const p = profilesByTitle[t.id];
            const dc = dealCounts[t.id] ?? { active: 0, won: 0, total: 0 };
            const rc = requestCounts[t.id] ?? 0;
            const ready = !!p && p.commercial_status !== "not_open";
            return (
              <div key={t.id} className="p-3 flex flex-wrap items-center justify-between gap-3 hover:bg-secondary/10">
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium truncate">{t.title}</div>
                  <div className="text-[10px] text-muted-foreground mt-0.5 flex flex-wrap gap-2">
                    <span>status: {t.status}</span>
                    {t.language && <span>· {t.language}</span>}
                    <span>· owner {t.owner_user_id.slice(0, 8)}…</span>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 flex-wrap">
                  <Badge variant="outline" className={ready ? "border-emerald-500/40 text-emerald-300" : "border-border/60 text-muted-foreground"}>
                    {p?.commercial_status ?? "not_open"}
                  </Badge>
                  {rc > 0 && <Badge variant="outline" className="border-sky-500/40 text-sky-300">{rc} req</Badge>}
                  {dc.active > 0 && <Badge variant="outline" className="border-amber-500/40 text-amber-300">{dc.active} active deal</Badge>}
                  {dc.won > 0 && <Badge variant="outline" className="border-emerald-500/40 text-emerald-300">{dc.won} won</Badge>}
                  {!p && <Badge variant="outline" className="border-orange-500/40 text-orange-300">no profile</Badge>}
                  <Button size="sm" variant="outline" onClick={() => setSelectedTitle(t)}>Open</Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {selectedTitle && (
        <TitleCommercialDialog
          title={selectedTitle}
          initialProfile={profilesByTitle[selectedTitle.id] ?? null}
          onClose={() => setSelectedTitle(null)}
          onSaved={() => { load(); }}
        />
      )}
    </section>
  );
}

function TitleCommercialDialog({
  title, initialProfile, onClose, onSaved,
}: { title: Title; initialProfile: Profile | null; onClose: () => void; onSaved: () => void }) {
  const [profile, setProfile] = useState<Profile>(() => initialProfile ?? {
    title_id: title.id,
    owner_user_id: title.owner_user_id,
    commercial_status: "not_open",
    available_for_screeners: false,
    available_for_nonexclusive_license: false,
    available_for_exclusive_license: false,
    available_for_acquisition: false,
    available_for_distribution_partnership: false,
    rights_status_summary: null,
    legal_clearance_summary: null,
    delivery_readiness_summary: null,
    chain_of_title_notes: null,
    buyer_facing_summary: null,
    admin_internal_notes: null,
    published_to_buyers: false,
  });
  const [savingProfile, setSavingProfile] = useState(false);

  const [rights, setRights] = useState<Rights[]>([]);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [requests, setRequests] = useState<Request[]>([]);
  const [loading, setLoading] = useState(false);
  const [dealDialog, setDealDialog] = useState<{ from?: Request } | null>(null);

  const load = async () => {
    setLoading(true);
    const [rRes, dRes, reqRes] = await Promise.all([
      (supabase as any).from("title_rights_availability").select("*").eq("title_id", title.id).order("right_category"),
      (supabase as any).from("deal_memos").select("*").eq("title_id", title.id).order("created_at", { ascending: false }),
      supabase.from("commercial_requests").select("*").eq("title_id", title.id).order("created_at", { ascending: false }),
    ]);
    setLoading(false);
    setRights((rRes.data as Rights[]) ?? []);
    setDeals((dRes.data as Deal[]) ?? []);
    setRequests((reqRes.data as unknown as Request[]) ?? []);
  };
  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  const saveProfile = async () => {
    setSavingProfile(true);
    const payload = { ...profile };
    const { error } = await (supabase as any)
      .from("title_commercial_profiles")
      .upsert(payload, { onConflict: "title_id" });
    setSavingProfile(false);
    if (error) return toast.error(error.message);
    toast.success("Commercial profile saved");
    onSaved();
  };

  return (
    <Dialog open={true} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display text-xl">{title.title}</DialogTitle>
          <p className="text-xs text-muted-foreground">Commercial cockpit for this title — admin only.</p>
        </DialogHeader>

        <Tabs defaultValue="profile">
          <TabsList className="grid grid-cols-4 w-full">
            <TabsTrigger value="profile">Profile</TabsTrigger>
            <TabsTrigger value="rights">Rights ({rights.length})</TabsTrigger>
            <TabsTrigger value="requests">Demand ({requests.length})</TabsTrigger>
            <TabsTrigger value="deals">Deals ({deals.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="profile" className="mt-4 space-y-3">
            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Commercial status</Label>
                <Select value={profile.commercial_status} onValueChange={v => setProfile(p => ({ ...p, commercial_status: v }))}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>{COMMERCIAL_STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="flex items-end">
                <label className="flex items-center gap-2 text-xs">
                  <input type="checkbox" checked={profile.published_to_buyers} onChange={e => setProfile(p => ({ ...p, published_to_buyers: e.target.checked }))} />
                  Visible to buyers
                </label>
              </div>
            </div>

            <div className="grid sm:grid-cols-2 gap-2 text-xs">
              {([
                ["available_for_screeners", "Screeners"],
                ["available_for_nonexclusive_license", "Non-exclusive license"],
                ["available_for_exclusive_license", "Exclusive license"],
                ["available_for_acquisition", "Acquisition"],
                ["available_for_distribution_partnership", "Distribution partnership"],
              ] as const).map(([k, label]) => (
                <label key={k} className="flex items-center gap-2 rounded border border-border/40 bg-background/40 p-2">
                  <input type="checkbox" checked={profile[k] as boolean} onChange={e => setProfile(p => ({ ...p, [k]: e.target.checked }))} />
                  {label}
                </label>
              ))}
            </div>

            <div className="grid sm:grid-cols-2 gap-3">
              <Field label="Rights status summary"><Textarea rows={2} value={profile.rights_status_summary ?? ""} onChange={e => setProfile(p => ({ ...p, rights_status_summary: e.target.value }))} /></Field>
              <Field label="Legal clearance"><Textarea rows={2} value={profile.legal_clearance_summary ?? ""} onChange={e => setProfile(p => ({ ...p, legal_clearance_summary: e.target.value }))} /></Field>
              <Field label="Delivery readiness"><Textarea rows={2} value={profile.delivery_readiness_summary ?? ""} onChange={e => setProfile(p => ({ ...p, delivery_readiness_summary: e.target.value }))} /></Field>
              <Field label="Chain of title notes"><Textarea rows={2} value={profile.chain_of_title_notes ?? ""} onChange={e => setProfile(p => ({ ...p, chain_of_title_notes: e.target.value }))} /></Field>
              <Field label="Buyer-facing summary"><Textarea rows={2} value={profile.buyer_facing_summary ?? ""} onChange={e => setProfile(p => ({ ...p, buyer_facing_summary: e.target.value }))} /></Field>
              <Field label="Admin internal notes"><Textarea rows={2} value={profile.admin_internal_notes ?? ""} onChange={e => setProfile(p => ({ ...p, admin_internal_notes: e.target.value }))} /></Field>
            </div>

            <div className="flex justify-end">
              <Button size="sm" disabled={savingProfile} onClick={saveProfile}>
                {savingProfile ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <Save className="w-3.5 h-3.5 mr-1" />}
                Save profile
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="rights" className="mt-4">
            <RightsTab titleId={title.id} rights={rights} onReload={load} />
          </TabsContent>

          <TabsContent value="requests" className="mt-4">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : requests.length === 0 ? (
              <p className="text-xs text-muted-foreground">No buyer requests linked to this title.</p>
            ) : (
              <div className="space-y-2">
                {requests.map(r => (
                  <div key={r.id} className="rounded-lg border border-border/40 bg-background/40 p-3 text-xs">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <Badge variant="outline">{r.request_type}</Badge>
                        <span className="ml-2 text-muted-foreground">{r.state}</span>
                      </div>
                      <Button size="sm" variant="outline" onClick={() => setDealDialog({ from: r })}>
                        <Plus className="w-3 h-3 mr-1" /> Create deal memo
                      </Button>
                    </div>
                    <div className="text-muted-foreground mt-1">Buyer {r.buyer_user_id.slice(0, 8)}… · {new Date(r.created_at).toLocaleString()}</div>
                    {r.message && <p className="mt-2 whitespace-pre-wrap">{r.message}</p>}
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="deals" className="mt-4 space-y-3">
            <div className="flex justify-end">
              <Button size="sm" onClick={() => setDealDialog({})}><Plus className="w-3.5 h-3.5 mr-1" /> New deal memo</Button>
            </div>
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : deals.length === 0 ? (
              <p className="text-xs text-muted-foreground">No deal memos yet for this title.</p>
            ) : (
              <div className="space-y-2">
                {deals.map(d => <DealRow key={d.id} deal={d} onChanged={load} />)}
              </div>
            )}
          </TabsContent>
        </Tabs>

        <DialogFooter><Button variant="outline" onClick={onClose}>Close</Button></DialogFooter>

        {dealDialog && (
          <DealMemoDialog
            title={title}
            fromRequest={dealDialog.from}
            onClose={() => setDealDialog(null)}
            onSaved={() => { setDealDialog(null); load(); onSaved(); }}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><Label className="text-xs">{label}</Label>{children}</div>;
}

function RightsTab({ titleId, rights, onReload }: { titleId: string; rights: Rights[]; onReload: () => void }) {
  const [draft, setDraft] = useState({
    right_category: "digital_ott", territory: "worldwide", language: "original",
    exclusivity: "non_exclusive", status: "available", notes: "",
  });
  const [busy, setBusy] = useState(false);

  const add = async () => {
    setBusy(true);
    const { error } = await (supabase as any).from("title_rights_availability").insert({ title_id: titleId, ...draft });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Rights slice added");
    setDraft(d => ({ ...d, notes: "" }));
    onReload();
  };

  const updateRow = async (id: string, patch: Partial<Rights>) => {
    const { error } = await (supabase as any).from("title_rights_availability").update(patch).eq("id", id);
    if (error) return toast.error(error.message);
    onReload();
  };

  const del = async (id: string) => {
    if (!confirm("Delete this rights slice?")) return;
    const { error } = await (supabase as any).from("title_rights_availability").delete().eq("id", id);
    if (error) return toast.error(error.message);
    onReload();
  };

  return (
    <div className="space-y-3">
      <div className="rounded-lg border border-border/40 bg-background/40 p-3">
        <div className="text-xs font-medium mb-2">Add rights slice</div>
        <div className="grid sm:grid-cols-3 gap-2">
          <SelectField label="Category" value={draft.right_category} onChange={v => setDraft(d => ({ ...d, right_category: v }))} options={RIGHT_CATEGORIES} />
          <Field label="Territory"><Input className="h-9" value={draft.territory} onChange={e => setDraft(d => ({ ...d, territory: e.target.value }))} /></Field>
          <Field label="Language"><Input className="h-9" value={draft.language} onChange={e => setDraft(d => ({ ...d, language: e.target.value }))} /></Field>
          <SelectField label="Exclusivity" value={draft.exclusivity} onChange={v => setDraft(d => ({ ...d, exclusivity: v }))} options={EXCLUSIVITIES} />
          <SelectField label="Status" value={draft.status} onChange={v => setDraft(d => ({ ...d, status: v }))} options={RIGHT_STATUSES} />
          <Field label="Notes"><Input className="h-9" value={draft.notes} onChange={e => setDraft(d => ({ ...d, notes: e.target.value }))} /></Field>
        </div>
        <div className="flex justify-end mt-2">
          <Button size="sm" onClick={add} disabled={busy}><Plus className="w-3.5 h-3.5 mr-1" /> Add</Button>
        </div>
      </div>

      {rights.length === 0 ? (
        <p className="text-xs text-muted-foreground">No rights slices defined yet.</p>
      ) : (
        <div className="rounded-lg border border-border/40 overflow-hidden">
          <table className="w-full text-xs">
            <thead className="bg-secondary/20">
              <tr><th className="p-2 text-left">Category</th><th className="p-2 text-left">Territory</th><th className="p-2 text-left">Language</th><th className="p-2 text-left">Excl.</th><th className="p-2 text-left">Status</th><th className="p-2 text-left">Notes</th><th></th></tr>
            </thead>
            <tbody>
              {rights.map(r => (
                <tr key={r.id} className="border-t border-border/30">
                  <td className="p-2">{r.right_category}</td>
                  <td className="p-2">{r.territory}</td>
                  <td className="p-2">{r.language}</td>
                  <td className="p-2">{r.exclusivity}</td>
                  <td className="p-2">
                    <Select value={r.status} onValueChange={v => updateRow(r.id, { status: v })}>
                      <SelectTrigger className="h-7 w-28 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>{RIGHT_STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                    </Select>
                  </td>
                  <td className="p-2 text-muted-foreground">{r.notes ?? ""}{r.committed_deal_id && <span className="ml-1 text-emerald-400">· deal</span>}</td>
                  <td className="p-2"><Button size="sm" variant="ghost" onClick={() => del(r.id)}>×</Button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function SelectField({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: string[] }) {
  return (
    <div>
      <Label className="text-xs">{label}</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
        <SelectContent>{options.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent>
      </Select>
    </div>
  );
}

function DealRow({ deal, onChanged }: { deal: Deal; onChanged: () => void }) {
  const [busy, setBusy] = useState(false);

  const setStatus = async (status: string) => {
    if (["won", "lost", "expired", "cancelled"].includes(status)) {
      setBusy(true);
      // Conflict check for win + exclusive
      if (status === "won" && deal.exclusivity === "exclusive" && deal.right_category) {
        const { data: conf } = await (supabase as any).rpc("deal_memo_check_conflict", { _deal_id: deal.id });
        const c = Array.isArray(conf) ? conf[0] : conf;
        if (c && c.conflict_count > 0) {
          if (!confirm(`Conflict: ${c.conflict_count} other active exclusive deal(s) on the same slice (e.g. ${c.sample_memo}). Continue?`)) {
            setBusy(false); return;
          }
        }
      }
      const { error } = await (supabase as any).rpc("admin_close_deal_memo", { _deal_id: deal.id, _status: status });
      setBusy(false);
      if (error) return toast.error(error.message);
      toast.success(`Deal ${status}`);
    } else {
      setBusy(true);
      const { error } = await (supabase as any).from("deal_memos").update({ status }).eq("id", deal.id);
      setBusy(false);
      if (error) return toast.error(error.message);
    }
    onChanged();
  };

  return (
    <div className="rounded-lg border border-border/40 bg-background/40 p-3 text-xs space-y-1">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <code className="font-mono">{deal.memo_number}</code>
          <Badge variant="outline">{deal.deal_type}</Badge>
          {deal.exclusivity === "exclusive" && <Badge variant="outline" className="border-amber-500/40 text-amber-300">exclusive</Badge>}
        </div>
        <Select value={deal.status} onValueChange={setStatus} disabled={busy}>
          <SelectTrigger className="h-7 w-40 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>{DEAL_STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
        </Select>
      </div>
      <div className="text-muted-foreground">
        {deal.buyer_org_name ?? (deal.buyer_user_id ? `Buyer ${deal.buyer_user_id.slice(0, 8)}…` : "—")}
        {deal.right_category && <> · {deal.right_category}</>}
        {deal.territory && <> · {deal.territory}</>}
        {deal.language && <> · {deal.language}</>}
        {deal.amount_paise && <> · ₹{(deal.amount_paise / 100).toLocaleString("en-IN")}</>}
      </div>
      {deal.internal_notes && <p className="text-muted-foreground italic">{deal.internal_notes}</p>}
    </div>
  );
}

function DealMemoDialog({
  title, fromRequest, onClose, onSaved,
}: { title: Title; fromRequest?: Request; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({
    deal_type: (fromRequest?.request_type as string) || "licensing",
    status: "draft",
    buyer_user_id: fromRequest?.buyer_user_id ?? "",
    buyer_org_name: "",
    buyer_contact_email: "",
    commercial_request_id: fromRequest?.id ?? "",
    right_category: "digital_ott",
    territory: "worldwide",
    language: "original",
    exclusivity: "non_exclusive",
    term_start: "",
    term_end: "",
    amount_inr: "",
    payment_terms: "",
    internal_notes: fromRequest?.message ? `From request: ${fromRequest.message}` : "",
    buyer_facing_memo: "",
  });
  const [busy, setBusy] = useState(false);

  const validTypes = ["licensing", "screener", "acquisition", "distribution_representation", "rights_information"];
  const normalizedDealType = validTypes.includes(form.deal_type) ? form.deal_type : "licensing";

  const save = async () => {
    setBusy(true);
    const payload = {
      title_id: title.id,
      deal_type: normalizedDealType,
      status: form.status,
      buyer_user_id: form.buyer_user_id || null,
      buyer_org_name: form.buyer_org_name || null,
      buyer_contact_email: form.buyer_contact_email || null,
      commercial_request_id: form.commercial_request_id || null,
      right_category: form.right_category,
      territory: form.territory,
      language: form.language,
      exclusivity: form.exclusivity,
      term_start: form.term_start || null,
      term_end: form.term_end || null,
      amount_paise: form.amount_inr ? Math.round(Number(form.amount_inr) * 100) : null,
      payment_terms: form.payment_terms || null,
      internal_notes: form.internal_notes || null,
      buyer_facing_memo: form.buyer_facing_memo || null,
    };
    const { error } = await (supabase as any).from("deal_memos").insert(payload);
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Deal memo created");
    onSaved();
  };

  return (
    <Dialog open={true} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>New deal memo · {title.title}</DialogTitle></DialogHeader>
        <div className="grid sm:grid-cols-2 gap-3 text-sm">
          <SelectField label="Deal type" value={normalizedDealType} onChange={v => setForm(f => ({ ...f, deal_type: v }))} options={DEAL_TYPES} />
          <SelectField label="Status" value={form.status} onChange={v => setForm(f => ({ ...f, status: v }))} options={DEAL_STATUSES} />
          <Field label="Buyer user UUID (optional)"><Input value={form.buyer_user_id} onChange={e => setForm(f => ({ ...f, buyer_user_id: e.target.value }))} /></Field>
          <Field label="Buyer org name"><Input value={form.buyer_org_name} onChange={e => setForm(f => ({ ...f, buyer_org_name: e.target.value }))} /></Field>
          <Field label="Buyer contact email"><Input value={form.buyer_contact_email} onChange={e => setForm(f => ({ ...f, buyer_contact_email: e.target.value }))} /></Field>
          <SelectField label="Right category" value={form.right_category} onChange={v => setForm(f => ({ ...f, right_category: v }))} options={RIGHT_CATEGORIES} />
          <Field label="Territory"><Input value={form.territory} onChange={e => setForm(f => ({ ...f, territory: e.target.value }))} /></Field>
          <Field label="Language"><Input value={form.language} onChange={e => setForm(f => ({ ...f, language: e.target.value }))} /></Field>
          <SelectField label="Exclusivity" value={form.exclusivity} onChange={v => setForm(f => ({ ...f, exclusivity: v }))} options={EXCLUSIVITIES} />
          <Field label="Amount (INR)"><Input type="number" value={form.amount_inr} onChange={e => setForm(f => ({ ...f, amount_inr: e.target.value }))} /></Field>
          <Field label="Term start"><Input type="date" value={form.term_start} onChange={e => setForm(f => ({ ...f, term_start: e.target.value }))} /></Field>
          <Field label="Term end"><Input type="date" value={form.term_end} onChange={e => setForm(f => ({ ...f, term_end: e.target.value }))} /></Field>
          <div className="sm:col-span-2"><Field label="Payment terms"><Input value={form.payment_terms} onChange={e => setForm(f => ({ ...f, payment_terms: e.target.value }))} /></Field></div>
          <div className="sm:col-span-2"><Field label="Internal notes"><Textarea rows={2} value={form.internal_notes} onChange={e => setForm(f => ({ ...f, internal_notes: e.target.value }))} /></Field></div>
          <div className="sm:col-span-2"><Field label="Buyer-facing memo"><Textarea rows={2} value={form.buyer_facing_memo} onChange={e => setForm(f => ({ ...f, buyer_facing_memo: e.target.value }))} /></Field></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={save} disabled={busy}>{busy ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <FileText className="w-3.5 h-3.5 mr-1" />}Create memo</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
