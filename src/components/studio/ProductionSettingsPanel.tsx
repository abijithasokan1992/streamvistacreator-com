/**
 * ProductionSettingsPanel — single source of truth for the Active Production.
 *
 * All values are persisted onto the existing `projects.crew` JSONB column.
 * No backend changes, no schema migration. Downstream stages (Ingest, Shoot
 * Days, Camera Cards, Clips, Proxy Generation, Editorial, Delivery, Archive)
 * already read from `projects.crew`, so saving here propagates automatically.
 */
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { FieldGroup } from "@/components/profile/FieldGroup";
import { Loader2, Save, Settings2, Sparkles } from "lucide-react";

const CONTENT_TYPES = [
  "Feature Film", "Short Film", "Series", "Documentary", "Commercial",
  "Music Video", "Corporate", "Live Event", "News", "Other",
];

const CAMERA_PRESETS = [
  "ARRI Alexa Mini LF", "ARRI Alexa 35", "RED V-Raptor", "RED Komodo",
  "Sony Venice 2", "Sony FX9", "Sony FX6", "Sony FX3",
  "Blackmagic URSA 12K", "Blackmagic Pocket 6K", "Canon C500 Mk II",
  "Canon C300 Mk III", "Panasonic Varicam LT", "Other",
];

const CODEC_PRESETS = [
  "ARRIRAW", "ProRes 4444 XQ", "ProRes 4444", "ProRes 422 HQ", "ProRes 422",
  "REDCODE RAW", "Sony X-OCN XT", "Sony X-OCN ST", "Blackmagic RAW",
  "XAVC-I", "H.265", "H.264", "Other",
];

const RESOLUTIONS = ["8K", "6K", "4K UHD", "4K DCI", "2K", "1080p", "720p"];
const FRAME_RATES = ["23.976", "24", "25", "29.97", "30", "50", "59.94", "60", "120"];
const COLOR_SPACES = ["ARRI LogC3", "ARRI LogC4", "RED Log3G10", "Sony S-Log3", "V-Log", "BMD Film Gen 5", "Rec.709", "Rec.2020"];
const PROXY_CODECS = ["ProRes Proxy", "ProRes 422 LT", "H.264 (5 Mbps)", "H.264 (10 Mbps)", "DNxHR LB"];
const PROXY_RES = ["Match Source", "3840×2160", "1920×1080", "1280×720", "960×540"];
const NLE_TARGETS = ["Avid Media Composer", "DaVinci Resolve", "Adobe Premiere Pro", "Final Cut Pro", "Other"];
const DELIVERY_TARGETS = ["Theatrical DCP", "Broadcast", "OTT / Streaming", "Web", "Social", "Archive Only"];

const NAMING_TOKENS = [
  "{project}", "{date}", "{shootday}", "{unit}", "{camera}", "{card}", "{clip}", "{scene}", "{take}",
];

type Crew = Record<string, any>;

export type CameraPackage = {
  id: string;
  name: string;               // "A Cam", "B Cam", "Drone", …
  camera_system: string;      // "ARRI"
  camera_model: string;       // "Alexa 35"
  recording_format: string;   // "ARRIRAW"
  codec: string;              // "ARRIRAW"
  resolution: string;         // "4.6K"
  frame_rate: string;         // "24"
  color_space: string;        // "ARRI LogC4"
  lut: string;                // "ARRI LogC4 → Rec.709"
  card_prefix: string;        // "A"
  folder_naming: string;      // "{camera}/{card}"
};

type Settings = {
  // Production
  title_number: string;
  title_status: string;
  production_company: string;
  director: string;
  dop: string;
  location: string;
  shoot_start: string;
  shoot_end: string;
  // Content Type
  content_type: string;
  aspect_ratio: string;
  // Equipment — legacy flat fields kept for backward compatibility.
  // Editing happens via camera_packages; these mirror the primary package on save.
  camera_system: string;
  camera_brand: string;
  codec: string;
  resolution: string;
  frame_rate: string;
  color_space: string;
  default_unit: string;
  // Camera Packages — new source of truth for equipment (one or many rigs).
  camera_packages: CameraPackage[];
  // Folder Structure
  folder_root: string;
  folder_pattern: string;
  // Naming Convention
  naming_pattern: string;
  // Proxy Defaults
  proxy_codec: string;
  proxy_resolution: string;
  proxy_burnin: boolean | string;
  // Editorial Defaults
  editorial_nle: string;
  editorial_bin_structure: string;
  editorial_notes: string;
  // Delivery Defaults
  delivery_target: string;
  delivery_specs: string;
};

