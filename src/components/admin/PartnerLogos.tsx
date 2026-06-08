import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Building2, Loader2, Plus, Save, Trash2, Upload, GripVertical, Eye, EyeOff } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

type Logo = {
  id: string;
  name: string;
  tag: string;
  description: string;
  logo_url: string;
  sort_order: number;
  is_active: boolean;
};

type Settings = {
  aspect_ratio: string;
  object_fit: string;
  container_bg: string;
};

const ASPECTS = ["16/9", "4/3", "3/2", "1/1", "21/9"];
const FITS = ["contain", "cover"];
const SIGNED_URL_TTL = 60 * 60 * 24 * 365 * 10; // ~10 years

/** Convert any image File → PNG Blob, letterboxed into the target aspect ratio. */
async function fileToUnifiedPng(file: File, aspectRatio: string, bg: string, fit: "contain" | "cover"): Promise<Blob> {
  const [aw, ah] = aspectRatio.split("/").map(Number);
  const targetW = 1200;
  const targetH = Math.round((targetW * ah) / aw);

  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = () => reject(new Error("Could not decode image"));
      i.src = url;
    });

    const canvas = document.createElement("canvas");
    canvas.width = targetW;
    canvas.height = targetH;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas unsupported");

    // Background (use transparent if bg is "transparent")
    if (bg && bg !== "transparent") {
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, targetW, targetH);
    } else {
      ctx.clearRect(0, 0, targetW, targetH);
    }

    const ratio = img.width / img.height;
    const targetRatio = targetW / targetH;
    let dw: number, dh: number;
    if (fit === "cover") {
      if (ratio > targetRatio) { dh = targetH; dw = dh * ratio; }
      else { dw = targetW; dh = dw / ratio; }
    } else {
      // contain with padding
      const pad = 0.12; // 12% safe padding so logos breathe
      const maxW = targetW * (1 - pad * 2);
      const maxH = targetH * (1 - pad * 2);
      if (ratio > maxW / maxH) { dw = maxW; dh = dw / ratio; }
      else { dh = maxH; dw = dh * ratio; }
    }
    const dx = (targetW - dw) / 2;
    const dy = (targetH - dh) / 2;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(img, dx, dy, dw, dh);

    return await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("PNG encode failed"))), "image/png")
    );
  } finally {
    URL.revokeObjectURL(url);
  }
}

async function uploadAndSign(blob: Blob, filenameHint: string): Promise<string> {
  const key = `${crypto.randomUUID()}-${filenameHint.replace(/[^a-z0-9.-]/gi, "_")}.png`;
  const { error: upErr } = await supabase.storage.from("partner-logos").upload(key, blob, {
    contentType: "image/png",
    upsert: false,
  });
  if (upErr) throw upErr;
  const { data, error } = await supabase.storage.from("partner-logos").createSignedUrl(key, SIGNED_URL_TTL);
  if (error || !data?.signedUrl) throw error ?? new Error("Could not sign URL");
  return data.signedUrl;
}

