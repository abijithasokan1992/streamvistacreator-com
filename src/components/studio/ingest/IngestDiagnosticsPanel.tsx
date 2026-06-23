/**
 * IngestDiagnosticsPanel
 * ======================
 * Supporting surface inside Studio Ingest where the underlying infrastructure
 * brand — Crayons Bridge Ingest Engine — is allowed to show through. Three
 * read-only sub-panels:
 *
 *   1. Engine connection      — current runtime mode (browser-only today,
 *                               local companion in roadmap)
 *   2. Transfer health        — aggregated stats from `ingest_jobs` last 7d
 *   3. Source health          — per-source last-seen + last job status
 *
 * Premium / operational tone. No developer-tool jargon on screen.
 * "Agent" language is allowed here only because this is a diagnostics surface,
 * per the brand architecture rules.
 */

import { useEffect, useMemo, useState } from "react";
import {
  Activity, Plug, ShieldCheck, Signal, Zap, ChevronDown, ChevronUp,
  CheckCircle2, AlertTriangle, Pause, Clock, Sparkles,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import IngestAlertsManager from "@/components/studio/ingest/IngestAlertsManager";

type JobAgg = {
  id: string;
  status: string;
  job_mode: string;
  destination_type: string;
  total_bytes: number;
  transferred_bytes: number;
  total_files: number;
  completed_files: number;
  failed_files: number;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
  source_id: string | null;
  source_summary: any;
};

type SourceRow = {
  id: string;
  label: string;
  source_type: string;
  updated_at: string;
};

function fmtBytes(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return "0 B";
  if (n < 1024) return `${n} B`;
  if (n < 1048576) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1073741824) return `${(n / 1048576).toFixed(1)} MB`;
  if (n < 1099511627776) return `${(n / 1073741824).toFixed(2)} GB`;
  return `${(n / 1099511627776).toFixed(2)} TB`;
}

function relTime(iso: string): string {
  const t = new Date(iso).getTime();
  const diff = Date.now() - t;
  if (diff < 60_000) return "just now";
  if (diff < 3_600_000) return `${Math.round(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.round(diff / 3_600_000)}h ago`;
  return `${Math.round(diff / 86_400_000)}d ago`;
}