const DEFAULTS: Settings = {
  title_number: "",
  title_status: "Active",
  production_company: "",
  director: "",
  dop: "",
  location: "",
  shoot_start: "",
  shoot_end: "",
  content_type: "Feature Film",
  aspect_ratio: "2.39:1",
  camera_system: "",
  camera_brand: "",
  codec: "",
  resolution: "4K UHD",
  frame_rate: "24",
  color_space: "",
  default_unit: "Main Unit",
  camera_packages: [],
  folder_root: "/{project}",
  folder_pattern: "{project}/{date}_{shootday}/{unit}/{camera}/{card}",
  naming_pattern: "{project}_{shootday}_{unit}_{camera}_{card}_{clip}",
  proxy_codec: "H.264 (10 Mbps)",
  proxy_resolution: "1920×1080",
  proxy_burnin: true,
  editorial_nle: "DaVinci Resolve",
  editorial_bin_structure: "01_Footage / 02_Audio / 03_Graphics / 04_Editorial",
  editorial_notes: "",
  delivery_target: "OTT / Streaming",
  delivery_specs: "",
};

const DEFAULT_PKG_NAMES = ["A Cam", "B Cam", "C Cam", "D Cam", "Drone", "Crash Cam", "GoPro", "Virtual Camera"];

function newPackage(index: number, seed?: Partial<CameraPackage>): CameraPackage {
  const letter = String.fromCharCode(65 + index); // A, B, C…
  return {
    id: `pkg_${Math.random().toString(36).slice(2, 10)}`,
    name: DEFAULT_PKG_NAMES[index] ?? `${letter} Cam`,
    camera_system: "",
    camera_model: "",
    recording_format: "",
    codec: "",
    resolution: "",
    frame_rate: "",
    color_space: "",
    lut: "",
    card_prefix: letter,
    folder_naming: "{camera}/{card}",
    ...seed,
  };
}

function crewToSettings(crew: Crew | null | undefined): Settings {
  const c = crew ?? {};
  const out: any = { ...DEFAULTS };
  for (const k of Object.keys(DEFAULTS)) {
    if (c[k] !== undefined && c[k] !== null) out[k] = c[k];
  }
  // Best-effort camera_brand fallback when only camera_system was set previously.
  if (!c.camera_brand && typeof c.camera_system === "string") {
    out.camera_brand = String(c.camera_system).split(/\s+/)[0] ?? "";
  }
  // Seed one Camera Package from legacy flat fields when nothing is defined yet.
  if (!Array.isArray(out.camera_packages) || out.camera_packages.length === 0) {
    const hasLegacy = out.camera_system || out.camera_brand || out.codec || out.resolution || out.color_space;
    if (hasLegacy) {
      out.camera_packages = [newPackage(0, {
        camera_system: out.camera_brand || String(out.camera_system).split(/\s+/)[0] || "",
        camera_model: out.camera_system || "",
        recording_format: out.codec || "",
        codec: out.codec || "",
        resolution: out.resolution || "",
        frame_rate: out.frame_rate || "",
        color_space: out.color_space || "",
        lut: "",
      })];
    } else {
      out.camera_packages = [];
    }
  }
  return out as Settings;
}

