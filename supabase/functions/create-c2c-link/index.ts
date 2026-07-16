// create-c2c-link
//
// Studio-user-facing endpoint that mints a short-lived Oracle Cloud (OCI)
// Pre-Authenticated Request (PAR) URL scoped to the caller's own tenant
// prefix (`c2c-ingest/studio_{userId}/`). Cameras and field devices can
// PUT files directly into that prefix without ever holding OCI credentials.
//
// Multi-tenant safety:
//   - The prefix is derived server-side from the verified JWT (never from
//     request input). Studio A cannot mint a link into Studio B's prefix.
//   - accessType = AnyObjectWrite      → write-only (no GET, no LIST)
//   - bucketListingAction = "Deny"      → PAR cannot list bucket contents
//   - PARs are logged to `dit_ingest_logs` for auditability.
//
// Request:  { ttl_hours?: number (1-168), label?: string }
// Response: { ok, url, expires_at, prefix, par_id }

import { createClient } from "npm:@supabase/supabase-js@2";
import { buildCorsHeaders, handleOptions } from "../_shared/cors.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

function json(req: Request, body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...buildCorsHeaders(req), "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return handleOptions(req);
  if (req.method !== "POST") return json(req, { error: "Method not allowed" }, 405);

  try {
    const auth = req.headers.get("Authorization") ?? "";
    if (!auth.startsWith("Bearer ")) return json(req, { ok: false, error: "Unauthorized" }, 401);

    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: auth } },
    });
    const { data: userRes } = await userClient.auth.getUser();
    const uid = userRes?.user?.id;
    if (!uid) return json(req, { ok: false, error: "Unauthorized" }, 401);

    const body = await req.json().catch(() => ({}));
    const ttlHours = Math.min(168, Math.max(1, Number(body?.ttl_hours ?? 24)));
    const label = (body?.label ? String(body.label) : "").slice(0, 60).replace(/[^\w.-]/g, "-") || "camera";

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

    // Tenant-isolated prefix (server-derived — never trust client for this).
    const prefix = `c2c-ingest/studio_${uid}/`;
    const expiresAtIso = new Date(Date.now() + ttlHours * 3600 * 1000).toISOString();
    const parName = `c2c-${label}-${uid.slice(0, 8)}-${Date.now()}`;

    // Delegate to oracle-proxy using the internal service-role bypass header.
    const proxyRes = await fetch(`${SUPABASE_URL}/functions/v1/oracle-proxy`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${SERVICE_ROLE}`,
        "x-sv-internal": SERVICE_ROLE,
      },
      body: JSON.stringify({
        action: "create-par",
        name: parName,
        objectName: prefix,
        accessType: "AnyObjectWrite",   // write-only, prefix-scoped
        bucketListingAction: "Deny",    // no LIST leakage to holders of the URL
        expiresAt: expiresAtIso,
      }),
    });
    const proxyJson = await proxyRes.json().catch(() => ({}));
    if (!proxyRes.ok || !proxyJson?.ok || !proxyJson?.url) {
      console.error("create-c2c-link: PAR mint failed", proxyJson);
      return json(req, {
        ok: false,
        error: proxyJson?.error || "Failed to mint Camera-to-Cloud link",
        detail: proxyJson,
      }, 502);
    }

    // Best-effort audit log; failure here shouldn't block the caller.
    try {
      await admin.from("admin_audit_log").insert({
        actor_id: uid,
        action: "c2c_par_created",
        entity_type: "oci_par",
        entity_id: parName,
        metadata: {
          prefix,
          expires_at: expiresAtIso,
          access_type: "AnyObjectWrite",
        },
      });
    } catch (e) {
      console.warn("create-c2c-link: audit log skipped", (e as Error)?.message);
    }

    return json(req, {
      ok: true,
      url: proxyJson.url,
      expires_at: expiresAtIso,
      prefix,
      par_id: proxyJson.par?.id ?? null,
      access_type: "AnyObjectWrite",
    });
  } catch (e) {
    console.error("create-c2c-link error", e);
    return json(req, { ok: false, error: (e as Error).message }, 500);
  }
});
