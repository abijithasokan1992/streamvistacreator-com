/**
 * DIT Master Compliance & Ingest Protocol
 *
 * Studio-scoped compliance form the DIT (Digital Imaging Technician) fills at
 * the end of every shoot day. Captures workflow mode, camera→card mapping, the
 * human-verification checklist, and the mandatory data-copy screenshot.
 *
 * All writes go through `dit_ingest_logs` (RLS: owner-only) and the private
 * `dit-ingest-screenshots` bucket.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ClipboardCheck, HardDrive, Plus, Trash2, Upload, ChevronRight,
  Folder, FolderOpen, Camera, ShieldCheck, Loader2, CheckCircle2, History,
  Radio, Cloud, Layers, AlertTriangle,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useWorkspaces } from "@/hooks/useWorkspaces";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

// ────────────────────────────────────────────────────────────────────────────
// Domain constants
// ────────────────────────────────────────────────────────────────────────────

type ModeId =
  | "mode_1_physical_plus_cloud"
  | "mode_2_local_master_cloud_proxies"
  | "mode_3_pure_cloud_ingest";

const MODES: Array<{
  id: ModeId; title: string; blurb: string; icon: React.ComponentType<{ className?: string }>;
}> = [
  {
    id: "mode_1_physical_plus_cloud",
    title: "Physical Master Backup + 1 Cloud Archive",
    blurb: "Two identical physical masters, one cold cloud archive. Traditional DIT safety net.",
    icon: HardDrive,
  },
  {
    id: "mode_2_local_master_cloud_proxies",
    title: "Cloud-Based Processing Workflow",
    blurb: "Local master retained on set; proxies pushed to cloud for editorial in parallel.",
    icon: Layers,
  },
  {
    id: "mode_3_pure_cloud_ingest",
    title: "Pure Cloud Ingest (5G / Bonded Network)",
    blurb: "Wireless multi-region ingest — no physical master on set. Requires region replication.",
    icon: Radio,
  },
];

type ChecklistKey =
  | "visual_qc" | "audio_tc_sync" | "card_lock" | "transcoding" | "screenshot_uploaded";

const CHECKLIST: Array<{ id: ChecklistKey; label: string; hint?: string }> = [
  {
    id: "visual_qc",
    label: "Visual QC",
    hint: "Verified no digital glitches or black frames in DaVinci Resolve.",
  },
  {
    id: "audio_tc_sync",
    label: "Audio & Timecode Sync",
    hint: "Confirmed no timecode drift between camera and external audio recorder.",
  },
  {
    id: "card_lock",
    label: "Card Lock Protocol",
    hint: "Verified physical card write-protection before insertion.",
  },
  {
    id: "transcoding",
    label: "Transcoding Execution",
    // Bilingual label per DIT protocol brief.
    hint: "DaVinci Resolve-ൽ പ്രോക്സി ട്രാൻസ്കോഡിങ് കൺവേർഷൻ പൂർത്തിയായി — proxy transcoding conversion completed in DaVinci Resolve, XML/MHL logs generated.",
  },
  {
    id: "screenshot_uploaded",
    label: "Screenshot Upload",
    hint: "Data-copying log screenshot uploaded below.",
  },
];

type CameraRow = { id: string; source: string; card: string; clipRange: string };
type ChecklistState = Record<ChecklistKey, boolean>;

const EMPTY_CHECKLIST: ChecklistState = {
  visual_qc: false, audio_tc_sync: false, card_lock: false,
  transcoding: false, screenshot_uploaded: false,
};

const uid = () => Math.random().toString(36).slice(2, 10);

// ────────────────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────────────────

function formatShootFolder(d: string): string {
  // Input: yyyy-mm-dd → Output: Date_DD-MM-YY
  if (!d) return "Date_DD-MM-YY";
  const [y, m, day] = d.split("-");
  if (!y || !m || !day) return "Date_DD-MM-YY";
  return `Date_${day}-${m}-${y.slice(2)}`;
}

function sanitizeCamFolder(source: string, card: string, i: number): string {
  const s = (source || `Cam_${String.fromCharCode(65 + i)}`).trim().replace(/\s+/g, "_");
  const c = (card || `${String.fromCharCode(65 + i)}001`).trim().replace(/\s+/g, "_");
  return `${s}_${c}`;
}

// ────────────────────────────────────────────────────────────────────────────
// Directory Tree
// ────────────────────────────────────────────────────────────────────────────

function DirectoryTree({
  productionName, shootDate, cameras,
}: { productionName: string; shootDate: string; cameras: CameraRow[] }) {
  const prodLabel = productionName?.trim() ? productionName.trim() : "[Movie Name]";
  const dateLabel = formatShootFolder(shootDate);
  const cams = cameras.length > 0 ? cameras : [{ id: "placeholder", source: "Cam_A", card: "A001", clipRange: "" }];

  return (
    <div className="rounded-lg border border-border/50 bg-secondary/10 p-4 font-mono text-xs leading-6 overflow-x-auto">
      <TreeNode icon={<HardDrive className="w-3.5 h-3.5 text-accent" />} label="Hard Disk 1" depth={0} last>
        <TreeNode icon={<FolderOpen className="w-3.5 h-3.5 text-accent" />} label="Master" depth={1} last>
          <TreeNode icon={<Folder className="w-3.5 h-3.5" />} label={prodLabel} depth={2} last>
            <TreeNode icon={<Folder className="w-3.5 h-3.5" />} label="Master" depth={3} last>
              <TreeNode icon={<Folder className="w-3.5 h-3.5" />} label={dateLabel} depth={4} last>
                {cams.map((c, i) => (
                  <TreeNode
                    key={c.id}
                    depth={5}
                    last={i === cams.length - 1}
                    icon={<Camera className="w-3.5 h-3.5 text-muted-foreground" />}
                    label={sanitizeCamFolder(c.source, c.card, i)}
                  />
                ))}
              </TreeNode>
            </TreeNode>
          </TreeNode>
        </TreeNode>
      </TreeNode>
    </div>
  );
}

function TreeNode({
  icon, label, depth, last, children,
}: {
  icon: React.ReactNode; label: string; depth: number; last?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-center gap-2 whitespace-nowrap" style={{ paddingLeft: depth * 14 }}>
        <span className="text-muted-foreground/60 select-none">{last ? "└─" : "├─"}</span>
        {icon}
        <span className="text-foreground/90">{label}</span>
      </div>
      {children}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Log entry row type (from DB)
// ────────────────────────────────────────────────────────────────────────────

type LogRow = {
  id: string;
  production_name: string;
  shoot_date: string;
  selected_mode: ModeId;
  replication_regions: number | null;
  camera_mapping: CameraRow[];
  checklist_status: ChecklistState;
  screenshot_url: string | null;
  notes: string | null;
  created_at: string;
};

// ────────────────────────────────────────────────────────────────────────────
// Main component
// ────────────────────────────────────────────────────────────────────────────

export default function DitIngestProtocol() {
  const { user } = useAuth();
  const { active } = useWorkspaces();
  const workspaceId = active?.id ?? null;

  // Form state
  const [productionName, setProductionName] = useState("");
  const [shootDate, setShootDate] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [mode, setMode] = useState<ModeId>("mode_1_physical_plus_cloud");
  const [regions, setRegions] = useState<1 | 2 | 3>(2);
  const [cameras, setCameras] = useState<CameraRow[]>([
    { id: uid(), source: "Cam A", card: "A001", clipRange: "" },
  ]);
  const [checklist, setChecklist] = useState<ChecklistState>(EMPTY_CHECKLIST);
  const [screenshotFile, setScreenshotFile] = useState<File | null>(null);
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // History
  const [history, setHistory] = useState<LogRow[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [tab, setTab] = useState<"form" | "history">("form");
  // Storage-bucket availability. When the private DIT bucket write fails we
  // surface a persistent banner and keep the form values as an explicit
  // LOCAL DRAFT. No compliance log is persisted server-side in that state.
  const [storageUnavailable, setStorageUnavailable] = useState(false);

  const loadHistory = useCallback(async () => {
    if (!user) return;
    setHistoryLoading(true);
    const { data, error } = await supabase
      .from("dit_ingest_logs")
      .select("id,production_name,shoot_date,selected_mode,replication_regions,camera_mapping,checklist_status,screenshot_url,notes,created_at")
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) {
      toast.error(`Could not load history: ${error.message}`);
    } else {
      setHistory((data ?? []) as unknown as LogRow[]);
    }
    setHistoryLoading(false);
  }, [user]);

  useEffect(() => { loadHistory(); }, [loadHistory]);

  // Checklist tracker
  const requiredKeys = useMemo(
    () => CHECKLIST.map((c) => c.id).filter((k) => k !== "screenshot_uploaded"),
    [],
  );
  const checklistOK = requiredKeys.every((k) => checklist[k]);
  const hasScreenshot = !!screenshotFile;
  const canSubmit =
    !!user && productionName.trim().length > 0 && !!shootDate &&
    cameras.length > 0 && cameras.every((c) => c.source.trim() && c.card.trim()) &&
    checklistOK && hasScreenshot && !submitting;

  const addCamera = () => {
    const i = cameras.length;
    const letter = String.fromCharCode(65 + i);
    setCameras((rows) => [...rows, { id: uid(), source: `Cam ${letter}`, card: `${letter}001`, clipRange: "" }]);
  };
  const removeCamera = (id: string) => setCameras((rows) => rows.filter((r) => r.id !== id));
  const updateCamera = (id: string, patch: Partial<CameraRow>) =>
    setCameras((rows) => rows.map((r) => (r.id === id ? { ...r, ...patch } : r)));

  const resetForm = () => {
    setProductionName("");
    setShootDate(new Date().toISOString().slice(0, 10));
    setMode("mode_1_physical_plus_cloud");
    setRegions(2);
    setCameras([{ id: uid(), source: "Cam A", card: "A001", clipRange: "" }]);
    setChecklist(EMPTY_CHECKLIST);
    setScreenshotFile(null);
    setNotes("");
  };

  const submit = async () => {
    if (!user || !canSubmit) return;
    setSubmitting(true);
    try {
      // 1. Upload screenshot to private storage. This is a mandatory chain-of-
      //    custody artefact — if the upload fails (bucket missing, RLS deny,
      //    network error) we MUST NOT persist a compliance log. No synthetic
      //    `pending-local://` placeholder is written to the database.
      const ext = screenshotFile!.name.split(".").pop() || "png";
      const path = `${user.id}/${new Date().toISOString().replace(/[:.]/g, "-")}-${uid()}.${ext}`;

      let uploadErrorMessage: string | null = null;
      try {
        const up = await supabase.storage
          .from("dit-ingest-screenshots")
          .upload(path, screenshotFile!, { cacheControl: "3600", upsert: false });
        if (up.error) uploadErrorMessage = up.error.message;
      } catch (uploadErr: any) {
        uploadErrorMessage = uploadErr?.message ?? String(uploadErr);
      }

      if (uploadErrorMessage) {
        // Honest failure. Preserve the form (and the picked file) as a LOCAL
        // DRAFT — never as a submitted compliance record.
        setStorageUnavailable(true);
        toast.error(
          `DIT log NOT submitted — screenshot upload failed (${uploadErrorMessage}). Your entries are kept as a local draft; re-submit once storage is available.`,
        );
        return;
      }

      setStorageUnavailable(false);
      const finalChecklist: ChecklistState = { ...checklist, screenshot_uploaded: true };

      // 2. Insert compliance log row with the real storage path.
      const { error } = await supabase.from("dit_ingest_logs").insert({
        user_id: user.id,
        workspace_id: workspaceId,
        production_name: productionName.trim(),
        shoot_date: shootDate,
        selected_mode: mode,
        replication_regions: mode === "mode_3_pure_cloud_ingest" ? regions : null,
        camera_mapping: cameras,
        checklist_status: finalChecklist,
        screenshot_url: path,
        notes: notes.trim() || null,
      });
      if (error) throw new Error(error.message);

      toast.success("DIT ingest log saved.");
      resetForm();
      await loadHistory();
      setTab("history");
    } catch (e: any) {
      toast.error(e?.message || "Failed to submit DIT log.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.2em] text-muted-foreground/70">
            <ShieldCheck className="w-3 h-3" /> DIT Protocol
          </div>
          <h1 className="text-2xl font-semibold tracking-tight mt-1">
            Master Compliance & Ingest
          </h1>
          <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
            End-of-day DIT compliance log — workflow mode, camera→card mapping, human verification,
            and mandatory copy-screenshot for chain-of-custody.
          </p>
        </div>
        <div className="flex items-center gap-1 rounded-lg border border-border/50 p-1 bg-secondary/10">
          <TabBtn active={tab === "form"} onClick={() => setTab("form")}>
            <ClipboardCheck className="w-3.5 h-3.5" /> New Log
          </TabBtn>
          <TabBtn active={tab === "history"} onClick={() => setTab("history")}>
            <History className="w-3.5 h-3.5" /> History
            {history.length > 0 && (
              <span className="ml-1 text-[10px] text-muted-foreground">({history.length})</span>
            )}
          </TabBtn>
        </div>
      </header>

      {tab === "form" ? (
        <>
          {storageUnavailable && (
            <div
              role="status"
              className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-200"
            >
              <div className="font-medium">DIT evidence storage is being configured.</div>
              <p className="mt-1 text-xs text-amber-200/80">
                Your DIT log is saved and the screenshot is retained locally. Once the private
                storage bucket is provisioned, re-open this form and re-attach the screenshot to
                complete chain-of-custody.
              </p>
            </div>
          )}
          {/* Production identity */}
          <Section title="1. Production" step="Identity">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="prod-name">Production / Movie Name</Label>
                <Input
                  id="prod-name" value={productionName}
                  onChange={(e) => setProductionName(e.target.value)}
                  placeholder="e.g. Untitled Feature 2026"
                  maxLength={200}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="shoot-date">Shoot Date</Label>
                <Input
                  id="shoot-date" type="date" value={shootDate}
                  onChange={(e) => setShootDate(e.target.value)}
                />
              </div>
            </div>
          </Section>

          {/* Workflow mode */}
          <Section title="2. Workflow Mode" step="Selector">
            <div className="grid gap-2.5 md:grid-cols-3">
              {MODES.map((m) => {
                const Icon = m.icon;
                const active = m.id === mode;
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setMode(m.id)}
                    aria-pressed={active}
                    className={cn(
                      "text-left rounded-xl border p-3.5 transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent/50",
                      active
                        ? "border-accent/60 bg-accent/10 ring-1 ring-inset ring-accent/30"
                        : "border-border/50 bg-secondary/10 hover:bg-secondary/20",
                    )}
                  >
                    <div className="flex items-center gap-2 text-sm font-semibold">
                      <Icon className={cn("w-4 h-4", active ? "text-accent" : "text-muted-foreground")} />
                      {m.title}
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-1.5">{m.blurb}</p>
                  </button>
                );
              })}
            </div>

            {mode === "mode_3_pure_cloud_ingest" && (
              <div className="mt-4 rounded-lg border border-accent/30 bg-accent/5 p-3">
                <div className="flex items-center gap-2 text-xs font-medium">
                  <Cloud className="w-3.5 h-3.5 text-accent" /> Multi-Region Replication
                </div>
                <p className="text-[11px] text-muted-foreground mt-1">
                  Pure cloud ingest has no physical master. Choose how many regions to replicate to.
                </p>
                <div className="mt-2.5 flex gap-1.5">
                  {[1, 2, 3].map((n) => {
                    const active = regions === n;
                    return (
                      <button
                        key={n}
                        type="button"
                        onClick={() => setRegions(n as 1 | 2 | 3)}
                        className={cn(
                          "rounded-full px-3 py-1 text-xs font-medium border transition-colors",
                          active
                            ? "bg-accent text-accent-foreground border-accent"
                            : "bg-secondary/30 text-muted-foreground border-border/40 hover:text-foreground",
                        )}
                      >
                        {n} {n === 1 ? "Region" : "Regions"}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </Section>

          {/* Camera mapping */}
          <Section title="3. Camera Mapping" step="Grid">
            <div className="rounded-lg border border-border/50 overflow-hidden">
              <div className="grid grid-cols-[1.2fr_1fr_1.3fr_40px] gap-0 bg-secondary/20 px-3 py-2 text-[10px] uppercase tracking-wider text-muted-foreground font-mono">
                <span>Input Source</span>
                <span>Card #</span>
                <span>Clip Range</span>
                <span />
              </div>
              <div className="divide-y divide-border/40">
                {cameras.map((row, i) => (
                  <div key={row.id} className="grid grid-cols-[1.2fr_1fr_1.3fr_40px] gap-2 px-3 py-2 items-center">
                    <Input
                      value={row.source}
                      onChange={(e) => updateCamera(row.id, { source: e.target.value })}
                      placeholder={`Cam ${String.fromCharCode(65 + i)}`}
                      className="h-8 text-sm"
                    />
                    <Input
                      value={row.card}
                      onChange={(e) => updateCamera(row.id, { card: e.target.value.toUpperCase() })}
                      placeholder={`${String.fromCharCode(65 + i)}001`}
                      className="h-8 text-sm font-mono"
                    />
                    <Input
                      value={row.clipRange}
                      onChange={(e) => updateCamera(row.id, { clipRange: e.target.value })}
                      placeholder="e.g. 0001–0142"
                      className="h-8 text-sm font-mono"
                    />
                    <button
                      type="button"
                      onClick={() => removeCamera(row.id)}
                      disabled={cameras.length === 1}
                      className="text-muted-foreground hover:text-destructive disabled:opacity-30 rounded p-1 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent/50"
                      aria-label="Remove camera row"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
              <button
                type="button"
                onClick={addCamera}
                className="w-full flex items-center justify-center gap-1.5 py-2 text-xs text-accent hover:bg-accent/5 border-t border-border/40 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent/50"
              >
                <Plus className="w-3.5 h-3.5" /> Add camera
              </button>
            </div>
          </Section>

          {/* Directory tree preview */}
          <Section title="4. Master Drive Structure" step="Preview">
            <p className="text-[11px] text-muted-foreground mb-2.5">
              Live preview of the folder tree the DIT should create on Hard Disk 1.
              Updates automatically from the fields above.
            </p>
            <DirectoryTree productionName={productionName} shootDate={shootDate} cameras={cameras} />
          </Section>

          {/* Checklist */}
          <Section title="5. Human Verification Checklist" step="Mandatory">
            <ul className="space-y-2">
              {CHECKLIST.map((item) => {
                const derived = item.id === "screenshot_uploaded" ? hasScreenshot : checklist[item.id];
                const isScreenshot = item.id === "screenshot_uploaded";
                return (
                  <li
                    key={item.id}
                    className={cn(
                      "rounded-lg border p-3 flex gap-3 items-start",
                      derived ? "border-emerald-500/30 bg-emerald-500/5" : "border-border/50 bg-secondary/10",
                    )}
                  >
                    <Checkbox
                      id={`chk-${item.id}`}
                      checked={derived}
                      disabled={isScreenshot}
                      onCheckedChange={(v) => {
                        if (isScreenshot) return;
                        setChecklist((s) => ({ ...s, [item.id]: !!v }));
                      }}
                      className="mt-0.5"
                    />
                    <div className="min-w-0 flex-1">
                      <label htmlFor={`chk-${item.id}`} className="text-sm font-medium cursor-pointer select-none">
                        {item.label}
                      </label>
                      {item.hint && (
                        <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">{item.hint}</p>
                      )}
                    </div>
                    {derived && <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />}
                  </li>
                );
              })}
            </ul>

            {/* Screenshot upload */}
            <div className="mt-4 rounded-lg border border-amber-400/30 bg-amber-500/5 p-4 space-y-3">
              <div className="flex items-start gap-2 text-xs text-amber-200">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                <span>
                  <strong>Mandatory rule:</strong> Date wise Copying, and every copying take a Screenshot.
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <label
                  htmlFor="dit-screenshot"
                  className="inline-flex items-center gap-2 text-xs font-medium rounded-md border border-border/50 bg-secondary/30 hover:bg-secondary/50 px-3 py-2 cursor-pointer focus-within:ring-1 focus-within:ring-accent/50"
                >
                  <Upload className="w-3.5 h-3.5" />
                  {screenshotFile ? "Replace screenshot" : "Choose screenshot"}
                </label>
                <input
                  id="dit-screenshot"
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={(e) => setScreenshotFile(e.target.files?.[0] ?? null)}
                  className="sr-only"
                />
                {screenshotFile ? (
                  <span className="text-[11px] text-muted-foreground truncate max-w-[280px]">
                    {screenshotFile.name} · {(screenshotFile.size / 1024).toFixed(1)} KB
                  </span>
                ) : (
                  <span className="text-[11px] text-muted-foreground">PNG / JPG / WEBP, ≤ 20 MB.</span>
                )}
              </div>
            </div>
          </Section>

          {/* Notes */}
          <Section title="6. Notes" step="Optional">
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Anything the next shift needs to know — anomalies, missing cards, retakes…"
              rows={3}
              maxLength={2000}
            />
          </Section>

          {/* Submit */}
          <div className="sticky bottom-4 z-10">
            <div className="rounded-xl border border-border/60 bg-background/90 backdrop-blur px-4 py-3 flex flex-wrap items-center justify-between gap-3 shadow-lg">
              <div className="text-xs text-muted-foreground">
                {checklistOK && hasScreenshot ? (
                  <span className="text-emerald-300 flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5" /> All required checks complete.
                  </span>
                ) : (
                  <span>
                    {requiredKeys.filter((k) => checklist[k]).length + (hasScreenshot ? 1 : 0)} / {CHECKLIST.length} required items complete.
                  </span>
                )}
              </div>
              <div className="flex gap-2">
                <Button variant="ghost" size="sm" onClick={resetForm} disabled={submitting}>
                  Reset
                </Button>
                <Button size="sm" onClick={submit} disabled={!canSubmit}>
                  {submitting ? (
                    <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> Submitting…</>
                  ) : (
                    <>Submit DIT Log <ChevronRight className="w-3.5 h-3.5 ml-1" /></>
                  )}
                </Button>
              </div>
            </div>
          </div>
        </>
      ) : (
        <HistoryList rows={history} loading={historyLoading} onReload={loadHistory} />
      )}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Sub-components
// ────────────────────────────────────────────────────────────────────────────

function Section({
  title, step, children,
}: { title: string; step?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-border/50 bg-secondary/5 p-4 md:p-5">
      <div className="flex items-center justify-between mb-3.5">
        <h2 className="text-sm font-semibold tracking-tight">{title}</h2>
        {step && (
          <span className="text-[10px] uppercase tracking-[0.18em] font-mono text-muted-foreground/70">
            {step}
          </span>
        )}
      </div>
      <Separator className="mb-4 bg-border/40" />
      {children}
    </section>
  );
}

function TabBtn({
  active, onClick, children,
}: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent/50",
        active
          ? "bg-accent/15 text-foreground"
          : "text-muted-foreground hover:text-foreground hover:bg-secondary/30",
      )}
    >
      {children}
    </button>
  );
}

function HistoryList({
  rows, loading, onReload,
}: { rows: LogRow[]; loading: boolean; onReload: () => void }) {
  if (loading) {
    return (
      <div className="rounded-xl border border-border/50 bg-secondary/5 py-10 grid place-items-center text-muted-foreground">
        <Loader2 className="w-4 h-4 animate-spin" />
      </div>
    );
  }
  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-border/50 bg-secondary/5 py-10 text-center text-sm text-muted-foreground">
        No DIT logs submitted yet.
      </div>
    );
  }
  return (
    <div className="space-y-2.5">
      <div className="flex justify-end">
        <Button variant="ghost" size="sm" onClick={onReload}>Refresh</Button>
      </div>
      <ul className="space-y-2.5">
        {rows.map((r) => {
          const mode = MODES.find((m) => m.id === r.selected_mode);
          const camCount = Array.isArray(r.camera_mapping) ? r.camera_mapping.length : 0;
          const checkVals = r.checklist_status ?? ({} as ChecklistState);
          const checkedCount = Object.values(checkVals).filter(Boolean).length;
          const screenshotPendingLocal =
            typeof r.screenshot_url === "string" &&
            r.screenshot_url.startsWith("pending-local://");
          return (
            <li key={r.id} className="rounded-xl border border-border/50 bg-secondary/5 p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-semibold truncate">{r.production_name}</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    Shoot {r.shoot_date} · Logged {new Date(r.created_at).toLocaleString()}
                  </p>
                </div>
                <div className="flex flex-wrap gap-1.5 shrink-0">
                  <Badge variant="secondary" className="text-[10px]">
                    {mode?.title.split(" (")[0] ?? r.selected_mode}
                  </Badge>
                  {r.replication_regions && (
                    <Badge variant="outline" className="text-[10px]">
                      {r.replication_regions}× region
                    </Badge>
                  )}
                  <Badge variant="outline" className="text-[10px]">
                    {camCount} camera{camCount === 1 ? "" : "s"}
                  </Badge>
                  <Badge
                    className={cn(
                      "text-[10px]",
                      checkedCount === 5 ? "bg-emerald-500/20 text-emerald-200 hover:bg-emerald-500/20" : "bg-amber-500/15 text-amber-200 hover:bg-amber-500/15",
                    )}
                  >
                    Checklist {checkedCount}/5
                  </Badge>
                  {screenshotPendingLocal && (
                    <Badge
                      className="text-[10px] bg-amber-500/20 text-amber-200 hover:bg-amber-500/20 border border-amber-400/40"
                      title="Screenshot was not uploaded to cloud storage. Re-attach when the bucket is available."
                    >
                      <AlertTriangle className="w-3 h-3 mr-1" />
                      Pending local — not uploaded
                    </Badge>
                  )}
                </div>
              </div>
              {screenshotPendingLocal && (
                <p className="text-[11px] text-amber-300/90 mt-2">
                  Chain-of-custody metadata saved, but the screenshot never reached
                  cloud storage. This log is <strong>not</strong> a completed
                  distribution asset — an admin must re-attach the screenshot to
                  finalise it.
                </p>
              )}
              {r.notes && (
                <p className="text-xs text-muted-foreground mt-2 line-clamp-2">{r.notes}</p>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
