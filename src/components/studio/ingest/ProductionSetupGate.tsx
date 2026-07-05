/**
 * TitleSetupGate (MVP + UX Polish)
 * ================================
 * Reuses the existing Title Setup form. This revision replaces free-text
 * technical fields with searchable dropdowns, industry presets, dependent
 * selections, and crew autocomplete. Auto-saves after the first successful
 * create — no manual Save button.
 *
 * No backend, schema, RBAC, upload-pipeline, or DRM changes.
 * All extra fields continue to live in the existing `projects.crew` jsonb.
 */

import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import {
  Loader2, Clapperboard, Building2, FolderTree, Plus, ArrowRight, Repeat,
  Check, ChevronsUpDown, Package, X, UserPlus,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { generateProductionNumber } from "@/lib/productionNumber";
import { useAuth } from "@/hooks/useAuth";
import { useWorkspaces } from "@/hooks/useWorkspaces";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from "@/components/ui/command";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import StudioIngest from "./StudioIngest";

// ---------------------------------------------------------------------------
// Static presets
// ---------------------------------------------------------------------------

const CONTENT_TYPES = [
  "Feature Film", "Series", "Documentary", "Short Film",
  "Commercial", "Music Video", "Animation", "Other",
] as const;

const TITLE_STATUSES = [
  "Pre-Production", "Production", "Post-Production", "Delivery", "Archived",
] as const;

const CURRENCIES = ["INR", "USD", "EUR", "GBP", "AED", "AUD", "CAD", "JPY", "SGD"] as const;

const DEFAULT_FOLDERS = [
  "RAW", "Proxy", "Audio", "Documents", "Reports",
  "LUTs", "Stills", "Masters", "Deliverables", "Archive",
] as const;

/** Camera catalog. Codecs & resolutions cascade from the chosen format. */
type FormatSpec = { name: string; codecs: string[]; resolutions: string[] };
type CameraSpec = { name: string; formats: FormatSpec[] };

const CAMERA_CATALOG: Record<string, CameraSpec[]> = {
  ARRI: [
    {
      name: "ARRI Alexa 35",
      formats: [
        { name: "Open Gate 4.6K", codecs: ["ARRIRAW", "ProRes 4444 XQ", "ProRes 4444", "ProRes 422 HQ"], resolutions: ["4608 × 3164"] },
        { name: "4.6K 3:2", codecs: ["ARRIRAW", "ProRes 4444 XQ", "ProRes 422 HQ"], resolutions: ["4608 × 3164"] },
        { name: "4K 16:9", codecs: ["ARRIRAW", "ProRes 4444", "ProRes 422 HQ"], resolutions: ["3840 × 2160"] },
      ],
    },
    {
      name: "ARRI Alexa Mini LF",
      formats: [
        { name: "LF Open Gate", codecs: ["ARRIRAW", "ProRes 4444 XQ", "ProRes 422 HQ"], resolutions: ["4448 × 3096"] },
        { name: "LF 16:9", codecs: ["ARRIRAW", "ProRes 4444", "ProRes 422 HQ"], resolutions: ["3840 × 2160"] },
      ],
    },
  ],
  RED: [
    {
      name: "RED V-RAPTOR [X] 8K VV",
      formats: [
        { name: "8K VV", codecs: ["REDCODE RAW HQ", "REDCODE RAW MQ", "REDCODE RAW LQ", "ProRes 422 HQ"], resolutions: ["8192 × 4320"] },
        { name: "6K S35", codecs: ["REDCODE RAW HQ", "REDCODE RAW MQ"], resolutions: ["6144 × 3240"] },
      ],
    },
    {
      name: "RED KOMODO-X 6K",
      formats: [
        { name: "6K S35", codecs: ["REDCODE RAW", "ProRes 422 HQ"], resolutions: ["6144 × 3240"] },
        { name: "4K", codecs: ["REDCODE RAW", "ProRes 422 HQ"], resolutions: ["4096 × 2160"] },
      ],
    },
  ],
  Sony: [
    {
      name: "Sony VENICE 2",
      formats: [
        { name: "8.6K Full Frame", codecs: ["X-OCN XT", "X-OCN ST", "X-OCN LT", "ProRes 422 HQ"], resolutions: ["8640 × 5760"] },
        { name: "6K Full Frame", codecs: ["X-OCN XT", "X-OCN ST", "X-OCN LT"], resolutions: ["6048 × 4032"] },
      ],
    },
    {
      name: "Sony FX9",
      formats: [
        { name: "6K Full Frame", codecs: ["XAVC-I", "XAVC-L"], resolutions: ["6008 × 3168"] },
        { name: "4K UHD", codecs: ["XAVC-I", "XAVC-L"], resolutions: ["3840 × 2160"] },
      ],
    },
    {
      name: "Sony FX6",
      formats: [
        { name: "4K UHD", codecs: ["XAVC-I", "XAVC-L"], resolutions: ["3840 × 2160"] },
      ],
    },
  ],
  Canon: [
    {
      name: "Canon C500 Mark II",
      formats: [
        { name: "5.9K Full Frame", codecs: ["Cinema RAW Light", "XF-AVC"], resolutions: ["5952 × 3140"] },
        { name: "4K UHD", codecs: ["Cinema RAW Light", "XF-AVC"], resolutions: ["3840 × 2160"] },
      ],
    },
    {
      name: "Canon C300 Mark III",
      formats: [
        { name: "4K S35", codecs: ["Cinema RAW Light", "XF-AVC"], resolutions: ["4096 × 2160"] },
      ],
    },
    {
      name: "Canon EOS R5 C",
      formats: [
        { name: "8K Full Frame", codecs: ["Cinema RAW Light", "XF-AVC", "H.265"], resolutions: ["8192 × 4320"] },
        { name: "4K UHD", codecs: ["XF-AVC", "H.265"], resolutions: ["3840 × 2160"] },
      ],
    },
  ],
  Blackmagic: [
    {
      name: "Blackmagic URSA Cine 12K LF",
      formats: [
        { name: "12K Full Frame", codecs: ["Blackmagic RAW"], resolutions: ["12288 × 6480"] },
        { name: "8K Full Frame", codecs: ["Blackmagic RAW"], resolutions: ["8192 × 4320"] },
      ],
    },
    {
      name: "Blackmagic Pocket 6K Pro",
      formats: [
        { name: "6K S35", codecs: ["Blackmagic RAW", "ProRes 422 HQ"], resolutions: ["6144 × 3456"] },
      ],
    },
  ],
  Panasonic: [
    {
      name: "Panasonic LUMIX GH6",
      formats: [
        { name: "5.7K", codecs: ["ProRes 422 HQ", "H.265"], resolutions: ["5728 × 3024"] },
        { name: "4K UHD", codecs: ["ProRes 422 HQ", "H.265"], resolutions: ["3840 × 2160"] },
      ],
    },
    {
      name: "Panasonic VariCam LT",
      formats: [
        { name: "4K S35", codecs: ["V-RAW", "AVC-Intra"], resolutions: ["4096 × 2160"] },
      ],
    },
  ],
  DJI: [
    {
      name: "DJI Ronin 4D",
      formats: [
        { name: "6K Full Frame", codecs: ["ProRes RAW HQ", "ProRes 422 HQ", "H.264"], resolutions: ["6008 × 3168"] },
        { name: "4K UHD", codecs: ["ProRes RAW HQ", "ProRes 422 HQ", "H.264"], resolutions: ["3840 × 2160"] },
      ],
    },
    {
      name: "DJI Inspire 3",
      formats: [
        { name: "8K Full Frame", codecs: ["CinemaDNG", "ProRes 422 HQ", "H.264"], resolutions: ["8192 × 4320"] },
      ],
    },
  ],
  GoPro: [
    {
      name: "GoPro HERO12 Black",
      formats: [{ name: "5.3K", codecs: ["H.265", "H.264"], resolutions: ["5312 × 2988"] }],
    },
  ],
  Nikon: [
    {
      name: "Nikon Z9",
      formats: [
        { name: "8K Full Frame", codecs: ["N-RAW", "ProRes 422 HQ", "H.265"], resolutions: ["8256 × 4644"] },
      ],
    },
  ],
  Fujifilm: [
    {
      name: "Fujifilm X-H2S",
      formats: [
        { name: "6.2K APS-C", codecs: ["ProRes 422 HQ", "H.265"], resolutions: ["6240 × 4160"] },
      ],
    },
  ],
};

const LUT_PRESETS = [
  "ARRI LogC4 → Rec.709",
  "ARRI LogC3 → Rec.709",
  "RED IPP2 → Rec.709",
  "Sony S-Log3 → Rec.709",
  "Sony S-Log3 → Rec.709 (Type A)",
  "Canon C-Log2 → Rec.709",
  "Canon C-Log3 → Rec.709",
  "Blackmagic Film Gen 5 → Rec.709",
  "Panasonic V-Log → Rec.709",
  "DJI D-Log → Rec.709",
  "Nikon N-Log → Rec.709",
  "Fujifilm F-Log2 → Rec.709",
];

/** Turn-key equipment packages that pre-populate the technical section. */
type EquipmentPreset = {
  id: string; label: string;
  brand: string; system: string; format: string; codec: string; resolution: string; lut: string;
};
const EQUIPMENT_PRESETS: EquipmentPreset[] = [
  { id: "arri-alexa-35", label: "ARRI Alexa 35 Package", brand: "ARRI", system: "ARRI Alexa 35", format: "Open Gate 4.6K", codec: "ARRIRAW", resolution: "4608 × 3164", lut: "ARRI LogC4 → Rec.709" },
  { id: "arri-mini-lf", label: "ARRI Mini LF Package", brand: "ARRI", system: "ARRI Alexa Mini LF", format: "LF Open Gate", codec: "ARRIRAW", resolution: "4448 × 3096", lut: "ARRI LogC3 → Rec.709" },
  { id: "red-vraptor", label: "RED V-RAPTOR Package", brand: "RED", system: "RED V-RAPTOR [X] 8K VV", format: "8K VV", codec: "REDCODE RAW HQ", resolution: "8192 × 4320", lut: "RED IPP2 → Rec.709" },
  { id: "sony-venice-2", label: "Sony VENICE 2 Package", brand: "Sony", system: "Sony VENICE 2", format: "8.6K Full Frame", codec: "X-OCN XT", resolution: "8640 × 5760", lut: "Sony S-Log3 → Rec.709" },
  { id: "bm-ursa-cine", label: "Blackmagic URSA Cine Package", brand: "Blackmagic", system: "Blackmagic URSA Cine 12K LF", format: "12K Full Frame", codec: "Blackmagic RAW", resolution: "12288 × 6480", lut: "Blackmagic Film Gen 5 → Rec.709" },
  { id: "canon-c500-ii", label: "Canon C500 Mark II Package", brand: "Canon", system: "Canon C500 Mark II", format: "5.9K Full Frame", codec: "Cinema RAW Light", resolution: "5952 × 3140", lut: "Canon C-Log2 → Rec.709" },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function generateTitleNumber(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `TTL-${yyyy}${mm}${dd}-${rand}`;
}

const ACTIVE_TITLE_KEY = (wsId: string) => `sv:active-title:${wsId}`;
const SMART_DEFAULTS_KEY = (wsId: string) => `sv:title-defaults:${wsId}`;

type SmartDefaults = Partial<{
  brand: string; cameraSystem: string; cameraFormat: string;
  codec: string; resolution: string; primaryLut: string; currency: string;
}>;

function loadDefaults(wsId: string): SmartDefaults {
  try { return JSON.parse(localStorage.getItem(SMART_DEFAULTS_KEY(wsId)) || "{}"); }
  catch { return {}; }
}
function saveDefaults(wsId: string, d: SmartDefaults) {
  try { localStorage.setItem(SMART_DEFAULTS_KEY(wsId), JSON.stringify(d)); } catch { /* noop */ }
}

type CrewMember = { role: "Producer" | "Director" | "DOP" | "DIT"; user_id?: string; display_name?: string; email?: string };
type TitleRow = { id: string; name: string; created_at?: string };
type SaveStatus = "idle" | "saving" | "saved" | "syncing";

// ---------------------------------------------------------------------------
// Reusable searchable combobox
// ---------------------------------------------------------------------------

function Combobox({
  value, onChange, options, placeholder, allowCustom = true, disabled,
}: {
  value: string; onChange: (v: string) => void;
  options: string[]; placeholder: string;
  allowCustom?: boolean; disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const showCustom = allowCustom && q.trim() && !options.some((o) => o.toLowerCase() === q.trim().toLowerCase());
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button" variant="outline" role="combobox" disabled={disabled}
          className={cn("w-full justify-between font-normal", !value && "text-muted-foreground")}
        >
          <span className="truncate">{value || placeholder}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="p-0 w-[--radix-popover-trigger-width]" align="start">
        <Command>
          <CommandInput placeholder="Search…" value={q} onValueChange={setQ} />
          <CommandList>
            <CommandEmpty>No match.</CommandEmpty>
            <CommandGroup>
              {options.map((o) => (
                <CommandItem key={o} value={o} onSelect={() => { onChange(o); setOpen(false); setQ(""); }}>
                  <Check className={cn("mr-2 h-4 w-4", value === o ? "opacity-100" : "opacity-0")} />
                  {o}
                </CommandItem>
              ))}
              {showCustom && (
                <CommandItem value={`__custom_${q}`} onSelect={() => { onChange(q.trim()); setOpen(false); setQ(""); }}>
                  <Plus className="mr-2 h-4 w-4" /> Use "{q.trim()}"
                </CommandItem>
              )}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

// ---------------------------------------------------------------------------
// Crew picker (user_profiles autocomplete + email fallback)
// ---------------------------------------------------------------------------

function CrewPicker({
  role, value, onChange,
}: { role: CrewMember["role"]; value: CrewMember | null; onChange: (v: CrewMember | null) => void }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Array<{ user_id: string; display_name: string }>>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let alive = true;
    const term = q.trim();
    if (term.length < 2) { setResults([]); return; }
    setLoading(true);
    const t = setTimeout(async () => {
      const { data } = await supabase
        .from("user_profiles")
        .select("user_id, display_name")
        .ilike("display_name", `%${term.replace(/^@/, "")}%`)
        .limit(8);
      if (!alive) return;
      setResults((data as any[]) ?? []);
      setLoading(false);
    }, 220);
    return () => { alive = false; clearTimeout(t); };
  }, [q]);

  const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(q.trim());

  return (
    <div className="space-y-1.5">
      <Label>{role}</Label>
      {value ? (
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="gap-1.5 py-1 px-2">
            {value.user_id ? "@" : ""}{value.display_name || value.email}
          </Badge>
          <Button type="button" size="icon" variant="ghost" className="h-7 w-7" onClick={() => onChange(null)}>
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      ) : (
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button type="button" variant="outline" className="w-full justify-start font-normal text-muted-foreground">
              <UserPlus className="mr-2 h-4 w-4" /> Search @username or email…
            </Button>
          </PopoverTrigger>
          <PopoverContent className="p-0 w-[--radix-popover-trigger-width]" align="start">
            <Command shouldFilter={false}>
              <CommandInput placeholder="@username or email" value={q} onValueChange={setQ} />
              <CommandList>
                {loading && <div className="p-3 text-xs text-muted-foreground">Searching…</div>}
                {!loading && results.length === 0 && !isEmail && q.trim().length >= 2 && (
                  <CommandEmpty>No user found. Type a full email to invite.</CommandEmpty>
                )}
                {results.length > 0 && (
                  <CommandGroup heading="Users">
                    {results.map((u) => (
                      <CommandItem key={u.user_id} value={u.user_id}
                        onSelect={() => { onChange({ role, user_id: u.user_id, display_name: u.display_name }); setOpen(false); setQ(""); }}>
                        @{u.display_name}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                )}
                {isEmail && (
                  <CommandGroup heading="Invite by email">
                    <CommandItem value={`invite_${q}`}
                      onSelect={() => { onChange({ role, email: q.trim(), display_name: q.trim() }); setOpen(false); setQ(""); }}>
                      <UserPlus className="mr-2 h-4 w-4" /> Invite {q.trim()}
                    </CommandItem>
                  </CommandGroup>
                )}
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function ProductionSetupGate() {
  const { user } = useAuth();
  const { activeId, canWriteActive } = useWorkspaces();

  const [checking, setChecking] = useState(true);
  const [titles, setTitles] = useState<TitleRow[]>([]);
  const [activeTitleId, setActiveTitleIdState] = useState<string | null>(null);
  const [mode, setMode] = useState<"gate" | "form">("gate");
  const [submitting, setSubmitting] = useState(false);

  // Draft id: once created, further edits auto-save via update().
  const [draftId, setDraftId] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");

  // ---- Form state ----
  const defaults = useMemo(() => (activeId ? loadDefaults(activeId) : {}), [activeId]);

  const [titleNumber, setTitleNumber] = useState(generateTitleNumber);
  const [name, setName] = useState("");
  const [contentType, setContentType] = useState<string>("Feature Film");
  const [company, setCompany] = useState("");
  const [startDate, setStartDate] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [status, setStatus] = useState<string>("Pre-Production");

  const [equipmentPreset, setEquipmentPreset] = useState<string>("");
  const [brand, setBrand] = useState<string>(defaults.brand ?? "");
  const [cameraSystem, setCameraSystem] = useState(defaults.cameraSystem ?? "");
  const [cameraFormat, setCameraFormat] = useState(defaults.cameraFormat ?? "");
  const [codec, setCodec] = useState(defaults.codec ?? "");
  const [resolution, setResolution] = useState(defaults.resolution ?? "");
  const [primaryLut, setPrimaryLut] = useState(defaults.primaryLut ?? "");

  const [producer, setProducer] = useState<CrewMember | null>(null);
  const [director, setDirector] = useState<CrewMember | null>(null);
  const [dop, setDop] = useState<CrewMember | null>(null);
  const [dit, setDit] = useState<CrewMember | null>(null);

  const [budgetRaw, setBudgetRaw] = useState("");
  const [currency, setCurrency] = useState<string>(defaults.currency ?? "INR");

  // Cascading option lists
  const brandOptions = useMemo(() => Object.keys(CAMERA_CATALOG), []);
  const systemOptions = useMemo(
    () => (brand ? CAMERA_CATALOG[brand]?.map((s) => s.name) ?? [] : Object.values(CAMERA_CATALOG).flat().map((s) => s.name)),
    [brand],
  );
  const formatOptions = useMemo(() => {
    const sys = Object.values(CAMERA_CATALOG).flat().find((s) => s.name === cameraSystem);
    return sys?.formats.map((f) => f.name) ?? [];
  }, [cameraSystem]);
  const codecOptions = useMemo(() => {
    const sys = Object.values(CAMERA_CATALOG).flat().find((s) => s.name === cameraSystem);
    return sys?.formats.find((f) => f.name === cameraFormat)?.codecs ?? [];
  }, [cameraSystem, cameraFormat]);
  const resolutionOptions = useMemo(() => {
    const sys = Object.values(CAMERA_CATALOG).flat().find((s) => s.name === cameraSystem);
    return sys?.formats.find((f) => f.name === cameraFormat)?.resolutions ?? [];
  }, [cameraSystem, cameraFormat]);

  // Reset dependent selections when parent changes and the child no longer matches
  useEffect(() => {
    if (cameraFormat && !formatOptions.includes(cameraFormat)) setCameraFormat("");
  }, [formatOptions, cameraFormat]);
  useEffect(() => {
    if (codec && codecOptions.length && !codecOptions.includes(codec)) setCodec("");
    if (resolution && resolutionOptions.length && !resolutionOptions.includes(resolution)) setResolution("");
  }, [codecOptions, resolutionOptions, codec, resolution]);

  const applyEquipmentPreset = (id: string) => {
    setEquipmentPreset(id);
    const p = EQUIPMENT_PRESETS.find((x) => x.id === id);
    if (!p) return;
    setBrand(p.brand); setCameraSystem(p.system); setCameraFormat(p.format);
    setCodec(p.codec); setResolution(p.resolution); setPrimaryLut(p.lut);
  };

  // Formatted budget
  const budgetDisplay = useMemo(() => {
    const n = Number(budgetRaw.replace(/[^\d.]/g, ""));
    if (!budgetRaw || !isFinite(n) || n <= 0) return "";
    try { return new Intl.NumberFormat(undefined, { style: "currency", currency, maximumFractionDigits: 0 }).format(n); }
    catch { return n.toLocaleString(); }
  }, [budgetRaw, currency]);

  const setActiveTitleId = useCallback((id: string | null) => {
    setActiveTitleIdState(id);
    if (!activeId) return;
    try {
      if (id) localStorage.setItem(ACTIVE_TITLE_KEY(activeId), id);
      else localStorage.removeItem(ACTIVE_TITLE_KEY(activeId));
    } catch { /* ignore */ }
  }, [activeId]);

  const refresh = useCallback(async () => {
    if (!activeId) { setChecking(false); setTitles([]); return; }
    setChecking(true);
    const { data } = await supabase.from("projects")
      .select("id,name,created_at").eq("workspace_id", activeId)
      .order("created_at", { ascending: false });
    const rows = (data as TitleRow[]) ?? [];
    setTitles(rows);
    let saved: string | null = null;
    try { saved = localStorage.getItem(ACTIVE_TITLE_KEY(activeId)); } catch { /* ignore */ }
    setActiveTitleIdState(saved && rows.some((r) => r.id === saved) ? saved : null);
    setChecking(false);
  }, [activeId]);

  useEffect(() => { refresh(); }, [refresh]);

  // Build the jsonb payload sent to `projects.crew`
  const buildCrewPayload = useCallback(() => ({
    title_number: titleNumber,
    content_type: contentType,
    production_company: company.trim(),
    start_date: startDate,
    title_status: status,
    equipment_preset: equipmentPreset || null,
    camera_brand: brand || null,
    camera_system: cameraSystem || null,
    camera_format: cameraFormat || null,
    recording_codec: codec || null,
    resolution: resolution || null,
    primary_lut: primaryLut || null,
    producer: producer?.display_name || null,
    director: director?.display_name || null,
    dop: dop?.display_name || null,
    dit: dit?.display_name || null,
    estimated_budget: budgetRaw ? Number(budgetRaw.replace(/[^\d.]/g, "")) || null : null,
    currency,
    folders: DEFAULT_FOLDERS,
    members: [producer, director, dop, dit].filter(Boolean),
  } as any), [
    titleNumber, contentType, company, startDate, status, equipmentPreset,
    brand, cameraSystem, cameraFormat, codec, resolution, primaryLut,
    producer, director, dop, dit, budgetRaw, currency,
  ]);

  const canSubmit = useMemo(
    () => !!activeId && !!user && !!name.trim() && !!company.trim() && !!contentType && !!startDate && !!status,
    [activeId, user, name, company, contentType, startDate, status],
  );

  const handleCreate = async () => {
    if (!canSubmit || !activeId || !user) return;
    if (!canWriteActive) { toast.error("You only have viewer access to this workspace"); return; }
    setSubmitting(true);
    setSaveStatus("saving");
    try {
      const { data, error } = await supabase.from("projects").insert({
        workspace_id: activeId,
        user_id: user.id,
        name: name.trim(),
        crew: buildCrewPayload(),
      }).select("id,name").single();
      if (error) throw error;
      setDraftId((data as any).id);
      // Persist smart defaults for next time.
      saveDefaults(activeId, { brand, cameraSystem, cameraFormat, codec, resolution, primaryLut, currency });
      setSaveStatus("saved");
      toast.success("Title created");
      await refresh();
    } catch (e) {
      setSaveStatus("idle");
      toast.error((e as Error).message || "Failed to create Title");
    } finally {
      setSubmitting(false);
    }
  };

  // ----- Auto-save after draft exists -----
  const isDirtyRef = useRef(false);
  useEffect(() => {
    if (!draftId) return;
    isDirtyRef.current = true;
    setSaveStatus("syncing");
    const t = setTimeout(async () => {
      const { error } = await supabase.from("projects")
        .update({ name: name.trim(), crew: buildCrewPayload() })
        .eq("id", draftId);
      if (!error) {
        setSaveStatus("saved");
        if (activeId) saveDefaults(activeId, { brand, cameraSystem, cameraFormat, codec, resolution, primaryLut, currency });
      } else {
        setSaveStatus("idle");
      }
    }, 700);
    return () => clearTimeout(t);
    // Include all persisted fields
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftId, name, contentType, company, startDate, status, equipmentPreset, brand,
      cameraSystem, cameraFormat, codec, resolution, primaryLut,
      producer, director, dop, dit, budgetRaw, currency]);

  // ----- Render -----
  if (checking) {
    return (
      <div className="min-h-[40vh] grid place-items-center text-muted-foreground">
        <Loader2 className="w-5 h-5 animate-spin" />
      </div>
    );
  }

  if (!activeId) {
    return (
      <Card className="p-6 text-sm text-muted-foreground border-amber-500/30 bg-amber-500/5">
        <div className="flex items-center gap-2">
          <Building2 className="w-4 h-4" />
          Pick a workspace to begin. Titles and ingest are scoped per workspace.
        </div>
      </Card>
    );
  }

  if (activeTitleId) return <StudioIngest />;

  if (titles.length > 0 && mode === "gate" && !draftId) {
    const latest = titles[0];
    return (
      <div className="max-w-2xl mx-auto">
        <Card className="p-6 sm:p-8 space-y-5">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-primary">
              <Clapperboard className="w-5 h-5" />
              <span className="text-xs uppercase tracking-widest">Title Workspace</span>
            </div>
            <h2 className="text-2xl font-semibold tracking-tight">Choose a Title to continue</h2>
            <p className="text-sm text-muted-foreground">
              Every ingest is filed under a Title. Continue your latest, create a new one, or switch to another.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <Button className="justify-start" onClick={() => setActiveTitleId(latest.id)}>
              <ArrowRight className="w-4 h-4 mr-2" />
              Continue Ingest
            </Button>
            <Button variant="outline" className="justify-start" onClick={() => setMode("form")}>
              <Plus className="w-4 h-4 mr-2" />
              New Title
            </Button>
            <div className="flex items-center gap-2">
              <Repeat className="w-4 h-4 text-muted-foreground shrink-0" />
              <Select onValueChange={(v) => setActiveTitleId(v)}>
                <SelectTrigger><SelectValue placeholder="Switch Title" /></SelectTrigger>
                <SelectContent>
                  {titles.map((t) => (<SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="rounded-md border border-border/60 bg-muted/30 p-3 text-xs text-muted-foreground">
            Latest: <span className="text-foreground font-medium">{latest.name}</span>
          </div>
        </Card>
      </div>
    );
  }

  const saveLabel =
    saveStatus === "saving" ? "Saving…" :
    saveStatus === "syncing" ? "Syncing…" :
    saveStatus === "saved" ? "Saved" : "";

  return (
    <div className="max-w-3xl mx-auto">
      <Card className="p-6 sm:p-8 space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-primary">
              <Clapperboard className="w-5 h-5" />
              <span className="text-xs uppercase tracking-widest">Title Setup</span>
            </div>
            <h2 className="text-2xl font-semibold tracking-tight">Create your Title Workspace</h2>
            <p className="text-sm text-muted-foreground">
              Pick an equipment package or configure manually. Everything auto-saves — no Save button.
            </p>
          </div>
          {saveLabel && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground shrink-0 mt-1">
              {(saveStatus === "saving" || saveStatus === "syncing") && <Loader2 className="w-3 h-3 animate-spin" />}
              {saveStatus === "saved" && <Check className="w-3 h-3 text-emerald-500" />}
              {saveLabel}
            </div>
          )}
        </div>

        {/* Basics */}
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2 space-y-1.5">
            <Label htmlFor="ttl-number">Title Number</Label>
            <Input id="ttl-number" value={titleNumber} readOnly className="font-mono bg-muted/40" />
            <p className="text-xs text-muted-foreground">Auto-generated and read-only.</p>
          </div>

          <div className="sm:col-span-2 space-y-1.5">
            <Label htmlFor="ttl-name">Title Name</Label>
            <Input id="ttl-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Untitled Feature 2026" />
          </div>

          <div className="space-y-1.5">
            <Label>Content Type</Label>
            <Select value={contentType} onValueChange={setContentType}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {CONTENT_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Status</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {TITLE_STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="sm:col-span-2 space-y-1.5">
            <Label htmlFor="ttl-company">Production Company</Label>
            <Input id="ttl-company" value={company} onChange={(e) => setCompany(e.target.value)} placeholder="e.g. Northlight Pictures Pvt. Ltd." />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="ttl-start">Start Date</Label>
            <Input id="ttl-start" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </div>

          <div className="space-y-1.5">
            <Label>Currency</Label>
            <Select value={currency} onValueChange={setCurrency}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {CURRENCIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Technical */}
        <div className="space-y-4 rounded-lg border border-border/60 bg-muted/20 p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Package className="w-4 h-4 text-primary" /> Technical
            </div>
            {equipmentPreset && (
              <Button type="button" size="sm" variant="ghost" onClick={() => setEquipmentPreset("")}>
                Clear preset
              </Button>
            )}
          </div>

          <div className="space-y-1.5">
            <Label>Equipment Preset</Label>
            <Select value={equipmentPreset} onValueChange={applyEquipmentPreset}>
              <SelectTrigger><SelectValue placeholder="Select a package (optional) — auto-fills camera, codec, resolution & LUT" /></SelectTrigger>
              <SelectContent>
                {EQUIPMENT_PRESETS.map((p) => <SelectItem key={p.id} value={p.id}>{p.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Camera Brand</Label>
              <Combobox
                value={brand} onChange={(v) => { setBrand(v); setCameraSystem(""); setCameraFormat(""); setCodec(""); setResolution(""); }}
                options={brandOptions} placeholder="Search brand…" allowCustom={false}
              />
            </div>

            <div className="space-y-1.5">
              <Label>Camera System</Label>
              <Combobox
                value={cameraSystem}
                onChange={(v) => { setCameraSystem(v); setCameraFormat(""); setCodec(""); setResolution(""); }}
                options={systemOptions} placeholder="Search camera…"
              />
            </div>

            <div className="space-y-1.5">
              <Label>Camera Format</Label>
              <Combobox
                value={cameraFormat} onChange={(v) => { setCameraFormat(v); setCodec(""); setResolution(""); }}
                options={formatOptions} placeholder={cameraSystem ? "Select format…" : "Choose camera first"}
                disabled={!cameraSystem}
              />
            </div>

            <div className="space-y-1.5">
              <Label>Recording Codec</Label>
              <Combobox
                value={codec} onChange={setCodec}
                options={codecOptions} placeholder={cameraFormat ? "Select codec…" : "Choose format first"}
                disabled={!cameraFormat}
              />
            </div>

            <div className="space-y-1.5">
              <Label>Resolution</Label>
              <Combobox
                value={resolution} onChange={setResolution}
                options={resolutionOptions} placeholder="Select or type custom…"
              />
            </div>

            <div className="space-y-1.5">
              <Label>Primary LUT <span className="text-muted-foreground font-normal">(optional)</span></Label>
              <Combobox value={primaryLut} onChange={setPrimaryLut} options={LUT_PRESETS} placeholder="Search LUT…" />
            </div>
          </div>
        </div>

        {/* Crew */}
        <div className="space-y-4 rounded-lg border border-border/60 bg-muted/20 p-4">
          <div className="text-sm font-medium">Crew</div>
          <div className="grid gap-4 sm:grid-cols-2">
            <CrewPicker role="Producer" value={producer} onChange={setProducer} />
            <CrewPicker role="Director" value={director} onChange={setDirector} />
            <CrewPicker role="DOP" value={dop} onChange={setDop} />
            <CrewPicker role="DIT" value={dit} onChange={setDit} />
          </div>
        </div>

        {/* Budget */}
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="ttl-budget">Estimated Budget <span className="text-muted-foreground font-normal">(optional)</span></Label>
            <Input
              id="ttl-budget" inputMode="decimal" value={budgetRaw}
              onChange={(e) => setBudgetRaw(e.target.value.replace(/[^\d.]/g, ""))}
              placeholder="e.g. 25000000"
            />
            {budgetDisplay && <p className="text-xs text-muted-foreground">{budgetDisplay}</p>}
          </div>
        </div>

        {/* Folders */}
        <div className="rounded-md border border-border/60 bg-muted/30 p-3 text-xs text-muted-foreground space-y-2">
          <div className="flex items-center gap-2 text-foreground">
            <FolderTree className="w-3.5 h-3.5" />
            <span className="font-medium">Auto-created folders</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {DEFAULT_FOLDERS.map((f) => (
              <span key={f} className="px-2 py-0.5 rounded bg-background border border-border/60 text-[11px]">{f}</span>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-2">
          {titles.length > 0 && !draftId && (
            <Button variant="ghost" onClick={() => setMode("gate")} disabled={submitting}>Cancel</Button>
          )}
          {!draftId ? (
            <Button onClick={handleCreate} disabled={!canSubmit || submitting}>
              {submitting
                ? (<><Loader2 className="w-4 h-4 mr-2 animate-spin" />Creating…</>)
                : "Create Title"}
            </Button>
          ) : (
            <Button onClick={() => setActiveTitleId(draftId)}>
              <ArrowRight className="w-4 h-4 mr-2" /> Continue to Ingest
            </Button>
          )}
        </div>
      </Card>
    </div>
  );
}
