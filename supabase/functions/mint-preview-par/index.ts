/**
 * mint-preview-par
 *
 * Mints a short-lived read-only OCI PAR URL for an authenticated user to
 * preview one of their own uploads (or any upload, if caller is admin).
 * Reuses the existing `oracle-proxy` (`create-par`) action via service role,
 * caches the URL on `recent_uploads.par_url` until expiry to reduce mint calls.
 *
 * Request: { upload_id: string, ttl_hours?: number }
 * Response: { url, expires_at }
 */
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
  try {
    const auth = req.headers.get("Authorization") ?? "";
    if (!auth.startsWith("Bearer ")) return json(req, { error: "Unauthorized" }, 401);

    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: auth } },
    });
    const { data: userRes } = await userClient.auth.getUser();
    const uid = userRes?.user?.id;
    if (!uid) return json(req, { error: "Unauthorized" }, 401);

    const body = await req.json().catch(() => ({}));
    const uploadId = String(body?.upload_id ?? "");
    const ttlHours = Math.min(24, Math.max(1, Number(body?.ttl_hours ?? 4)));
    if (!uploadId) return json(req, { error: "Missing upload_id" }, 400);

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
    const { data: isAdmin } = await admin.rpc("has_role", { _user_id: uid, _role: "admin" });

    const { data: row, error: rowErr } = await admin
      .from("recent_uploads")
      .select("id, user_id, object_key, par_url, par_expires_at, status")
      .eq("id", uploadId)
      .maybeSingle();
    if (rowErr || !row) return json(req, { error: "Upload not found" }, 404);

    if (!isAdmin && row.user_id !== uid) {
      return json(req, { error: "Forbidden" }, 403);
    }
    if (!row.object_key) return json(req, { error: "Upload has no object_key" }, 400);

    // Reuse a still-valid cached URL (>15min headroom).
    const now = Date.now();
    if (
      row.par_url &&
      row.par_expires_at &&
      new Date(row.par_expires_at).getTime() - now > 15 * 60 * 1000
    ) {
      return json(req, { url: row.par_url, expires_at: row.par_expires_at, cached: true });
    }

    const expiresAtIso = new Date(now + ttlHours * 3600 * 1000).toISOString();
    const proxyRes = await fetch(`${SUPABASE_URL}/functions/v1/oracle-proxy`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${SERVICE_ROLE}`,
        "x-sv-internal": SERVICE_ROLE,
      },
      body: JSON.stringify({
        action: "create-par",
        name: `preview-${uploadId.slice(0, 8)}-${Date.now()}`,
        objectName: row.object_key,
        accessType: "ObjectRead",
        expiresAt: expiresAtIso,
      }),
    });
    const proxyJson = await proxyRes.json().catch(() => ({}));
    if (!proxyRes.ok || !proxyJson?.ok || !proxyJson?.url) {
      return json(req, { error: "PAR mint failed", detail: proxyJson }, 502);
    }

    await admin.from("recent_uploads").update({
      par_url: proxyJson.url,
      par_expires_at: expiresAtIso,
    }).eq("id", uploadId);

    return json(req, { url: proxyJson.url, expires_at: expiresAtIso, cached: false });
  } catch (e) {
    return json(req, { error: (e as Error).message }, 500);
  }
});
