import { createClient } from "npm:@supabase/supabase-js@2";
import { buildCorsHeaders, handleOptions } from "../_shared/cors.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const PBKDF2_ITERATIONS = 210_000;
const PBKDF2_HASH = "SHA-256";
const PBKDF2_KEY_LEN = 32;

function bytesToHex(b: Uint8Array): string {
  return Array.from(b).map((x) => x.toString(16).padStart(2, "0")).join("");
}

function hexToBytes(hex: string): Uint8Array {
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.substr(i * 2, 2), 16);
  return out;
}

function randomSalt(): string {
  const arr = new Uint8Array(16);
  crypto.getRandomValues(arr);
  return bytesToHex(arr);
}

async function hashPassword(pwd: string, saltHex: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(pwd),
    { name: "PBKDF2" },
    false,
    ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt: hexToBytes(saltHex), iterations: PBKDF2_ITERATIONS, hash: PBKDF2_HASH },
    key,
    PBKDF2_KEY_LEN * 8,
  );
  return bytesToHex(new Uint8Array(bits));
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...buildCorsHeaders(req), "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: buildCorsHeaders(req) });

  try {
    const body = await req.json().catch(() => ({}));
    const { action, token, password, fileId, newPassword } = body as {
      action: string; token?: string; password?: string; fileId?: string; newPassword?: string;
    };

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

    // Owner-only: set/update password for a file by id (requires JWT).
    if (action === "set-password") {
      const authHeader = req.headers.get("Authorization");
      if (!authHeader?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);
      const userClient = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: claims } = await userClient.auth.getClaims(authHeader.replace("Bearer ", ""));
      const uid = claims?.claims?.sub;
      if (!uid) return json({ error: "Unauthorized" }, 401);
      if (!fileId || typeof fileId !== "string") return json({ error: "Invalid fileId" }, 400);

      const { data: row, error: rowErr } = await admin
        .from("shared_files").select("id, owner_id").eq("id", fileId).maybeSingle();
      if (rowErr || !row || row.owner_id !== uid) return json({ error: "Not found" }, 404);

      let salt: string | null = null;
      let hash: string | null = null;
      if (newPassword && typeof newPassword === "string" && newPassword.length > 0) {
        if (newPassword.length > 256) return json({ error: "Password too long" }, 400);
        salt = randomSalt();
        hash = await hashPassword(newPassword, salt);
      }
      const { error: upErr } = await admin
        .from("shared_files")
        .update({ password_hash: hash, password_salt: salt })
        .eq("id", fileId);
      if (upErr) return json({ error: "Update failed" }, 500);
      return json({ ok: true });
    }

    // Recipient flows: info / download by token
    if (!token || typeof token !== "string" || token.length < 8 || token.length > 128) {
      return json({ error: "Invalid token" }, 400);
    }

    const { data: file, error } = await admin
      .from("shared_files").select("*").eq("share_token", token).maybeSingle();
    if (error || !file) return json({ error: "Not found" }, 404);
    if (file.revoked) return json({ error: "Link revoked" }, 410);
    if (file.expires_at && new Date(file.expires_at) < new Date()) return json({ error: "Link expired" }, 410);
    if (file.max_downloads != null && file.download_count >= file.max_downloads) {
      return json({ error: "Download limit reached" }, 410);
    }

    if (action === "info") {
      return json({
        filename: file.filename,
        size_bytes: file.size_bytes,
        mime_type: file.mime_type ?? null,
        tier: file.tier,
        requires_password: !!file.password_hash,
        expires_at: file.expires_at,
        downloads_left: file.max_downloads != null ? file.max_downloads - file.download_count : null,
        view_only: !!file.view_only,
      });
    }

    // Verify password helper (used by view + download)
    async function verifyPwd(): Promise<Response | null> {
      if (!file.password_hash) return null;
      if (!password || typeof password !== "string") return json({ error: "Password required" }, 401);
      if (!file.password_salt) {
        const legacy = bytesToHex(new Uint8Array(
          await crypto.subtle.digest("SHA-256", new TextEncoder().encode(password)),
        ));
        if (!timingSafeEqual(legacy, file.password_hash)) return json({ error: "Wrong password" }, 401);
      } else {
        const h = await hashPassword(password, file.password_salt);
        if (!timingSafeEqual(h, file.password_salt ? h : "")) {} // no-op for type
        if (!timingSafeEqual(h, file.password_hash)) return json({ error: "Wrong password" }, 401);
      }
      return null;
    }

    if (action === "view") {
      const bad = await verifyPwd(); if (bad) return bad;
      const { data: signed, error: sErr } = await admin.storage
        .from("vault").createSignedUrl(file.storage_path, 600);
      if (sErr || !signed) return json({ error: "Storage error" }, 500);
      return json({ url: signed.signedUrl, filename: file.filename, mime_type: file.mime_type ?? null });
    }

    if (action === "download") {
      if (file.view_only) return json({ error: "Download disabled for this link" }, 403);
      if (file.password_hash) {
        if (!password || typeof password !== "string") return json({ error: "Password required" }, 401);
        if (!file.password_salt) {
          // Legacy unsalted SHA-256 fallback (will be re-encoded on next owner update).
          const legacy = bytesToHex(new Uint8Array(
            await crypto.subtle.digest("SHA-256", new TextEncoder().encode(password)),
          ));
          if (!timingSafeEqual(legacy, file.password_hash)) return json({ error: "Wrong password" }, 401);
        } else {
          const h = await hashPassword(password, file.password_salt);
          if (!timingSafeEqual(h, file.password_hash)) return json({ error: "Wrong password" }, 401);
        }
      }

      const { data: signed, error: sErr } = await admin.storage
        .from("vault").createSignedUrl(file.storage_path, 300, { download: file.filename });
      if (sErr || !signed) return json({ error: "Storage error" }, 500);

      await admin.from("shared_files").update({ download_count: file.download_count + 1 }).eq("id", file.id);
      return json({ url: signed.signedUrl, filename: file.filename });
    }

    return json({ error: "Unknown action" }, 400);
  } catch (e) {
    console.error("vault-share error", e);
    return json({ error: "Server error" }, 500);
  }
});
