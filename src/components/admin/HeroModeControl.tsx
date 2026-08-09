import { useEffect, useState } from "react";
import { Loader2, Save, Layers, Image as ImageIcon } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { PublicFrontTemplateControl } from "./PublicFrontTemplateControl";

type Settings = {
  mode: "single" | "slider";
  autoplay: boolean;
  interval_ms: number;
  pause_on_hover: boolean;
};

const DEFAULTS: Settings = {
  mode: "single",
  autoplay: true,
  interval_ms: 5000,
  pause_on_hover: true,
};

/**
 * Singleton control for `homepage_hero_settings`. Decides whether the public
 * homepage hero renders the single lowest-sort banner ("single") or fades
 * through every published + active banner in sort_order ("slider").
 */
export function HeroModeControl() {
  const [s, setS] = useState<Settings>(DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    (async () => {
      const { data, error } = await (supabase as any)
        .from("homepage_hero_settings")
        .select("mode,autoplay,interval_ms,pause_on_hover")
        .eq("id", true)
        .maybeSingle();
      setLoading(false);
      if (error) return toast.error(error.message);
      if (data) setS({ ...DEFAULTS, ...data });
    })();
  }, []);

  const patch = (p: Partial<Settings>) => {
    setS((cur) => ({ ...cur, ...p }));
    setDirty(true);
  };

  const save = async () => {
    setSaving(true);
    const { error } = await (supabase as any)
      .from("homepage_hero_settings")
      .upsert({ id: true, ...s, updated_at: new Date().toISOString() });
    setSaving(false);
    if (error) return toast.error(error.message);
    setDirty(false);
    toast.success("Hero mode saved");
  };

  if (loading) {
    return (
      <div className="space-y-3">
        <PublicFrontTemplateControl />
        <div className="py-3 grid place-items-center">
          <Loader2 className="w-4 h-4 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  const Pill = ({
    active,
    onClick,
    icon,
    label,
    desc,
  }: {
    active: boolean;
    onClick: () => void;
    icon: React.ReactNode;
    label: string;
    desc: string;
  }) => (
    <button
      type="button"
      onClick={onClick}
      className={`flex-1 text-left rounded-lg border p-3 transition ${
        active
          ? "border-accent/70 bg-accent/10 ring-1 ring-accent/40"
          : "border-border hover:bg-secondary/60"
      }`}
    >
      <div className="flex items-center gap-2 text-xs font-semibold">
        {icon}
        {label}
        {active && (
          <span className="ml-auto text-[10px] uppercase tracking-wider text-accent">
            Active
          </span>
        )}
      </div>
      <p className="text-[11px] text-muted-foreground mt-1 leading-relaxed">{desc}</p>
    </button>
  );

  return (
    <div className="space-y-3">
      <PublicFrontTemplateControl />

      <div className="rounded-xl border border-border/70 bg-card/50 p-4 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-foreground/90">
              Hero Mode
            </p>
            <p className="text-[11px] text-muted-foreground">
              Controls how the public homepage hero renders all banners below.
            </p>
          </div>
          <button
            onClick={save}
            disabled={!dirty || saving}
            className="h-8 px-3 rounded-md text-xs flex items-center gap-1.5 bg-primary text-primary-foreground disabled:opacity-40"
          >
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            Save
          </button>
        </div>

        <div className="flex flex-col sm:flex-row gap-2">
          <Pill
            active={s.mode === "single"}
            onClick={() => patch({ mode: "single" })}
            icon={<ImageIcon className="w-3.5 h-3.5" />}
            label="Single"
            desc="Show only the Published + Active banner with the lowest Sort order."
          />
          <Pill
            active={s.mode === "slider"}
            onClick={() => patch({ mode: "slider" })}
            icon={<Layers className="w-3.5 h-3.5" />}
            label="Slider"
            desc="Fade through every Published + Active banner in Sort order."
          />
        </div>

        {s.mode === "slider" && (
          <div className="grid sm:grid-cols-3 gap-3 pt-1">
            <label className="flex items-center gap-2 text-xs">
              <input
                type="checkbox"
                checked={s.autoplay}
                onChange={(e) => patch({ autoplay: e.target.checked })}
              />
              Autoplay
            </label>
            <label className="flex items-center gap-2 text-xs">
              <input
                type="checkbox"
                checked={s.pause_on_hover}
                onChange={(e) => patch({ pause_on_hover: e.target.checked })}
              />
              Pause on hover
            </label>
            <label className="flex items-center gap-2 text-xs">
              <span className="text-muted-foreground">Interval</span>
              <input
                type="number"
                min={1500}
                max={60000}
                step={500}
                value={s.interval_ms}
                onChange={(e) => patch({ interval_ms: Math.max(1500, Math.min(60000, Number(e.target.value) || 5000)) })}
                className="h-7 w-20 rounded border border-border bg-background px-2 text-xs"
              />
              <span className="text-muted-foreground">ms</span>
            </label>
            <p className="sm:col-span-3 text-[11px] text-muted-foreground">
              Transition: <strong>fade</strong> (smooth crossfade).
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
