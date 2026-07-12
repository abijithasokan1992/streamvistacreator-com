import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Plus, Trash2, Loader2, Layers, Film, Languages, Send, Link2, FolderTree, Truck } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  listChildren, createChildTitle, updateTitleHierarchy,
  listFranchises, createFranchise,
  listMediaVersions, upsertMediaVersion, deleteMediaVersion,
  listLocalizations, upsertLocalization, deleteLocalization,
  getPublishing, upsertPublishing,
  listCollections, createCollection,
  listCollectionsContainingTitle, addTitleToCollection, removeTitleFromCollection,
  listDeliveriesForTitle,
  MEDIA_VERSION_LABELS, LOCALIZATION_LABELS,
  type TitleKind, type MediaVersion, type MediaVersionType,
  type Localization, type LocalizationKind,
  type PublishingRecord, type Franchise, type Collection, type DeliveryRow,
} from "@/lib/creator/mediaCmsApi";

type Sub = "hierarchy" | "collections" | "versions" | "localization" | "publishing" | "delivery";

const SUBS: { id: Sub; label: string; icon: any }[] = [
  { id: "hierarchy",    label: "Structure",      icon: Layers     },
  { id: "collections",  label: "Collections",    icon: FolderTree },
  { id: "versions",     label: "Media Versions", icon: Film       },
  { id: "localization", label: "Localization",   icon: Languages  },
  { id: "publishing",   label: "Publishing",     icon: Send       },
  { id: "delivery",     label: "Delivery",       icon: Truck      },
];

const VERSION_TYPES: MediaVersionType[] = ["master","broadcast","ott","hdr","sdr","proxy","trailer","screener","clip"];
const LOCALIZATION_KINDS: LocalizationKind[] = ["audio_track","subtitle","closed_caption","dub","localized_metadata"];

export function MediaCmsPanel({
  titleId, ownerUserId, workspaceId, titleKind, readOnly,
}: {
  titleId: string; ownerUserId: string; workspaceId: string | null;
  titleKind: TitleKind; readOnly: boolean;
}) {
  const [sub, setSub] = useState<Sub>("hierarchy");
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-1 border-b border-border/40 pb-2">
        {SUBS.map((s) => {
          const Icon = s.icon;
          return (
            <button key={s.id} onClick={() => setSub(s.id)}
              className={cn(
                "inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md transition-colors",
                sub === s.id ? "bg-accent/15 text-foreground" : "text-muted-foreground hover:bg-secondary/30 hover:text-foreground",
              )}>
              <Icon className="w-3.5 h-3.5" /> {s.label}
            </button>
          );
        })}
      </div>

      {sub === "hierarchy"    && <HierarchyTab titleId={titleId} ownerUserId={ownerUserId} workspaceId={workspaceId} titleKind={titleKind} readOnly={readOnly} />}
      {sub === "collections"  && <CollectionsTab titleId={titleId} ownerUserId={ownerUserId} readOnly={readOnly} />}
      {sub === "versions"     && <VersionsTab titleId={titleId} readOnly={readOnly} />}
      {/* Localization + Publishing are Admin-owned surfaces. Creator gets read-only view. */}
      {sub === "localization" && <LocalizationTab titleId={titleId} readOnly={true} />}
      {sub === "publishing"   && <PublishingTab titleId={titleId} readOnly={true} />}
      {sub === "delivery"     && <DeliveryTab titleId={titleId} />}
    </div>
  );
}

