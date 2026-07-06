/**
 * Turn a raw device scan into an ingest manifest:
 *   - per-file classification (from mediaIntelligence)
 *   - per-file policy verdict (from formatPolicy)
 *   - per-file fingerprint (for local + cross-job dedupe)
 *   - dedupe pass within the pick
 *   - optional dedupe pass against prior `ingest_job_items` for the workspace
 *
 * This module is read-only — it never mutates the source files or handles.
 */

import type { ScannedFile, ScanResult } from "./deviceScanner";
import { classifyFile, type Classification } from "./mediaIntelligence";
import { checkPolicy } from "./formatPolicy";
import { fingerprintFile } from "./fingerprint";
import { supabase } from "@/integrations/supabase/client";

export type ManifestItemStatus =
  | "new"
  | "duplicate_in_pick"
  | "duplicate_known"
  | "rejected";

export type ManifestItem = {
  id: string; // stable local id (relativePath + size)
  file: File;
  relativePath: string;
  subpath: string;
  size: number;
  classification: Classification;
  fingerprint: string;
  status: ManifestItemStatus;
  rejectReason?: string;
  duplicateOfLocalId?: string;
  duplicateOfRemoteItemId?: string;
};

export type Manifest = {
  rootLabel: string;
  cameraFamilyLabel: string;
  totalBytes: number;
  items: ManifestItem[];
  counts: {
    total: number;
    new: number;
    duplicateInPick: number;
    duplicateKnown: number;
    rejected: number;
  };
};

function localId(f: ScannedFile): string {
  return `${f.relativePath}::${f.file.size}`;
}

export type BuildOptions = {
  workspaceId?: string | null;
  onProgress?: (done: number, total: number) => void;
  signal?: AbortSignal;
};

export async function buildManifest(scan: ScanResult, opts: BuildOptions = {}): Promise<Manifest> {
  const items: ManifestItem[] = [];
  const seenFingerprints = new Map<string, string>(); // fp -> localId

  for (let i = 0; i < scan.files.length; i++) {
    if (opts.signal?.aborted) break;
    const sf = scan.files[i];
    const classification = classifyFile(sf.file.name, sf.relativePath);
    const policy = checkPolicy(sf.file.name, sf.file.size);
    const fp = await fingerprintFile(sf.file);
    const id = localId(sf);

    let status: ManifestItemStatus = "new";
    let rejectReason: string | undefined;
    let dupLocal: string | undefined;

    if (!policy.allowed) {
      status = "rejected";
      rejectReason = policy.reason;
    } else if (seenFingerprints.has(fp)) {
      status = "duplicate_in_pick";
      dupLocal = seenFingerprints.get(fp);
    } else {
      seenFingerprints.set(fp, id);
    }

    items.push({
      id,
      file: sf.file,
      relativePath: sf.relativePath,
      subpath: sf.subpath,
      size: sf.file.size,
      classification,
      fingerprint: fp,
      status,
      rejectReason,
      duplicateOfLocalId: dupLocal,
    });
    opts.onProgress?.(i + 1, scan.files.length);
  }

  // Cross-job dedupe against prior successfully-ingested items in this
  // workspace. Best-effort — if RLS or network fails we fall back to
  // in-pick-only dedupe.
  if (opts.workspaceId && items.some((it) => it.status === "new")) {
    const fps = items.filter((it) => it.status === "new").map((it) => it.fingerprint);
    try {
      const { data } = await supabase
        .from("ingest_job_items")
        .select("id, metadata")
        .in("status", ["verified", "qc_passed", "completed"])
        .limit(2000);
      const knownByFp = new Map<string, string>();
      for (const row of data ?? []) {
        const meta = (row as { metadata?: { fingerprint?: string } }).metadata;
        const fp = meta?.fingerprint;
        if (fp && fps.includes(fp) && !knownByFp.has(fp)) knownByFp.set(fp, row.id as string);
      }
      for (const it of items) {
        if (it.status === "new" && knownByFp.has(it.fingerprint)) {
          it.status = "duplicate_known";
          it.duplicateOfRemoteItemId = knownByFp.get(it.fingerprint);
        }
      }
    } catch {
      /* non-fatal — dedupe stays in-pick-only */
    }
  }

  const counts = {
    total: items.length,
    new: items.filter((i) => i.status === "new").length,
    duplicateInPick: items.filter((i) => i.status === "duplicate_in_pick").length,
    duplicateKnown: items.filter((i) => i.status === "duplicate_known").length,
    rejected: items.filter((i) => i.status === "rejected").length,
  };

  return {
    rootLabel: scan.rootLabel,
    cameraFamilyLabel: scan.cameraFamilyLabel,
    totalBytes: scan.totalBytes,
    items,
    counts,
  };
}
