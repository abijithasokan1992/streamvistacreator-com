/**
 * TitleSetupGate (MVP)
 * ====================
 * Reuses the existing Ingest Setup wizard as a lightweight **Title Setup**
 * shown before the first Studio Ingest for a workspace. Once at least one
 * Title exists and one is marked Active, the existing StudioIngest surface
 * renders unchanged.
 *
 * Design intent (kept minimal, but forward-compatible):
 * The Title Workspace is the permanent parent container for all future media,
 * metadata, reports, editorial assets, masters, deliverables, and archive.
 * MVP stores only the fields listed in the ticket + a canonical folder list
 * inside the existing `projects.crew` jsonb column — no schema changes.
 *
 * No backend, RBAC, upload-pipeline, or DRM changes.
 */

import { useEffect, useMemo, useState, useCallback } from "react";
import { Loader2, Clapperboard, Building2, FolderTree, Plus, ArrowRight, Repeat } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useWorkspaces } from "@/hooks/useWorkspaces";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import StudioIngest from "./StudioIngest";

const CONTENT_TYPES = [
  "Feature Film", "Series", "Documentary", "Short Film",
  "Commercial", "Music Video", "Animation", "Other",
] as const;

const TITLE_STATUSES = [
  "Pre-Production", "Production", "Post-Production", "Delivery", "Archived",
] as const;

const CURRENCIES = ["INR", "USD", "EUR", "GBP", "AED", "AUD", "CAD", "JPY", "SGD"] as const;

/** Canonical folder layout auto-created on every new Title. Stored in
 *  `crew.folders` today; ready to migrate to a folders table later without
 *  breaking existing titles. */
const DEFAULT_FOLDERS = [
  "RAW", "Proxy", "Audio", "Documents", "Reports",
  "LUTs", "Stills", "Masters", "Deliverables", "Archive",
] as const;

function generateTitleNumber(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `TTL-${yyyy}${mm}${dd}-${rand}`;
}

const ACTIVE_TITLE_KEY = (wsId: string) => `sv:active-title:${wsId}`;

type TitleRow = { id: string; name: string; created_at?: string };