/* ============ Collections ============ */
function CollectionsTab({ titleId, ownerUserId, readOnly }: { titleId: string; ownerUserId: string; readOnly: boolean }) {
  const [all, setAll] = useState<Collection[]>([]);
  const [memberships, setMemberships] = useState<Array<{ id: string; collection: Collection | null }>>([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState("");
  const [busy, setBusy] = useState(false);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const [a, m] = await Promise.all([listCollections(ownerUserId), listCollectionsContainingTitle(titleId)]);
      setAll(a); setMemberships(m as any);
    } finally { setLoading(false); }
  }, [ownerUserId, titleId]);
  useEffect(() => { void reload(); }, [reload]);

  const memberIds = new Set(memberships.map((m) => m.collection?.id).filter(Boolean) as string[]);

  const toggle = async (c: Collection) => {
    setBusy(true);
    try {
      if (memberIds.has(c.id)) {
        const item = memberships.find((m) => m.collection?.id === c.id);
        if (item) await removeTitleFromCollection(item.id);
      } else {
        await addTitleToCollection(c.id, titleId);
      }
      await reload();
    } catch (e: any) { toast.error(e.message ?? "Could not update"); }
    finally { setBusy(false); }
  };

  const addNew = async () => {
    if (!newName.trim()) return;
    setBusy(true);
    try {
      const c = await createCollection(ownerUserId, newName.trim());
      await addTitleToCollection(c.id, titleId);
      setNewName("");
      await reload();
      toast.success("Collection created");
    } catch (e: any) { toast.error(e.message ?? "Could not create"); }
    finally { setBusy(false); }
  };

  if (loading) return <p className="text-xs text-muted-foreground"><Loader2 className="w-3.5 h-3.5 inline animate-spin" /> Loading…</p>;

  return (
    <div className="space-y-4">
      <Card title="Collections">
        {all.length === 0 ? (
          <p className="text-xs text-muted-foreground">No collections yet.</p>
        ) : (
          <ul className="space-y-1">
            {all.map((c) => (
              <li key={c.id} className="flex items-center justify-between text-xs px-2.5 py-2 rounded-md bg-background/40 border border-border/40">
                <span className="truncate">
                  <Link2 className="w-3 h-3 inline mr-1 text-muted-foreground" />
                  <span className="font-medium">{c.name}</span>
                  {c.description && <span className="text-muted-foreground"> · {c.description}</span>}
                </span>
                <button disabled={readOnly || busy} onClick={() => toggle(c)}
                  className={cn("text-[11px] px-2 py-1 rounded-md border transition-colors",
                    memberIds.has(c.id)
                      ? "bg-emerald-500/15 border-emerald-500/30 text-emerald-200"
                      : "border-border/50 text-muted-foreground hover:bg-secondary/30")}>
                  {memberIds.has(c.id) ? "In collection" : "Add"}
                </button>
              </li>
            ))}
          </ul>
        )}
        {!readOnly && (
          <div className="flex flex-wrap gap-2 mt-3">
            <input placeholder="New collection name" value={newName} onChange={(e) => setNewName(e.target.value)}
              className="flex-1 min-w-[200px] rounded-md bg-background/60 border border-border/50 text-xs px-2 py-1.5" />
            <button disabled={busy || !newName.trim()} onClick={addNew}
              className="inline-flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-md bg-accent text-accent-foreground disabled:opacity-40">
              <Plus className="w-3.5 h-3.5" /> Create & add
            </button>
          </div>
        )}
      </Card>
    </div>
  );
}

