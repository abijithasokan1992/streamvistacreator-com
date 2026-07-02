import { useEffect, useMemo, useState, useCallback } from "react";
import {
  Loader2, Plus, Trash2, Save, Upload, Image as ImageIcon, Newspaper, Film,
  Megaphone, Sparkles, Globe, FileEdit, EyeOff, Clapperboard, GripVertical,
  Pencil, RefreshCw, CheckCircle2, AlertTriangle, ChevronDown,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { HeroReelPreview } from "./HeroReelPreview";
import { HeroModeControl } from "./HeroModeControl";
import { HeroLivePreview } from "./HeroLivePreview";

type AnyRow = Record<string, any> & { id: string };

const TABLES = {
  reel: "homepage_hero_reel",
  hero: "hero_banners",
  ad: "ad_zones",
  film: "featured_films",
  news: "news_events",
} as const;

type Kind = keyof typeof TABLES;

const BLANK: Record<Kind, AnyRow> = {
  reel: { id: "", title: "", subtitle: "", poster_url: "", backdrop_url: "", image_url: "", cta_label: "", cta_url: "", sort_order: 0, is_active: true, is_featured: false, status: "published", starts_at: null, ends_at: null },
  hero: { id: "", internal_label: "", headline: "", subheadline: "", image_url: "", cta_label: "", cta_url: "", cta2_label: "", cta2_url: "", sort_order: 0, is_active: true, status: "draft", starts_at: null, ends_at: null },
  ad:   { id: "", slot: "top", title: "", image_url: "", link_url: "", sort_order: 0, is_active: true, status: "draft", starts_at: null, ends_at: null },
  film: { id: "", title: "", subtitle: "", blurb: "", content_type: "", year: null, partner: "", poster_url: "", link_url: "", sort_order: 0, is_active: true, status: "draft", starts_at: null, ends_at: null },
  news: { id: "", kind: "news", title: "", summary: "", image_url: "", link_url: "", event_date: null, location: "", sort_order: 0, is_active: true, status: "draft", starts_at: null, ends_at: null },
};

export default function MarketingCMS() {
  return (
    <div className="glass rounded-2xl p-6 space-y-10">
      <div className="flex items-start gap-3">
        <div className="w-11 h-11 rounded-xl bg-accent/10 text-accent grid place-items-center shrink-0">
          <Sparkles className="w-5 h-5" />
        </div>
        <div>
          <h2 className="font-display text-2xl font-bold">Homepage CMS</h2>
          <p className="text-sm text-muted-foreground">Everything visible on the public StreamVista homepage is controlled from this page — hero, licensed content carousel, ads and news.</p>
        </div>
      </div>

      <Section
        kind="hero"
        title="Homepage Hero Banners"
        icon={<ImageIcon className="w-4 h-4" />}
        helper={<>Set the <strong>Hero Mode</strong> below. In <strong>Single</strong> mode the homepage renders only the <strong>Published</strong> + <strong>Active</strong> banner with the <strong>lowest Sort order</strong>. In <strong>Slider</strong> mode it fades through <em>all</em> Published + Active banners in Sort order. New rows save as <strong>Draft</strong> — click <strong>Publish</strong> to make a row eligible.</>}
      />

      <Section
        kind="film"
        title="Homepage Licensed Contents"
        icon={<Film className="w-4 h-4" />}
        helper={<>Controls the homepage strip <em>"Successfully Licensed Contents by StreamVista"</em>. Only items that are <strong>Published</strong> AND <strong>Active</strong> appear publicly. <strong>Sort order</strong> (low → high) controls left-to-right order in the carousel.</>}
      />

      <Section kind="reel" title="Homepage hero carousel (legacy cinematic reel)" icon={<Clapperboard className="w-4 h-4" />} />
      <Section kind="ad"   title="Advertisement zones"     icon={<Megaphone className="w-4 h-4" />} />
      <Section kind="news" title="News & events"           icon={<Newspaper className="w-4 h-4" />} />
    </div>
  );
}

function Section({ kind, title, icon, helper }: { kind: Kind; title: string; icon: React.ReactNode; helper?: React.ReactNode }) {
  const table = TABLES[kind];
  const [rows, setRows] = useState<AnyRow[]>([]);
  // baseline snapshot per row (for dirty checks)
  const [baseline, setBaseline] = useState<Record<string, AnyRow>>({});
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [overIdx, setOverIdx] = useState<number | null>(null);
  const [reordering, setReordering] = useState(false);
  const dndEnabled = kind === "reel";

  const liveHeroId = useMemo(() => {
    if (kind !== "hero") return null;
    return [...rows]
      .filter(r => r.status === "published" && r.is_active && !r.id.startsWith("new-"))
      .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))[0]?.id ?? null;
  }, [rows, kind]);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await (supabase as any).from(table).select("*").order("sort_order").order("created_at", { ascending: false });
    setLoading(false);
    if (error) return toast.error(error.message);
    const list = (data as AnyRow[]) ?? [];
    setRows(list);
    const base: Record<string, AnyRow> = {};
    list.forEach(r => { base[r.id] = { ...r }; });
    setBaseline(base);
  }, [table]);

  useEffect(() => { load(); }, [load]);

  const add = () => {
    const id = `new-${crypto.randomUUID()}`;
    setRows(r => [{ ...BLANK[kind], id }, ...r]);
    setExpanded(e => ({ ...e, [id]: true }));
  };

  const update = (id: string, patch: Partial<AnyRow>) =>
    setRows(r => r.map(x => x.id === id ? { ...x, ...patch } : x));

  const isDirty = (row: AnyRow): boolean => {
    if (row.id.startsWith("new-")) return true;
    const b = baseline[row.id];
    if (!b) return true;
    const keys = new Set([...Object.keys(row), ...Object.keys(b)]);
    for (const k of keys) {
      if (k === "updated_at") continue;
      const a = row[k], c = b[k];
      if ((a ?? null) !== (c ?? null)) return true;
    }
    return false;
  };

  const save = async (row: AnyRow) => {
    setSavingId(row.id);
    const isNew = row.id.startsWith("new-");
    const payload: AnyRow = { ...row };
    if (isNew) delete (payload as any).id;
    ["starts_at","ends_at","event_date"].forEach(k => { if (payload[k] === "") payload[k] = null; });
    const q = isNew
      ? (supabase as any).from(table).insert(payload).select().single()
      : (supabase as any).from(table).update(payload).eq("id", row.id).select().single();
    const { data, error } = await q;
    setSavingId(null);
    if (error) return toast.error(error.message);
    const saved = data as AnyRow;
    setRows(r => r.map(x => x.id === row.id ? saved : x));
    setBaseline(b => {
      const next = { ...b };
      if (isNew) delete next[row.id];
      next[saved.id] = { ...saved };
      return next;
    });
    setExpanded(e => {
      const next = { ...e };
      if (isNew) delete next[row.id];
      next[saved.id] = false; // collapse on success
      return next;
    });
    toast.success(isNew ? "Saved" : "Updated");
  };

  const remove = async (id: string) => {
    if (id.startsWith("new-")) {
      setRows(r => r.filter(x => x.id !== id));
      setExpanded(e => { const n = { ...e }; delete n[id]; return n; });
      return;
    }
    if (!confirm("Delete this item?")) return;
    const { error } = await (supabase as any).from(table).delete().eq("id", id);
    if (error) return toast.error(error.message);
    setRows(r => r.filter(x => x.id !== id));
    setBaseline(b => { const n = { ...b }; delete n[id]; return n; });
    setExpanded(e => { const n = { ...e }; delete n[id]; return n; });
    toast.success("Deleted");
  };

  const setStatus = async (row: AnyRow, status: "draft" | "published") => {
    if (row.id.startsWith("new-")) {
      update(row.id, { status });
      toast.message("Save the item first to apply the new status.");
      return;
    }
    const { data, error } = await (supabase as any).from(table).update({ status }).eq("id", row.id).select().single();
    if (error) return toast.error(error.message);
    const saved = data as AnyRow;
    setRows(r => r.map(x => x.id === row.id ? saved : x));
    setBaseline(b => ({ ...b, [saved.id]: { ...saved } }));
    toast.success(status === "published" ? "Published — now eligible to appear on the homepage" : "Reverted to draft — hidden from homepage");
  };

  const uploadImage = async (row: AnyRow, field: string, file: File) => {
    const ext = file.name.split(".").pop() || "png";
    const path = `${kind}/${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage.from("marketing").upload(path, file, { cacheControl: "3600", upsert: false });
    if (error) return toast.error(error.message);
    const { data } = supabase.storage.from("marketing").getPublicUrl(path);
    update(row.id, { [field]: data.publicUrl });
    toast.success("Image uploaded");
  };

  const persistOrder = async (next: AnyRow[]) => {
    setReordering(true);
    const updates = next
      .map((r, idx) => ({ id: r.id, sort_order: idx * 10 }))
      .filter(u => !u.id.startsWith("new-"));
    const results = await Promise.all(
      updates.map(u => (supabase as any).from(table).update({ sort_order: u.sort_order }).eq("id", u.id))
    );
    setReordering(false);
    const firstErr = results.find((r: any) => r?.error);
    if (firstErr) return toast.error(firstErr.error.message);
    setBaseline(b => {
      const n = { ...b };
      next.forEach((r, idx) => {
        if (n[r.id]) n[r.id] = { ...n[r.id], sort_order: idx * 10 };
      });
      return n;
    });
    toast.success("Order saved");
  };

  const onDragStart = (idx: number) => (e: React.DragEvent) => {
    setDragIdx(idx);
    e.dataTransfer.effectAllowed = "move";
    try { e.dataTransfer.setData("text/plain", String(idx)); } catch { /* noop */ }
  };
  const onDragOver = (idx: number) => (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (overIdx !== idx) setOverIdx(idx);
  };
  const onDragLeave = () => setOverIdx(null);
  const onDrop = (idx: number) => async (e: React.DragEvent) => {
    e.preventDefault();
    setOverIdx(null);
    if (dragIdx === null || dragIdx === idx) { setDragIdx(null); return; }
    const next = [...rows];
    const [moved] = next.splice(dragIdx, 1);
    next.splice(idx, 0, moved);
    const reindexed = next.map((r, i) => ({ ...r, sort_order: i * 10 }));
    setRows(reindexed);
    setDragIdx(null);
    await persistOrder(reindexed);
  };

  // visibility reason — only for the eligible-public sections
  const visibility = (row: AnyRow, idx: number): { live: boolean; reasons: string[] } => {
    const reasons: string[] = [];
    if (row.id.startsWith("new-")) reasons.push("not saved yet");
    if (row.status !== "published") reasons.push("status is Draft");
    if (!row.is_active) reasons.push("Inactive (visibility off)");
    if (row.starts_at && new Date(row.starts_at) > new Date()) reasons.push("scheduled to start later");
    if (row.ends_at && new Date(row.ends_at) <= new Date()) reasons.push("schedule has ended");
    if (kind === "hero" && reasons.length === 0 && liveHeroId && row.id !== liveHeroId) {
      reasons.push("another Hero banner has a lower Sort order");
    }
    // image required for film/hero/reel to actually look right (not a hard block, just info)
    return { live: reasons.length === 0, reasons };
  };

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-sm flex items-center gap-2 text-foreground/90">
          {icon}{title}
          {reordering && <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" />}
        </h3>
        <div className="flex items-center gap-2">
          <button onClick={load} title="Refresh from database" className="h-8 px-2.5 rounded-md border border-border text-xs flex items-center gap-1.5 hover:bg-secondary text-muted-foreground">
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
          <button onClick={add} className="h-8 px-3 rounded-md border border-border text-xs flex items-center gap-1.5 hover:bg-secondary">
            <Plus className="w-3.5 h-3.5" /> Add
          </button>
        </div>
      </div>

      {helper && (
        <p className="text-[11px] text-muted-foreground border-l-2 border-accent/50 pl-3 leading-relaxed">
          {helper}
        </p>
      )}

      {kind === "hero" && <HeroModeControl />}
      {kind === "hero" && <HeroLivePreview />}

      {dndEnabled && !loading && (
        <HeroReelPreview items={rows} />
      )}
      {dndEnabled && rows.length > 1 && (
        <p className="text-[11px] text-muted-foreground flex items-center gap-1.5">
          <GripVertical className="w-3 h-3" /> Drag the handle on each card to reorder. Order saves instantly.
        </p>
      )}

      {loading ? (
        <div className="py-8 grid place-items-center"><Loader2 className="w-4 h-4 animate-spin text-primary" /></div>
      ) : rows.length === 0 ? (
        <p className="text-xs text-muted-foreground py-6 text-center border border-dashed border-border/50 rounded-xl">No items yet — click Add.</p>
      ) : (
        <div className="space-y-3">
          {rows.map((row, idx) => {
            const vis = visibility(row, idx);
            const isOpen = expanded[row.id] ?? row.id.startsWith("new-");
            return (
              <div
                key={row.id}
                onDragOver={dndEnabled ? onDragOver(idx) : undefined}
                onDragLeave={dndEnabled ? onDragLeave : undefined}
                onDrop={dndEnabled ? onDrop(idx) : undefined}
                className={`relative transition-all ${dndEnabled && overIdx === idx && dragIdx !== idx ? "ring-2 ring-accent/60 rounded-xl" : ""} ${dndEnabled && dragIdx === idx ? "opacity-50" : ""}`}
              >
                <RowCard
                  kind={kind}
                  row={row}
                  isLive={kind === "hero" && row.id === liveHeroId}
                  visibility={vis}
                  expanded={isOpen}
                  dirty={isDirty(row)}
                  onToggleExpand={() => setExpanded(e => ({ ...e, [row.id]: !isOpen }))}
                  onChange={(patch) => update(row.id, patch)}
                  onSave={() => save(row)}
                  onDelete={() => remove(row.id)}
                  onUpload={(field, file) => uploadImage(row, field, file)}
                  onSetStatus={(s) => setStatus(row, s)}
                  saving={savingId === row.id}
                  dragHandleProps={dndEnabled ? {
                    draggable: true,
                    onDragStart: onDragStart(idx),
                    onDragEnd: () => { setDragIdx(null); setOverIdx(null); },
                  } : undefined}
                />
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

function RowCard({ kind, row, isLive, visibility: vis, expanded, dirty, onToggleExpand, onChange, onSave, onDelete, onUpload, onSetStatus, saving, dragHandleProps }: {
  kind: Kind; row: AnyRow;
  isLive?: boolean;
  visibility: { live: boolean; reasons: string[] };
  expanded: boolean;
  dirty: boolean;
  onToggleExpand: () => void;
  onChange: (p: Partial<AnyRow>) => void;
  onSave: () => void; onDelete: () => void;
  onUpload: (field: string, file: File) => void;
  onSetStatus: (s: "draft" | "published") => void;
  saving: boolean;
  dragHandleProps?: React.HTMLAttributes<HTMLDivElement> & { draggable?: boolean };
}) {
  const imageField = kind === "film" ? "poster_url" : kind === "reel" ? "poster_url" : "image_url";
  const isPublished = row.status === "published";
  const isNew = row.id.startsWith("new-");
  const summaryLabel =
    row.internal_label || row.headline || row.title || row.subtitle || (isNew ? "New item" : "Untitled");

  return (
    <div className={`rounded-xl border ${isLive ? "border-emerald-500/60 bg-emerald-500/[0.06] ring-1 ring-emerald-500/40" : isPublished ? "border-emerald-500/30 bg-emerald-500/[0.03]" : "border-amber-500/30 bg-amber-500/[0.03]"}`}>
      {/* Summary header — always shown */}
      <div className="flex items-center justify-between gap-3 p-4 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap min-w-0">
          {dragHandleProps && (
            <div
              {...dragHandleProps}
              title="Drag to reorder"
              className="cursor-grab active:cursor-grabbing h-7 w-7 rounded-md grid place-items-center border border-border/60 text-muted-foreground hover:text-foreground hover:bg-secondary"
            >
              <GripVertical className="w-3.5 h-3.5" />
            </div>
          )}
          {row[imageField] && (
            <img src={row[imageField]} alt="" className="h-10 w-14 object-cover rounded-md border border-border/60 shrink-0" />
          )}
          <div className="min-w-0">
            <div className="text-sm font-semibold truncate max-w-[28ch]">{summaryLabel}</div>
            <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
              <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider ${isPublished ? "bg-emerald-500/15 text-emerald-500" : "bg-amber-500/15 text-amber-500"}`}>
                {isPublished ? <><Globe className="w-3 h-3" /> Published</> : <><FileEdit className="w-3 h-3" /> Draft</>}
              </span>
              <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider ${row.is_active ? "bg-sky-500/15 text-sky-400" : "bg-muted text-muted-foreground"}`}>
                {row.is_active ? "Active" : "Inactive"}
              </span>
              <span className="text-[10px] text-muted-foreground">Sort {row.sort_order ?? 0}</span>
              {vis.live ? (
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider bg-emerald-500/20 text-emerald-400 border border-emerald-500/40">
                  <CheckCircle2 className="w-3 h-3" /> {kind === "hero" ? "Live on Homepage" : "Visible on Homepage"}
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider bg-muted text-muted-foreground border border-border/60" title={vis.reasons.join(" · ")}>
                  <EyeOff className="w-3 h-3" /> Hidden
                </span>
              )}
              {dirty && !isNew && (
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider bg-amber-500/15 text-amber-500">
                  Unsaved
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {!isNew && (
            isPublished
              ? <button onClick={() => onSetStatus("draft")} className="h-8 px-3 rounded-md border border-border text-xs inline-flex items-center gap-1.5 hover:bg-secondary"><EyeOff className="w-3.5 h-3.5" /> Unpublish</button>
              : <button onClick={() => onSetStatus("published")} className="h-8 px-3 rounded-md bg-emerald-500/20 text-emerald-500 border border-emerald-500/40 text-xs inline-flex items-center gap-1.5 hover:bg-emerald-500/30"><Globe className="w-3.5 h-3.5" /> Publish</button>
          )}
          {!expanded && !isNew && (
            <button onClick={onToggleExpand} className="h-8 px-3 rounded-md border border-border text-xs inline-flex items-center gap-1.5 hover:bg-secondary">
              <Pencil className="w-3.5 h-3.5" /> Edit
            </button>
          )}
          {expanded && !isNew && (
            <button onClick={onToggleExpand} className="h-8 w-8 rounded-md border border-border text-xs inline-flex items-center justify-center hover:bg-secondary" title="Collapse">
              <ChevronDown className="w-3.5 h-3.5 rotate-180 transition-transform" />
            </button>
          )}
        </div>
      </div>

      {!vis.live && expanded && vis.reasons.length > 0 && (
        <div className="mx-4 -mt-1 mb-3 flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-[11px] text-amber-500/90">
          <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
          <div>
            <strong className="font-semibold">Not live on homepage</strong> — {vis.reasons.join("; ")}.
          </div>
        </div>
      )}

      {expanded && (
        <div className="px-4 pb-4 space-y-3">
          <div className="grid md:grid-cols-2 gap-3">
            {kind === "reel" && (<>
              <Field label="Title"><input className={cls} value={row.title ?? ""} onChange={e => onChange({ title: e.target.value })} /></Field>
              <Field label="Subtitle / tagline"><input className={cls} value={row.subtitle ?? ""} onChange={e => onChange({ subtitle: e.target.value })} /></Field>
              <Field label="CTA label"><input className={cls} value={row.cta_label ?? ""} onChange={e => onChange({ cta_label: e.target.value })} /></Field>
              <Field label="CTA URL"><input className={cls} value={row.cta_url ?? ""} onChange={e => onChange({ cta_url: e.target.value })} /></Field>
              <Field label="Backdrop / still (16:9, wide)" full>
                <div className="flex items-center gap-3">
                  {row.backdrop_url && <img src={row.backdrop_url} alt="" className="h-14 w-24 object-cover rounded-md border border-border/60" />}
                  <label className="h-9 px-3 rounded-md border border-border text-xs inline-flex items-center gap-1.5 cursor-pointer hover:bg-secondary">
                    <Upload className="w-3.5 h-3.5" /> Upload
                    <input type="file" accept="image/*" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) onUpload("backdrop_url", f); }} />
                  </label>
                  <input placeholder="…or paste backdrop URL" className={cls + " flex-1"} value={row.backdrop_url ?? ""} onChange={e => onChange({ backdrop_url: e.target.value })} />
                </div>
              </Field>
              <Field label="Featured (spotlight)">
                <label className="inline-flex items-center gap-2 text-sm h-10">
                  <input type="checkbox" checked={!!row.is_featured} onChange={e => onChange({ is_featured: e.target.checked })} /> Mark as spotlight
                </label>
              </Field>
            </>)}
            {kind === "hero" && (<>
              <Field label="Internal label (admin only, e.g. Homepage Hero 01)" full><input className={cls} value={row.internal_label ?? ""} onChange={e => onChange({ internal_label: e.target.value })} /></Field>
              <Field label="Hero title (headline)"><input className={cls} value={row.headline ?? ""} onChange={e => onChange({ headline: e.target.value })} /></Field>
              <Field label="Hero subtitle (subheadline)"><input className={cls} value={row.subheadline ?? ""} onChange={e => onChange({ subheadline: e.target.value })} /></Field>
              <Field label="CTA 1 label"><input className={cls} value={row.cta_label ?? ""} onChange={e => onChange({ cta_label: e.target.value })} /></Field>
              <Field label="CTA 1 link"><input className={cls} value={row.cta_url ?? ""} onChange={e => onChange({ cta_url: e.target.value })} /></Field>
              <Field label="CTA 2 label"><input className={cls} value={row.cta2_label ?? ""} onChange={e => onChange({ cta2_label: e.target.value })} /></Field>
              <Field label="CTA 2 link"><input className={cls} value={row.cta2_url ?? ""} onChange={e => onChange({ cta2_url: e.target.value })} /></Field>
            </>)}
            {kind === "ad" && (<>
              <Field label="Slot">
                <select className={cls} value={row.slot} onChange={e => onChange({ slot: e.target.value })}>
                  <option value="top">Top</option><option value="mid">Mid</option><option value="bottom">Bottom</option>
                </select>
              </Field>
              <Field label="Title"><input className={cls} value={row.title ?? ""} onChange={e => onChange({ title: e.target.value })} /></Field>
              <Field label="Link URL"><input className={cls} value={row.link_url ?? ""} onChange={e => onChange({ link_url: e.target.value })} /></Field>
            </>)}
            {kind === "film" && (<>
              <Field label="Title"><input className={cls} value={row.title ?? ""} onChange={e => onChange({ title: e.target.value })} /></Field>
              <Field label="Subtitle / caption"><input className={cls} value={row.subtitle ?? ""} onChange={e => onChange({ subtitle: e.target.value })} /></Field>
              <Field label="Content type (e.g. Feature, Series, Short)"><input className={cls} value={row.content_type ?? ""} onChange={e => onChange({ content_type: e.target.value })} /></Field>
              <Field label="Year"><input type="number" className={cls} value={row.year ?? ""} onChange={e => onChange({ year: e.target.value ? Number(e.target.value) : null })} /></Field>
              <Field label="Partner / platform"><input className={cls} value={row.partner ?? ""} onChange={e => onChange({ partner: e.target.value })} /></Field>
              <Field label="Link URL"><input className={cls} value={row.link_url ?? ""} onChange={e => onChange({ link_url: e.target.value })} /></Field>
              <Field label="Blurb" full><textarea rows={2} className={cls} value={row.blurb ?? ""} onChange={e => onChange({ blurb: e.target.value })} /></Field>
            </>)}
            {kind === "news" && (<>
              <Field label="Type">
                <select className={cls} value={row.kind} onChange={e => onChange({ kind: e.target.value })}>
                  <option value="news">News</option><option value="event">Event</option>
                </select>
              </Field>
              <Field label="Title"><input className={cls} value={row.title ?? ""} onChange={e => onChange({ title: e.target.value })} /></Field>
              <Field label="Link URL"><input className={cls} value={row.link_url ?? ""} onChange={e => onChange({ link_url: e.target.value })} /></Field>
              <Field label="Event date"><input type="datetime-local" className={cls} value={toLocal(row.event_date)} onChange={e => onChange({ event_date: fromLocal(e.target.value) })} /></Field>
              <Field label="Location"><input className={cls} value={row.location ?? ""} onChange={e => onChange({ location: e.target.value })} /></Field>
              <Field label="Summary" full><textarea rows={2} className={cls} value={row.summary ?? ""} onChange={e => onChange({ summary: e.target.value })} /></Field>
            </>)}

            <Field label="Image" full>
              <div className="flex items-center gap-3">
                {row[imageField] && <img src={row[imageField]} alt="" className="h-14 w-24 object-cover rounded-md border border-border/60" />}
                <label className="h-9 px-3 rounded-md border border-border text-xs inline-flex items-center gap-1.5 cursor-pointer hover:bg-secondary">
                  <Upload className="w-3.5 h-3.5" /> Upload
                  <input type="file" accept="image/*" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) onUpload(imageField, f); }} />
                </label>
                <input placeholder="…or paste image URL" className={cls + " flex-1"} value={row[imageField] ?? ""} onChange={e => onChange({ [imageField]: e.target.value })} />
              </div>
            </Field>

            <Field label="Sort order"><input type="number" className={cls} value={row.sort_order ?? 0} onChange={e => onChange({ sort_order: Number(e.target.value) })} /></Field>
            <Field label="Active">
              <label className="inline-flex items-center gap-2 text-sm h-10">
                <input type="checkbox" checked={!!row.is_active} onChange={e => onChange({ is_active: e.target.checked })} /> Visible to public
              </label>
            </Field>
            <Field label="Starts at"><input type="datetime-local" className={cls} value={toLocal(row.starts_at)} onChange={e => onChange({ starts_at: fromLocal(e.target.value) })} /></Field>
            <Field label="Ends at"><input type="datetime-local" className={cls} value={toLocal(row.ends_at)} onChange={e => onChange({ ends_at: fromLocal(e.target.value) })} /></Field>
          </div>

          {isNew && !isPublished && (
            <p className="text-[11px] text-amber-500/90 bg-amber-500/10 border border-amber-500/30 rounded-md px-3 py-2">
              This item will save as <strong>Draft</strong>. After saving, click <strong>Publish</strong> on the row to make it eligible to appear on the homepage.
            </p>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <button onClick={onDelete} className="h-9 px-3 rounded-md border border-border text-xs flex items-center gap-1.5 hover:bg-destructive/10 hover:text-destructive">
              <Trash2 className="w-3.5 h-3.5" /> Delete
            </button>
            <button
              onClick={onSave}
              disabled={saving || (!isNew && !dirty)}
              className="h-9 px-4 rounded-md bg-gradient-primary text-primary-foreground text-xs font-semibold inline-flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
              title={!isNew && !dirty ? "No changes to update" : undefined}
            >
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
              {isNew ? "Save" : "Update"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

const cls = "w-full h-10 px-3 rounded-md bg-background border border-border/60 text-sm focus:outline-none focus:ring-2 focus:ring-accent/40";

function Field({ label, full, children }: { label: string; full?: boolean; children: React.ReactNode }) {
  return (
    <div className={`space-y-1 ${full ? "md:col-span-2" : ""}`}>
      <label className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</label>
      {children}
    </div>
  );
}

function toLocal(v: string | null | undefined) {
  if (!v) return "";
  const d = new Date(v);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function fromLocal(v: string) { return v ? new Date(v).toISOString() : null; }
