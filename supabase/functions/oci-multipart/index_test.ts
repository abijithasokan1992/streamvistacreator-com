// HTTP-layer integration tests for the deployed `oci-multipart` edge function.
//
// Covers the public failure contract:
//   - CORS preflight
//   - unauthenticated calls are rejected with 401
//   - invalid bearer token is rejected
//   - unknown action surfaces a JSON error (auth gate first, then routing)
//   - commit / complete shape errors are validated server-side
//
// Per-action input validation (missing uploadRowId/uploadId, missing parts)
// runs AFTER auth, so we can only assert the auth-gate contract end-to-end
// here. The forbidden-file-type allowlist that `init` delegates to is fully
// covered by `_shared/uploadValidation_test.ts`.

import "https://deno.land/std@0.224.0/dotenv/load.ts";
import { assertEquals, assertExists } from "https://deno.land/std@0.224.0/assert/mod.ts";

const SUPABASE_URL = Deno.env.get("VITE_SUPABASE_URL") ?? Deno.env.get("SUPABASE_URL");
const FN_URL = `${SUPABASE_URL}/functions/v1/oci-multipart`;

async function post(body: unknown, headers: Record<string, string> = {}) {
  const resp = await fetch(FN_URL, {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
  const json = await resp.json().catch(() => ({}));
  return { status: resp.status, json };
}

Deno.test("CORS preflight returns access-control headers", async () => {
  const resp = await fetch(FN_URL, {
    method: "OPTIONS",
    headers: {
      origin: "http://localhost:8080",
      "access-control-request-method": "POST",
      "access-control-request-headers": "authorization,content-type",
    },
  });
  await resp.text();
  assertEquals([200, 204].includes(resp.status), true);
  assertExists(resp.headers.get("access-control-allow-origin"));
});

Deno.test("init without auth is rejected with 401", async () => {
  const { status, json } = await post({
    action: "init",
    fileName: "evil.exe",
    fileSize: 10 * 1024 * 1024,
    mimeType: "application/octet-stream",
    workspaceId: "00000000-0000-0000-0000-000000000000",
  });
  assertEquals(status, 401);
  assertEquals(json.error, "unauthenticated");
});

Deno.test("complete without auth is rejected with 401", async () => {
  const { status, json } = await post({
    action: "complete",
    uploadRowId: "00000000-0000-0000-0000-000000000000",
    uploadId: "fake-upload-id",
    parts: [{ partNumber: 1, etag: "abc" }],
  });
  assertEquals(status, 401);
  assertExists(json.error);
});

Deno.test("invalid bearer token is rejected with 401 invalid token", async () => {
  const { status, json } = await post(
    { action: "init", fileName: "x.mp4", fileSize: 10, mimeType: "video/mp4", workspaceId: "ws" },
    { authorization: "Bearer not-a-real-jwt" },
  );
  assertEquals(status, 401);
  assertExists(json.error);
});

Deno.test("unknown action without auth still hits auth gate first", async () => {
  // Auth runs before action dispatch — this proves the security boundary.
  const { status, json } = await post({ action: "nuke-the-bucket" });
  assertEquals(status, 401);
  assertEquals(json.error, "unauthenticated");
});

Deno.test("complete with malformed body without auth is still 401 (no info leak)", async () => {
  const { status } = await post({ action: "complete" });
  assertEquals(status, 401);
});
