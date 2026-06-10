// c2c-ingest-webhook
// Receives ingest-verified events from the C2C frontend / external encoders
// after a 03-RAW-INGEST chunk or PAR PUT lands in OCI Object Storage, and
// writes a structured row into public.payment_debug_logs so ops can see the
// checksum handshake / ETag verification and per-file duration.
//
// Endpoint is intentionally public — callers (encoders, browser) send a
// non-sensitive ingest receipt, never secrets. Service role is used only to
// write the audit row.

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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const body = await req.json().catch(() => ({}));
    const {
      file_name,
      size_bytes,
      sha256,
      etag,
      duration_ms,
      workspace_id,
      production_banner,
      category,
      ingest_path,        // 'hardware' | 'mobile' | 'ndi' | 'virtual'
      par_status,         // HTTP status of the PAR PUT (or 'multipart')
      transport,          // 'par' | 'multipart' | 'webhook'
    } = body ?? {};

    if (!file_name || typeof file_name !== "string") {
      return json({ error: "file_name required" }, 400);
    }

    // ETag handshake: if both sha256 and etag are present, they should agree
    // (OCI returns the MD5 of the object body for single-part PUTs, and a
    // multipart-style etag for chunked). We only flag a mismatch, never fail.
    const etag_matches = sha256 && etag
      ? String(etag).replace(/"/g, "").toLowerCase().includes(String(sha256).slice(0, 16).toLowerCase())
      : null;

    const supa = createClient(SUPABASE_URL, SERVICE_ROLE, {
      auth: { persistSession: false },
    });

    const auth = req.headers.get("Authorization") ?? "";
    let user_id: string | null = null;
    if (auth.startsWith("Bearer ")) {
      const { data } = await supa.auth.getUser(auth.replace("Bearer ", ""));
      user_id = data.user?.id ?? null;
    }

    const { error } = await supa.from("payment_debug_logs").insert({
      severity: par_status && Number(par_status) >= 400 ? "error" : "info",
      action_type: "c2c.ingest_verified",
      source: "edge",
      user_id,
      duration_ms: Number.isFinite(Number(duration_ms)) ? Number(duration_ms) : null,
      error_message: par_status && Number(par_status) >= 400 ? `PAR HTTP ${par_status}` : null,
      extra: {
        file_name,
        size_bytes: Number(size_bytes) || null,
        sha256: sha256 ?? null,
        etag: etag ?? null,
        etag_matches,
        workspace_id: workspace_id ?? null,
        production_banner: production_banner ?? null,
        category: category ?? null,
        ingest_path: ingest_path ?? null,
        transport: transport ?? null,
        par_status: par_status ?? null,
        ua: req.headers.get("user-agent") ?? null,
      },
    });

    if (error) {
      console.error("c2c-ingest-webhook insert failed", error);
      return json({ error: "Internal server error" }, 500);
    }
    return json({ ok: true, etag_matches });
  } catch (e) {
    console.error("c2c-ingest-webhook crash", e);
    return json({ error: "Internal server error" }, 500);
  }
});
