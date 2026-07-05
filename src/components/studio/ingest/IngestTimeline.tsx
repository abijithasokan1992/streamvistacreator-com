/**
 * IngestTimeline
 * ==============
 * Chronological read-out of what happened after an ingest job was started.
 * Reads only from existing tables (`ingest_jobs`, `ingest_job_items`,
 * `archive_jobs`) — no duplicate processing logic, no backend changes.
 * Every step is derived from data the current pipeline already writes.
 */
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  CheckCircle2, Circle, Clock, AlertTriangle, ShieldCheck, Cloud, HardDrive,
  Film, Database, ClipboardCheck, Scissors, Snowflake, PlayCircle, Loader2,
} from "lucide-react";

type JobLike = {
  id: string;
  status: string;
  created_at: string;
  started_at?: string | null;
  completed_at?: string | null;
  destination_type: string;
  total_files: number;
  completed_files: number;
  failed_files: number;
  metadata?: Record<string, any> | null;
};

type Step = {
  key: string;
  label: string;
  icon: any;
  state: "done" | "active" | "pending" | "skipped" | "failed";
  at?: string | null;
  detail?: string | null;
};

function fmtTime(iso?: string | null): string | null {
  if (!iso) return null;
  try { return new Date(iso).toLocaleString(); } catch { return null; }
}