/* ============ Delivery history (read-only) ============ */
function DeliveryTab({ titleId }: { titleId: string }) {
  const [rows, setRows] = useState<DeliveryRow[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    (async () => {
      setLoading(true);
      try { setRows(await listDeliveriesForTitle(titleId)); }
      catch (e: any) { toast.error(e.message ?? "Could not load"); }
      finally { setLoading(false); }
    })();
  }, [titleId]);
  if (loading) return <p className="text-xs text-muted-foreground"><Loader2 className="w-3.5 h-3.5 inline animate-spin" /> Loading…</p>;
  if (rows.length === 0) return <p className="text-xs text-muted-foreground">No deliveries dispatched yet.</p>;
  const badge = (s: string) => {
    const cls = s === "delivered" ? "bg-emerald-500/15 text-emerald-200"
      : s === "failed" ? "bg-rose-500/15 text-rose-200"
      : s === "in_progress" || s === "queued" ? "bg-amber-500/15 text-amber-200"
      : "bg-secondary/40 text-muted-foreground";
    return <span className={cn("text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded", cls)}>{s.replace(/_/g," ")}</span>;
  };
  return (
    <ul className="space-y-2">
      {rows.map((r) => (
        <li key={r.id} className="rounded-md border border-border/40 bg-background/40 p-3 text-xs">
          <div className="flex items-center justify-between mb-1">
            <span className="font-medium">
              {r.partner?.name ?? "Partner"} <span className="text-muted-foreground">· {r.protocol}</span>
            </span>
            {badge(r.status)}
          </div>
          <div className="grid sm:grid-cols-3 gap-x-4 gap-y-0.5 text-muted-foreground">
            <span>Attempt: <span className="text-foreground">#{r.attempt_no}</span></span>
            {r.dispatched_at && <span>Dispatched: <span className="text-foreground">{new Date(r.dispatched_at).toLocaleString()}</span></span>}
            {r.delivered_at && <span>Delivered: <span className="text-foreground">{new Date(r.delivered_at).toLocaleString()}</span></span>}
            {r.bytes_transferred != null && <span>Bytes: <span className="text-foreground">{Number(r.bytes_transferred).toLocaleString()}</span></span>}
            {r.duration_ms != null && <span>Duration: <span className="text-foreground">{r.duration_ms} ms</span></span>}
            {r.error_code && <span className="text-rose-300">Error: {r.error_code}</span>}
          </div>
          {r.error_message && <div className="mt-1 text-rose-300/80">{r.error_message}</div>}
        </li>
      ))}
    </ul>
  );
}

