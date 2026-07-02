// HTTP-layer integration tests for the deployed `oci-upload` edge function.
//
// We cannot exercise the OCI PUT path from a test (no real user JWT, no live
// OCI creds in CI), so these tests pin the public failure contract:
//   - CORS preflight succeeds
//   - unauthenticated calls are rejected with 401 and a JSON error
//   - JSON `list` action without auth surfaces "unauthenticated"
//
// The full forbidden-file-type allowlist is covered by the unit tests in
// `_shared/uploadValidation_test.ts` — that module is the single source of
// truth that this function delegates to.

import "https://deno.land/std@0.224.0/dotenv/load.ts";
import { assertEquals, assertExists } from "https://deno.land/std@0.224.0/assert/mod.ts";

const SUPABASE_URL = Deno.env.get("VITE_SUPABASE_URL") ?? Deno.env.get("SUPABASE_URL");
const FN_URL = `${SUPABASE_URL}/functions/v1/oci-upload`;

Deno.test("CORS preflight returns a 2xx response", async () => {
  const resp = await fetch(FN_URL, {
    method: "OPTIONS",
    headers: {
      "access-control-request-method": "POST",
      "access-control-request-headers": "authorization,content-type",
    },
  });
  await resp.text();
  assertEquals([200, 204].includes(resp.status), true);
});

Deno.test("unauthenticated multipart upload is rejected with 401", async () => {
  const form = new FormData();
  form.append("workspaceId", "00000000-0000-0000-0000-000000000000");
  form.append("file", new File([new Uint8Array([1, 2, 3])], "evil.exe", { type: "application/octet-stream" }));
  const resp = await fetch(FN_URL, { method: "POST", body: form });
  const json = await resp.json();
  assertEquals(resp.status, 401);
  assertExists(json.error);
});

Deno.test("unauthenticated JSON list action is rejected with 401", async () => {
  const resp = await fetch(FN_URL, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ action: "list" }),
  });
  const json = await resp.json();
  assertEquals(resp.status, 401);
  assertEquals(json.error, "unauthenticated");
});

Deno.test("invalid bearer token is rejected with 401 invalid token", async () => {
  const resp = await fetch(FN_URL, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: "Bearer not-a-real-jwt" },
    body: JSON.stringify({ action: "list" }),
  });
  const json = await resp.json();
  assertEquals(resp.status, 401);
  assertExists(json.error);
});