export default function PartnerLogos() {
  const [logos, setLogos] = useState<Logo[]>([]);
  const [settings, setSettings] = useState<Settings>({ aspect_ratio: "16/9", object_fit: "contain", container_bg: "#ffffff" });
  const [loading, setLoading] = useState(true);
  const [savingSettings, setSavingSettings] = useState(false);
  const [addOpen, setAddOpen] = useState(false);

  const load = async () => {
    setLoading(true);
    const [{ data: rows }, { data: s }] = await Promise.all([
      supabase.from("partner_logos").select("*").order("sort_order", { ascending: true }),
      supabase.from("partner_logos_settings").select("*").eq("id", true).maybeSingle(),
    ]);
    setLogos((rows as Logo[]) ?? []);
    if (s) setSettings({ aspect_ratio: s.aspect_ratio, object_fit: s.object_fit, container_bg: s.container_bg });
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const saveSettings = async () => {
    setSavingSettings(true);
    const { error } = await supabase
      .from("partner_logos_settings")
      .upsert({ id: true, ...settings }, { onConflict: "id" });
    setSavingSettings(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Logo display settings saved");
  };

  const updateLogo = async (id: string, patch: Partial<Logo>) => {
    setLogos(prev => prev.map(l => l.id === id ? { ...l, ...patch } : l));
    const { error } = await supabase.from("partner_logos").update(patch).eq("id", id);
    if (error) toast.error(error.message);
  };

  const removeLogo = async (id: string) => {
    if (!confirm("Remove this partner?")) return;
    const { error } = await supabase.from("partner_logos").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    setLogos(prev => prev.filter(l => l.id !== id));
    toast.success("Removed");
  };

  return (
    <div className="glass rounded-2xl p-6 space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="font-display text-2xl font-bold flex items-center gap-2">
            <Building2 className="w-5 h-5 text-accent" /> Cloud Studio Partners
          </h2>
          <p className="text-xs text-muted-foreground mt-1">
            Upload any image — it's auto-converted to a uniform PNG using the aspect ratio below. Public homepage updates instantly.
          </p>
        </div>
        <button
          onClick={() => setAddOpen(v => !v)}
          className="h-10 px-4 rounded-xl bg-gradient-primary text-primary-foreground text-sm font-semibold inline-flex items-center gap-2 glow-primary"
        >
          <Plus className="w-4 h-4" /> Add partner
        </button>
      </div>

      {/* Settings */}
      <div className="rounded-xl border border-border/50 bg-secondary/20 p-4 grid sm:grid-cols-4 gap-3 items-end">
        <Field label="Aspect ratio">
          <select
            value={settings.aspect_ratio}
            onChange={e => setSettings(s => ({ ...s, aspect_ratio: e.target.value }))}
            className="w-full h-10 px-3 rounded-lg bg-background border border-border/60 text-sm"
          >
            {ASPECTS.map(a => <option key={a} value={a}>{a}</option>)}
          </select>
        </Field>
        <Field label="Fit">
          <select
            value={settings.object_fit}
            onChange={e => setSettings(s => ({ ...s, object_fit: e.target.value }))}
            className="w-full h-10 px-3 rounded-lg bg-background border border-border/60 text-sm"
          >
            {FITS.map(f => <option key={f} value={f}>{f}</option>)}
          </select>
        </Field>
        <Field label="Container background">
          <div className="flex gap-2">
            <input
              type="color"
              value={settings.container_bg === "transparent" ? "#ffffff" : settings.container_bg}
              onChange={e => setSettings(s => ({ ...s, container_bg: e.target.value }))}
              className="h-10 w-12 rounded-lg bg-background border border-border/60 cursor-pointer"
            />
            <input
              value={settings.container_bg}
              onChange={e => setSettings(s => ({ ...s, container_bg: e.target.value }))}
              placeholder="#ffffff or transparent"
              className="flex-1 h-10 px-3 rounded-lg bg-background border border-border/60 text-sm font-mono"
            />
          </div>
        </Field>
        <button
          onClick={saveSettings}
          disabled={savingSettings}
          className="h-10 px-4 rounded-lg bg-accent text-accent-foreground text-sm font-semibold inline-flex items-center justify-center gap-2 disabled:opacity-60"
        >
          {savingSettings ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Save display
        </button>
      </div>

      {addOpen && (
        <AddPartnerForm
          settings={settings}
          onCancel={() => setAddOpen(false)}
          onCreated={(l) => { setLogos(prev => [...prev, l]); setAddOpen(false); }}
          existingCount={logos.length}
        />
      )}

      {/* List */}
      {loading ? (
        <div className="py-10 grid place-items-center"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>
      ) : logos.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border/60 p-10 text-center text-sm text-muted-foreground">
          No partners yet. Click <span className="text-foreground">Add partner</span> to upload your first logo.
          <div className="text-[11px] mt-2">Until then, the homepage shows cinematic icon placeholders.</div>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 gap-4">
          {logos.map(l => (
            <PartnerRow
              key={l.id}
              logo={l}
              settings={settings}
              onUpdate={(p) => updateLogo(l.id, p)}
              onDelete={() => removeLogo(l.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</label>
      {children}
    </div>
  );
}

function AddPartnerForm({
  settings, onCancel, onCreated, existingCount,
}: {
  settings: Settings;
  onCancel: () => void;
  onCreated: (l: Logo) => void;
  existingCount: number;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState("");
  const [tag, setTag] = useState("");
  const [description, setDescription] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!file) { setPreview(null); return; }
    let cancelled = false;
    (async () => {
      try {
        const blob = await fileToUnifiedPng(file, settings.aspect_ratio, settings.container_bg, settings.object_fit as "contain" | "cover");
        if (!cancelled) setPreview(URL.createObjectURL(blob));
      } catch {/* ignore */}
    })();
    return () => { cancelled = true; };
  }, [file, settings.aspect_ratio, settings.container_bg, settings.object_fit]);

  const submit = async () => {
    if (!name.trim()) return toast.error("Name is required");
    if (!file) return toast.error("Pick an image file");
    setBusy(true);
    try {
      const png = await fileToUnifiedPng(file, settings.aspect_ratio, settings.container_bg, settings.object_fit as "contain" | "cover");
      const logo_url = await uploadAndSign(png, name);
      const { data, error } = await supabase
        .from("partner_logos")
        .insert({ name, tag, description, logo_url, sort_order: existingCount })
        .select()
        .single();
      if (error) throw error;
      toast.success("Partner added");
      onCreated(data as Logo);
    } catch (e: any) {
      toast.error(e?.message ?? "Upload failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-xl border border-accent/40 bg-secondary/30 p-5 space-y-4 animate-fade-in">
      <div className="grid sm:grid-cols-2 gap-4">
        <div className="space-y-3">
          <Field label="Partner name">
            <input value={name} onChange={e => setName(e.target.value)} placeholder="Crayons Pictures"
              className="w-full h-10 px-3 rounded-lg bg-background border border-border/60 text-sm" />
          </Field>
          <Field label="Tag">
            <input value={tag} onChange={e => setTag(e.target.value)} placeholder="Production House"
              className="w-full h-10 px-3 rounded-lg bg-background border border-border/60 text-sm" />
          </Field>
          <Field label="Description">
            <textarea value={description} onChange={e => setDescription(e.target.value)} rows={3}
              placeholder="Short blurb shown under the logo…"
              className="w-full px-3 py-2 rounded-lg bg-background border border-border/60 text-sm resize-none" />
          </Field>
          <Field label="Logo file (any format — auto-converted to PNG)">
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="w-full h-10 px-3 rounded-lg border border-dashed border-border/70 hover:border-accent/60 text-sm inline-flex items-center justify-center gap-2"
            >
              <Upload className="w-4 h-4" /> {file ? file.name : "Choose file"}
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              hidden
              onChange={e => setFile(e.target.files?.[0] ?? null)}
            />
          </Field>
        </div>
        <div className="space-y-2">
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Live preview</div>
          <div
            className="rounded-xl border border-border/60 overflow-hidden grid place-items-center"
            style={{ aspectRatio: settings.aspect_ratio.replace("/", " / "), background: settings.container_bg }}
          >
            {preview ? (
              <img src={preview} alt="Preview" className="w-full h-full object-contain" />
            ) : (
              <div className="text-xs text-muted-foreground">No file selected</div>
            )}
          </div>
          <div className="text-[10px] text-muted-foreground">
            Output PNG · 1200 × {Math.round(1200 * Number(settings.aspect_ratio.split("/")[1]) / Number(settings.aspect_ratio.split("/")[0]))} · fit: {settings.object_fit}
          </div>
        </div>
      </div>
      <div className="flex items-center justify-end gap-2">
        <button onClick={onCancel} className="h-10 px-4 rounded-lg border border-border text-sm">Cancel</button>
        <button onClick={submit} disabled={busy}
          className="h-10 px-4 rounded-lg bg-gradient-primary text-primary-foreground text-sm font-semibold inline-flex items-center gap-2 glow-primary disabled:opacity-60">
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Save partner
        </button>
      </div>
    </div>
  );
}

function PartnerRow({
  logo, settings, onUpdate, onDelete,
}: {
  logo: Logo;
  settings: Settings;
  onUpdate: (p: Partial<Logo>) => void;
  onDelete: () => void;
}) {
  const [name, setName] = useState(logo.name);
  const [tag, setTag] = useState(logo.tag);
  const [description, setDescription] = useState(logo.description);

  return (
    <div className="rounded-xl border border-border/50 bg-secondary/20 p-4 space-y-3">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <GripVertical className="w-4 h-4" />
        <span className="font-mono">#{logo.sort_order}</span>
        <button
          onClick={() => onUpdate({ is_active: !logo.is_active })}
          className={`ml-auto inline-flex items-center gap-1 px-2 py-1 rounded-md border text-[11px] ${logo.is_active ? "border-success/50 text-success" : "border-border text-muted-foreground"}`}
        >
          {logo.is_active ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
          {logo.is_active ? "Live" : "Hidden"}
        </button>
        <button onClick={onDelete} className="p-1.5 rounded-md hover:bg-destructive/10 text-destructive">
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
      <div
        className="rounded-lg overflow-hidden border border-border/40"
        style={{ aspectRatio: settings.aspect_ratio.replace("/", " / "), background: settings.container_bg }}
      >
        <img src={logo.logo_url} alt={logo.name} className="w-full h-full object-contain" />
      </div>
      <input value={name} onChange={e => setName(e.target.value)} onBlur={() => name !== logo.name && onUpdate({ name })}
        className="w-full h-9 px-3 rounded-lg bg-background border border-border/60 text-sm font-semibold" />
      <input value={tag} onChange={e => setTag(e.target.value)} onBlur={() => tag !== logo.tag && onUpdate({ tag })}
        placeholder="Tag"
        className="w-full h-9 px-3 rounded-lg bg-background border border-border/60 text-xs" />
      <textarea value={description} onChange={e => setDescription(e.target.value)} onBlur={() => description !== logo.description && onUpdate({ description })}
        rows={2} placeholder="Description"
        className="w-full px-3 py-2 rounded-lg bg-background border border-border/60 text-xs resize-none" />
    </div>
  );
}
