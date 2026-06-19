/**
 * review-link — public review token resolver.
 * Reads password hash/salt from review_link_secrets (service-role only).
 */
import { createClient } from "npm:@supabase/supabase-js@2";
import { buildCorsHeaders } from "../_shared/cors.ts";

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

// PBKDF2-SHA256 (matches vault-share). New review-link passwords use PBKDF2;
// legacy sha256 rows remain verifiable via algo branch for backwards compat.
const PBKDF2_ITERATIONS = 210_000;
const PBKDF2_HASH = "SHA-256";
const PBKDF2_KEY_LEN = 32;
function hexToBytes(hex: string): Uint8Array {
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.substr(i * 2, 2), 16);
  return out;
}
async function pbkdf2Hex(pwd: string, saltHex: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw", new TextEncoder().encode(pwd), { name: "PBKDF2" }, false, ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt: hexToBytes(saltHex), iterations: PBKDF2_ITERATIONS, hash: PBKDF2_HASH },
    key, PBKDF2_KEY_LEN * 8,
  );
  return Array.from(new Uint8Array(bits))
    .map((b) => b.toString(16).padStart(2, "0")).join("");
}
function timingSafeEqualStr(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
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
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

    // Owner/writer-only: set or clear a review link password.
    if (action === "set-password") {
      const authHeader = req.headers.get("Authorization");
      if (!authHeader?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);
      const userClient = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: claims } = await userClient.auth.getClaims(authHeader.replace("Bearer ", ""));
      const uid = claims?.claims?.sub;
      if (!uid) return json({ error: "Unauthorized" }, 401);

      const reviewLinkId = String(body?.reviewLinkId ?? "");
      const pwd = typeof body?.password === "string" ? body.password : "";
      if (!reviewLinkId) return json({ error: "reviewLinkId required" }, 400);
      if (pwd.length > 256) return json({ error: "Password too long" }, 400);

      const { data: link } = await admin
        .from("review_links")
        .select("id, workspace_id, created_by")
        .eq("id", reviewLinkId)
        .maybeSingle();
      if (!link) return json({ error: "Not found" }, 404);

      // Only the creator or workspace writers can set the password
      const { data: canWrite } = await admin.rpc("can_write_workspace", {
        _workspace_id: link.workspace_id, _user_id: uid,
      });
      if (link.created_by !== uid && !canWrite) return json({ error: "Forbidden" }, 403);

      if (pwd) {
        const salt = Array.from(crypto.getRandomValues(new Uint8Array(16)))
          .map((b) => b.toString(16).padStart(2, "0")).join("");
        const hash = await pbkdf2Hex(pwd, salt);
        await admin.from("review_link_secrets").upsert({
          review_link_id: reviewLinkId, password_hash: hash, password_salt: salt,
          password_hash_algo: "pbkdf2-sha256", updated_at: new Date().toISOString(),
        });
        await admin.from("review_links").update({ requires_password: true }).eq("id", reviewLinkId);
      } else {
        await admin.from("review_link_secrets").delete().eq("review_link_id", reviewLinkId);
        await admin.from("review_links").update({ requires_password: false }).eq("id", reviewLinkId);
      }
      return json({ ok: true });
    }

    const token = String(body?.token ?? "").trim();
    if (!token || token.length < 8) return json({ error: "Invalid token" }, 400);
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
          .select("password_hash, password_salt, password_hash_algo")
          .eq("review_link_id", row.id)
          .maybeSingle();
        if (!secret) return json({ error: "Incorrect password" }, 401);
        const salt = secret.password_salt ?? "";
        const algo = (secret as any).password_hash_algo ?? "sha256";
        const candidate = algo === "pbkdf2-sha256"
          ? await pbkdf2Hex(pwd, salt)
          : await sha256Hex(`${salt}::${pwd}`);
        if (!timingSafeEqualStr(candidate, secret.password_hash)) {
          return json({ error: "Incorrect password" }, 401);
        }
        // Opportunistic upgrade of legacy sha256 rows to PBKDF2 on successful unlock.
        if (algo !== "pbkdf2-sha256") {
          try {
            const newSalt = Array.from(crypto.getRandomValues(new Uint8Array(16)))
              .map((b) => b.toString(16).padStart(2, "0")).join("");
            const newHash = await pbkdf2Hex(pwd, newSalt);
            await admin.from("review_link_secrets").update({
              password_hash: newHash, password_salt: newSalt,
              password_hash_algo: "pbkdf2-sha256", updated_at: new Date().toISOString(),
            }).eq("review_link_id", row.id);
          } catch (e) { console.error("review-link: pbkdf2 upgrade failed", e); }
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
    return json({ error: "Internal server error" }, 500);
  }
});
