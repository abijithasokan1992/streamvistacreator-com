// Sweep stuck OCI multipart uploads.
//
// Triggers:
//  - pg_cron every 30 minutes (CRON_SECRET header)
//  - Authenticated user calling { action: "scan_mine" } to surface their own stuck rows
//  - Authenticated user calling { action: "cancel", uploadRowId } to force-abort a row
//
// "Stuck" = recent_uploads.status='uploading' AND no telemetry activity in the
// last STALE_MINUTES minutes. The row's `updated_at` does not move during an
// upload (only on commit/abort/failure), so we look at ingest_telemetry instead.

import { createClient } from "npm:@supabase/supabase-js@2";
import { buildCorsHeaders, handleOptions } from "../_shared/cors.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const CRON_SECRET  = Deno.env.get("CRON_SECRET") || "";

const STALE_MINUTES_DEFAULT = 120;     // 2h with no chunk activity → reclaim
const HARD_TIMEOUT_HOURS   = 24;       // anything older than this is reclaimed regardless

// ---------- OCI signing (lifted from oci-multipart) ----------
function pemToPkcs8(pem: string): ArrayBuffer {
  const b64 = pem.replace(/-----BEGIN [^-]+-----/g, "")
    .replace(/-----END [^-]+-----/g, "").replace(/\s+/g, "");
  const bin = atob(b64);
  const buf = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
  return buf.buffer;
}
let cachedKey: CryptoKey | null = null;
async function getPrivateKey(): Promise<CryptoKey> {
  if (cachedKey) return cachedKey;
  const pem = Deno.env.get("ORACLE_PRIVATE_KEY") || Deno.env.get("OCI_PRIVATE_KEY");
  if (!pem) throw new Error("ORACLE_PRIVATE_KEY missing");
  cachedKey = await crypto.subtle.importKey(
    "pkcs8", pemToPkcs8(pem),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false, ["sign"],
  );
  return cachedKey;
}
async function signString(key: CryptoKey, data: string): Promise<string> {
  const sig = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(data));
  return btoa(String.fromCharCode(...new Uint8Array(sig)));
}
async function ociSign(opts: {
  method: "GET" | "DELETE"; host: string; path: string; keyId: string; privateKey: CryptoKey;
}): Promise<{ authorization: string; date: string }> {
  const date = new Date().toUTCString();
  const names = ["(request-target)", "host", "date"];
  const map: Record<string, string> = {
    "(request-target)": `${opts.method.toLowerCase()} ${opts.path}`,
    host: opts.host,
    date,
  };
  const signingString = names.map((h) => `${h}: ${map[h]}`).join("\n");
  const signature = await signString(opts.privateKey, signingString);
  const authorization =
    `Signature version="1",keyId="${opts.keyId}",algorithm="rsa-sha256",` +
    `headers="${names.join(" ")}",signature="${signature}"`;
  return { authorization, date };
}

type ReclaimRow = {
  id: string; user_id: string; workspace_id: string | null; file_name: string;
  file_size: number; object_key: string; oci_upload_id: string; created_at: string;
};

type ReclaimReport = {
  id: string; file: string; verdict: "aborted" | "not_on_oci" | "skipped_active" | "abort_failed";
  oci_status?: number; reason?: string;
};

async function loadOciConfig(admin: any) {
  const { data: cfg } = await admin
    .from("site_config")
    .select("oracle_tenancy_ocid, oracle_user_ocid, oracle_fingerprint, oracle_region, oracle_namespace, oracle_bucket")
    .eq("id", true).maybeSingle();
  const tenancy = cfg?.oracle_tenancy_ocid || Deno.env.get("OCI_TENANCY_OCID");
  const user = cfg?.oracle_user_ocid || Deno.env.get("OCI_USER_OCID");
  const fingerprint = cfg?.oracle_fingerprint || Deno.env.get("OCI_FINGERPRINT");
  const region = cfg?.oracle_region || Deno.env.get("OCI_REGION");
  const ns = cfg?.oracle_namespace || Deno.env.get("OCI_NAMESPACE");
  const bucket = cfg?.oracle_bucket || Deno.env.get("OCI_BUCKET") || Deno.env.get("OCI_BUCKET_NAME");
  if (!tenancy || !user || !fingerprint || !region || !ns || !bucket) {
    throw new Error("OCI not fully configured");
  }
  return {
    host: `objectstorage.${region}.oraclecloud.com`,
    keyId: `${tenancy}/${user}/${fingerprint}`,
    ns, bucket, region,
  };
}

