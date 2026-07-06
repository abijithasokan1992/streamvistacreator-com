/**
 * Post-upload three-way verifier.
 *
 * Witness A: streaming SHA-256 computed during the upload (from the engine).
 * Witness B: independent whole-file SHA-256, computed by re-reading the source
 *            AFTER the upload completes. Source is read only, never written.
 * Witness C: server-side checksum recorded by the existing OCI pipeline
 *            (persisted on `ingest_job_items` as `client_checksum` /
 *            `metadata.server_checksum`).
 *
 * Any 2-of-3 disagreement quarantines the item as `corrupt` and the source
 * is left untouched. No retry is automatic — the operator decides.
 */

import { wholeFileSha256 } from "./fingerprint";

export type Witnesses = {
  streaming: string | null;
  reread: string | null;
  server: string | null;
};

export type VerifyResult =
  | { verdict: "verified"; witnesses: Witnesses }
  | { verdict: "corrupt"; witnesses: Witnesses; reason: string }
  | { verdict: "insufficient"; witnesses: Witnesses; reason: string };

export async function verifyItem(
  file: File,
  streaming: string | null,
  server: string | null,
  signal?: AbortSignal,
): Promise<VerifyResult> {
  const reread = await wholeFileSha256(file, signal);
  const witnesses: Witnesses = { streaming, reread, server };

  const present = [streaming, reread, server].filter(Boolean) as string[];
  if (present.length < 2) {
    return {
      verdict: "insufficient",
      witnesses,
      reason: "Not enough witnesses to verify (need at least 2)",
    };
  }

  // Majority vote.
  const tally = new Map<string, number>();
  for (const h of present) tally.set(h, (tally.get(h) ?? 0) + 1);
  const [winnerHash, winnerCount] = Array.from(tally.entries()).sort((a, b) => b[1] - a[1])[0];

  if (winnerCount >= 2 && present.every((h) => h === winnerHash || tally.get(h)! < winnerCount)) {
    // Full agreement or 2-of-3 agreement.
    if (winnerCount === present.length) {
      return { verdict: "verified", witnesses };
    }
    return {
      verdict: "corrupt",
      witnesses,
      reason: `Checksum disagreement — 1 witness of ${present.length} did not match`,
    };
  }

  return {
    verdict: "corrupt",
    witnesses,
    reason: "No majority checksum agreement",
  };
}
