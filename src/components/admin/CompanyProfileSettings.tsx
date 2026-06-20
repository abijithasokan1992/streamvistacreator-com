import { useEffect, useRef, useState } from "react";
import { Loader2, Save, ImagePlus, Plus, Trash2, ArrowUp, ArrowDown, Lock, Building2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  fetchCompanyProfile,
  fetchFounderWorks,
  uploadFounderImage,
  type CompanyProfile,
  type FounderWork,
  type BrandUnit,
} from "@/lib/companyProfile";

export default function CompanyProfileSettings() {
  const [profile, setProfile] = useState<CompanyProfile | null>(null);
  const [works, setWorks] = useState<FounderWork[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const imgInput = useRef<HTMLInputElement>(null);

  const load = async () => {
    setLoading(true);
    const [p, w] = await Promise.all([fetchCompanyProfile(), fetchFounderWorks(false)]);
    setProfile(p);
    setWorks(w);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const setField = <K extends keyof CompanyProfile>(k: K, v: CompanyProfile[K]) => {
    if (!profile) return;
    setProfile({ ...profile, [k]: v });
  };

  const setBrand = (i: number, patch: Partial<BrandUnit>) => {
    if (!profile) return;
    const brands = [...profile.brands];
    brands[i] = { ...brands[i], ...patch };
    setProfile({ ...profile, brands });
  };

  const setVisibility = (k: keyof CompanyProfile["visibility"], v: boolean) => {
    if (!profile) return;
    setProfile({ ...profile, visibility: { ...profile.visibility, [k]: v } });
  };

  const onUpload = async (file: File) => {
    if (!file.type.startsWith("image/")) { toast.error("Please choose an image"); return; }
    setUploading(true);
    try {
      const url = await uploadFounderImage(file);
      setField("founder_image_url", url);
      toast.success("Image uploaded — remember to save");
    } catch (e: any) {
      toast.error(e?.message ?? "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const saveProfile = async () => {
    if (!profile) return;
    setSaving(true);
    const { error } = await (supabase as any).from("company_profile").update({
      parent_company_name: profile.parent_company_name,
      parent_company_description: profile.parent_company_description,
      ecosystem_thesis: profile.ecosystem_thesis,
      founder_name: profile.founder_name,
      founder_role_line: profile.founder_role_line,
      founder_bio: profile.founder_bio,
      founder_image_url: profile.founder_image_url,
      founder_image_alt: profile.founder_image_alt,
      brands: profile.brands,
      visibility: profile.visibility,
    }).eq("id", profile.id);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Company profile saved");
  };

  const addWork = async () => {
    const sort_order = (works.at(-1)?.sort_order ?? 0) + 10;
    const { data, error } = await (supabase as any).from("founder_works").insert({
      title: "New work", role: "", synopsis: "", achievement: "", banner: "Crayons Pictures", sort_order, visible: true,
    }).select("*").maybeSingle();
    if (error) return toast.error(error.message);
    setWorks([...works, data as FounderWork]);
  };

  const saveWork = async (w: FounderWork) => {
    const { error } = await (supabase as any).from("founder_works").update({
      title: w.title, role: w.role, year: w.year, synopsis: w.synopsis,
      achievement: w.achievement, banner: w.banner, sort_order: w.sort_order, visible: w.visible,
    }).eq("id", w.id);
    if (error) return toast.error(error.message);
    toast.success("Work saved");
  };

  const deleteWork = async (id: string) => {
    if (!confirm("Delete this entry?")) return;
    const { error } = await (supabase as any).from("founder_works").delete().eq("id", id);
    if (error) return toast.error(error.message);
    setWorks(works.filter((w) => w.id !== id));
  };

  const moveWork = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= works.length) return;
    const next = [...works];
    const a = next[i].sort_order;
    next[i].sort_order = next[j].sort_order;
    next[j].sort_order = a;
    [next[i], next[j]] = [next[j], next[i]];
    setWorks(next);
  };

  const updateWork = (i: number, patch: Partial<FounderWork>) => {
    const next = [...works];
    next[i] = { ...next[i], ...patch };
    setWorks(next);
  };

  if (loading || !profile) {
    return (
      <div className="glass rounded-2xl p-10 grid place-items-center">
        <Loader2 className="w-5 h-5 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="glass rounded-2xl p-6 space-y-5">
        <div className="flex items-center gap-2">
          <Building2 className="w-5 h-5 text-accent" />
          <h2 className="font-display text-xl font-bold">Company Profile & Founder</h2>
          <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-md bg-accent/10 text-accent border border-accent/30">
            <Lock className="w-3 h-3" /> Admin only
          </span>
        </div>
        <p className="text-xs text-muted-foreground -mt-3">
          Drives the public About page and founder credibility blocks.
        </p>

        {/* Visibility */}
        <div className="rounded-xl border border-border/60 p-4">
          <div className="text-xs uppercase tracking-wider text-muted-foreground mb-3">Block visibility</div>
          <div className="flex flex-wrap gap-3 text-sm">
            {(["hero","founder","brands","works","thesis"] as const).map((k) => (
              <label key={k} className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md border border-border/60 cursor-pointer">
                <input type="checkbox" checked={!!profile.visibility?.[k]} onChange={(e) => setVisibility(k, e.target.checked)} />
                <span className="capitalize">{k}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Parent company */}
        <div className="grid md:grid-cols-2 gap-4">
          <Field label="Parent company name">
            <input className="input" value={profile.parent_company_name} onChange={(e) => setField("parent_company_name", e.target.value)} />
          </Field>
          <Field label="Founder name">
            <input className="input" value={profile.founder_name} onChange={(e) => setField("founder_name", e.target.value)} />
          </Field>
        </div>
        <Field label="Parent company description">
          <textarea className="input min-h-[90px]" value={profile.parent_company_description} onChange={(e) => setField("parent_company_description", e.target.value)} />
        </Field>
        <Field label="Ecosystem thesis (Why this ecosystem exists)">
          <textarea className="input min-h-[90px]" value={profile.ecosystem_thesis} onChange={(e) => setField("ecosystem_thesis", e.target.value)} />
        </Field>

        {/* Founder image */}
        <div className="rounded-xl border border-border/60 p-4 grid md:grid-cols-[160px,1fr] gap-4">
          <div className="aspect-[3/4] rounded-lg bg-secondary/40 border border-border/50 grid place-items-center overflow-hidden">
            {profile.founder_image_url
              ? <img src={profile.founder_image_url} alt="" className="w-full h-full object-cover" />
              : <span className="text-xs text-muted-foreground text-center px-2">No portrait</span>}
          </div>
          <div className="space-y-2">
            <div className="text-xs uppercase tracking-wider text-muted-foreground">Founder portrait</div>
            <Field label="Image alt text">
              <input className="input" value={profile.founder_image_alt ?? ""} onChange={(e) => setField("founder_image_alt", e.target.value)} />
            </Field>
            <div className="flex gap-2">
              <button onClick={() => imgInput.current?.click()} disabled={uploading} className="px-3 py-2 text-sm rounded-md border border-border hover:bg-secondary flex items-center gap-2">
                {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ImagePlus className="w-4 h-4" />}
                Upload portrait
              </button>
              {profile.founder_image_url && (
                <button onClick={() => setField("founder_image_url", null)} className="px-3 py-2 text-sm rounded-md border border-border hover:bg-secondary">
                  Remove
                </button>
              )}
              <input ref={imgInput} type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) onUpload(f); e.currentTarget.value = ""; }} />
            </div>
          </div>
        </div>

        <Field label="Founder role line">
          <textarea className="input min-h-[60px]" value={profile.founder_role_line} onChange={(e) => setField("founder_role_line", e.target.value)} />
        </Field>
        <Field label="Founder bio">
          <textarea className="input min-h-[160px]" value={profile.founder_bio} onChange={(e) => setField("founder_bio", e.target.value)} />
        </Field>

        {/* Brands */}
        <div className="rounded-xl border border-border/60 p-4 space-y-3">
          <div className="text-xs uppercase tracking-wider text-muted-foreground">Brand / business units</div>
          {profile.brands?.map((b, i) => (
            <div key={b.key} className="rounded-lg border border-border/50 p-3 space-y-2">
              <div className="grid md:grid-cols-2 gap-2">
                <Field label="Title"><input className="input" value={b.title} onChange={(e) => setBrand(i, { title: e.target.value })} /></Field>
                <Field label="One-liner"><input className="input" value={b.one_liner} onChange={(e) => setBrand(i, { one_liner: e.target.value })} /></Field>
              </div>
              <Field label="Description">
                <textarea className="input min-h-[60px]" value={b.description} onChange={(e) => setBrand(i, { description: e.target.value })} />
              </Field>
              <Field label="Link (optional)">
                <input className="input" value={b.link ?? ""} onChange={(e) => setBrand(i, { link: e.target.value })} placeholder="https://…" />
              </Field>
            </div>
          ))}
        </div>

        <div className="flex justify-end">
          <button onClick={saveProfile} disabled={saving} className="px-4 py-2 text-sm rounded-md bg-gradient-primary text-primary-foreground glow-primary flex items-center gap-2">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Save profile
          </button>
        </div>
      </div>

      {/* Founder works */}
      <div className="glass rounded-2xl p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-display text-lg font-bold">Selected works & milestones</h3>
            <p className="text-xs text-muted-foreground">Editable filmography seeded with Kolumittayi and Jananam 1947 Pranayam Thudarunnu.</p>
          </div>
          <button onClick={addWork} className="px-3 py-2 text-sm rounded-md border border-border hover:bg-secondary flex items-center gap-2">
            <Plus className="w-4 h-4" /> Add entry
          </button>
        </div>

        <div className="space-y-3">
          {works.map((w, i) => (
            <div key={w.id} className="rounded-xl border border-border/60 p-4 space-y-2">
              <div className="flex items-center gap-2">
                <button onClick={() => moveWork(i, -1)} className="p-1.5 rounded-md border border-border hover:bg-secondary"><ArrowUp className="w-3.5 h-3.5" /></button>
                <button onClick={() => moveWork(i, 1)} className="p-1.5 rounded-md border border-border hover:bg-secondary"><ArrowDown className="w-3.5 h-3.5" /></button>
                <label className="inline-flex items-center gap-2 text-xs ml-2">
                  <input type="checkbox" checked={w.visible} onChange={(e) => updateWork(i, { visible: e.target.checked })} />
                  Visible
                </label>
                <div className="flex-1" />
                <button onClick={() => saveWork(w)} className="px-2.5 py-1.5 text-xs rounded-md bg-gradient-primary text-primary-foreground flex items-center gap-1.5"><Save className="w-3.5 h-3.5" /> Save</button>
                <button onClick={() => deleteWork(w.id)} className="p-1.5 rounded-md border border-border hover:bg-destructive/20 text-destructive"><Trash2 className="w-3.5 h-3.5" /></button>
              </div>
              <div className="grid md:grid-cols-3 gap-2">
                <Field label="Title"><input className="input" value={w.title} onChange={(e) => updateWork(i, { title: e.target.value })} /></Field>
                <Field label="Role"><input className="input" value={w.role ?? ""} onChange={(e) => updateWork(i, { role: e.target.value })} /></Field>
                <Field label="Year"><input className="input" value={w.year ?? ""} onChange={(e) => updateWork(i, { year: e.target.value })} /></Field>
              </div>
              <Field label="Banner">
                <input className="input" value={w.banner ?? ""} onChange={(e) => updateWork(i, { banner: e.target.value })} />
              </Field>
              <Field label="Synopsis">
                <textarea className="input min-h-[60px]" value={w.synopsis ?? ""} onChange={(e) => updateWork(i, { synopsis: e.target.value })} />
              </Field>
              <Field label="Achievement / festival / award">
                <textarea className="input min-h-[60px]" value={w.achievement ?? ""} onChange={(e) => updateWork(i, { achievement: e.target.value })} />
              </Field>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1">
      <span className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}