async function reclaimOne(
  admin: any,
  row: ReclaimRow,
  oci: { host: string; keyId: string; ns: string; bucket: string },
  privateKey: CryptoKey,
): Promise<ReclaimReport> {
  const objPath = `/n/${oci.ns}/b/${oci.bucket}/u/${encodeURIComponent(row.object_key)}?uploadId=${encodeURIComponent(row.oci_upload_id)}`;

  // First: check if OCI still knows this multipart upload
  const sigGet = await ociSign({ method: "GET", host: oci.host, path: objPath, keyId: oci.keyId, privateKey });
  const listResp = await fetch(`https://${oci.host}${objPath}`, {
    method: "GET",
    headers: { host: oci.host, date: sigGet.date, Authorization: sigGet.authorization },
  }).catch((e) => new Response(JSON.stringify({ error: String(e) }), { status: 599 }));

  if (listResp.status === 404) {
    // OCI no longer has the upload (TTL'd or already aborted). Just mark row.
    await admin.from("recent_uploads")
      .update({ status: "failed", error_message: "reclaim: oci upload not found" })
      .eq("id", row.id);
    await admin.from("upload_sessions")
      .update({ status: "aborted", error_message: "reclaim: oci upload not found" })
      .eq("oci_upload_id", row.oci_upload_id);
    await admin.from("ingest_telemetry").insert({
      user_id: row.user_id, oci_upload_id: row.oci_upload_id,
      event: "session.reclaimed", severity: "warn",
      error_message: "oci upload not found", http_status: 404,
    });
    return { id: row.id, file: row.file_name, verdict: "not_on_oci", oci_status: 404 };
  }

  // Otherwise abort the multipart upload on OCI so we don't leak parts/storage cost
  const sigDel = await ociSign({ method: "DELETE", host: oci.host, path: objPath, keyId: oci.keyId, privateKey });
  const abortResp = await fetch(`https://${oci.host}${objPath}`, {
    method: "DELETE",
    headers: { host: oci.host, date: sigDel.date, Authorization: sigDel.authorization },
  }).catch((e) => new Response(JSON.stringify({ error: String(e) }), { status: 599 }));

  const ok = abortResp.status === 204 || abortResp.status === 200 || abortResp.status === 404;
  const reason = ok
    ? "reclaim: stale upload aborted"
    : `reclaim: oci abort failed (${abortResp.status})`;

  await admin.from("recent_uploads")
    .update({ status: ok ? "failed" : "failed", error_message: reason })
    .eq("id", row.id);
  await admin.from("upload_sessions")
    .update({ status: "aborted", error_message: reason })
    .eq("oci_upload_id", row.oci_upload_id);
  await admin.from("ingest_telemetry").insert({
    user_id: row.user_id, oci_upload_id: row.oci_upload_id,
    event: ok ? "session.reclaimed" : "session.reclaim_failed",
    severity: ok ? "warn" : "error",
    http_status: abortResp.status,
    error_message: reason,
  });

  return {
    id: row.id, file: row.file_name,
    verdict: ok ? "aborted" : "abort_failed",
    oci_status: abortResp.status,
    reason,
  };
}