export default function ProductionSetupGate() {
  const { user } = useAuth();
  const { activeId, canWriteActive } = useWorkspaces();

  const [checking, setChecking] = useState(true);
  const [titles, setTitles] = useState<TitleRow[]>([]);
  const [activeTitleId, setActiveTitleIdState] = useState<string | null>(null);
  const [mode, setMode] = useState<"gate" | "form">("gate");
  const [submitting, setSubmitting] = useState(false);

  // ---- Form state (MVP fields only) ----
  const [titleNumber, setTitleNumber] = useState(generateTitleNumber);
  const [name, setName] = useState("");
  const [contentType, setContentType] = useState<string>("Feature Film");
  const [company, setCompany] = useState("");
  const [startDate, setStartDate] = useState<string>(
    () => new Date().toISOString().slice(0, 10),
  );
  const [status, setStatus] = useState<string>("Pre-Production");
  const [cameraSystem, setCameraSystem] = useState("");
  const [cameraFormat, setCameraFormat] = useState("");
  const [codec, setCodec] = useState("");
  const [resolution, setResolution] = useState("");
  const [primaryLut, setPrimaryLut] = useState("");
  const [producer, setProducer] = useState("");
  const [director, setDirector] = useState("");
  const [dop, setDop] = useState("");
  const [dit, setDit] = useState("");
  const [budget, setBudget] = useState("");
  const [currency, setCurrency] = useState<string>("INR");

  const setActiveTitleId = useCallback((id: string | null) => {
    setActiveTitleIdState(id);
    if (!activeId) return;
    try {
      if (id) localStorage.setItem(ACTIVE_TITLE_KEY(activeId), id);
      else localStorage.removeItem(ACTIVE_TITLE_KEY(activeId));
    } catch { /* ignore */ }
  }, [activeId]);

  // Load titles for the active workspace + restore Active Title selection.
  const refresh = useCallback(async () => {
    if (!activeId) { setChecking(false); setTitles([]); return; }
    setChecking(true);
    const { data } = await supabase
      .from("projects")
      .select("id,name,created_at")
      .eq("workspace_id", activeId)
      .order("created_at", { ascending: false });
    const rows = (data as TitleRow[]) ?? [];
    setTitles(rows);
    let saved: string | null = null;
    try { saved = localStorage.getItem(ACTIVE_TITLE_KEY(activeId)); } catch { /* ignore */ }
    const valid = saved && rows.some((r) => r.id === saved) ? saved : null;
    setActiveTitleIdState(valid);
    setChecking(false);
  }, [activeId]);

  useEffect(() => { refresh(); }, [refresh]);

  const canSubmit = useMemo(
    () => !!activeId && !!user && !!name.trim() && !!company.trim() && !!contentType && !!startDate && !!status,
    [activeId, user, name, company, contentType, startDate, status],
  );

  const handleCreate = async () => {
    if (!canSubmit || !activeId || !user) return;
    if (!canWriteActive) { toast.error("You only have viewer access to this workspace"); return; }
    setSubmitting(true);
    try {
      const { data, error } = await supabase.from("projects").insert({
        workspace_id: activeId,
        user_id: user.id,
        name: name.trim(),
        // All extra fields live inside the existing jsonb column, keeping the
        // schema untouched while remaining fully editable later.
        crew: {
          title_number: titleNumber,
          content_type: contentType,
          production_company: company.trim(),
          start_date: startDate,
          title_status: status,
          camera_system: cameraSystem || null,
          camera_format: cameraFormat || null,
          recording_codec: codec || null,
          resolution: resolution || null,
          primary_lut: primaryLut || null,
          producer: producer || null,
          director: director || null,
          dop: dop || null,
          dit: dit || null,
          estimated_budget: budget ? Number(budget) || budget : null,
          currency,
          folders: DEFAULT_FOLDERS,
          members: [],
        } as any,
      }).select("id,name").single();
      if (error) throw error;
      toast.success("Title created — starting ingest");
      setActiveTitleId((data as any).id);
      await refresh();
    } catch (e) {
      toast.error((e as Error).message || "Failed to create Title");
    } finally {
      setSubmitting(false);
    }
  };

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

  // Active Title selected → hand off to existing ingest flow unchanged.
  if (activeTitleId) return <StudioIngest />;

  // Titles exist but none active → Continue / New / Switch gate.
  if (titles.length > 0 && mode === "gate") {
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
                  {titles.map((t) => (
                    <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                  ))}
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

  // No titles yet (or user chose "New Title") → MVP setup form.
  return (
    <div className="max-w-3xl mx-auto">
      <Card className="p-6 sm:p-8 space-y-6">
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-primary">
            <Clapperboard className="w-5 h-5" />
            <span className="text-xs uppercase tracking-widest">Title Setup</span>
          </div>
          <h2 className="text-2xl font-semibold tracking-tight">Create your Title Workspace</h2>
          <p className="text-sm text-muted-foreground">
            A quick one-time setup. Everything else — Shoot Days, Ingest Sessions, Camera
            & Sound Reports, Cast & Crew, Editorial, VFX, DI, Rights, Distribution —
            can be added later without interrupting ingest.
          </p>
        </div>

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
            <Label htmlFor="ttl-cam-sys">Camera System</Label>
            <Input id="ttl-cam-sys" value={cameraSystem} onChange={(e) => setCameraSystem(e.target.value)} placeholder="e.g. ARRI Alexa 35" />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="ttl-cam-fmt">Camera Format</Label>
            <Input id="ttl-cam-fmt" value={cameraFormat} onChange={(e) => setCameraFormat(e.target.value)} placeholder="e.g. Open Gate 4.6K" />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="ttl-codec">Recording Codec</Label>
            <Input id="ttl-codec" value={codec} onChange={(e) => setCodec(e.target.value)} placeholder="e.g. ARRIRAW / ProRes 4444 XQ" />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="ttl-res">Resolution</Label>
            <Input id="ttl-res" value={resolution} onChange={(e) => setResolution(e.target.value)} placeholder="e.g. 4448 × 3096" />
          </div>

          <div className="sm:col-span-2 space-y-1.5">
            <Label htmlFor="ttl-lut">Primary LUT <span className="text-muted-foreground font-normal">(optional)</span></Label>
            <Input id="ttl-lut" value={primaryLut} onChange={(e) => setPrimaryLut(e.target.value)} placeholder="e.g. ARRI LogC4 → Rec.709" />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="ttl-producer">Producer</Label>
            <Input id="ttl-producer" value={producer} onChange={(e) => setProducer(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ttl-director">Director</Label>
            <Input id="ttl-director" value={director} onChange={(e) => setDirector(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ttl-dop">DOP</Label>
            <Input id="ttl-dop" value={dop} onChange={(e) => setDop(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ttl-dit">DIT</Label>
            <Input id="ttl-dit" value={dit} onChange={(e) => setDit(e.target.value)} />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="ttl-budget">Estimated Budget <span className="text-muted-foreground font-normal">(optional)</span></Label>
            <Input id="ttl-budget" inputMode="decimal" value={budget} onChange={(e) => setBudget(e.target.value)} placeholder="e.g. 25000000" />
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
          <div>
            Workflow: <span className="text-foreground font-medium">Title → RAW Ingest → Checksum → Primary Backup → OCI Backup → Proxy Generation → Ready for Editorial</span>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2">
          {titles.length > 0 && (
            <Button variant="ghost" onClick={() => setMode("gate")} disabled={submitting}>Cancel</Button>
          )}
          <Button onClick={handleCreate} disabled={!canSubmit || submitting}>
            {submitting ? (<><Loader2 className="w-4 h-4 mr-2 animate-spin" />Creating…</>) : "Create Title & start ingest"}
          </Button>
        </div>
      </Card>
    </div>
  );
}
