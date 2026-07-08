/**
 * ProductionMediaWorkspace — read-only logical view of ingested media for the
 * Active Production.
 *
 * Reuses existing tables (ingest_jobs, ingest_job_items, recent_uploads) — no
 * new tables, no duplicate folders, no new pipeline. Groups clips by:
 *   Production → Shoot Day → Unit → Camera → Card → Clips
 *
 * Also surfaces:
 *   • Processing status (Upload / Checksum / Backup / OCI / Proxy / QC /
 *     Editorial / Archive) — inferred from existing item + upload state.
 *   • Storage locations (Primary / Secondary / OCI / Proxy / Archive) —
 *     inferred from existing storage_tier + upload status.
 *
 * Purely a UI aggregation over the current backend.
 */
import { useEffect, useMemo, useState } from "react";
import {
  Clapperboard, Camera, HardDrive, Film, Search, ChevronRight, ChevronDown,
  ShieldCheck, Cloud, Snowflake, FileVideo, FileAudio, FileText, Loader2,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

type Job = {
  id: string;
  project_id: string | null;
  shoot_day: string | null;
  camera_label: string | null;
  status: string;
  created_at: string;
  source_summary: any;
  notes: string | null;
  total_files: number;
  completed_files: number;
  failed_files: number;
};

type Item = {
  id: string;
  job_id: string;
  file_name: string;
  relative_path: string;
  size_bytes: number;
  status: string;
  asset_class: string | null;
  mime_guess: string | null;
  upload_id: string | null;
  metadata: any;
};

type Upload = {
  id: string;
  status: string;
  storage_tier: string;
  file_size: number;
};

function fmtBytes(n: number): string {
  if (!n || n <= 0) return "—";
  if (n < 1_048_576) return `${(n / 1024).toFixed(0)} KB`;
  if (n < 1_073_741_824) return `${(n / 1_048_576).toFixed(1)} MB`;
  if (n < 1_099_511_627_776) return `${(n / 1_073_741_824).toFixed(2)} GB`;
  return `${(n / 1_099_511_627_776).toFixed(2)} TB`;
}

function unitOf(job: Job): string {
  const s = job.source_summary || {};
  return s.unit || (job.notes?.match(/Unit:\s*([^\n]+)/i)?.[1] ?? "").trim() || "Main Unit";
}

function cameraOf(job: Job): string {
  const s = job.source_summary || {};
  return (
    [s.camera_brand, s.camera].filter(Boolean).join(" ") ||
    job.camera_label ||
    "Unknown Camera"
  );
}

function cardOf(job: Job): string {
  const s = job.source_summary || {};
  return s.card || s.root_label || "Card 1";
}

function shootDayOf(job: Job): string {
  return job.shoot_day || (job.created_at ? new Date(job.created_at).toISOString().slice(0, 10) : "Unscheduled");
}

// Item processing status → pipeline stage (read-only inference).
function pipelineStage(it: Item, up?: Upload): string {
  if (it.status === "failed") return "Failed";
  if (it.status === "queued" || it.status === "ready") return "Upload";
  if (it.status === "uploading") return "Upload";
  if (!up) return "Upload";
  if (up.status === "uploading") return "Upload";
  if (up.status === "verifying" || up.status === "checksum") return "Checksum Verified";
  if (up.status === "processing" || up.status === "proxy_pending") return "Proxy";
  if (up.storage_tier === "archive") return "Archive";
  if (up.status === "ready" || up.status === "complete" || up.status === "done") return "Editorial Delivered";
  return "Primary Backup";
}

// Storage location badges from existing storage_tier / status.
function storageBadges(up?: Upload): string[] {
  if (!up) return ["Primary"];
  const out: string[] = ["Primary"];
  if (up.status === "ready" || up.status === "complete" || up.status === "done") {
    out.push("Secondary", "OCI Cloud");
  }
  if (up.storage_tier === "archive") out.push("Archive");
  return out;
}

function assetIcon(cls?: string | null) {
  if (cls === "audio") return <FileAudio className="w-3.5 h-3.5" />;
  if (cls === "reports" || cls === "metadata") return <FileText className="w-3.5 h-3.5" />;
  return <FileVideo className="w-3.5 h-3.5" />;
}

const STAGES = [
  "Upload", "Checksum Verified", "Primary Backup",
  "OCI Cloud Sync", "Proxy Ready", "QC",
  "Editorial Delivered", "Archive",
];

export default function ProductionMediaWorkspace({
  workspaceId,
  activeProjectId,
  activeProjectName,
  activeProjectNumber,
}: {
  workspaceId: string | null;
  activeProjectId: string | null;
  activeProjectName?: string | null;
  activeProjectNumber?: string | null;
}) {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [uploads, setUploads] = useState<Record<string, Upload>>({});
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [filterCamera, setFilterCamera] = useState<string>("all");
  const [filterDay, setFilterDay] = useState<string>("all");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!workspaceId || !activeProjectId) { setJobs([]); setItems([]); setUploads({}); return; }
    let cancelled = false;
    setLoading(true);
    (async () => {
      const { data: jd } = await supabase
        .from("ingest_jobs")
        .select("id,project_id,shoot_day,camera_label,status,created_at,source_summary,notes,total_files,completed_files,failed_files")
        .eq("workspace_id", workspaceId)
        .eq("project_id", activeProjectId)
        .order("created_at", { ascending: false })
        .limit(200);
      if (cancelled) return;
      const jobsData = (jd as Job[]) ?? [];
      setJobs(jobsData);

      if (jobsData.length === 0) {
        setItems([]); setUploads({}); setLoading(false); return;
      }

      const ids = jobsData.map(j => j.id);
      const { data: itd } = await supabase
        .from("ingest_job_items")
        .select("id,job_id,file_name,relative_path,size_bytes,status,asset_class,mime_guess,upload_id,metadata")
        .in("job_id", ids)
        .limit(5000);
      if (cancelled) return;
      const itemsData = (itd as Item[]) ?? [];
      setItems(itemsData);

      const uploadIds = itemsData.map(i => i.upload_id).filter(Boolean) as string[];
      if (uploadIds.length) {
        const { data: ud } = await supabase
          .from("recent_uploads")
          .select("id,status,storage_tier,file_size")
          .in("id", uploadIds);
        if (cancelled) return;
        const map: Record<string, Upload> = {};
        (ud as Upload[] | null)?.forEach(u => { map[u.id] = u; });
        setUploads(map);
      } else {
        setUploads({});
      }
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [workspaceId, activeProjectId]);

  // Build hierarchy: shoot_day → unit → camera → card → clips
  const tree = useMemo(() => {
    const byJob = new Map<string, Item[]>();
    for (const it of items) {
      if (!byJob.has(it.job_id)) byJob.set(it.job_id, []);
      byJob.get(it.job_id)!.push(it);
    }
    const days: Record<string, Record<string, Record<string, Record<string, { job: Job; items: Item[] }>>>> = {};
    for (const j of jobs) {
      const day = shootDayOf(j);
      const unit = unitOf(j);
      const cam = cameraOf(j);
      const card = cardOf(j);
      days[day] ??= {};
      days[day][unit] ??= {};
      days[day][unit][cam] ??= {};
      days[day][unit][cam][card] = { job: j, items: byJob.get(j.id) ?? [] };
    }
    return days;
  }, [jobs, items]);

  const allCameras = useMemo(() => Array.from(new Set(jobs.map(cameraOf))).sort(), [jobs]);
  const allDays = useMemo(() => Array.from(new Set(jobs.map(shootDayOf))).sort().reverse(), [jobs]);

  const q = search.trim().toLowerCase();
  const matchItem = (it: Item) => !q || it.file_name.toLowerCase().includes(q) || it.relative_path.toLowerCase().includes(q);

  const toggle = (k: string) => setExpanded(e => ({ ...e, [k]: !e[k] }));

  if (!activeProjectId) {
    return (
      <div className="rounded-xl border border-dashed border-border/50 bg-secondary/10 p-6 text-center">
        <Clapperboard className="w-6 h-6 text-muted-foreground mx-auto mb-2" />
        <p className="text-sm text-muted-foreground">Pick an active production to view its media workspace.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="p-6 text-center text-sm text-muted-foreground">
        <Loader2 className="w-4 h-4 animate-spin inline mr-2" /> Loading production media…
      </div>
    );
  }

  if (jobs.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border/50 bg-secondary/10 p-6 text-center">
        <Film className="w-6 h-6 text-muted-foreground mx-auto mb-2" />
        <p className="text-sm text-muted-foreground">No media ingested yet. Start with Ingest Media above.</p>
      </div>
    );
  }

  const totalClips = items.length;
  const totalSize = items.reduce((s, i) => s + (i.size_bytes || 0), 0);

  return (
    <div className="space-y-3">
      {/* Header + filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search clips by name or path…"
            className="pl-9"
          />
        </div>
        <Select value={filterDay} onValueChange={setFilterDay}>
          <SelectTrigger className="w-[140px] h-9"><SelectValue placeholder="Shoot Day" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All days</SelectItem>
            {allDays.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterCamera} onValueChange={setFilterCamera}>
          <SelectTrigger className="w-[160px] h-9"><SelectValue placeholder="Camera" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All cameras</SelectItem>
            {allCameras.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Tree */}
      <div className="rounded-2xl border border-border/50 bg-secondary/5 divide-y divide-border/40">
        {Object.entries(tree)
          .filter(([day]) => filterDay === "all" || day === filterDay)
          .sort(([a], [b]) => b.localeCompare(a))
          .map(([day, units]) => {
            const dayKey = `d:${day}`;
            const open = expanded[dayKey] ?? true;
            return (
              <div key={day} className="p-3">
                <button onClick={() => toggle(dayKey)} className="flex items-center gap-2 w-full text-left">
                  {open ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                  <span className="text-[10px] uppercase tracking-widest font-mono text-muted-foreground">Shoot Day</span>
                  <span className="font-display text-base">{day}</span>
                </button>
                {open && (
                  <div className="pl-6 mt-2 space-y-2">
                    {Object.entries(units).map(([unit, cams]) => {
                      const uKey = `${dayKey}|u:${unit}`;
                      const uOpen = expanded[uKey] ?? true;
                      return (
                        <div key={unit}>
                          <button onClick={() => toggle(uKey)} className="flex items-center gap-2 text-left">
                            {uOpen ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                            <span className="text-[10px] uppercase tracking-widest font-mono text-muted-foreground">Unit</span>
                            <span className="text-sm">{unit}</span>
                          </button>
                          {uOpen && (
                            <div className="pl-5 mt-1 space-y-1">
                              {Object.entries(cams)
                                .filter(([cam]) => filterCamera === "all" || cam === filterCamera)
                                .map(([cam, cards]) => {
                                  const cKey = `${uKey}|c:${cam}`;
                                  const cOpen = expanded[cKey] ?? false;
                                  return (
                                    <div key={cam}>
                                      <button onClick={() => toggle(cKey)} className="flex items-center gap-2 text-left">
                                        {cOpen ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                                        <Camera className="w-3.5 h-3.5 text-accent" />
                                        <span className="text-sm">{cam}</span>
                                      </button>
                                      {cOpen && (
                                        <div className="pl-5 mt-1 space-y-2">
                                          {Object.entries(cards).map(([card, { job, items: clips }]) => {
                                            const kKey = `${cKey}|k:${card}`;
                                            const kOpen = expanded[kKey] ?? false;
                                            const raw = clips.filter(c => c.asset_class === "raw" || c.asset_class === "video" || !c.asset_class).length;
                                            const proxy = clips.filter(c => c.asset_class === "proxy").length;
                                            const audio = clips.filter(c => c.asset_class === "audio").length;
                                            const reports = clips.filter(c => c.asset_class === "reports" || c.asset_class === "metadata").length;
                                            const totalBytes = clips.reduce((s, c) => s + (c.size_bytes || 0), 0);
                                            return (
                                              <div key={card} className="rounded-lg border border-border/40 bg-background/40">
                                                <button onClick={() => toggle(kKey)} className="w-full flex flex-wrap items-center gap-2 p-2.5 text-left">
                                                  {kOpen ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                                                  <HardDrive className="w-3.5 h-3.5 text-accent" />
                                                  <span className="text-sm font-medium">{card}</span>
                                                  <span className="text-[11px] text-muted-foreground font-mono">· {clips.length} clips · {fmtBytes(totalBytes)}</span>
                                                  <div className="ml-auto flex flex-wrap gap-1">
                                                    {raw > 0 && <Badge variant="outline" className="text-[10px]">RAW · {raw}</Badge>}
                                                    {proxy > 0 && <Badge variant="outline" className="text-[10px]">Proxy · {proxy}</Badge>}
                                                    {audio > 0 && <Badge variant="outline" className="text-[10px]">Audio · {audio}</Badge>}
                                                    {reports > 0 && <Badge variant="outline" className="text-[10px]">Reports · {reports}</Badge>}
                                                  </div>
                                                </button>
                                                {kOpen && (
                                                  <div className="border-t border-border/40 p-3 space-y-2">
                                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-[11px]">
                                                      <Info label="Camera" value={cam} />
                                                      <Info label="Card" value={card} />
                                                      <Info label="Status" value={job.status} />
                                                      <Info label="Job" value={`${job.completed_files}/${job.total_files} files`} />
                                                    </div>
                                                    <div className="overflow-x-auto">
                                                      <table className="w-full text-xs">
                                                        <thead className="text-muted-foreground">
                                                          <tr className="text-left">
                                                            <th className="py-1.5 pr-3">Clip</th>
                                                            <th className="py-1.5 pr-3">Size</th>
                                                            <th className="py-1.5 pr-3">Codec / Type</th>
                                                            <th className="py-1.5 pr-3">Processing</th>
                                                            <th className="py-1.5 pr-3">Storage</th>
                                                          </tr>
                                                        </thead>
                                                        <tbody>
                                                          {clips.filter(matchItem).map(it => {
                                                            const up = it.upload_id ? uploads[it.upload_id] : undefined;
                                                            const stage = pipelineStage(it, up);
                                                            const locs = storageBadges(up);
                                                            const meta = it.metadata || {};
                                                            const codec = meta.codec || it.mime_guess || (it.asset_class ?? "—");
                                                            return (
                                                              <tr key={it.id} className="border-t border-border/30 hover:bg-secondary/20">
                                                                <td className="py-1.5 pr-3">
                                                                  <span className="inline-flex items-center gap-1.5 min-w-0">
                                                                    {assetIcon(it.asset_class)}
                                                                    <span className="truncate max-w-[280px]">{it.file_name}</span>
                                                                  </span>
                                                                  {(meta.timecode || meta.duration || meta.resolution) && (
                                                                    <div className="text-[10px] text-muted-foreground font-mono mt-0.5">
                                                                      {meta.timecode && <>TC {meta.timecode} · </>}
                                                                      {meta.duration && <>{meta.duration}s · </>}
                                                                      {meta.resolution && <>{meta.resolution}</>}
                                                                    </div>
                                                                  )}
                                                                </td>
                                                                <td className="py-1.5 pr-3 font-mono text-[11px]">{fmtBytes(it.size_bytes)}</td>
                                                                <td className="py-1.5 pr-3 text-[11px]">{codec}</td>
                                                                <td className="py-1.5 pr-3">
                                                                  <Badge variant={stage === "Failed" ? "destructive" : "secondary"} className="text-[10px]">{stage}</Badge>
                                                                </td>
                                                                <td className="py-1.5 pr-3">
                                                                  <div className="flex flex-wrap gap-1">
                                                                    {locs.map(l => (
                                                                      <span key={l} className="inline-flex items-center gap-1 text-[10px] text-muted-foreground border border-border/40 rounded-full px-1.5 py-0.5">
                                                                        {l === "Archive" ? <Snowflake className="w-3 h-3" /> : l === "OCI Cloud" ? <Cloud className="w-3 h-3" /> : <ShieldCheck className="w-3 h-3" />}
                                                                        {l}
                                                                      </span>
                                                                    ))}
                                                                  </div>
                                                                </td>
                                                              </tr>
                                                            );
                                                          })}
                                                        </tbody>
                                                      </table>
                                                    </div>
                                                  </div>
                                                )}
                                              </div>
                                            );
                                          })}
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
      </div>

      {/* Legend: pipeline stages */}
      <div className="flex flex-wrap gap-1.5 text-[10px] text-muted-foreground">
        <span className="uppercase tracking-widest font-mono mr-1">Pipeline:</span>
        {STAGES.map(s => <Badge key={s} variant="outline" className="text-[10px]">{s}</Badge>)}
      </div>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border/40 p-2">
      <p className="text-[9px] uppercase tracking-widest text-muted-foreground font-mono">{label}</p>
      <p className="text-xs mt-0.5 truncate">{value}</p>
    </div>
  );
}
