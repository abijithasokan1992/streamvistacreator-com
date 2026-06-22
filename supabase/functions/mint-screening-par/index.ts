/**
 * mint-screening-par
 *
 * Mints a short-lived Oracle OCI Pre-Authenticated Request (PAR) for a
 * screening invite's underlying asset, stamps the resulting URL onto
 * the screening_invites row (playback_url + playback_url_expires_at),
 * and returns it.
 *
 * Admin-only. Replaces manual paste of playback URLs in the
 * Screening Ops Console.
 *
 * Request:  { invite_id: string, ttl_hours?: number }
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

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
    const { data: isAdmin } = await admin.rpc("has_role", { _user_id: uid, _role: "admin" });
    if (!isAdmin) return json(req, { error: "Admin only" }, 403);

    const body = await req.json().catch(() => ({}));
    const inviteId = String(body?.invite_id ?? "");
    const ttlHours = Math.min(168, Math.max(1, Number(body?.ttl_hours ?? 48)));
    if (!inviteId) return json(req, { error: "Missing invite_id" }, 400);

    // Look up invite → asset → upload session for the OCI object_key.
    const { data: invite, error: invErr } = await admin
      .from("screening_invites")
      .select("id, title_id, screening_asset_id, invite_email")
      .eq("id", inviteId)
      .maybeSingle();
    if (invErr || !invite) return json(req, { error: "Invite not found" }, 404);
    if (!invite.screening_asset_id) return json(req, { error: "Invite has no screening_asset_id; attach an asset first" }, 400);

    const { data: asset } = await admin
      .from("title_screening_assets")
      .select("id, label, source_kind, upload_id, external_url")
      .eq("id", invite.screening_asset_id)
      .maybeSingle();
    if (!asset) return json(req, { error: "Screening asset not found" }, 404);

    // If the asset is external, we cannot mint a PAR — return its URL as-is.
    if (asset.source_kind !== "upload" || !asset.upload_id) {
      if (asset.external_url) {
        const expiresAt = new Date(Date.now() + ttlHours * 3600 * 1000).toISOString();
        await admin.from("screening_invites").update({
          playback_url: asset.external_url,
          playback_url_expires_at: expiresAt,
        }).eq("id", inviteId);
        return json(req, { url: asset.external_url, expires_at: expiresAt, source: "external" });
      }
      return json(req, { error: "Asset has no upload_id or external_url; cannot mint PAR" }, 400);
    }

    const { data: session } = await admin
      .from("upload_sessions")
      .select("object_key")
      .eq("id", asset.upload_id)
      .maybeSingle();
    if (!session?.object_key) return json(req, { error: "Upload session has no object_key" }, 400);

    const expiresAtIso = new Date(Date.now() + ttlHours * 3600 * 1000).toISOString();

    // Reuse oracle-proxy create-par.
    const proxyRes = await fetch(`${SUPABASE_URL}/functions/v1/oracle-proxy`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${SERVICE_ROLE}`,
      },
      body: JSON.stringify({
        action: "create-par",
        name: `screening-${inviteId.slice(0, 8)}`,
        objectName: session.object_key,
        expiresAt: expiresAtIso,
        accessType: "ObjectRead",
      }),
    });
    const proxyJson = await proxyRes.json().catch(() => ({}));
    if (!proxyRes.ok || !proxyJson?.url) {
      return json(req, { error: "PAR mint failed", detail: proxyJson }, 502);
    }

    await admin.from("screening_invites").update({
      playback_url: proxyJson.url,
      playback_url_expires_at: expiresAtIso,
    }).eq("id", inviteId);

    return json(req, { url: proxyJson.url, expires_at: expiresAtIso, source: "oci_par" });
  } catch (e) {
    console.error("mint-screening-par error", e);
    return json(req, { error: String((e as Error)?.message ?? e) }, 500);
  }
});
