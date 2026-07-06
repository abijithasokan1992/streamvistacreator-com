/**
 * Ingest orchestrator.
 *
 * Given a built Manifest + a workspace, run the transfer pipeline:
 *   queued → hashing → uploading → server_checksum → verifying → verified
 *
 * Safety invariants:
 *   - Source files are only ever READ. No rename, no delete, no mtime touch.
 *   - Device removal → item goes to `paused_device_lost`, not failed.
 *   - 2-of-3 checksum disagreement → item goes to `corrupt`; source is not
 *     touched, upload is not auto-retried.
 *
 * Uses the existing `uploadFileMultipart` driver from
 * `src/lib/ociMultipartUpload.ts` — no duplicate upload logic.
 */

import { supabase } from "@/integrations/supabase/client";
import { uploadFileMultipart, mapUploadError } from "@/lib/ociMultipartUpload";
import type { Manifest, ManifestItem } from "./deviceManifest";
import { verifyItem, type Witnesses } from "./verifier";
import { wholeFileSha256 } from "./fingerprint";
import { saveResumeToken, flushResumeToken, type ResumeToken, type ItemResumeState } from "./resumeController";

export type ItemRuntimeStatus =
  | "queued"
  | "hashing"
  | "uploading"
  | "server_checksum"
  | "verifying"
  | "verified"
  | "duplicate_skipped"
  | "format_rejected"
  | "paused_device_lost"
  | "paused_user"
  | "corrupt"
  | "failed";

export type ItemRuntime = {
  item: ManifestItem;
  status: ItemRuntimeStatus;
  bytesUploaded: number;
  totalBytes: number;
  message?: string;
  witnesses?: Witnesses;
  startedAt?: number;
  finishedAt?: number;
};

export type EngineEvent =
  | { type: "item"; item: ItemRuntime }
  | { type: "log"; level: "info" | "warn" | "error"; message: string; itemId?: string }
  | { type: "done"; summary: { verified: number; corrupt: number; failed: number; skipped: number } };

export type EngineOptions = {
  workspaceId: string;
  titleId?: string | null;
  jobId: string;
  onEvent?: (evt: EngineEvent) => void;
  signal?: AbortSignal;
};

function isDeviceLostError(err: unknown): boolean {
  const name = (err as { name?: string })?.name ?? "";
  const msg = (err as { message?: string })?.message ?? "";
  return (
    name === "NotFoundError" ||
    name === "NotReadableError" ||
    /device|not readable|no such file/i.test(msg)
  );
}

export class IngestEngine {
  private runtimes: ItemRuntime[] = [];
  private token: ResumeToken;
  private paused = false;

  constructor(private readonly manifest: Manifest, private readonly opts: EngineOptions) {
    this.token = { version: 1, updatedAt: new Date().toISOString(), items: {} };
    this.runtimes = manifest.items.map((item) => ({
      item,
      status:
        item.status === "rejected"
          ? "format_rejected"
          : item.status === "duplicate_in_pick" || item.status === "duplicate_known"
            ? "duplicate_skipped"
            : "queued",
      bytesUploaded: 0,
      totalBytes: item.size,
      message: item.rejectReason,
    }));
  }

  getRuntimes(): ItemRuntime[] {
    return this.runtimes.slice();
  }

  pause(): void {
    this.paused = true;
    for (const r of this.runtimes) {
      if (r.status === "uploading" || r.status === "hashing") {
        r.status = "paused_user";
        this.emit({ type: "item", item: r });
      }
    }
  }

  async run(): Promise<void> {
    const eligible = this.runtimes.filter((r) => r.status === "queued");
    for (const r of eligible) {
      if (this.opts.signal?.aborted) break;
      if (this.paused) break;
      await this.processItem(r);
    }
    const summary = {
      verified: this.runtimes.filter((r) => r.status === "verified").length,
      corrupt: this.runtimes.filter((r) => r.status === "corrupt").length,
      failed: this.runtimes.filter((r) => r.status === "failed").length,
      skipped: this.runtimes.filter((r) => r.status === "duplicate_skipped" || r.status === "format_rejected").length,
    };
    await flushResumeToken(this.opts.jobId, this.token).catch(() => {});
    this.emit({ type: "done", summary });
  }

  private emit(e: EngineEvent) {
    this.opts.onEvent?.(e);
  }

  private updateToken(item: ManifestItem, patch: Partial<ItemResumeState>) {
    const prev: ItemResumeState = this.token.items[item.id] ?? {
      status: "queued",
      bytesUploaded: 0,
      fingerprint: item.fingerprint,
      size: item.size,
    };
    this.token.items[item.id] = { ...prev, ...patch };
    saveResumeToken(this.opts.jobId, this.token);
  }

