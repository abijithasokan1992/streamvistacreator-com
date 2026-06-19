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
    // Reject obviously oversized payloads (log flooding / abuse defence).
    const rawText = await req.text();
    if (rawText.length > 8 * 1024) {
      return json({ error: "Payload too large" }, 413);
    }
    let body: any = {};
    try { body = rawText ? JSON.parse(rawText) : {}; } catch {
      return json({ error: "Invalid JSON" }, 400);
    }

    const clip = (v: unknown, n: number): string | null => {
      if (typeof v !== "string") return null;
      const t = v.trim();
      return t.length === 0 ? null : t.slice(0, n);
    };
    const isUuid = (v: unknown): string | null => {
      if (typeof v !== "string") return null;
      return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v) ? v : null;
    };

    const file_name = clip(body?.file_name, 256);
    if (!file_name) return json({ error: "file_name required" }, 400);

    const size_bytes_n = Number(body?.size_bytes);
    const size_bytes = Number.isFinite(size_bytes_n) && size_bytes_n >= 0 && size_bytes_n < 1e15
      ? size_bytes_n : null;
    const duration_ms_n = Number(body?.duration_ms);
    const duration_ms = Number.isFinite(duration_ms_n) && duration_ms_n >= 0 && duration_ms_n < 24 * 3600 * 1000
      ? duration_ms_n : null;

    const sha256 = clip(body?.sha256, 128);
    const etag = clip(body?.etag, 128);
    const workspace_id = isUuid(body?.workspace_id);
    const production_banner = clip(body?.production_banner, 64);
    const category = clip(body?.category, 64);
    const ingest_path = clip(body?.ingest_path, 32);
    const transport = clip(body?.transport, 32);
    const par_status = clip(body?.par_status, 16);
    const par_status_num = par_status ? Number(par_status) : NaN;

    // ETag handshake: if both sha256 and etag are present, they should agree.
    const etag_matches = sha256 && etag
      ? etag.replace(/"/g, "").toLowerCase().includes(sha256.slice(0, 16).toLowerCase())
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
      severity: Number.isFinite(par_status_num) && par_status_num >= 400 ? "error" : "info",
      action_type: "c2c.ingest_verified",
      source: "edge",
      user_id,
      duration_ms,
      error_message: Number.isFinite(par_status_num) && par_status_num >= 400 ? `PAR HTTP ${par_status}` : null,
      extra: {
        file_name,
        size_bytes,
        sha256,
        etag,
        etag_matches,
        workspace_id,
        production_banner,
        category,
        ingest_path,
        transport,
        par_status,
        ua: (req.headers.get("user-agent") ?? "").slice(0, 256),
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
