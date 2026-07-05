import { useEffect, useRef, useState } from "react";
import { Loader2, ImagePlus, Lock, Save } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { fetchBranding, uploadBrandingFile, type BrandingSettings as B } from "@/lib/branding";

export default function BrandingSettings() {
  const [b, setB] = useState<B | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState<"site" | "footer" | null>(null);
  const siteInput = useRef<HTMLInputElement>(null);
  const footerInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchBranding(true).then((v) => { setB(v); setLoading(false); });
  }, []);

  const upload = async (kind: "site" | "footer", file: File) => {
    if (!b) return;
    if (!file.type.startsWith("image/")) { toast.error("Please choose an image"); return; }
    setUploading(kind);
    try {
      const path = `${kind}/${kind}-${Date.now()}-${file.name}`;
      const url = await uploadBrandingFile(file, path);
      setB({ ...b, [kind === "site" ? "site_logo_url" : "footer_logo_url"]: url });
      toast.success("Logo uploaded — don't forget to save");
    } catch (e: any) {
      toast.error(e?.message ?? "Upload failed");
    } finally {
      setUploading(null);
    }
  };

  const save = async () => {
    if (!b) return;
    setSaving(true);
    const { error } = await supabase.from("branding_settings").update({
      site_logo_url: b.site_logo_url,
      site_logo_position: b.site_logo_position,
      footer_logo_url: b.footer_logo_url,
      footer_logo_position: b.footer_logo_position,
      show_wordmark: b.show_wordmark,
      allow_user_logos: b.allow_user_logos,
      user_logos_paid_only: b.user_logos_paid_only,
    }).eq("id", b.id);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Branding saved · live across the site");
  };

  return (
    <div className="glass rounded-2xl p-6 space-y-5">
      <div className="flex items-center gap-2">
        <ImagePlus className="w-5 h-5 text-accent" />
        <h2 className="font-display text-xl font-bold">Site Branding</h2>
        <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-md bg-accent/10 text-accent border border-accent/30">
          <Lock className="w-3 h-3" /> Admin only
        </span>
      </div>

      {/* Canonical brand assets — read only reference */}
      <div className="rounded-xl border border-border/50 bg-secondary/20 p-4">
        <div className="text-[10px] font-mono-tech uppercase tracking-[0.22em] text-muted-foreground mb-3">
          Official brand assets · The Crayons Network
        </div>
        <div className="grid grid-cols-3 gap-3">
          {[
            { name: "Crayons Pictures", url: "/__l5e/assets-v1/5555a121-bd40-4126-be14-47370e1c5210/crayons-pictures.png" },
            { name: "Crayons Bridge",   url: "/__l5e/assets-v1/d6f6a6b8-1cdf-404b-8bf3-0c7b03349c78/crayons-bridge.png" },
            { name: "Crayons Loop",     url: "/__l5e/assets-v1/27bcc856-a282-449e-9b01-311b6bfd20bb/crayons-loop.png" },
          ].map((b) => (
            <div key={b.name} className="rounded-lg border border-border/50 bg-background/40 p-3 grid place-items-center">
              <img src={b.url} alt={b.name} className="h-10 w-auto object-contain" />
              <div className="mt-2 text-[10px] uppercase tracking-[0.16em] text-muted-foreground text-center">{b.name}</div>
            </div>
          ))}
        </div>
        <p className="text-[11px] text-muted-foreground mt-3">
          Canonical logos used across the site, auth screens, About page, and transactional emails. Managed via Lovable Assets — not user-uploadable.
        </p>
      </div>
      <p className="text-xs text-muted-foreground -mt-3">
        Upload a logo for the navbar and footer. Images auto-fit their containers (aspect ratio preserved).
      </p>

      {loading || !b ? (
        <div className="py-10 grid place-items-center"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>
      ) : (
        <>
          <div className="grid md:grid-cols-2 gap-5">
            {/* Site logo */}
            <div className="border border-border/60 rounded-xl p-4 space-y-3">
              <div className="text-xs uppercase tracking-wider text-muted-foreground">Header logo</div>
              <div className="h-24 rounded-lg bg-secondary/40 border border-border/50 grid place-items-center overflow-hidden">
                {b.site_logo_url
                  ? <img src={b.site_logo_url} alt="" className="max-h-full max-w-full object-contain" />
                  : <span className="text-xs text-muted-foreground">No logo uploaded</span>}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => siteInput.current?.click()}
                  disabled={uploading === "site"}
                  className="flex-1 h-10 rounded-md border border-border text-xs font-medium hover:bg-secondary flex items-center justify-center gap-2"
                >
                  {uploading === "site" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ImagePlus className="w-3.5 h-3.5" />}
                  Choose image
                </button>
                {b.site_logo_url && (
                  <button onClick={() => setB({ ...b, site_logo_url: null })}
                    className="h-10 px-3 rounded-md border border-border text-xs hover:bg-secondary">Remove</button>
                )}
              </div>
              <input ref={siteInput} type="file" accept="image/*" className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) upload("site", f); e.currentTarget.value = ""; }} />
              <label className="block">
                <span className="text-[11px] uppercase tracking-wider text-muted-foreground">Position</span>
                <select value={b.site_logo_position}
                  onChange={(e) => setB({ ...b, site_logo_position: e.target.value as any })}
                  className="mt-1 w-full h-9 px-2 rounded-md bg-secondary/50 border border-border text-sm">
                  <option value="top-left">Top left</option>
                  <option value="top-right">Top right</option>
                </select>
              </label>
              <label className="flex items-center gap-2 text-xs">
                <input type="checkbox" checked={b.show_wordmark}
                  onChange={(e) => setB({ ...b, show_wordmark: e.target.checked })} />
                Show "StreamVista Cloud X" wordmark next to logo
              </label>
            </div>

            {/* Footer logo */}
            <div className="border border-border/60 rounded-xl p-4 space-y-3">
              <div className="text-xs uppercase tracking-wider text-muted-foreground">Footer logo</div>
              <div className="h-24 rounded-lg bg-secondary/40 border border-border/50 grid place-items-center overflow-hidden">
                {b.footer_logo_url
                  ? <img src={b.footer_logo_url} alt="" className="max-h-full max-w-full object-contain" />
                  : <span className="text-xs text-muted-foreground">No footer logo</span>}
              </div>
              <div className="flex gap-2">
                <button onClick={() => footerInput.current?.click()} disabled={uploading === "footer"}
                  className="flex-1 h-10 rounded-md border border-border text-xs font-medium hover:bg-secondary flex items-center justify-center gap-2">
                  {uploading === "footer" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ImagePlus className="w-3.5 h-3.5" />}
                  Choose image
                </button>
                {b.footer_logo_url && (
                  <button onClick={() => setB({ ...b, footer_logo_url: null })}
                    className="h-10 px-3 rounded-md border border-border text-xs hover:bg-secondary">Remove</button>
                )}
              </div>
              <input ref={footerInput} type="file" accept="image/*" className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) upload("footer", f); e.currentTarget.value = ""; }} />
              <label className="block">
                <span className="text-[11px] uppercase tracking-wider text-muted-foreground">Position</span>
                <select value={b.footer_logo_position}
                  onChange={(e) => setB({ ...b, footer_logo_position: e.target.value as any })}
                  className="mt-1 w-full h-9 px-2 rounded-md bg-secondary/50 border border-border text-sm">
                  <option value="footer-left">Footer left</option>
                  <option value="footer-right">Footer right</option>
                </select>
              </label>
            </div>
          </div>

          <div className="border-t border-border/50 pt-4 flex items-center justify-between flex-wrap gap-3">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={b.allow_user_logos}
                onChange={(e) => setB({ ...b, allow_user_logos: e.target.checked })} />
              Let creators upload their own brand logo from their dashboard
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={b.user_logos_paid_only}
                onChange={(e) => setB({ ...b, user_logos_paid_only: e.target.checked })} />
              Restrict creator logo uploads to paid plans only
            </label>
            <button onClick={save} disabled={saving}
              className="h-10 px-4 rounded-md bg-gradient-primary text-primary-foreground text-sm font-semibold glow-primary disabled:opacity-60 flex items-center gap-2">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Save branding
            </button>
          </div>
        </>
      )}
    </div>
  );
}