  private async processItem(r: ItemRuntime): Promise<void> {
    const { item } = r;
    r.startedAt = Date.now();

    try {
      // Stage 1 — streaming SHA + upload via existing multipart driver.
      r.status = "hashing";
      this.emit({ type: "item", item: r });

      // Kick off the independent streaming hash in parallel with upload.
      const streamingShaPromise = wholeFileSha256(item.file, this.opts.signal);

      r.status = "uploading";
      this.emit({ type: "item", item: r });

      const uploadResult = await uploadFileMultipart({
        file: item.file,
        workspaceId: this.opts.workspaceId,
        pendingId: `${this.opts.jobId}:${item.id}`,
        onProgress: (loaded, total) => {
          r.bytesUploaded = loaded;
          r.totalBytes = total;
          this.emit({ type: "item", item: r });
          this.updateToken(item, { bytesUploaded: loaded, status: "uploading" });
        },
        signal: this.opts.signal,
      });

      const streamingSha = await streamingShaPromise;
      const serverSha =
        (uploadResult?.upload as { server_checksum?: string; checksum_sha256?: string } | undefined)
          ?.server_checksum ??
        (uploadResult?.upload as { checksum_sha256?: string } | undefined)?.checksum_sha256 ??
        null;

      // Stage 2 — server checksum ack (already returned from multipart complete).
      r.status = "server_checksum";
      this.emit({ type: "item", item: r });

      // Stage 3 — independent re-read verify.
      r.status = "verifying";
      this.emit({ type: "item", item: r });
      const result = await verifyItem(item.file, streamingSha, serverSha, this.opts.signal);
      r.witnesses = result.witnesses;

      if (result.verdict === "verified") {
        r.status = "verified";
        r.finishedAt = Date.now();
        this.updateToken(item, {
          status: "verified",
          bytesUploaded: item.size,
          streamingSha,
          serverSha,
        });
        this.emit({ type: "item", item: r });
        this.emit({ type: "log", level: "info", message: `Verified ${item.relativePath}`, itemId: item.id });
      } else if (result.verdict === "corrupt") {
        r.status = "corrupt";
        r.message = result.reason;
        this.emit({ type: "item", item: r });
        this.emit({
          type: "log",
          level: "error",
          message: `Corrupt: ${item.relativePath} — ${result.reason}`,
          itemId: item.id,
        });
      } else {
        r.status = "failed";
        r.message = result.reason;
        this.emit({ type: "item", item: r });
        this.emit({
          type: "log",
          level: "warn",
          message: `Cannot verify ${item.relativePath}: ${result.reason}`,
          itemId: item.id,
        });
      }
    } catch (err) {
      if (isDeviceLostError(err)) {
        r.status = "paused_device_lost";
        r.message = "Device removed — replug and click Resume";
        this.emit({ type: "item", item: r });
        this.emit({
          type: "log",
          level: "warn",
          message: `Device lost during ${item.relativePath} — safely paused`,
          itemId: item.id,
        });
        return;
      }
      r.status = "failed";
      r.message = mapUploadError(err);
      this.emit({ type: "item", item: r });
      this.emit({
        type: "log",
        level: "error",
        message: `${item.relativePath}: ${r.message}`,
        itemId: item.id,
      });
    }
  }
}

/**
 * Create the parent `ingest_jobs` row that all items in this run attach to.
 * Uses the existing table — no schema change.
 */
export async function createIngestJob(params: {
  workspaceId: string;
  titleId?: string | null;
  rootLabel: string;
  cameraFamilyLabel: string;
  totalBytes: number;
  itemCount: number;
}): Promise<string> {
  const { data: userRes } = await supabase.auth.getUser();
  const createdBy = userRes?.user?.id;
  if (!createdBy) throw new Error("Sign in required to start ingest");
  const { data, error } = await supabase
    .from("ingest_jobs")
    .insert({
      workspace_id: params.workspaceId,
      created_by: createdBy,
      job_mode: "camera_card",
      destination_type: "working_vault",
      status: "ready",
      total_files: params.itemCount,
      total_bytes: params.totalBytes,
      metadata: {
        engine: "ingest_engine_v2",
        source_label: params.rootLabel,
        camera_family: params.cameraFamilyLabel,
        title_id: params.titleId ?? null,
      },
    })
    .select("id")
    .single();
  if (error || !data) throw new Error(error?.message ?? "Failed to create ingest job");
  return data.id as string;
}
