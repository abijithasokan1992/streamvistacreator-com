/**
 * mint-delivery-par
 *
 * Mints a short-lived Oracle OCI Pre-Authenticated Request (PAR) for a
 * deal_deliveries row. Admin picks the underlying asset to share either
 * by upload_session_id (preferred — uses object_key) or by passing an
 * object_key directly. Stamps share_url + expires_at on the delivery row.
 *
 * Admin-only.
 *
 * Request: { delivery_id, upload_session_id?, object_key?, ttl_hours? }
 * Response: { url, expires_at, source }
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

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
    const { data: isAdmin } = await admin.rpc("has_role", { _user_id: uid, _role: "admin" });
    if (!isAdmin) return json(req, { error: "Admin only" }, 403);

    const body = await req.json().catch(() => ({}));
    const deliveryId = String(body?.delivery_id ?? "");
    let objectKey: string | null = body?.object_key ?? null;
    const uploadSessionId: string | null = body?.upload_session_id ?? null;
    const ttlHours = Math.min(168, Math.max(1, Number(body?.ttl_hours ?? 72)));
    if (!deliveryId) return json(req, { error: "Missing delivery_id" }, 400);

    if (!objectKey && uploadSessionId) {
      const { data: session } = await admin
        .from("upload_sessions").select("object_key").eq("id", uploadSessionId).maybeSingle();
      objectKey = session?.object_key ?? null;
    }
    if (!objectKey) return json(req, { error: "Provide object_key or upload_session_id" }, 400);

    const expiresAtIso = new Date(Date.now() + ttlHours * 3600 * 1000).toISOString();

    const proxyRes = await fetch(`${SUPABASE_URL}/functions/v1/oracle-proxy`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${SERVICE_ROLE}` },
      body: JSON.stringify({
        action: "create-par",
        name: `delivery-${deliveryId.slice(0, 8)}`,
        objectName: objectKey,
        expiresAt: expiresAtIso,
        accessType: "ObjectRead",
      }),
    });
    const proxyJson = await proxyRes.json().catch(() => ({}));
    if (!proxyRes.ok || !proxyJson?.url) {
      return json(req, { error: "PAR mint failed", detail: proxyJson }, 502);
    }

    await admin.from("deal_deliveries").update({
      share_url: proxyJson.url,
      expires_at: expiresAtIso,
      shared_at: new Date().toISOString(),
      status: "shared",
    }).eq("id", deliveryId);

    return json(req, { url: proxyJson.url, expires_at: expiresAtIso, source: "oci_par" });
  } catch (e) {
    console.error("mint-delivery-par error", e);
    return json(req, { error: String((e as Error)?.message ?? e) }, 500);
  }
});
