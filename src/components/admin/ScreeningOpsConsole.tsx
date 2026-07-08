import { useEffect, useMemo, useState } from "react";
import { Loader2, RefreshCw, Plus, Film, Shield, Copy, Ban, Clock, ExternalLink, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";

type Title = { id: string; title: string; language: string | null };
type Asset = {
  id: string; title_id: string; label: string; source_kind: string;
  upload_id: string | null; external_url: string | null;
  duration_seconds: number | null; mime_type: string | null;
  is_active: boolean; notes: string | null; created_at: string;
};
type Invite = {
  id: string; title_id: string; screening_asset_id: string | null;
  commercial_request_id: string | null; deal_memo_id: string | null;
  buyer_user_id: string | null; invite_email: string; invite_name: string | null;
  buyer_org_name: string | null; token: string; status: string;
  expires_at: string; first_opened_at: string | null; last_viewed_at: string | null;
  view_count: number; max_progress_pct: number; completed: boolean;
  revoked_at: string | null; revoke_reason: string | null;
  nda_required: boolean; watermark_enabled: boolean;
  playback_url: string | null; playback_url_expires_at: string | null;
  notes: string | null; created_at: string;
};

const STATUS_COLORS: Record<string, string> = {
  sent: "bg-blue-500/10 text-blue-600 border-blue-500/30",
  opened: "bg-amber-500/10 text-amber-600 border-amber-500/30",
  viewing: "bg-violet-500/10 text-violet-600 border-violet-500/30",
  completed: "bg-emerald-500/10 text-emerald-600 border-emerald-500/30",
  expired: "bg-muted text-muted-foreground border-border",
  revoked: "bg-red-500/10 text-red-600 border-red-500/30",
  draft: "bg-muted text-muted-foreground border-border",
};

function screeningUrl(token: string) {
  return `${window.location.origin}/screening/${token}`;
}

export default function ScreeningOpsConsole() {
  const [loading, setLoading] = useState(true);
  const [titles, setTitles] = useState<Title[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [filter, setFilter] = useState<string>("all");
  const [shareOpen, setShareOpen] = useState(false);
  const [assetOpen, setAssetOpen] = useState(false);

  const sb = supabase as any;

  async function load() {
    setLoading(true);
    const [t, a, i] = await Promise.all([
      sb.from("content_titles").select("id,title,language").order("created_at", { ascending: false }).limit(500),
      sb.from("title_screening_assets").select("*").order("created_at", { ascending: false }),
      sb.from("screening_invites").select("*").order("created_at", { ascending: false }).limit(500),
    ]);
    if (t.error || a.error || i.error) toast.error("Failed to load screening data");
    setTitles((t.data ?? []) as Title[]);
    setAssets((a.data ?? []) as Asset[]);
    setInvites((i.data ?? []) as Invite[]);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    if (filter === "all") return invites;
    if (filter === "unopened") return invites.filter(i => !i.first_opened_at && i.status !== "revoked" && i.status !== "expired");
    if (filter === "viewed") return invites.filter(i => i.first_opened_at && i.status !== "revoked" && i.status !== "expired");
    return invites.filter(i => i.status === filter);
  }, [invites, filter]);

  async function copyLink(token: string) {
    await navigator.clipboard.writeText(screeningUrl(token));
    toast.success("Screening link copied");
  }
  async function revoke(id: string) {
    const reason = window.prompt("Revoke reason (optional)") || null;
    const { error } = await sb.rpc("admin_revoke_screening_invite", { _invite_id: id, _reason: reason });
    if (error) return toast.error(error.message);
    toast.success("Invite revoked");
    load();
  }
  async function extend(id: string) {
    const days = window.prompt("Extend by how many days?", "7");
    if (!days) return;
    const newExp = new Date(Date.now() + Number(days) * 24 * 60 * 60 * 1000).toISOString();
    const { error } = await sb.rpc("admin_extend_screening_invite", {
      _invite_id: id, _new_expires_at: newExp,
      _new_playback_url: null, _new_playback_url_expires_at: null,
    });
    if (error) return toast.error(error.message);
    toast.success("Expiry extended");
    load();
  }
  async function rotateUrl(id: string) {
    const url = window.prompt("Paste new playback URL (leave blank to auto-mint a 48h Oracle PAR)");
    if (url === null) return;
    if (url.trim() === "") {
      // Auto-mint via Oracle PAR.
      const { data, error } = await sb.functions.invoke("mint-screening-par", { body: { invite_id: id, ttl_hours: 48 } });
      if (error || (data as any)?.error) return toast.error(((data as any)?.error || error?.message) ?? "Mint failed");
      toast.success(`Playback URL minted (${(data as any).source})`);
      load();
      return;
    }
    const exp = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();
    const { error } = await sb.rpc("admin_extend_screening_invite", {
      _invite_id: id, _new_expires_at: null,
      _new_playback_url: url, _new_playback_url_expires_at: exp,
    });
    if (error) return toast.error(error.message);
    toast.success("Playback URL rotated");
    load();
  }
  async function sweep() {
    const { error } = await sb.rpc("sweep_screening_invites_expired");
    if (error) return toast.error(error.message);
    toast.success("Expired invites swept");
    load();
  }

  return (
    <section className="rounded-xl border bg-card">
      <header className="px-5 py-4 border-b flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Film className="w-4 h-4 text-primary" />
          <h3 className="font-semibold">Screening Room — Commercial Screener Operations</h3>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={() => setAssetOpen(true)}>
            <Plus className="w-4 h-4 mr-1" /> Manage Screener Assets
          </Button>
          <Button size="sm" onClick={() => setShareOpen(true)}>
            <Plus className="w-4 h-4 mr-1" /> Share Screener
          </Button>
          <Button size="sm" variant="ghost" onClick={sweep}><Clock className="w-4 h-4 mr-1" /> Sweep expired</Button>
          <Button size="sm" variant="ghost" onClick={load}><RefreshCw className="w-4 h-4" /></Button>
        </div>
      </header>

      <Tabs value={filter} onValueChange={setFilter} className="px-5 pt-4">
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="all">All ({invites.length})</TabsTrigger>
          <TabsTrigger value="unopened">Unopened</TabsTrigger>
          <TabsTrigger value="viewed">Viewed</TabsTrigger>
          <TabsTrigger value="opened">Opened</TabsTrigger>
          <TabsTrigger value="viewing">Viewing</TabsTrigger>
          <TabsTrigger value="completed">Completed</TabsTrigger>
          <TabsTrigger value="expired">Expired</TabsTrigger>
          <TabsTrigger value="revoked">Revoked</TabsTrigger>
        </TabsList>
        <TabsContent value={filter} className="mt-4">
          {loading ? (
            <div className="py-10 text-center text-muted-foreground"><Loader2 className="inline w-4 h-4 animate-spin mr-2" /> Loading…</div>
          ) : filtered.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">No invites in this view.</p>
          ) : (
            <div className="overflow-x-auto pb-5">
              <table className="w-full text-sm">
                <thead className="text-left text-xs text-muted-foreground">
                  <tr className="border-b">
                    <th className="py-2 px-2">Title</th>
                    <th className="px-2">Invitee</th>
                    <th className="px-2">Status</th>
                    <th className="px-2">Sent</th>
                    <th className="px-2">First opened</th>
                    <th className="px-2">Last viewed</th>
                    <th className="px-2">Progress</th>
                    <th className="px-2">Expires</th>
                    <th className="px-2">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((inv) => {
                    const ttl = titles.find(t => t.id === inv.title_id);
                    return (
                      <tr key={inv.id} className="border-b last:border-0 align-top">
                        <td className="py-3 px-2 font-medium">{ttl?.title ?? inv.title_id.slice(0, 8)}</td>
                        <td className="px-2">
                          <div>{inv.invite_email}</div>
                          {inv.buyer_org_name && <div className="text-xs text-muted-foreground">{inv.buyer_org_name}</div>}
                        </td>
                        <td className="px-2"><Badge variant="outline" className={STATUS_COLORS[inv.status]}>{inv.status}</Badge></td>
                        <td className="px-2 text-xs">{new Date(inv.created_at).toLocaleDateString()}</td>
                        <td className="px-2 text-xs">{inv.first_opened_at ? new Date(inv.first_opened_at).toLocaleString() : "—"}</td>
                        <td className="px-2 text-xs">{inv.last_viewed_at ? new Date(inv.last_viewed_at).toLocaleString() : "—"}</td>
                        <td className="px-2 text-xs">
                          {inv.max_progress_pct}% {inv.completed && <CheckCircle2 className="inline w-3 h-3 text-emerald-500" />}
                          {inv.view_count > 0 && <div className="text-muted-foreground">{inv.view_count} opens</div>}
                        </td>
                        <td className="px-2 text-xs">{new Date(inv.expires_at).toLocaleDateString()}</td>
                        <td className="px-2">
                          <div className="flex flex-wrap gap-1">
                            <Button size="icon" variant="ghost" title="Copy link" aria-label="Copy screening invite link" onClick={() => copyLink(inv.token)}><Copy className="w-3.5 h-3.5" aria-hidden="true" /></Button>
                            <Button size="icon" variant="ghost" title="Open" aria-label="Open screening in new tab" onClick={() => window.open(screeningUrl(inv.token), "_blank")}><ExternalLink className="w-3.5 h-3.5" aria-hidden="true" /></Button>
                            <Button size="icon" variant="ghost" title="Extend expiry" aria-label="Extend screening expiry" onClick={() => extend(inv.id)}><Clock className="w-3.5 h-3.5" aria-hidden="true" /></Button>
                            <Button size="icon" variant="ghost" title="Rotate playback URL" aria-label="Rotate playback URL" onClick={() => rotateUrl(inv.id)}><RefreshCw className="w-3.5 h-3.5" aria-hidden="true" /></Button>
                            {inv.status !== "revoked" && (
                              <Button size="icon" variant="ghost" title="Revoke" aria-label="Revoke screening access" onClick={() => revoke(inv.id)}><Ban className="w-3.5 h-3.5 text-red-500" aria-hidden="true" /></Button>
                            )}

                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </TabsContent>
      </Tabs>

      <ShareScreenerDialog
        open={shareOpen}
        onOpenChange={setShareOpen}
        titles={titles}
        assets={assets}
        onCreated={() => { setShareOpen(false); load(); }}
      />
      <ManageAssetsDialog
        open={assetOpen}
        onOpenChange={setAssetOpen}
        titles={titles}
        assets={assets}
        onChange={load}
      />
    </section>
  );
}

function ShareScreenerDialog({
  open, onOpenChange, titles, assets, onCreated,
  defaultTitleId, defaultRequestId, defaultDealId, defaultEmail, defaultBuyerUserId,
}: {
  open: boolean; onOpenChange: (v: boolean) => void;
  titles: Title[]; assets: Asset[]; onCreated: () => void;
  defaultTitleId?: string; defaultRequestId?: string; defaultDealId?: string;
  defaultEmail?: string; defaultBuyerUserId?: string;
}) {
  const [titleId, setTitleId] = useState(defaultTitleId ?? "");
  const [assetId, setAssetId] = useState("");
  const [email, setEmail] = useState(defaultEmail ?? "");
  const [name, setName] = useState("");
  const [org, setOrg] = useState("");
  const [days, setDays] = useState(14);
  const [playbackUrl, setPlaybackUrl] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ url: string } | null>(null);

  useEffect(() => {
    if (open) {
      setTitleId(defaultTitleId ?? "");
      setEmail(defaultEmail ?? "");
      setAssetId("");
      setResult(null);
    }
  }, [open, defaultTitleId, defaultEmail]);

  const titleAssets = assets.filter(a => a.title_id === titleId && a.is_active);

  async function submit() {
    if (!titleId || !email) { toast.error("Title and invitee email required"); return; }
    setSubmitting(true);
    const expires = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
    const { data, error } = await (supabase.rpc as any)("admin_create_screening_invite", {
      _title_id: titleId,
      _screening_asset_id: assetId || null,
      _invite_email: email,
      _invite_name: name || null,
      _buyer_org_name: org || null,
      _buyer_user_id: defaultBuyerUserId ?? null,
      _commercial_request_id: defaultRequestId ?? null,
      _deal_memo_id: defaultDealId ?? null,
      _expires_at: expires,
      _playback_url: playbackUrl || null,
      _playback_url_expires_at: playbackUrl ? expires : null,
      _nda_required: true,
      _max_views: null,
      _notes: notes || null,
    });
    setSubmitting(false);
    if (error) return toast.error(error.message);
    const row = Array.isArray(data) ? data[0] : data;
    const url = screeningUrl(row.token);
    setResult({ url });
    await navigator.clipboard.writeText(url).catch(() => {});
    toast.success("Screening invite created — link copied");
    onCreated();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle className="flex items-center gap-2"><Shield className="w-4 h-4" /> Share screener</DialogTitle></DialogHeader>
        {result ? (
          <div className="space-y-3">
            <p className="text-sm">Send this private screening link to the invitee:</p>
            <div className="p-3 rounded border bg-muted/30 text-xs break-all">{result.url}</div>
            <div className="flex gap-2">
              <Button size="sm" onClick={() => navigator.clipboard.writeText(result.url)}><Copy className="w-4 h-4 mr-1" /> Copy again</Button>
              <Button size="sm" variant="outline" onClick={() => window.open(result.url, "_blank")}><ExternalLink className="w-4 h-4 mr-1" /> Preview</Button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div>
              <Label>Title</Label>
              <Select value={titleId} onValueChange={setTitleId}>
                <SelectTrigger><SelectValue placeholder="Choose title" /></SelectTrigger>
                <SelectContent>
                  {titles.map(t => <SelectItem key={t.id} value={t.id}>{t.title}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Screener asset {titleAssets.length === 0 && <span className="text-xs text-muted-foreground">(none configured — playback URL only)</span>}</Label>
              <Select value={assetId} onValueChange={setAssetId} disabled={!titleId || titleAssets.length === 0}>
                <SelectTrigger><SelectValue placeholder={titleAssets.length === 0 ? "No active screener asset" : "Pick screener asset"} /></SelectTrigger>
                <SelectContent>
                  {titleAssets.map(a => <SelectItem key={a.id} value={a.id}>{a.label} · {a.source_kind}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div><Label>Invitee email</Label><Input value={email} onChange={e => setEmail(e.target.value)} placeholder="buyer@studio.com" /></div>
              <div><Label>Invitee name</Label><Input value={name} onChange={e => setName(e.target.value)} /></div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div><Label>Organisation</Label><Input value={org} onChange={e => setOrg(e.target.value)} /></div>
              <div><Label>Expires in (days)</Label><Input type="number" min={1} value={days} onChange={e => setDays(Number(e.target.value) || 14)} /></div>
            </div>
            <div>
              <Label>Playback URL (signed / PAR)</Label>
              <Input value={playbackUrl} onChange={e => setPlaybackUrl(e.target.value)} placeholder="https://… short-lived signed URL" />
              <p className="text-xs text-muted-foreground mt-1">Paste a short-lived signed/PAR URL for the screener file. Can be rotated later.</p>
            </div>
            <div><Label>Internal notes</Label><Textarea rows={2} value={notes} onChange={e => setNotes(e.target.value)} /></div>
          </div>
        )}
        <DialogFooter>
          {result ? (
            <Button onClick={() => onOpenChange(false)}>Close</Button>
          ) : (
            <>
              <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button onClick={submit} disabled={submitting}>{submitting && <Loader2 className="w-4 h-4 animate-spin mr-2" />} Create invite</Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ManageAssetsDialog({
  open, onOpenChange, titles, assets, onChange,
}: {
  open: boolean; onOpenChange: (v: boolean) => void;
  titles: Title[]; assets: Asset[]; onChange: () => void;
}) {
  const [titleId, setTitleId] = useState("");
  const [label, setLabel] = useState("Screener");
  const [sourceKind, setSourceKind] = useState("uploaded_screener");
  const [externalUrl, setExternalUrl] = useState("");
  const [duration, setDuration] = useState<number | "">("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const sb = supabase as any;

  async function add() {
    if (!titleId) return toast.error("Pick a title");
    setBusy(true);
    const { error } = await sb.from("title_screening_assets").insert({
      title_id: titleId, label, source_kind: sourceKind,
      external_url: externalUrl || null,
      duration_seconds: duration === "" ? null : Number(duration),
      notes: notes || null, is_active: true,
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Screener asset added");
    setLabel("Screener"); setExternalUrl(""); setDuration(""); setNotes("");
    onChange();
  }
  async function toggleActive(a: Asset) {
    const { error } = await sb.from("title_screening_assets").update({ is_active: !a.is_active }).eq("id", a.id);
    if (error) return toast.error(error.message);
    onChange();
  }
  async function remove(a: Asset) {
    if (!window.confirm("Delete this screener asset?")) return;
    const { error } = await sb.from("title_screening_assets").delete().eq("id", a.id);
    if (error) return toast.error(error.message);
    onChange();
  }

  const titleAssets = assets.filter(a => a.title_id === titleId);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader><DialogTitle>Screener assets</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Title</Label>
            <Select value={titleId} onValueChange={setTitleId}>
              <SelectTrigger><SelectValue placeholder="Pick a title" /></SelectTrigger>
              <SelectContent>
                {titles.map(t => <SelectItem key={t.id} value={t.id}>{t.title}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          {titleId && (
            <>
              <div className="border rounded p-3 space-y-3 bg-muted/30">
                <div className="text-xs font-medium text-muted-foreground">Add new screener asset</div>
                <div className="grid grid-cols-2 gap-2">
                  <div><Label>Label</Label><Input value={label} onChange={e => setLabel(e.target.value)} /></div>
                  <div>
                    <Label>Source kind</Label>
                    <Select value={sourceKind} onValueChange={setSourceKind}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="uploaded_screener">Uploaded screener</SelectItem>
                        <SelectItem value="proxy_asset">Proxy asset</SelectItem>
                        <SelectItem value="vault_asset">Vault asset</SelectItem>
                        <SelectItem value="external_source">External source</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div><Label>External / reference URL</Label><Input value={externalUrl} onChange={e => setExternalUrl(e.target.value)} placeholder="optional" /></div>
                  <div><Label>Duration (sec)</Label><Input type="number" value={duration} onChange={e => setDuration(e.target.value === "" ? "" : Number(e.target.value))} /></div>
                </div>
                <div><Label>Notes</Label><Textarea rows={2} value={notes} onChange={e => setNotes(e.target.value)} /></div>
                <Button size="sm" onClick={add} disabled={busy}>{busy && <Loader2 className="w-4 h-4 animate-spin mr-2" />} Add asset</Button>
              </div>

              <div className="space-y-2">
                <div className="text-xs font-medium text-muted-foreground">Existing assets</div>
                {titleAssets.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-2">No screener assets yet for this title.</p>
                ) : titleAssets.map(a => (
                  <div key={a.id} className="border rounded p-3 flex items-center justify-between gap-2">
                    <div className="text-sm">
                      <div className="font-medium">{a.label} <Badge variant="outline" className="ml-1">{a.source_kind}</Badge> {a.is_active ? <Badge className="ml-1 bg-emerald-500/10 text-emerald-700 border-emerald-500/30" variant="outline">active</Badge> : <Badge variant="outline" className="ml-1">inactive</Badge>}</div>
                      {a.notes && <div className="text-xs text-muted-foreground">{a.notes}</div>}
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" onClick={() => toggleActive(a)}>{a.is_active ? "Disable" : "Enable"}</Button>
                      <Button size="sm" variant="ghost" onClick={() => remove(a)} className="text-red-600">Delete</Button>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
        <DialogFooter><Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export { ShareScreenerDialog };