export default function IngestDiagnosticsPanel({ workspaceId }: { workspaceId: string | null }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [jobs, setJobs] = useState<JobAgg[]>([]);
  const [sources, setSources] = useState<SourceRow[]>([]);

  useEffect(() => {
    if (!open || !workspaceId) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      const since = new Date(Date.now() - 7 * 86_400_000).toISOString();
      const [j, s] = await Promise.all([
        supabase
          .from("ingest_jobs")
          .select("id,status,job_mode,destination_type,total_bytes,transferred_bytes,total_files,completed_files,failed_files,created_at,started_at,completed_at,source_id,source_summary")
          .eq("workspace_id", workspaceId)
          .gte("created_at", since)
          .order("created_at", { ascending: false })
          .limit(200),
        supabase
          .from("ingest_sources")
          .select("id,label,source_type,updated_at")
          .eq("workspace_id", workspaceId)
          .order("updated_at", { ascending: false })
          .limit(20),
      ]);
      if (cancelled) return;
      setJobs((j.data as JobAgg[]) ?? []);
      setSources((s.data as SourceRow[]) ?? []);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [open, workspaceId]);

  const stats = useMemo(() => {
    if (jobs.length === 0) {
      return {
        total: 0, completed: 0, failed: 0, paused: 0, inflight: 0,
        bytes: 0, files: 0, avgSpeedBps: 0, successRate: 0,
      };
    }
    let bytes = 0, files = 0, completed = 0, failed = 0, paused = 0, inflight = 0;
    let totalElapsedMs = 0, totalBytesForSpeed = 0;
    for (const j of jobs) {
      bytes += j.transferred_bytes ?? 0;
      files += j.completed_files ?? 0;
      if (j.status === "completed") completed++;
      else if (j.status === "failed") failed++;
      else if (j.status === "paused") paused++;
      else if (j.status === "uploading" || j.status === "verifying" || j.status === "retrying" || j.status === "ready") inflight++;
      if (j.started_at && j.completed_at) {
        const ms = new Date(j.completed_at).getTime() - new Date(j.started_at).getTime();
        if (ms > 0) { totalElapsedMs += ms; totalBytesForSpeed += j.transferred_bytes ?? 0; }
      }
    }
    const avgSpeedBps = totalElapsedMs > 0 ? (totalBytesForSpeed / (totalElapsedMs / 1000)) : 0;
    const decided = completed + failed;
    const successRate = decided > 0 ? Math.round((completed / decided) * 100) : 100;
    return {
      total: jobs.length, completed, failed, paused, inflight,
      bytes, files, avgSpeedBps, successRate,
    };
  }, [jobs]);

  const sourceHealth = useMemo(() => {
    // Find last job per source_id so each source shows its latest outcome.
    const latestBySource = new Map<string, JobAgg>();
    for (const j of jobs) {
      if (!j.source_id) continue;
      if (!latestBySource.has(j.source_id)) latestBySource.set(j.source_id, j);
    }
    return sources.map((s) => ({ source: s, lastJob: latestBySource.get(s.id) ?? null }));
  }, [jobs, sources]);

  return (
    <Card className="border-border/40 bg-secondary/5">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between gap-3 p-5 text-left hover:bg-secondary/10 transition-colors rounded-2xl"
      >
        <div className="flex items-start gap-3 min-w-0">
          <div className="h-9 w-9 rounded-lg bg-accent/10 border border-accent/20 grid place-items-center shrink-0">
            <Activity className="w-4 h-4 text-accent" />
          </div>
          <div className="min-w-0">
            <h3 className="font-semibold text-sm flex items-center gap-2">
              Ingest Diagnostics
              <Badge variant="outline" className="text-[10px] font-mono">live</Badge>
            </h3>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Engine connection, transfer health and source monitoring · Crayons Bridge Ingest Engine
            </p>
          </div>
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
      </button>

      {open && (
        <div className="px-5 pb-5 space-y-5 border-t border-border/30">
          {/* 1. Engine connection */}
          <section className="pt-5">
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground font-mono mb-2">
              Engine connection
            </div>
            <div className="grid sm:grid-cols-2 gap-3">
              <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4">
                <div className="flex items-center gap-2">
                  <Plug className="w-4 h-4 text-emerald-300" />
                  <span className="text-sm font-medium">Browser ingest channel</span>
                  <Badge variant="outline" className="text-[10px] border-emerald-500/40 text-emerald-300 ml-auto">connected</Badge>
                </div>
                <p className="text-[11px] text-muted-foreground mt-2">
                  Multipart, resumable transfer over your current browser session. Folder structure
                  is preserved and interrupted transfers resume on the same source.
                </p>
                <div className="flex items-center gap-3 mt-3 text-[10px] text-muted-foreground/80">
                  <span className="inline-flex items-center gap-1"><ShieldCheck className="w-3 h-3" /> TLS</span>
                  <span className="inline-flex items-center gap-1"><Zap className="w-3 h-3" /> multipart</span>
                  <span className="inline-flex items-center gap-1"><Signal className="w-3 h-3" /> resumable</span>
                </div>
              </div>
              <div className="rounded-xl border border-border/40 bg-secondary/10 p-4">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-accent" />
                  <span className="text-sm font-medium">Local companion</span>
                  <Badge variant="outline" className="text-[10px] ml-auto">coming soon</Badge>
                </div>
                <p className="text-[11px] text-muted-foreground mt-2">
                  The Crayons Bridge Ingest Engine desktop companion adds background folder watching,
                  device auto-detect and bonded transfer for shoot-day workflows.
                </p>
                <div className="flex items-center gap-3 mt-3 text-[10px] text-muted-foreground/80">
                  <span>watch folders</span>
                  <span>·</span>
                  <span>card auto-detect</span>
                  <span>·</span>
                  <span>checksum verify</span>
                </div>
              </div>
            </div>
          </section>

          {/* 2. Transfer health */}
          <section>
            <div className="flex items-center justify-between mb-2">
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground font-mono">
                Transfer health · last 7 days
              </div>
              {loading && <span className="text-[10px] text-muted-foreground">refreshing…</span>}
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <StatTile label="Jobs" value={String(stats.total)} sub={`${stats.inflight} in flight`} />
              <StatTile label="Files moved" value={String(stats.files)} sub={fmtBytes(stats.bytes)} />
              <StatTile
                label="Success rate"
                value={`${stats.successRate}%`}
                sub={`${stats.completed} ok · ${stats.failed} failed${stats.paused ? ` · ${stats.paused} paused` : ""}`}
                tone={stats.successRate >= 95 ? "good" : stats.successRate >= 80 ? "warn" : "bad"}
              />
              <StatTile
                label="Avg throughput"
                value={stats.avgSpeedBps > 0 ? `${fmtBytes(stats.avgSpeedBps)}/s` : "—"}
                sub="across completed jobs"
              />
            </div>
            {stats.total > 0 && (
              <div className="mt-3">
                <Progress value={stats.successRate} className="h-1" />
              </div>
            )}
          </section>

          {/* 3. Source health */}
          <section>
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground font-mono mb-2">
              Source monitoring
            </div>
            {sourceHealth.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                No ingest sources registered yet for this workspace. Start an ingest above and the
                source will appear here with its transfer history.
              </p>
            ) : (
              <ul className="divide-y divide-border/30 rounded-lg border border-border/30 bg-background/30">
                {sourceHealth.slice(0, 8).map(({ source, lastJob }) => {
                  const tone =
                    !lastJob ? "text-muted-foreground" :
                    lastJob.status === "completed" ? "text-emerald-300" :
                    lastJob.status === "failed" ? "text-destructive" :
                    lastJob.status === "paused" ? "text-amber-300" :
                    "text-accent";
                  const Icon =
                    !lastJob ? Clock :
                    lastJob.status === "completed" ? CheckCircle2 :
                    lastJob.status === "failed" ? AlertTriangle :
                    lastJob.status === "paused" ? Pause :
                    Activity;
                  return (
                    <li key={source.id} className="px-3 py-2.5 flex items-center gap-3 text-xs">
                      <Icon className={`w-3.5 h-3.5 shrink-0 ${tone}`} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium truncate">{source.label}</span>
                          <Badge variant="outline" className="text-[10px] font-mono">{source.source_type}</Badge>
                        </div>
                        <p className="text-[10px] text-muted-foreground mt-0.5">
                          Last activity {relTime(source.updated_at)}
                          {lastJob && (
                            <> · last job {fmtBytes(lastJob.transferred_bytes)} / {fmtBytes(lastJob.total_bytes)} · {lastJob.completed_files}/{lastJob.total_files} files</>
                          )}
                        </p>
                      </div>
                      <span className={`text-[10px] uppercase tracking-widest font-mono ${tone}`}>
                        {lastJob?.status ?? "idle"}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          <div className="flex items-center justify-between pt-2 border-t border-border/20">
            <p className="text-[10px] text-muted-foreground/70 tracking-wide">
              Powered by Crayons Bridge Ingest Engine
            </p>
            <Button
              variant="ghost" size="sm" className="h-7 text-[10px]"
              onClick={() => { setOpen(false); setTimeout(() => setOpen(true), 0); }}
              disabled={!workspaceId}
            >
              Refresh diagnostics
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}

function StatTile({
  label, value, sub, tone,
}: { label: string; value: string; sub?: string; tone?: "good" | "warn" | "bad" }) {
  const toneClass =
    tone === "good" ? "text-emerald-300" :
    tone === "warn" ? "text-amber-300" :
    tone === "bad" ? "text-destructive" :
    "text-foreground";
  return (
    <div className="rounded-xl border border-border/40 bg-background/40 p-3">
      <div className="text-[10px] uppercase tracking-widest text-muted-foreground font-mono">{label}</div>
      <div className={`mt-1 font-display text-xl ${toneClass}`}>{value}</div>
      {sub && <div className="text-[10px] text-muted-foreground mt-1 truncate">{sub}</div>}
    </div>
  );
}
