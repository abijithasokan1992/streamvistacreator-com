import { useEffect, useState, useCallback } from "react";
import { Loader2, Plus, Trash2, Save, Upload, Image as ImageIcon, Newspaper, Film, Megaphone, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

type AnyRow = Record<string, any> & { id: string };

const TABLES = {
  hero: "hero_banners",
  ad: "ad_zones",
  film: "featured_films",
  news: "news_events",
} as const;

type Kind = keyof typeof TABLES;

const BLANK: Record<Kind, AnyRow> = {
  hero: { id: "", headline: "", subheadline: "", image_url: "", cta_label: "", cta_url: "", sort_order: 0, is_active: true, starts_at: null, ends_at: null },
  ad:   { id: "", slot: "top", title: "", image_url: "", link_url: "", sort_order: 0, is_active: true, starts_at: null, ends_at: null },
  film: { id: "", title: "", blurb: "", poster_url: "", link_url: "", sort_order: 0, is_active: true, starts_at: null, ends_at: null },
  news: { id: "", kind: "news", title: "", summary: "", image_url: "", link_url: "", event_date: null, location: "", sort_order: 0, is_active: true, starts_at: null, ends_at: null },
};

export default function MarketingCMS() {
  return (
    <div className="glass rounded-2xl p-6 space-y-8">
      <div className="flex items-start gap-3">
        <div className="w-11 h-11 rounded-xl bg-accent/10 text-accent grid place-items-center shrink-0">
          <Sparkles className="w-5 h-5" />
        </div>
        <div>
          <h2 className="font-display text-2xl font-bold">Homepage CMS</h2>
          <p className="text-sm text-muted-foreground">Manage hero banners, advertisement zones, featured films and news / events on the public landing.</p>
        </div>
      </div>
      <Section kind="hero" title="Hero banners (carousel)" icon={<ImageIcon className="w-4 h-4" />} />
      <Section kind="ad"   title="Advertisement zones"     icon={<Megaphone className="w-4 h-4" />} />
      <Section kind="film" title="Featured films / projects" icon={<Film className="w-4 h-4" />} />
      <Section kind="news" title="News & events"           icon={<Newspaper className="w-4 h-4" />} />
    </div>
  );
}

function Section({ kind, title, icon }: { kind: Kind; title: string; icon: React.ReactNode }) {
  const table = TABLES[kind];
  const [rows, setRows] = useState<AnyRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await (supabase as any).from(table).select("*").order("sort_order").order("created_at", { ascending: false });
    setLoading(false);
    if (error) return toast.error(error.message);
    setRows((data as AnyRow[]) ?? []);
  }, [table]);

  useEffect(() => { load(); }, [load]);

  const add = () => setRows(r => [{ ...BLANK[kind], id: `new-${crypto.randomUUID()}` }, ...r]);

  const update = (id: string, patch: Partial<AnyRow>) =>
    setRows(r => r.map(x => x.id === id ? { ...x, ...patch } : x));

  const save = async (row: AnyRow) => {
    setSavingId(row.id);
    const isNew = row.id.startsWith("new-");
    const payload: AnyRow = { ...row };
    if (isNew) delete (payload as any).id;
    // empty-string dates → null
    ["starts_at","ends_at","event_date"].forEach(k => { if (payload[k] === "") payload[k] = null; });
    const q = isNew
      ? (supabase as any).from(table).insert(payload).select().single()
      : (supabase as any).from(table).update(payload).eq("id", row.id).select().single();
    const { data, error } = await q;
    setSavingId(null);
    if (error) return toast.error(error.message);
    setRows(r => r.map(x => x.id === row.id ? (data as AnyRow) : x));
    toast.success("Saved");
  };

  const remove = async (id: string) => {
    if (id.startsWith("new-")) { setRows(r => r.filter(x => x.id !== id)); return; }
    if (!confirm("Delete this item?")) return;
    const { error } = await (supabase as any).from(table).delete().eq("id", id);
    if (error) return toast.error(error.message);
    setRows(r => r.filter(x => x.id !== id));
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

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-sm flex items-center gap-2 text-foreground/90">{icon}{title}</h3>
        <button onClick={add} className="h-8 px-3 rounded-md border border-border text-xs flex items-center gap-1.5 hover:bg-secondary">
          <Plus className="w-3.5 h-3.5" /> Add
        </button>
      </div>
      {loading ? (
        <div className="py-8 grid place-items-center"><Loader2 className="w-4 h-4 animate-spin text-primary" /></div>
      ) : rows.length === 0 ? (
        <p className="text-xs text-muted-foreground py-6 text-center border border-dashed border-border/50 rounded-xl">No items yet — click Add.</p>
      ) : (
        <div className="space-y-3">
          {rows.map(row => (
            <RowCard
              key={row.id}
              kind={kind}
              row={row}
              onChange={(patch) => update(row.id, patch)}
              onSave={() => save(row)}
              onDelete={() => remove(row.id)}
              onUpload={(field, file) => uploadImage(row, field, file)}
              saving={savingId === row.id}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function RowCard({ kind, row, onChange, onSave, onDelete, onUpload, saving }: {
  kind: Kind; row: AnyRow;
  onChange: (p: Partial<AnyRow>) => void;
  onSave: () => void; onDelete: () => void;
  onUpload: (field: string, file: File) => void;
  saving: boolean;
}) {
  const imageField = kind === "film" ? "poster_url" : "image_url";
  return (
    <div className="rounded-xl border border-border/60 bg-secondary/20 p-4 space-y-3">
      <div className="grid md:grid-cols-2 gap-3">
        {kind === "hero" && (<>
          <Field label="Headline"><input className={cls} value={row.headline ?? ""} onChange={e => onChange({ headline: e.target.value })} /></Field>
          <Field label="Subheadline"><input className={cls} value={row.subheadline ?? ""} onChange={e => onChange({ subheadline: e.target.value })} /></Field>
          <Field label="CTA label"><input className={cls} value={row.cta_label ?? ""} onChange={e => onChange({ cta_label: e.target.value })} /></Field>
          <Field label="CTA URL"><input className={cls} value={row.cta_url ?? ""} onChange={e => onChange({ cta_url: e.target.value })} /></Field>
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
      <div className="flex justify-end gap-2 pt-1">
        <button onClick={onDelete} className="h-9 px-3 rounded-md border border-border text-xs flex items-center gap-1.5 hover:bg-destructive/10 hover:text-destructive">
          <Trash2 className="w-3.5 h-3.5" /> Delete
        </button>
        <button onClick={onSave} disabled={saving} className="h-9 px-4 rounded-md bg-gradient-primary text-primary-foreground text-xs font-semibold inline-flex items-center gap-1.5 disabled:opacity-60">
          {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />} Save
        </button>
      </div>
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