/* ============ Hierarchy + Franchise ============ */
function HierarchyTab({
  titleId, ownerUserId, workspaceId, titleKind, readOnly,
}: { titleId: string; ownerUserId: string; workspaceId: string | null; titleKind: TitleKind; readOnly: boolean }) {
  const [kind, setKind] = useState<TitleKind>(titleKind);
  const [children, setChildren] = useState<any[]>([]);
  const [franchises, setFranchises] = useState<Franchise[]>([]);
  const [franchiseId, setFranchiseId] = useState<string>("");
  const [newChildName, setNewChildName] = useState("");
  const [newSeason, setNewSeason] = useState<string>("");
  const [newEpisode, setNewEpisode] = useState<string>("");
  const [newFranchise, setNewFranchise] = useState("");
  const [busy, setBusy] = useState(false);

  const reload = useCallback(async () => {
    const [c, f] = await Promise.all([listChildren(titleId), listFranchises(ownerUserId)]);
    setChildren(c); setFranchises(f);
  }, [titleId, ownerUserId]);

  useEffect(() => { void reload(); }, [reload]);

  const changeKind = async (k: TitleKind) => {
    setKind(k);
    try { await updateTitleHierarchy(titleId, { kind: k }); toast.success("Structure updated"); }
    catch (e: any) { toast.error(e.message ?? "Could not update kind"); }
  };
  const linkFranchise = async (fid: string) => {
    setFranchiseId(fid);
    try { await updateTitleHierarchy(titleId, { franchise_id: fid || null }); toast.success("Franchise linked"); }
    catch (e: any) { toast.error(e.message ?? "Could not link franchise"); }
  };
  const createNewFranchise = async () => {
    if (!newFranchise.trim()) return;
    try { const f = await createFranchise(ownerUserId, newFranchise.trim()); setNewFranchise(""); await reload(); await linkFranchise(f.id); }
    catch (e: any) { toast.error(e.message ?? "Could not create franchise"); }
  };
  const addChild = async () => {
    if (!newChildName.trim()) return;
    setBusy(true);
    try {
      const childKind: TitleKind = kind === "series" ? "season" : kind === "season" ? "episode" : "episode";
      await createChildTitle({
        parent_id: titleId, owner_user_id: ownerUserId, workspace_id: workspaceId,
        kind: childKind, title: newChildName.trim(),
        season_number: newSeason ? Number(newSeason) : null,
        episode_number: newEpisode ? Number(newEpisode) : null,
      });
      setNewChildName(""); setNewSeason(""); setNewEpisode("");
      await reload();
      toast.success(`${childKind} added`);
    } catch (e: any) { toast.error(e.message ?? "Could not add"); }
    finally { setBusy(false); }
  };

  const canHaveChildren = kind === "series" || kind === "season";

  return (
    <div className="space-y-5">
      <Card title="Title kind">
        <div className="flex flex-wrap gap-1.5">
          {(["film","series","season","episode"] as TitleKind[]).map((k) => (
            <button key={k} disabled={readOnly} onClick={() => changeKind(k)}
              className={cn("text-xs px-3 py-1.5 rounded-md border transition-colors",
                kind === k ? "bg-accent/20 border-accent/40 text-foreground" : "border-border/50 text-muted-foreground hover:bg-secondary/30",
              )}>
              {k}
            </button>
          ))}
        </div>
        <p className="text-[11px] text-muted-foreground mt-2">Series contains seasons; seasons contain episodes.</p>
      </Card>

      <Card title="Franchise">
        <div className="flex flex-wrap items-center gap-2">
          <select disabled={readOnly} value={franchiseId} onChange={(e) => linkFranchise(e.target.value)}
            className="rounded-md bg-background/60 border border-border/50 text-xs px-2 py-1.5">
            <option value="">— none —</option>
            {franchises.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
          </select>
          <div className="flex items-center gap-1.5">
            <input value={newFranchise} onChange={(e) => setNewFranchise(e.target.value)}
              placeholder="New franchise name" className="rounded-md bg-background/60 border border-border/50 text-xs px-2 py-1.5" />
            <button disabled={readOnly || !newFranchise.trim()} onClick={createNewFranchise}
              className="inline-flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-md bg-accent/20 hover:bg-accent/30 disabled:opacity-40">
              <Plus className="w-3.5 h-3.5" /> Add
            </button>
          </div>
        </div>
      </Card>

      {canHaveChildren && (
        <Card title={kind === "series" ? "Seasons" : "Episodes"}>
          {!readOnly && (
            <div className="flex flex-wrap gap-2 mb-3">
              <input placeholder={kind === "series" ? "Season name" : "Episode name"}
                value={newChildName} onChange={(e) => setNewChildName(e.target.value)}
                className="flex-1 min-w-[200px] rounded-md bg-background/60 border border-border/50 text-xs px-2 py-1.5" />
              {kind === "season" && (
                <>
                  <input type="number" placeholder="S#" value={newSeason} onChange={(e) => setNewSeason(e.target.value)}
                    className="w-16 rounded-md bg-background/60 border border-border/50 text-xs px-2 py-1.5" />
                  <input type="number" placeholder="E#" value={newEpisode} onChange={(e) => setNewEpisode(e.target.value)}
                    className="w-16 rounded-md bg-background/60 border border-border/50 text-xs px-2 py-1.5" />
                </>
              )}
              <button disabled={busy || !newChildName.trim()} onClick={addChild}
                className="inline-flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-md bg-accent text-accent-foreground disabled:opacity-40">
                {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />} Add
              </button>
            </div>
          )}
          {children.length === 0 ? (
            <p className="text-xs text-muted-foreground">No {kind === "series" ? "seasons" : "episodes"} yet.</p>
          ) : (
            <ul className="space-y-1">
              {children.map((c) => (
                <li key={c.id} className="flex items-center justify-between text-xs px-2.5 py-2 rounded-md bg-background/40 border border-border/40">
                  <span className="truncate">
                    {c.season_number != null && <span className="text-muted-foreground">S{c.season_number} </span>}
                    {c.episode_number != null && <span className="text-muted-foreground">E{c.episode_number} · </span>}
                    {c.title}
                  </span>
                  <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{c.kind}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}
    </div>
  );
}

/* ============ Media Versions ============ */
function VersionsTab({ titleId, readOnly }: { titleId: string; readOnly: boolean }) {
  const [versions, setVersions] = useState<MediaVersion[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState<MediaVersionType | null>(null);
  const [draft, setDraft] = useState<Partial<MediaVersion>>({});

  const reload = useCallback(async () => {
    setLoading(true);
    try { setVersions(await listMediaVersions(titleId)); }
    finally { setLoading(false); }
  }, [titleId]);
  useEffect(() => { void reload(); }, [reload]);

  const save = async () => {
    if (!adding) return;
    try {
      await upsertMediaVersion({ ...(draft as any), title_id: titleId, version_type: adding });
      setAdding(null); setDraft({});
      await reload();
      toast.success("Version saved");
    } catch (e: any) { toast.error(e.message ?? "Could not save"); }
  };
  const remove = async (id: string) => {
    try { await deleteMediaVersion(id); await reload(); toast.success("Removed"); }
    catch (e: any) { toast.error(e.message ?? "Could not remove"); }
  };

  return (
    <div className="space-y-4">
      {!readOnly && (
        <div className="flex flex-wrap gap-1.5">
          {VERSION_TYPES.map((v) => (
            <button key={v} onClick={() => { setAdding(v); setDraft({}); }}
              className="text-[11px] px-2.5 py-1.5 rounded-md border border-border/50 hover:bg-secondary/30 inline-flex items-center gap-1">
              <Plus className="w-3 h-3" /> {MEDIA_VERSION_LABELS[v]}
            </button>
          ))}
        </div>
      )}

      {adding && (
        <Card title={`Add ${MEDIA_VERSION_LABELS[adding]}`}>
          <div className="grid sm:grid-cols-2 gap-2 text-xs">
            <Input label="Label"          value={draft.label ?? ""}         onChange={(v) => setDraft({ ...draft, label: v })} />
            <Input label="Codec"          value={draft.codec ?? ""}         onChange={(v) => setDraft({ ...draft, codec: v })} placeholder="ProRes 422, H.264…" />
            <Input label="Container"      value={draft.container ?? ""}     onChange={(v) => setDraft({ ...draft, container: v })} placeholder="MOV, MXF, MP4…" />
            <Input label="Frame Rate"     value={draft.frame_rate?.toString() ?? ""} onChange={(v) => setDraft({ ...draft, frame_rate: v ? Number(v) : null })} placeholder="23.976" />
            <Input label="Aspect Ratio"   value={draft.aspect_ratio ?? ""}  onChange={(v) => setDraft({ ...draft, aspect_ratio: v })} placeholder="16:9, 2.39:1" />
            <Input label="Bitrate (kbps)" value={draft.bitrate_kbps?.toString() ?? ""} onChange={(v) => setDraft({ ...draft, bitrate_kbps: v ? Number(v) : null })} />
            <Input label="Audio Layout"   value={draft.audio_layout ?? ""}  onChange={(v) => setDraft({ ...draft, audio_layout: v })} placeholder="5.1, stereo, Atmos" />
            <Input label="Loudness LUFS"  value={draft.loudness_lufs?.toString() ?? ""} onChange={(v) => setDraft({ ...draft, loudness_lufs: v ? Number(v) : null })} placeholder="-23.0" />
            <JsonInput label="HDR Metadata" value={draft.hdr_metadata ?? {}} onChange={(v) => setDraft({ ...draft, hdr_metadata: v })} />
            <JsonInput label="IMF Metadata" value={draft.imf_metadata ?? {}} onChange={(v) => setDraft({ ...draft, imf_metadata: v })} />
            <JsonInput label="Technical Metadata" value={draft.tech_metadata ?? {}} onChange={(v) => setDraft({ ...draft, tech_metadata: v })} />
          </div>
          <div className="flex gap-2 mt-3">
            <button onClick={save} className="text-xs px-3 py-1.5 rounded-md bg-accent text-accent-foreground">Save</button>
            <button onClick={() => { setAdding(null); setDraft({}); }} className="text-xs px-3 py-1.5 rounded-md border border-border/50">Cancel</button>
          </div>
        </Card>
      )}

      {loading ? (
        <p className="text-xs text-muted-foreground"><Loader2 className="w-3.5 h-3.5 inline animate-spin" /> Loading…</p>
      ) : versions.length === 0 ? (
        <p className="text-xs text-muted-foreground">No media versions yet.</p>
      ) : (
        <ul className="space-y-2">
          {versions.map((v) => (
            <li key={v.id} className="rounded-md border border-border/40 bg-background/40 p-3 text-xs">
              <div className="flex items-center justify-between mb-1">
                <span className="font-medium">{MEDIA_VERSION_LABELS[v.version_type]} {v.label && <span className="text-muted-foreground">· {v.label}</span>}</span>
                {!readOnly && (
                  <button onClick={() => remove(v.id)} className="text-muted-foreground hover:text-rose-300" aria-label="Delete version">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
              <div className="grid sm:grid-cols-3 gap-x-4 gap-y-0.5 text-muted-foreground">
                {v.codec         && <span>Codec: <span className="text-foreground">{v.codec}</span></span>}
                {v.container     && <span>Container: <span className="text-foreground">{v.container}</span></span>}
                {v.frame_rate    && <span>FPS: <span className="text-foreground">{v.frame_rate}</span></span>}
                {v.aspect_ratio  && <span>AR: <span className="text-foreground">{v.aspect_ratio}</span></span>}
                {v.bitrate_kbps  && <span>Bitrate: <span className="text-foreground">{v.bitrate_kbps} kbps</span></span>}
                {v.audio_layout  && <span>Audio: <span className="text-foreground">{v.audio_layout}</span></span>}
                {v.loudness_lufs != null && <span>Loudness: <span className="text-foreground">{v.loudness_lufs} LUFS</span></span>}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/* ============ Localization ============ */
function LocalizationTab({ titleId, readOnly }: { titleId: string; readOnly: boolean }) {
  const [items, setItems] = useState<Localization[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState<LocalizationKind | null>(null);
  const [draft, setDraft] = useState<Partial<Localization>>({ is_default: false });

  const reload = useCallback(async () => {
    setLoading(true);
    try { setItems(await listLocalizations(titleId)); }
    finally { setLoading(false); }
  }, [titleId]);
  useEffect(() => { void reload(); }, [reload]);

  const save = async () => {
    if (!adding) return;
    if (!draft.language) { toast.error("Language is required"); return; }
    try {
      await upsertLocalization({ ...(draft as any), title_id: titleId, kind: adding });
      setAdding(null); setDraft({ is_default: false });
      await reload();
      toast.success("Saved");
    } catch (e: any) { toast.error(e.message ?? "Could not save"); }
  };
  const remove = async (id: string) => {
    try { await deleteLocalization(id); await reload(); toast.success("Removed"); }
    catch (e: any) { toast.error(e.message ?? "Could not remove"); }
  };

  const groups: Record<LocalizationKind, Localization[]> = {
    audio_track: [], subtitle: [], closed_caption: [], dub: [], localized_metadata: [],
  };
  items.forEach((i) => groups[i.kind]?.push(i));

  return (
    <div className="space-y-4">
      {!readOnly && (
        <div className="flex flex-wrap gap-1.5">
          {LOCALIZATION_KINDS.map((k) => (
            <button key={k} onClick={() => { setAdding(k); setDraft({ is_default: false }); }}
              className="text-[11px] px-2.5 py-1.5 rounded-md border border-border/50 hover:bg-secondary/30 inline-flex items-center gap-1">
              <Plus className="w-3 h-3" /> {LOCALIZATION_LABELS[k]}
            </button>
          ))}
        </div>
      )}

      {adding && (
        <Card title={`Add ${LOCALIZATION_LABELS[adding]}`}>
          <div className="grid sm:grid-cols-2 gap-2 text-xs">
            <Input label="Language (BCP-47)" value={draft.language ?? ""} onChange={(v) => setDraft({ ...draft, language: v })} placeholder="en, hi-IN, es-419" />
            <Input label="Region"             value={draft.region ?? ""}   onChange={(v) => setDraft({ ...draft, region: v })}   placeholder="IN, US, LATAM" />
            <Input label="Label"              value={draft.label ?? ""}    onChange={(v) => setDraft({ ...draft, label: v })} />
            <label className="text-[11px] text-muted-foreground inline-flex items-center gap-2">
              <input type="checkbox" checked={!!draft.is_default} onChange={(e) => setDraft({ ...draft, is_default: e.target.checked })} />
              Mark as default
            </label>
            <JsonInput label="Payload (title / synopsis / caption format / SDH…)" value={draft.payload ?? {}} onChange={(v) => setDraft({ ...draft, payload: v })} />
          </div>
          <div className="flex gap-2 mt-3">
            <button onClick={save} className="text-xs px-3 py-1.5 rounded-md bg-accent text-accent-foreground">Save</button>
            <button onClick={() => { setAdding(null); setDraft({ is_default: false }); }} className="text-xs px-3 py-1.5 rounded-md border border-border/50">Cancel</button>
          </div>
        </Card>
      )}

      {loading ? (
        <p className="text-xs text-muted-foreground"><Loader2 className="w-3.5 h-3.5 inline animate-spin" /> Loading…</p>
      ) : items.length === 0 ? (
        <p className="text-xs text-muted-foreground">No localizations yet.</p>
      ) : (
        LOCALIZATION_KINDS.map((k) => groups[k].length > 0 && (
          <Card key={k} title={LOCALIZATION_LABELS[k]}>
            <ul className="space-y-1">
              {groups[k].map((l) => (
                <li key={l.id} className="flex items-center justify-between text-xs px-2.5 py-2 rounded-md bg-background/40 border border-border/40">
                  <span className="truncate">
                    <span className="font-medium">{l.language}</span>
                    {l.region && <span className="text-muted-foreground"> · {l.region}</span>}
                    {l.label && <span className="text-muted-foreground"> · {l.label}</span>}
                    {l.is_default && <span className="ml-2 text-[10px] uppercase tracking-wider text-emerald-300">default</span>}
                  </span>
                  {!readOnly && (
                    <button onClick={() => remove(l.id)} className="text-muted-foreground hover:text-rose-300" aria-label="Delete">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </Card>
        ))
      )}
    </div>
  );
}

/* ============ Publishing ============ */
function PublishingTab({ titleId, readOnly }: { titleId: string; readOnly: boolean }) {
  const [rec, setRec] = useState<PublishingRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const reload = useCallback(async () => {
    setLoading(true);
    try { setRec(await getPublishing(titleId)); }
    finally { setLoading(false); }
  }, [titleId]);
  useEffect(() => { void reload(); }, [reload]);

  const patch = (p: Partial<PublishingRecord>) => setRec({ ...(rec ?? { title_id: titleId } as any), ...p });

  const save = async () => {
    setSaving(true);
    try {
      await upsertPublishing({ ...(rec ?? {}), title_id: titleId });
      toast.success("Publishing updated");
      await reload();
    } catch (e: any) { toast.error(e.message ?? "Could not save"); }
    finally { setSaving(false); }
  };

  if (loading) return <p className="text-xs text-muted-foreground"><Loader2 className="w-3.5 h-3.5 inline animate-spin" /> Loading…</p>;

  return (
    <div className="space-y-4">
      <Card title="Status">
        <div className="grid sm:grid-cols-2 gap-3 text-xs">
          <Select label="Availability" disabled={readOnly} value={rec?.availability ?? "draft"}
            options={["draft","scheduled","available","expired","withdrawn"]}
            onChange={(v) => patch({ availability: v as any })} />
          <Select label="Distribution Readiness" disabled={readOnly} value={rec?.distribution ?? "not_ready"}
            options={["not_ready","in_prep","ready","blocked"]}
            onChange={(v) => patch({ distribution: v as any })} />
          <Select label="Approval" disabled={readOnly} value={rec?.approval ?? "pending"}
            options={["pending","approved","rejected","changes_requested"]}
            onChange={(v) => patch({ approval: v as any })} />
          <Select label="Delivery" disabled={readOnly} value={rec?.delivery ?? "not_started"}
            options={["not_started","queued","in_progress","delivered","failed"]}
            onChange={(v) => patch({ delivery: v as any })} />
          <Input label="Available From" type="datetime-local" value={toLocalDT(rec?.available_from)} onChange={(v) => patch({ available_from: fromLocalDT(v) })} />
          <Input label="Available Until" type="datetime-local" value={toLocalDT(rec?.available_until)} onChange={(v) => patch({ available_until: fromLocalDT(v) })} />
        </div>
        <div className="mt-3">
          <label className="text-[11px] text-muted-foreground">Notes</label>
          <textarea disabled={readOnly} value={rec?.notes ?? ""} onChange={(e) => patch({ notes: e.target.value })}
            rows={3} className="w-full mt-1 rounded-md bg-background/60 border border-border/50 text-xs px-2 py-1.5" />
        </div>
        {!readOnly && (
          <div className="mt-3">
            <button onClick={save} disabled={saving} className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md bg-accent text-accent-foreground disabled:opacity-40">
              {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />} Save
            </button>
          </div>
        )}
      </Card>
    </div>
  );
}

/* ============ tiny UI atoms ============ */
function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-border/40 bg-card/30 p-4">
      <div className="text-xs font-semibold mb-2">{title}</div>
      {children}
    </section>
  );
}
function Input({ label, value, onChange, placeholder, type }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string;
}) {
  return (
    <label className="block">
      <span className="text-[11px] text-muted-foreground">{label}</span>
      <input type={type ?? "text"} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
        className="mt-1 w-full rounded-md bg-background/60 border border-border/50 text-xs px-2 py-1.5" />
    </label>
  );
}
function Select({ label, value, options, onChange, disabled }: {
  label: string; value: string; options: string[]; onChange: (v: string) => void; disabled?: boolean;
}) {
  return (
    <label className="block">
      <span className="text-[11px] text-muted-foreground">{label}</span>
      <select disabled={disabled} value={value} onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded-md bg-background/60 border border-border/50 text-xs px-2 py-1.5">
        {options.map((o) => <option key={o} value={o}>{o.replace(/_/g," ")}</option>)}
      </select>
    </label>
  );
}
function JsonInput({ label, value, onChange }: { label: string; value: Record<string, any>; onChange: (v: Record<string, any>) => void }) {
  const [text, setText] = useState(() => JSON.stringify(value ?? {}, null, 0));
  const [err, setErr] = useState<string | null>(null);
  return (
    <label className="block sm:col-span-2">
      <span className="text-[11px] text-muted-foreground">{label}</span>
      <textarea rows={2} value={text}
        onChange={(e) => {
          setText(e.target.value);
          try { onChange(JSON.parse(e.target.value || "{}")); setErr(null); }
          catch { setErr("Invalid JSON"); }
        }}
        placeholder='{"transfer":"PQ","primaries":"BT.2020"}'
        className="mt-1 w-full font-mono rounded-md bg-background/60 border border-border/50 text-[11px] px-2 py-1.5" />
      {err && <span className="text-[10px] text-rose-300">{err}</span>}
    </label>
  );
}
function toLocalDT(iso?: string | null) {
  if (!iso) return "";
  const d = new Date(iso); const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function fromLocalDT(v: string): string | null {
  if (!v) return null;
  const d = new Date(v); return isNaN(+d) ? null : d.toISOString();
}
