/**
 * Cheap, stable client-side fingerprint for a source file.
 *
 * Fingerprint = SHA-256("<size>|<first-1MB-sha>|<last-1MB-sha>")
 *
 * Used only for local dedupe and resume-source-integrity checks. It is NOT
 * an authoritative checksum — the OCI pipeline still produces the whole-file
 * SHA-256 of record, and `verifier.ts` re-reads the source for a second
 * independent whole-file hash before an item is marked `verified`.
 *
 * Reads are all `slice()` reads against the immutable `File` handle the
 * browser hands us — the source device is never written to.
 */

const HEAD_TAIL_BYTES = 1 * 1024 * 1024;

async function sha256Hex(buf: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", buf);
  const bytes = new Uint8Array(digest);
  let hex = "";
  for (const b of bytes) hex += b.toString(16).padStart(2, "0");
  return hex;
}

export async function fingerprintFile(file: File): Promise<string> {
  try {
    const size = file.size;
    const headEnd = Math.min(HEAD_TAIL_BYTES, size);
    const tailStart = Math.max(0, size - HEAD_TAIL_BYTES);
    const [headBuf, tailBuf] = await Promise.all([
      file.slice(0, headEnd).arrayBuffer(),
      file.slice(tailStart, size).arrayBuffer(),
    ]);
    const [headSha, tailSha] = await Promise.all([sha256Hex(headBuf), sha256Hex(tailBuf)]);
    const payload = new TextEncoder().encode(`${size}|${headSha}|${tailSha}`);
    return await sha256Hex(payload.buffer);
  } catch {
    // Never throw during planning — fall back to a size-only key so the item
    // still shows up and can be re-planned once the device is stable.
    return `size:${file.size}`;
  }
}

export async function wholeFileSha256(file: File, signal?: AbortSignal): Promise<string | null> {
  try {
    // Stream the file in 4 MiB chunks so a 200 GB source does not need to
    // materialise in RAM. crypto.subtle has no incremental API, so we build
    // the hash by concatenating chunk digests deterministically:
    //   final = sha256(sha256(chunk0) || sha256(chunk1) || ...)
    // This is a stable client-side witness — the authoritative whole-file
    // hash comes from the server side of the OCI pipeline.
    const CHUNK = 4 * 1024 * 1024;
    const parts: Uint8Array[] = [];
    for (let offset = 0; offset < file.size; offset += CHUNK) {
      if (signal?.aborted) return null;
      const end = Math.min(offset + CHUNK, file.size);
      const buf = await file.slice(offset, end).arrayBuffer();
      const d = new Uint8Array(await crypto.subtle.digest("SHA-256", buf));
      parts.push(d);
    }
    const concat = new Uint8Array(parts.length * 32);
    parts.forEach((p, i) => concat.set(p, i * 32));
    return await sha256Hex(concat.buffer);
  } catch {
    return null;
  }
}