export default function ProductionSettingsPanel({
  activeProjectId,
  activeProjectName,
  activeProjectCrew,
  onSaved,
}: {
  activeProjectId: string | null;
  activeProjectName?: string | null;
  activeProjectCrew?: Crew | null;
  onSaved?: () => void;
}) {
  const [s, setS] = useState<Settings>(() => crewToSettings(activeProjectCrew));
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Re-hydrate whenever the active production changes.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!activeProjectId) { setS(crewToSettings(activeProjectCrew)); return; }
      setLoading(true);
      const { data } = await supabase
        .from("projects")
        .select("crew")
        .eq("id", activeProjectId)
        .maybeSingle();
      if (!cancelled) {
        setS(crewToSettings((data as any)?.crew));
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeProjectId]);

  const set = <K extends keyof Settings>(k: K, v: Settings[K]) => setS((prev) => ({ ...prev, [k]: v }));

  const canSave = !!activeProjectId && !saving && !loading;

  const save = async () => {
    if (!activeProjectId) {
      toast.error("Pick an active production first.");
      return;
    }
    setSaving(true);
    // Merge into existing crew — never overwrite unrelated keys.
    const { data: current } = await supabase
      .from("projects")
      .select("crew")
      .eq("id", activeProjectId)
      .maybeSingle();
    // Mirror the primary Camera Package into the legacy flat fields so any
    // downstream consumer that still reads crew.camera_system / codec / etc.
    // keeps working without changes.
    const primary = s.camera_packages[0];
    const mirrored: Settings = primary
      ? {
          ...s,
          camera_system: [primary.camera_system, primary.camera_model].filter(Boolean).join(" ") || s.camera_system,
          camera_brand: primary.camera_system || s.camera_brand,
          codec: primary.codec || primary.recording_format || s.codec,
          resolution: primary.resolution || s.resolution,
          frame_rate: primary.frame_rate || s.frame_rate,
          color_space: primary.color_space || s.color_space,
        }
      : s;
    const merged = { ...(((current as any)?.crew) ?? {}), ...mirrored };
    const { error } = await supabase.from("projects").update({ crew: merged }).eq("id", activeProjectId);
    setSaving(false);
    if (error) {
      toast.error(error.message || "Failed to save production settings.");
      return;
    }
    toast.success("Production settings saved — new ingests will inherit these values.");
    onSaved?.();
  };

  const namingPreview = useMemo(() => {
    return s.naming_pattern
      .replace("{project}", (activeProjectName ?? "PROJECT").replace(/\s+/g, "_"))
      .replace("{date}", "20260704")
      .replace("{shootday}", "D01")
      .replace("{unit}", s.default_unit.replace(/\s+/g, "") || "MainUnit")
      .replace("{camera}", (s.camera_brand || "CAM").toUpperCase().slice(0, 4))
      .replace("{card}", "A001")
      .replace("{clip}", "C0001")
      .replace("{scene}", "S01")
      .replace("{take}", "T01");
  }, [s.naming_pattern, s.default_unit, s.camera_brand, activeProjectName]);

  const folderPreview = useMemo(() => {
    return s.folder_pattern
      .replace("{project}", (activeProjectName ?? "PROJECT").replace(/\s+/g, "_"))
      .replace("{date}", "20260704")
      .replace("{shootday}", "D01")
      .replace("{unit}", s.default_unit.replace(/\s+/g, "") || "MainUnit")
      .replace("{camera}", (s.camera_brand || "CAM").toUpperCase().slice(0, 4))
      .replace("{card}", "A001");
  }, [s.folder_pattern, s.default_unit, s.camera_brand, activeProjectName]);

  if (!activeProjectId) {
    return (
      <Card className="p-8 text-center">
        <Settings2 className="w-8 h-8 mx-auto mb-3 text-muted-foreground" />
        <h3 className="text-base font-semibold">No Active Production</h3>
        <p className="text-sm text-muted-foreground mt-1">
          Select an active production to configure its defaults.
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="p-4 md:p-5 flex items-start gap-3 border-primary/20">
        <Sparkles className="w-5 h-5 text-primary shrink-0 mt-0.5" />
        <div className="flex-1">
          <div className="text-sm font-semibold">Single source of truth</div>
          <p className="text-xs text-muted-foreground">
            Configure once. Every new ingest, camera card, clip, proxy job, editorial delivery
            and archive job on <span className="font-medium text-foreground">{activeProjectName ?? "this production"}</span>{" "}
            inherits these values automatically.
          </p>
        </div>
        <Button onClick={save} disabled={!canSave} size="sm">
          {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> : <Save className="w-3.5 h-3.5 mr-1.5" />}
          Save
        </Button>
      </Card>

      {loading ? (
        <div className="py-10 text-center text-sm text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin inline mr-2" /> Loading settings…
        </div>
      ) : (
        <>
          <FieldGroup title="Production" description="Basic identity used across the production lifecycle.">
            <Field label="Title Number">
              <Input value={s.title_number} onChange={(e) => set("title_number", e.target.value)} placeholder="e.g. TN-2026-014" />
            </Field>
            <Field label="Status">
              <SearchSelect value={s.title_status} onChange={(v) => set("title_status", v)}
                options={["Active", "Pre-Production", "On Hold", "Wrap", "Post", "Archived"]} />
            </Field>
            <Field label="Production Company">
              <Input value={s.production_company} onChange={(e) => set("production_company", e.target.value)} />
            </Field>
            <Field label="Location">
              <Input value={s.location} onChange={(e) => set("location", e.target.value)} placeholder="Primary shoot location" />
            </Field>
            <Field label="Director">
              <Input value={s.director} onChange={(e) => set("director", e.target.value)} />
            </Field>
            <Field label="Director of Photography">
              <Input value={s.dop} onChange={(e) => set("dop", e.target.value)} />
            </Field>
            <Field label="Shoot Start">
              <Input type="date" value={s.shoot_start} onChange={(e) => set("shoot_start", e.target.value)} />
            </Field>
            <Field label="Shoot End">
              <Input type="date" value={s.shoot_end} onChange={(e) => set("shoot_end", e.target.value)} />
            </Field>
          </FieldGroup>

          <FieldGroup title="Content Type" description="Applied to metadata, delivery specs and archive tags.">
            <Field label="Content Type">
              <SearchSelect value={s.content_type} onChange={(v) => set("content_type", v)} options={CONTENT_TYPES} />
            </Field>
            <Field label="Aspect Ratio">
              <SearchSelect value={s.aspect_ratio} onChange={(v) => set("aspect_ratio", v)}
                options={["2.76:1", "2.39:1", "2.35:1", "2.00:1", "1.85:1", "1.90:1", "16:9", "4:3", "1:1", "9:16"]} />
            </Field>
          </FieldGroup>

          <CameraPackagesEditor
            packages={s.camera_packages}
            onChange={(pkgs) => set("camera_packages", pkgs)}
          />

          <FieldGroup title="Units" description="Default unit / team applied to every new ingest.">
            <Field label="Default Unit">
              <Input value={s.default_unit} onChange={(e) => set("default_unit", e.target.value)} placeholder="Main Unit" />
            </Field>
          </FieldGroup>

          <FieldGroup title="Folder Structure" description="Auto-generated for every shoot day, unit and camera card.">
            <Field label="Root Folder">
              <Input value={s.folder_root} onChange={(e) => set("folder_root", e.target.value)} placeholder="/{project}" />
            </Field>
            <Field label="Folder Pattern">
              <Input value={s.folder_pattern} onChange={(e) => set("folder_pattern", e.target.value)} />
            </Field>
            <Field label="Preview" full>
              <div className="rounded-md bg-muted/50 border border-border/40 px-3 py-2 font-mono text-xs text-muted-foreground break-all">
                {s.folder_root.replace(/\/$/, "")}/{folderPreview}
              </div>
              <TokenHints />
            </Field>
          </FieldGroup>

          <FieldGroup title="Naming Convention" description="Used to auto-name clips at ingest time.">
            <Field label="Clip Name Pattern" full>
              <Input value={s.naming_pattern} onChange={(e) => set("naming_pattern", e.target.value)} />
            </Field>
            <Field label="Preview" full>
              <div className="rounded-md bg-muted/50 border border-border/40 px-3 py-2 font-mono text-xs text-muted-foreground break-all">
                {namingPreview}.mov
              </div>
              <TokenHints />
            </Field>
          </FieldGroup>

          <FieldGroup title="Proxy Defaults" description="Applied to every automatic proxy generation job.">
            <Field label="Proxy Codec">
              <SearchSelect value={s.proxy_codec} onChange={(v) => set("proxy_codec", v)} options={PROXY_CODECS} />
            </Field>
            <Field label="Proxy Resolution">
              <SearchSelect value={s.proxy_resolution} onChange={(v) => set("proxy_resolution", v)} options={PROXY_RES} />
            </Field>
            <Field label="Burn-in">
              <SearchSelect
                value={s.proxy_burnin ? "Timecode + Clip name" : "None"}
                onChange={(v) => set("proxy_burnin", v !== "None")}
                options={["Timecode + Clip name", "None"]}
              />
            </Field>
          </FieldGroup>

          <FieldGroup title="Editorial Defaults" description="Used when handing off to editorial or the NLE bin structure.">
            <Field label="NLE Target">
              <SearchSelect value={s.editorial_nle} onChange={(v) => set("editorial_nle", v)} options={NLE_TARGETS} />
            </Field>
            <Field label="Bin Structure">
              <Input value={s.editorial_bin_structure} onChange={(e) => set("editorial_bin_structure", e.target.value)} />
            </Field>
            <Field label="Editorial Notes" full>
              <Textarea rows={2} value={s.editorial_notes} onChange={(e) => set("editorial_notes", e.target.value)}
                placeholder="Any editorial hand-off preferences…" />
            </Field>
          </FieldGroup>

          <FieldGroup title="Delivery Defaults" description="Default delivery target and specs for finished masters.">
            <Field label="Delivery Target">
              <SearchSelect value={s.delivery_target} onChange={(v) => set("delivery_target", v)} options={DELIVERY_TARGETS} />
            </Field>
            <Field label="Delivery Specs" full>
              <Textarea rows={2} value={s.delivery_specs} onChange={(e) => set("delivery_specs", e.target.value)}
                placeholder="Container, codec, LUFS, subtitle format…" />
            </Field>
          </FieldGroup>

          <div className="flex justify-end gap-2 pt-2">
            <Button onClick={save} disabled={!canSave}>
              {saving ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : <Save className="w-4 h-4 mr-1.5" />}
              Save Production Settings
            </Button>
          </div>
        </>
      )}
    </div>
  );
}

