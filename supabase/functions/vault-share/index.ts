import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

async function hashPwd(pwd: string): Promise<string> {
  const data = new TextEncoder().encode(pwd);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const { action, token, password } = body as { action: string; token: string; password?: string };

    if (!token || typeof token !== "string" || token.length < 8 || token.length > 128) {
      return new Response(JSON.stringify({ error: "Invalid token" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
    const { data: file, error } = await admin
      .from("shared_files")
      .select("*")
      .eq("share_token", token)
      .maybeSingle();

    if (error || !file) {
      return new Response(JSON.stringify({ error: "Not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (file.revoked) {
      return new Response(JSON.stringify({ error: "Link revoked" }), { status: 410, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (file.expires_at && new Date(file.expires_at) < new Date()) {
      return new Response(JSON.stringify({ error: "Link expired" }), { status: 410, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (file.max_downloads != null && file.download_count >= file.max_downloads) {
      return new Response(JSON.stringify({ error: "Download limit reached" }), { status: 410, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (action === "info") {
      return new Response(JSON.stringify({
        filename: file.filename,
        size_bytes: file.size_bytes,
        tier: file.tier,
        requires_password: !!file.password_hash,
        expires_at: file.expires_at,
        downloads_left: file.max_downloads != null ? file.max_downloads - file.download_count : null,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (action === "download") {
      if (file.password_hash) {
        if (!password || typeof password !== "string") {
          return new Response(JSON.stringify({ error: "Password required" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }
        const h = await hashPwd(password);
        if (h !== file.password_hash) {
          return new Response(JSON.stringify({ error: "Wrong password" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }
      }

      const { data: signed, error: sErr } = await admin.storage
        .from("vault")
        .createSignedUrl(file.storage_path, 300, { download: file.filename });

      if (sErr || !signed) {
        return new Response(JSON.stringify({ error: "Storage error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      await admin.from("shared_files").update({ download_count: file.download_count + 1 }).eq("id", file.id);

      return new Response(JSON.stringify({ url: signed.signedUrl, filename: file.filename }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (_e) {
    return new Response(JSON.stringify({ error: "Server error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
