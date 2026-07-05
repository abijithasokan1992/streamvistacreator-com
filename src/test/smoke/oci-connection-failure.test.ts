/**
 * Regression — OCI connectivity failure surfacing.
 *
 * Verifies that a low-level OCI/network exception is mapped to a friendly,
 * production-safe UI string that never leaks stack traces, tokens, request
 * IDs, or raw OCI response bodies. Also verifies the retry pathway still
 * exists in the multipart driver so the fix does not regress resume behaviour.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { mapUploadError } from "@/lib/ociMultipartUpload";

const FORBIDDEN = [
  /oci-cli/i, /BEGIN CERTIFICATE/i, /AKIA[0-9A-Z]{8,}/i,
  /at\s+\w+\s+\(\/.+:\d+:\d+\)/, // stack frame
  /"?stack"?\s*:/i,
  /Bearer\s+[A-Za-z0-9._-]{10,}/i,
  /supabase\.co\/functions\/v1\//i,
];

function assertSafe(msg: string) {
  for (const rx of FORBIDDEN) {
    expect(msg, `leaked sensitive fragment: ${rx}`).not.toMatch(rx);
  }
}

describe("OCI_CONNECTION_FAILED — friendly surface", () => {
  it("maps a connection refused error to safe copy", () => {
    const msg = mapUploadError(new Error("fetch failed: ECONNREFUSED objectstorage.example.com:443"));
    expect(msg).toMatch(/couldn't reach the storage service/i);
    assertSafe(msg);
  });

  it("maps DNS lookup failure to safe copy", () => {
    const msg = mapUploadError(new Error("getaddrinfo ENOTFOUND objectstorage.oci"));
    expect(msg).toMatch(/couldn't reach the storage service/i);
    assertSafe(msg);
  });

  it("maps a socket timeout to safe copy", () => {
    const msg = mapUploadError(new Error("connect ETIMEDOUT 140.238.x.y:443"));
    expect(msg).toMatch(/couldn't reach the storage service/i);
    assertSafe(msg);
  });

  it("never emits the OCI_CONNECTION_FAILED code to end users", () => {
    const msg = mapUploadError(new Error("OCI_CONNECTION_FAILED: TLS handshake failed"));
    expect(msg).not.toMatch(/OCI_CONNECTION_FAILED/);
    expect(msg).not.toMatch(/TLS handshake failed/);
    assertSafe(msg);
  });

  it("preserves existing retry pathway (multipart driver still exposes resume)", () => {
    const src = readFileSync(
      resolve(__dirname, "../../lib/ociMultipartUpload.ts"),
      "utf8",
    );
    // The resumable-upload contract must remain exported so pause/resume works.
    expect(src).toMatch(/class\s+ResumableUploadInterrupted/);
    expect(src).toMatch(/export\s+async\s+function\s+uploadFileMultipart/);
  });
});