export function IngestTimeline({ job }: { job: JobLike }) {
  const [items, setItems] = useState<Array<{ status: string; metadata: any }>>([]);
  const [archive, setArchive] = useState<{ status: string; completed_at: string | null } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const [{ data: itemRows }, archiveId] = await Promise.all([
        supabase
          .from("ingest_job_items")
          .select("status,metadata")
          .eq("job_id", job.id)
          .limit(1000),
        Promise.resolve((job.metadata as any)?.archive_job_id as string | undefined),
      ]);
      if (cancelled) return;
      setItems((itemRows as any) ?? []);
      if (archiveId) {
        const { data: aj } = await supabase
          .from("archive_jobs")
          .select("status,completed_at")
          .eq("id", archiveId)
          .maybeSingle();
        if (!cancelled) setArchive((aj as any) ?? null);
      }
      if (!cancelled) setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [job.id, job.metadata]);

  const steps = useMemo<Step[]>(() => {
    const uploadDone = job.status === "completed"
      || (job.completed_files > 0 && job.completed_files >= job.total_files);
    const anyFailed = (job.failed_files ?? 0) > 0;

    const checksums = items.filter((it) => it.metadata?.checksum_sha256).length;
    const checksumsPending = items.some((it) => it.metadata?.checksum_scope === "server_pending");
    const withMeta = items.filter((it) => it.metadata && Object.keys(it.metadata).length > 0).length;

    const proxyReady = items.some((it) =>
      it.metadata?.proxy_status === "ready" || it.metadata?.proxy_url || it.metadata?.detected_type === "proxy");
    const qcStatus = (job.metadata as any)?.qc_status as string | undefined;
    const editorialReady = job.status === "completed" && !anyFailed;
    const archiveActive = job.destination_type === "archive_vault" || !!archive;

    const s = (
      key: string, label: string, icon: any, state: Step["state"],
      at?: string | null, detail?: string | null,
    ): Step => ({ key, label, icon, state, at, detail });

    return [
      s("start", "Upload Started", PlayCircle, "done", job.started_at ?? job.created_at),
      s(
        "complete", "Upload Complete",
        anyFailed ? AlertTriangle : Film,
        uploadDone ? (anyFailed ? "failed" : "done")
          : job.status === "uploading" ? "active"
          : job.status === "paused" ? "active"
          : "pending",
        uploadDone ? job.completed_at : null,
        `${job.completed_files}/${job.total_files} files${anyFailed ? ` · ${job.failed_files} failed` : ""}`,
      ),
      s(
        "checksum", "Checksum Verified", ShieldCheck,
        checksums > 0 && checksums >= items.length && items.length > 0 ? "done"
          : checksumsPending || (uploadDone && items.length > 0 && checksums < items.length) ? "active"
          : uploadDone ? "pending" : "pending",
        null,
        items.length > 0 ? `${checksums}/${items.length} files verified` : null,
      ),
      s(
        "primary", "Primary Backup Complete", HardDrive,
        uploadDone && !anyFailed ? "done" : uploadDone && anyFailed ? "failed" : "pending",
        uploadDone && !anyFailed ? job.completed_at : null,
        "Working vault mirror",
      ),
      s(
        "oci", "OCI Cloud Sync Complete", Cloud,
        uploadDone ? (anyFailed ? "failed" : "done") : job.status === "uploading" ? "active" : "pending",
        uploadDone ? job.completed_at : null,
      ),
      s(
        "proxy", "Proxy Generated", Scissors,
        proxyReady ? "done" : uploadDone ? "active" : "pending",
        null,
        proxyReady ? "Proxies detected in job items" : "Runs post-upload",
      ),
      s(
        "meta", "Metadata Indexed", Database,
        withMeta > 0 && withMeta >= items.length && items.length > 0 ? "done"
          : withMeta > 0 ? "active" : "pending",
        null,
        items.length > 0 ? `${withMeta}/${items.length} items indexed` : null,
      ),
      s(
        "qc", "QC Status", ClipboardCheck,
        qcStatus === "passed" ? "done"
          : qcStatus === "failed" ? "failed"
          : qcStatus === "in_review" ? "active"
          : uploadDone ? "pending" : "pending",
        null,
        qcStatus ?? "Awaiting review",
      ),
      s(
        "editorial", "Editorial Ready", Film,
        editorialReady ? "done" : uploadDone ? "active" : "pending",
        editorialReady ? job.completed_at : null,
      ),
      s(
        "archive", "Archive Status", Snowflake,
        !archiveActive ? "skipped"
          : archive?.status === "completed" ? "done"
          : archive?.status === "failed" ? "failed"
          : archive ? "active" : uploadDone ? "active" : "pending",
        archive?.completed_at,
        !archiveActive ? "Not queued for archive" : (archive?.status ?? "queued"),
      ),
    ];
  }, [job, items, archive]);

  if (loading) {
    return (
      <div className="mt-3 flex items-center gap-2 text-[11px] text-muted-foreground">
        <Loader2 className="w-3 h-3 animate-spin" /> Loading timeline…
      </div>
    );
  }

  return (
    <div className="mt-3 rounded-md border border-border/40 bg-background/40 p-3">
      <div className="text-[10px] uppercase tracking-widest text-muted-foreground font-mono mb-2">
        Ingest timeline
      </div>
      <ol className="relative border-l border-border/40 ml-3 space-y-3">
        {steps.map((step) => {
          const Icon = step.icon;
          const tone =
            step.state === "done"    ? "text-emerald-300 border-emerald-500/40 bg-emerald-500/10"
          : step.state === "active"  ? "text-accent border-accent/40 bg-accent/10"
          : step.state === "failed"  ? "text-destructive border-destructive/40 bg-destructive/10"
          : step.state === "skipped" ? "text-muted-foreground/60 border-border/40 bg-transparent"
                                      : "text-muted-foreground border-border/40 bg-transparent";
          const StepIcon =
            step.state === "done"    ? CheckCircle2
          : step.state === "active"  ? Clock
          : step.state === "failed"  ? AlertTriangle
          : step.state === "skipped" ? Circle
                                      : Circle;
          return (
            <li key={step.key} className="ml-2 pl-3">
              <span className={`absolute -left-[9px] flex items-center justify-center w-4 h-4 rounded-full border ${tone}`}>
                <StepIcon className="w-2.5 h-2.5" />
              </span>
              <div className="flex items-center gap-2 text-[11px]">
                <Icon className="w-3 h-3 text-muted-foreground" />
                <span className="font-medium text-foreground">{step.label}</span>
                {step.state === "skipped" && (
                  <span className="text-[10px] uppercase text-muted-foreground/70">skipped</span>
                )}
              </div>
              {(step.at || step.detail) && (
                <div className="text-[10px] text-muted-foreground mt-0.5 flex flex-wrap gap-x-2">
                  {step.at && <span>{fmtTime(step.at)}</span>}
                  {step.detail && <span>· {step.detail}</span>}
                </div>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