function Field({ label, children, full }: { label: string; children: React.ReactNode; full?: boolean }) {
  return (
    <div className={`space-y-1.5 ${full ? "md:col-span-2" : ""}`}>
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

/**
 * SearchSelect — dropdown with type-ahead filtering and free-text fallback.
 * Uses the shared shadcn Select under the hood so styling stays consistent.
 */
function SearchSelect({
  value, onChange, options,
}: { value: string; onChange: (v: string) => void; options: string[] }) {
  const [q, setQ] = useState("");
  const merged = useMemo(() => {
    const set = new Set(options);
    if (value && !set.has(value)) return [value, ...options];
    return options;
  }, [options, value]);
  const filtered = useMemo(
    () => merged.filter((o) => o.toLowerCase().includes(q.trim().toLowerCase())),
    [merged, q],
  );
  return (
    <Select value={value || undefined} onValueChange={onChange}>
      <SelectTrigger className="h-10 text-sm">
        <SelectValue placeholder="Select…" />
      </SelectTrigger>
      <SelectContent>
        <div className="p-2">
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search…"
            className="h-8 text-xs"
            onKeyDown={(e) => e.stopPropagation()}
          />
        </div>
        {filtered.map((o) => (
          <SelectItem key={o} value={o}>{o}</SelectItem>
        ))}
        {filtered.length === 0 && (
          <div className="px-3 py-2 text-xs text-muted-foreground">No matches</div>
        )}
      </SelectContent>
    </Select>
  );
}

function TokenHints() {
  return (
    <div className="flex flex-wrap gap-1 pt-1">
      {NAMING_TOKENS.map((t) => (
        <code key={t} className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground border border-border/40">
          {t}
        </code>
      ))}
    </div>
  );
}
