/**
 * review-link — public review token resolver.
 * Reads password hash/salt from review_link_secrets (service-role only).
 */
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function sha256Hex(input: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function isExpired(row: { expires_at: string | null; max_views: number | null; view_count: number; revoked: boolean }) {
  if (row.revoked) return "revoked";
  if (row.expires_at && new Date(row.expires_at).getTime() <= Date.now()) return "expired";
  if (row.max_views !== null && row.view_count >= row.max_views) return "exhausted";
  return null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const action = String(body?.action ?? "");
    const token = String(body?.token ?? "").trim();
    if (!token || token.length < 8) return json({ error: "Invalid token" }, 400);

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
    const { data: row, error } = await admin
      .from("review_links")
      .select(
        "id, asset_name, asset_mime, asset_size_bytes, asset_par_url, asset_par_expires_at, requires_password, view_only, expires_at, max_views, view_count, revoked",
      )
      .eq("token", token)
      .maybeSingle();

    if (error) return json({ error: "Lookup failed" }, 500);
    if (!row) return json({ error: "Not found" }, 404);

    const status = isExpired(row as any);
    if (status === "revoked") return json({ error: "This review link has been revoked." }, 403);
    if (status === "expired") return json({ error: "This review link has expired." }, 410);
    if (status === "exhausted") return json({ error: "This review link has reached its view limit." }, 410);

    if (action === "info") {
      return json({
        filename: row.asset_name,
        mime: row.asset_mime,
        size: row.asset_size_bytes,
        requires_password: !!row.requires_password,
        view_only: row.view_only,
        expires_at: row.expires_at,
        max_views: row.max_views,
        view_count: row.view_count,
      });
    }

    if (action === "unlock") {
      if (row.requires_password) {
        const pwd = String(body?.password ?? "");
        if (!pwd) return json({ error: "Password required" }, 401);
        const { data: secret } = await admin
          .from("review_link_secrets")
          .select("password_hash, password_salt")
          .eq("review_link_id", row.id)
          .maybeSingle();
        if (!secret) return json({ error: "Incorrect password" }, 401);
        const candidate = await sha256Hex(`${secret.password_salt ?? ""}::${pwd}`);
        if (candidate !== secret.password_hash) {
          return json({ error: "Incorrect password" }, 401);
        }
      }

      await admin
        .from("review_links")
        .update({
          view_count: (row.view_count ?? 0) + 1,
          last_viewed_at: new Date().toISOString(),
        })
        .eq("id", row.id);

      return json({
        filename: row.asset_name,
        mime: row.asset_mime,
        size: row.asset_size_bytes,
        playback_url: row.asset_par_url,
        view_only: row.view_only,
        expires_at: row.expires_at,
      });
    }

    return json({ error: "Unknown action" }, 400);
  } catch (e) {
    console.error("review-link error:", e);
    return json({ error: e instanceof Error ? e.message : "Internal error" }, 500);
  }
});
