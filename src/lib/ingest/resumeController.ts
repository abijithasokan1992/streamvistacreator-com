/**
 * Resume controller.
 *
 * Persists per-job resume state inside `ingest_jobs.metadata.resume` so a
 * page reload, network blip, or device replug can pick up where it left off.
 *
 * Writes are throttled to at most 1/s per job to avoid hammering the DB
 * while a fast NVMe source streams chunks through.
 */

import { supabase } from "@/integrations/supabase/client";

export type ItemResumeState = {
  status: string;
  bytesUploaded: number;
  streamingSha?: string | null;
  serverSha?: string | null;
  fingerprint: string;
  size: number;
};

export type ResumeToken = {
  version: 1;
  updatedAt: string;
  items: Record<string, ItemResumeState>;
};

const lastWriteAt = new Map<string, number>();
const pendingWrite = new Map<string, ReturnType<typeof setTimeout>>();

export async function loadResumeToken(jobId: string): Promise<ResumeToken | null> {
  const { data, error } = await supabase
    .from("ingest_jobs")
    .select("metadata")
    .eq("id", jobId)
    .maybeSingle();
  if (error || !data) return null;
  const meta = (data as { metadata?: { resume?: ResumeToken } }).metadata;
  return meta?.resume ?? null;
}

async function writeNow(jobId: string, token: ResumeToken): Promise<void> {
  // Read-modify-write so we don't clobber sibling metadata keys.
  const { data } = await supabase
    .from("ingest_jobs")
    .select("metadata")
    .eq("id", jobId)
    .maybeSingle();
  const meta = { ...((data as { metadata?: Record<string, unknown> } | null)?.metadata ?? {}), resume: token };
  await supabase.from("ingest_jobs").update({ metadata: meta }).eq("id", jobId);
}

export function saveResumeToken(jobId: string, token: ResumeToken): void {
  const now = Date.now();
  const last = lastWriteAt.get(jobId) ?? 0;
  const wait = Math.max(0, 1000 - (now - last));
  const existing = pendingWrite.get(jobId);
  if (existing) clearTimeout(existing);
  const t = setTimeout(() => {
    lastWriteAt.set(jobId, Date.now());
    pendingWrite.delete(jobId);
    void writeNow(jobId, { ...token, updatedAt: new Date().toISOString() });
  }, wait);
  pendingWrite.set(jobId, t);
}

export async function flushResumeToken(jobId: string, token: ResumeToken): Promise<void> {
  const existing = pendingWrite.get(jobId);
  if (existing) {
    clearTimeout(existing);
    pendingWrite.delete(jobId);
  }
  await writeNow(jobId, { ...token, updatedAt: new Date().toISOString() });
  lastWriteAt.set(jobId, Date.now());
}