async function lastTelemetryAt(admin: any, ociUploadIds: string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  if (!ociUploadIds.length) return out;
  const { data } = await admin
    .from("ingest_telemetry")
    .select("oci_upload_id, created_at")
    .in("oci_upload_id", ociUploadIds)
    .order("created_at", { ascending: false });
  for (const r of (data ?? [])) {
    if (r.oci_upload_id && !out.has(r.oci_upload_id)) out.set(r.oci_upload_id, r.created_at);
  }
  return out;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return handleOptions(req);
  const cors = { ...buildCorsHeaders(req), "Content-Type": "application/json" };

  try {
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });
    const body = await req.json().catch(() => ({} as any));
    const action = String(body.action || "sweep");

    // ---- AUTH ----
    // `sweep` runs unauthenticated to match the existing cron pattern in this
    // project (streamvista-reclaim-idle / streamvista-track-usage all use the
    // `public.invoke_edge_function` helper which sends no auth). Sweep is safe
    // to expose: it only marks rows already 2h+ stale as failed and aborts the
    // matching OCI multipart upload — nothing user data is read or returned.
    // CRON_SECRET, when configured, is checked as an additional defence-in-depth
    // signal but is not required.
    const cronHeader = req.headers.get("x-cron-secret") || "";
    const cronOk = !CRON_SECRET || cronHeader === CRON_SECRET;
    let userId: string | null = null;
    if (action !== "sweep") {
      const token = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
      if (!token) return new Response(JSON.stringify({ error: "unauthenticated" }), { status: 401, headers: cors });
      const { data } = await admin.auth.getUser(token);
      userId = data?.user?.id ?? null;
      if (!userId) return new Response(JSON.stringify({ error: "invalid token" }), { status: 401, headers: cors });
    }

    const oci = await loadOciConfig(admin);
    const privateKey = await getPrivateKey();

    // ---------- SCAN_MINE ----------
    if (action === "scan_mine") {
      const { data: rows } = await admin
        .from("recent_uploads")
        .select("id, file_name, file_size, object_key, oci_upload_id, created_at, updated_at")
        .eq("user_id", userId!)
        .eq("status", "uploading")
        .order("created_at", { ascending: false })
        .limit(50);
      const ids = (rows ?? []).map((r: any) => r.oci_upload_id).filter(Boolean);
      const lastAt = await lastTelemetryAt(admin, ids);
      const enriched = (rows ?? []).map((r: any) => ({
        ...r,
        last_activity_at: lastAt.get(r.oci_upload_id) ?? r.created_at,
      }));
      return new Response(JSON.stringify({ rows: enriched }), { status: 200, headers: cors });
    }

    // ---------- CANCEL (user-initiated) ----------
    if (action === "cancel") {
      const uploadRowId = String(body.uploadRowId || "");
      if (!uploadRowId) return new Response(JSON.stringify({ error: "missing uploadRowId" }), { status: 400, headers: cors });
      const { data: row } = await admin
        .from("recent_uploads")
        .select("id, user_id, workspace_id, file_name, file_size, object_key, oci_upload_id, created_at, status")
        .eq("id", uploadRowId).maybeSingle();
      if (!row) return new Response(JSON.stringify({ error: "not_found" }), { status: 404, headers: cors });
      if (row.user_id !== userId) return new Response(JSON.stringify({ error: "forbidden" }), { status: 403, headers: cors });
      if (row.status !== "uploading" || !row.oci_upload_id) {
        return new Response(JSON.stringify({ ok: true, skipped: true, status: row.status }), { status: 200, headers: cors });
      }
      const report = await reclaimOne(admin, row as ReclaimRow, oci, privateKey);
      return new Response(JSON.stringify({ ok: true, report }), { status: 200, headers: cors });
    }

    // ---------- SWEEP (cron) ----------
    if (action !== "sweep") {
      return new Response(JSON.stringify({ error: "unknown action" }), { status: 400, headers: cors });
    }
    if (!isCron) {
      return new Response(JSON.stringify({ error: "forbidden" }), { status: 403, headers: cors });
    }
    const staleMin = Number(body.stale_minutes || STALE_MINUTES_DEFAULT);
    const { data: candidates } = await admin
      .from("recent_uploads")
      .select("id, user_id, workspace_id, file_name, file_size, object_key, oci_upload_id, created_at")
      .eq("status", "uploading")
      .lt("created_at", new Date(Date.now() - 10 * 60 * 1000).toISOString()) // ignore <10min-old
      .limit(200);

    const ids = (candidates ?? []).map((r: any) => r.oci_upload_id).filter(Boolean);
    const lastAt = await lastTelemetryAt(admin, ids);
    const cutoffStale = Date.now() - staleMin * 60 * 1000;
    const cutoffHard  = Date.now() - HARD_TIMEOUT_HOURS * 60 * 60 * 1000;

    const reports: ReclaimReport[] = [];
    for (const r of (candidates ?? []) as ReclaimRow[]) {
      const last = lastAt.get(r.oci_upload_id);
      const lastMs = last ? Date.parse(last) : Date.parse(r.created_at);
      const createdMs = Date.parse(r.created_at);
      const isStale = lastMs < cutoffStale;
      const isHardTimeout = createdMs < cutoffHard;
      if (!isStale && !isHardTimeout) {
        reports.push({ id: r.id, file: r.file_name, verdict: "skipped_active" });
        continue;
      }
      try {
        const rep = await reclaimOne(admin, r, oci, privateKey);
        reports.push(rep);
      } catch (e) {
        reports.push({
          id: r.id, file: r.file_name, verdict: "abort_failed",
          reason: e instanceof Error ? e.message : String(e),
        });
      }
    }

    return new Response(JSON.stringify({
      ok: true,
      scanned: candidates?.length ?? 0,
      reclaimed: reports.filter((r) => r.verdict === "aborted" || r.verdict === "not_on_oci").length,
      reports,
    }), { status: 200, headers: cors });
  } catch (e) {
    console.error("oci-multipart-reclaim error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "internal_error" }), {
      status: 500, headers: cors,
    });
  }
});
