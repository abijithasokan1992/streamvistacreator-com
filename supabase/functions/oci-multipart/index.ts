// Resumable Multipart Upload for OCI Object Storage.
//
// This function never streams the file itself — it only signs OCI requests
// server-side so the browser can PUT each chunk directly to Object Storage.
// That keeps the edge runtime inside its CPU/wall-clock budget regardless of
// file size and gives us native chunk-level retries via standard HTTP.
//
// Actions (POST JSON, action field):
//   init        → create multipart upload, returns uploadId + objectKey + uploadRowId
//   sign_part   → returns signed Authorization headers for PUT of one part
//                  (client sends sha256 of the chunk + partNumber + size)
//   list_parts  → returns parts already uploaded to OCI for the uploadId
//                  (used to resume an interrupted upload)
//   complete    → commits the multipart upload with the parts list
//   abort       → aborts the multipart upload and marks the row failed
//
// All requests require a valid Supabase JWT. Workspace membership and writer
// role are enforced for init/complete/abort, matching the single-shot path.

import { createClient } from "npm:@supabase/supabase-js@2";
import { buildCorsHeaders, handleOptions } from "../_shared/cors.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const MAX_BYTES = 50 * 1024 * 1024 * 1024;        // 50 GB hard ceiling (global safety)
const MIN_PART  = 5  * 1024 * 1024;                // OCI minimum 5 MB (last part exempt)
const MAX_PART  = 50 * 1024 * 1024;                // 50 MB per part recommended

// ---------- Phase 3: Server-side category limits (bytes) ----------
// Caps stay <= MAX_BYTES until the global ceiling is intentionally raised.
const GB = 1024 * 1024 * 1024;
const MB = 1024 * 1024;
const CATEGORY_LIMITS: Record<string, number> = {
  trailer: 5 * GB,
  feature_film: 50 * GB,
  master: 50 * GB,         // target 250GB after global lift
  prores: 50 * GB,         // target 500GB after global lift
  dcp: 50 * GB,            // target 500GB after global lift
  poster: 500 * MB,
  artwork: 500 * MB,
  subtitle: 50 * MB,
  captions: 50 * MB,
  censor_certificate: 200 * MB,
  censor_cert: 200 * MB,
  ownership_documents: 500 * MB,
  ownership: 500 * MB,
  legal: 200 * MB,
  sales: 500 * MB,
  audio: 5 * GB,
  audio_tracks: 5 * GB,
};

// ---------- Phase 4: Server-derived prefix map (no client trust) ----------
const CATEGORY_PREFIX: Record<string, string> = {
  trailer: "trailers",
  feature_film: "masters",
  master: "masters",
  prores: "prores",
  dcp: "dcp",
  poster: "artwork",
  artwork: "artwork",
  subtitle: "subtitles",
  captions: "subtitles",
  censor_certificate: "documents",
  censor_cert: "documents",
  ownership_documents: "documents",
  ownership: "documents",
  legal: "documents",
  sales: "documents",
  audio: "documents",
  audio_tracks: "documents",
};

// ---------- Phase 7: Plan-level total storage quotas (bytes) ----------
const TB = 1024 * GB;
const PLAN_QUOTA: Record<string, number> = {
  free: 100 * GB,
  creator: 1 * TB,
  monthly: 5 * TB,
  quarterly: 5 * TB,
  yearly: 5 * TB,
};
function planQuotaBytes(planTier: string | null | undefined, topupTb: number | null | undefined): number {
  const base = PLAN_QUOTA[String(planTier || "free").toLowerCase()] ?? PLAN_QUOTA.free;
  const topup = Math.max(0, Number(topupTb || 0)) * TB;
  return base + topup;
}

// ---------- OCI signing helpers ----------

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
  if (!pem) throw new Error("ORACLE_PRIVATE_KEY/OCI_PRIVATE_KEY missing");
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

async function sha256B64Bytes(bytes: Uint8Array): Promise<string> {
  const d = await crypto.subtle.digest("SHA-256", bytes);
  return btoa(String.fromCharCode(...new Uint8Array(d)));
}

/** Build an OCI v1 Signature for a request the client will issue. */
async function buildOciSignature(opts: {
  method: "GET" | "PUT" | "POST" | "DELETE";
  host: string;
  path: string;            // includes query string when present
  contentSha256: string;   // base64 SHA-256 of body ("" SHA for empty)
  contentType?: string;
  contentLength?: number;
  keyId: string;
  privateKey: CryptoKey;
  dateHeader?: "date" | "x-date";
}): Promise<{ authorization: string; headers: Record<string, string>; date: string }> {
  const { method, host, path, contentSha256, contentType, contentLength, keyId, privateKey } = opts;
  const dateHeader = opts.dateHeader ?? "date";
  const date = new Date().toUTCString();
  const isBodyMethod = method === "PUT" || method === "POST";

  const headers: Record<string, string> = {
    "(request-target)": `${method.toLowerCase()} ${path}`,
    host,
    [dateHeader]: date,
  };
  const names = ["(request-target)", "host", dateHeader];

  if (isBodyMethod) {
    headers["x-content-sha256"] = contentSha256;
    headers["content-type"] = contentType ?? "application/octet-stream";
    headers["content-length"] = String(contentLength ?? 0);
    names.push("x-content-sha256", "content-type", "content-length");
  }

  const signingString = names.map((h) => `${h}: ${headers[h]}`).join("\n");
  const signature = await signString(privateKey, signingString);
  const authorization =
    `Signature version="1",keyId="${keyId}",algorithm="rsa-sha256",` +
    `headers="${names.join(" ")}",signature="${signature}"`;

  return { authorization, headers, date };
}

// Empty body SHA-256 (used for POST commit if body is sent inline, etc.)
const EMPTY_SHA256_B64 = "47DEQpj8HBSa+/TImW+5JCeuQeRkm5NMpJWZG3hSuFU=";

function safeName(name: string): string {
  return name.replace(/[^\w.\-]+/g, "_").slice(0, 120);
}

// ---------- telemetry ----------

async function logIngest(admin: any, evt: {
  user_id?: string | null; session_id?: string | null; oci_upload_id?: string | null;
  part_number?: number | null; event: string;
  severity?: "info" | "warn" | "error";
  duration_ms?: number | null; bytes?: number | null;
  http_status?: number | null; error_message?: string | null;
  metadata?: Record<string, unknown> | null;
}) {
  try {
    await admin.from("ingest_telemetry").insert({
      user_id: evt.user_id ?? null,
      session_id: evt.session_id ?? null,
      oci_upload_id: evt.oci_upload_id ?? null,
      part_number: evt.part_number ?? null,
      event: evt.event,
      severity: evt.severity ?? "info",
      duration_ms: evt.duration_ms ?? null,
      bytes: evt.bytes ?? null,
      http_status: evt.http_status ?? null,
      error_message: evt.error_message ?? null,
      metadata: evt.metadata ?? null,
    });
  } catch { /* never block the upload on a logging failure */ }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return handleOptions(req);
  const cors = { ...buildCorsHeaders(req), "Content-Type": "application/json" };


  try {
    const token = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
    if (!token) return json({ error: "unauthenticated" }, 401, cors);

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });
    const { data: userRes } = await admin.auth.getUser(token);
    const userId = userRes?.user?.id;
    if (!userId) return json({ error: "invalid token" }, 401, cors);

    const body = await req.json().catch(() => ({}));
    const action = String(body.action || "");

    // Load OCI config once per request
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
      return json({ error: "OCI not fully configured" }, 500, cors);
    }
    const host = `objectstorage.${region}.oraclecloud.com`;
    const keyId = `${tenancy}/${user}/${fingerprint}`;
    const privateKey = await getPrivateKey();

    // -------- LOOKUP (cross-device resume by SHA-256) --------
    if (action === "lookup") {
      const fileSha256 = String(body.fileSha256 || "").trim();
      if (!fileSha256) return json({ error: "missing fileSha256" }, 400, cors);
      const { data: sess } = await admin
        .from("upload_sessions")
        .select("id, file_name, file_size, mime_type, object_key, oci_upload_id, total_chunks, uploaded_parts, status, workspace_id, updated_at")
        .eq("user_id", userId)
        .eq("file_sha256", fileSha256)
        .in("status", ["pending", "processing"])
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!sess || !sess.oci_upload_id) return json({ found: false }, 200, cors);

      // Confirm with OCI which parts are actually stored.
      const path = `/n/${ns}/b/${bucket}/u/${encodeURIComponent(sess.object_key)}?uploadId=${encodeURIComponent(sess.oci_upload_id)}`;
      const sig = await buildOciSignature({ method: "GET", host, path, contentSha256: "", keyId, privateKey });
      const resp = await fetch(`https://${host}${path}`, {
        method: "GET", headers: { host, date: sig.date, Authorization: sig.authorization },
      });
      const text = await resp.text();
      let parts: Array<{ partNumber: number; etag: string; size?: number }> = [];
      if (resp.ok) {
        try {
          const arr = JSON.parse(text);
          if (Array.isArray(arr)) {
            parts = arr.map((p: any) => ({
              partNumber: Number(p.partNumber ?? p.uploadPartNum ?? p.part_num),
              etag: String(p.etag ?? p.ETag ?? "").replace(/^"|"$/g, ""),
              size: typeof p.size === "number" ? p.size : undefined,
            })).filter((p) => Number.isInteger(p.partNumber) && p.etag);
          }
        } catch { /* ignore */ }
      }
      const nextPart = (parts.reduce((m, p) => Math.max(m, p.partNumber), 0) || 0) + 1;
      await logIngest(admin, {
        user_id: userId, session_id: sess.id, oci_upload_id: sess.oci_upload_id,
        event: "session.resumed", severity: "info",
        metadata: { parts_already_uploaded: parts.length, next_part: nextPart },
      });
      return json({
        found: true,
        session: sess,
        bucket, namespace: ns, region,
        partSize: MAX_PART,
        partsAlreadyUploaded: parts,
        nextPartNumber: nextPart,
      }, 200, cors);
    }

    // -------- INIT --------
    if (action === "init") {
      const fileName = String(body.fileName || "").trim();
      const fileSize = Number(body.fileSize || 0);
      const mime = String(body.mimeType || "application/octet-stream");
      const workspaceId = String(body.workspaceId || "").trim();
      const pendingId = body.pendingId ? String(body.pendingId).slice(0, 80) : null;
      const projectIdRaw = body.projectId ? String(body.projectId) : "";
      const categoryRaw = body.category ? String(body.category) : "";
      const subpathRaw = body.subpath ? String(body.subpath) : "";
      const titleIdRaw = body.titleId ? String(body.titleId).trim() : "";

      if (!fileName) return json({ error: "missing fileName" }, 400, cors);
      if (!workspaceId) return json({ error: "missing workspaceId" }, 400, cors);
      if (!fileSize || fileSize <= 0) return json({ error: "missing fileSize" }, 400, cors);
      if (fileSize > MAX_BYTES) return json({ error: `file exceeds ${MAX_BYTES} bytes` }, 413, cors);

      const { data: membership } = await admin
        .from("workspace_members").select("role")
        .eq("workspace_id", workspaceId).eq("user_id", userId).maybeSingle();
      if (!membership || !["owner", "admin", "editor"].includes(membership.role)) {
        return json({ error: "forbidden_workspace" }, 403, cors);
      }

      // ---------- Phase 3: per-category limit ----------
      const catKey = categoryRaw.trim().toLowerCase().replace(/[^a-z0-9_-]/g, "");
      if (titleIdRaw) {
        if (!catKey || !(catKey in CATEGORY_LIMITS)) {
          return json({ error: `invalid category '${categoryRaw}'` }, 400, cors);
        }
        const catLimit = CATEGORY_LIMITS[catKey];
        if (fileSize > catLimit) {
          return json({
            error: `Upload Failed — ${catKey} exceeds category limit (${Math.round(catLimit / GB * 10) / 10} GB)`,
            limitBytes: catLimit,
          }, 413, cors);
        }
      } else if (catKey && CATEGORY_LIMITS[catKey] && fileSize > CATEGORY_LIMITS[catKey]) {
        return json({
          error: `Upload Failed — ${catKey} exceeds category limit`,
          limitBytes: CATEGORY_LIMITS[catKey],
        }, 413, cors);
      }

      // ---------- Phase 7: total storage quota ----------
      const { data: prof } = await admin
        .from("user_profiles")
        .select("plan_tier, topup_tb")
        .eq("user_id", userId)
        .maybeSingle();
      const quota = planQuotaBytes(prof?.plan_tier, prof?.topup_tb);
      const { data: usedRows } = await admin
        .from("recent_uploads")
        .select("file_size")
        .eq("user_id", userId)
        .in("status", ["uploading", "uploaded", "verified", "ready", "completed", "done"]);
      const usedBytes = (usedRows ?? []).reduce(
        (sum: number, r: any) => sum + (Number(r.file_size) || 0),
        0,
      );
      if (usedBytes + fileSize > quota) {
        return json({
          error: `Upload Failed — storage quota exceeded (${Math.round(quota / GB)} GB total)`,
          quotaBytes: quota,
          usedBytes,
        }, 413, cors);
      }

      // Idempotent resume: if a prior row exists for the same pendingId and it
      // is still in "uploading" status with an oci_upload_id stored in metadata,
      // hand back the same uploadId so the client can resume.
      if (pendingId) {
        const { data: existing } = await admin
          .from("recent_uploads")
          .select("id, object_key, status, oci_upload_id")
          .eq("user_id", userId)
          .eq("workspace_id", workspaceId)
          .eq("client_pending_id", pendingId)
          .maybeSingle();
        if (existing) {
          if (existing.status === "uploaded") {
            const { data: full } = await admin
              .from("recent_uploads").select("*").eq("id", existing.id).single();
            return json({ idempotent: true, upload: full }, 200, cors);
          }
          if (existing.oci_upload_id && existing.object_key) {
            return json({
              resumed: true,
              uploadRowId: existing.id,
              uploadId: existing.oci_upload_id,
              objectKey: existing.object_key,
              bucket, namespace: ns, region,
              partSize: MAX_PART,
            }, 200, cors);
          }
        }
      }

      // ---------- Phase 4: server-derived object key ----------
      // Title uploads: users/{userId}/titles/{titleId}/{prefix}/...
      // Legacy non-title uploads keep the previous workspace/project layout.
      let objectKey: string;
      let categorySegment = "ingest";
      let projectSegment = "";

      if (titleIdRaw) {
        // Verify title ownership (server-side; never trust client subpath).
        const { data: t } = await admin
          .from("content_titles")
          .select("id, owner_user_id, workspace_id")
          .eq("id", titleIdRaw)
          .maybeSingle();
        if (!t || (t.owner_user_id !== userId)) {
          return json({ error: "forbidden_title" }, 403, cors);
        }
        const prefix = CATEGORY_PREFIX[catKey] ?? "documents";
        objectKey = `users/${userId}/titles/${titleIdRaw}/${prefix}/${Date.now()}-${crypto.randomUUID()}-${safeName(fileName)}`;
        categorySegment = catKey;
      } else {
        // Legacy path (unchanged) for non-title workflows.
        if (projectIdRaw) {
          const { data: proj } = await admin.from("projects")
            .select("id, workspace_id, foldering_mode_archive, foldering_mode_raw")
            .eq("id", projectIdRaw).maybeSingle();
          if (proj && proj.workspace_id === workspaceId) {
            projectSegment = `projects/${proj.id}/`;
            if (catKey) categorySegment = catKey;
            const manual =
              (catKey === "raw" && proj.foldering_mode_raw === "manual") ||
              (catKey === "archive" && proj.foldering_mode_archive === "manual");
            if (manual && subpathRaw.trim()) {
              const clean = subpathRaw.trim().replace(/^\/+|\/+$/g, "").replace(/[^\w./-]+/g, "_").slice(0, 200);
              if (clean) categorySegment = clean;
            }
          }
        }
        objectKey = `workspaces/${workspaceId}/${projectSegment}${categorySegment}/users/${userId}/${Date.now()}-${crypto.randomUUID()}-${safeName(fileName)}`;
      }



      // Create multipart upload on OCI:
      //   POST /n/{ns}/b/{bucket}/u  body: {"object":"...","contentType":"..."}
      const createBody = JSON.stringify({ object: objectKey, contentType: mime });
      const createBytes = new TextEncoder().encode(createBody);
      const createSha = await sha256B64Bytes(createBytes);
      const createPath = `/n/${ns}/b/${bucket}/u`;
      const sig = await buildOciSignature({
        method: "POST", host, path: createPath,
        contentSha256: createSha, contentType: "application/json",
        contentLength: createBytes.byteLength, keyId, privateKey,
      });
      const createResp = await fetch(`https://${host}${createPath}`, {
        method: "POST",
        headers: {
          host, date: sig.date,
          Authorization: sig.authorization,
          "x-content-sha256": createSha,
          "content-type": "application/json",
          "content-length": String(createBytes.byteLength),
        },
        body: createBytes,
      });
      const createText = await createResp.text();
      if (!createResp.ok) {
        return json({ error: `OCI create-multipart failed (${createResp.status})`, detail: createText.slice(0, 400) }, 502, cors);
      }
      let parsed: any = {};
      try { parsed = JSON.parse(createText); } catch { /* ignore */ }
      const uploadId: string | undefined = parsed.uploadId || parsed.upload_id;
      if (!uploadId) return json({ error: "OCI did not return uploadId", detail: createText.slice(0, 400) }, 502, cors);

      // Persist row with status=uploading + the OCI uploadId for resume support.
      const insertPayload: Record<string, unknown> = {
        user_id: userId,
        workspace_id: workspaceId,
        file_name: fileName,
        file_size: fileSize,
        mime_type: mime,
        bucket, namespace: ns, region,
        object_key: objectKey,
        status: "uploading",
        client_pending_id: pendingId,
        project_id: projectSegment ? projectIdRaw : null,
        category: projectSegment ? categorySegment : null,
        oci_upload_id: uploadId,
      };
      const { data: inserted, error: insErr } = await admin
        .from("recent_uploads").insert(insertPayload)
        .select("id").single();
      if (insErr || !inserted) {
        console.error("recent_uploads insert failed:", insErr);
        // Best-effort abort the OCI upload so we don't leak parts.
        await abortMultipart({ host, ns, bucket, objectKey, uploadId, keyId, privateKey }).catch(() => {});
        return json({ error: "INTERNAL_SERVER_ERROR", code: 500 }, 500, cors);
      }

      // Mirror into upload_sessions for cross-device SHA-256 resume.
      const fileSha256 = body.fileSha256 ? String(body.fileSha256).slice(0, 128) : null;
      const totalChunks = Number(body.totalChunks || 0) || null;
      const { data: sess } = await admin.from("upload_sessions").insert({
        user_id: userId,
        workspace_id: workspaceId,
        file_name: fileName,
        file_size: fileSize,
        file_sha256: fileSha256,
        mime_type: mime,
        oci_upload_id: uploadId,
        object_key: objectKey,
        total_chunks: totalChunks,
        status: "processing",
      }).select("id").single();

      await logIngest(admin, {
        user_id: userId, session_id: sess?.id ?? null, oci_upload_id: uploadId,
        event: "session.init", severity: "info",
        bytes: fileSize, metadata: { file_name: fileName, total_chunks: totalChunks },
      });

      return json({
        uploadRowId: inserted.id,
        sessionId: sess?.id ?? null,
        uploadId,
        objectKey,
        bucket, namespace: ns, region,
        partSize: MAX_PART,
        minPart: MIN_PART,
      }, 200, cors);
    }


    // -------- SIGN PART --------
    if (action === "sign_part") {
      const uploadRowId = String(body.uploadRowId || "");
      const uploadId = String(body.uploadId || "");
      const partNumber = Number(body.partNumber || 0);
      const contentSha256 = String(body.contentSha256 || ""); // base64 SHA-256 of the chunk
      const contentLength = Number(body.contentLength || 0);

      if (!uploadRowId || !uploadId) return json({ error: "missing uploadRowId/uploadId" }, 400, cors);
      if (!Number.isInteger(partNumber) || partNumber < 1 || partNumber > 10000) {
        return json({ error: "invalid partNumber" }, 400, cors);
      }
      if (!contentSha256 || !contentLength) return json({ error: "missing contentSha256/contentLength" }, 400, cors);
      if (contentLength > MAX_PART) return json({ error: `part exceeds ${MAX_PART}` }, 400, cors);

      const { data: row } = await admin.from("recent_uploads")
        .select("user_id, object_key, oci_upload_id, status")
        .eq("id", uploadRowId).maybeSingle();
      if (!row || row.user_id !== userId) return json({ error: "not_found" }, 404, cors);
      if (row.oci_upload_id !== uploadId) return json({ error: "uploadId mismatch" }, 400, cors);
      if (row.status === "uploaded") return json({ error: "already complete" }, 409, cors);

      const objectKey = row.object_key;
      const path = `/n/${ns}/b/${bucket}/u/${encodeURIComponent(objectKey)}?uploadId=${encodeURIComponent(uploadId)}&uploadPartNum=${partNumber}`;
      const sig = await buildOciSignature({
        method: "PUT", host, path,
        contentSha256, contentType: "application/octet-stream",
        contentLength, keyId, privateKey,
        dateHeader: "x-date",
      });

      await logIngest(admin, {
        user_id: userId, oci_upload_id: uploadId, part_number: partNumber,
        event: "part.signed", severity: "info", bytes: contentLength,
      });

      return json({
        url: `https://${host}${path}`,
        method: "PUT",
        headers: {
          host,
          "x-date": sig.date,
          Authorization: sig.authorization,
          "x-content-sha256": contentSha256,
          "content-type": "application/octet-stream",
        },
        expires_in: 300,
      }, 200, cors);
    }

    // -------- REPORT PART (client tells us a part finished or failed) --------
    if (action === "report_part") {
      const uploadId = String(body.uploadId || "");
      const partNumber = Number(body.partNumber || 0);
      const ok = body.ok !== false;
      const httpStatus = body.httpStatus ? Number(body.httpStatus) : null;
      const durationMs = body.durationMs ? Number(body.durationMs) : null;
      const bytes = body.bytes ? Number(body.bytes) : null;
      const errorMessage = body.error ? String(body.error).slice(0, 500) : null;
      if (!uploadId || !Number.isInteger(partNumber)) return json({ error: "bad input" }, 400, cors);
      await logIngest(admin, {
        user_id: userId, oci_upload_id: uploadId, part_number: partNumber,
        event: ok ? "part.completed" : "part.failed",
        severity: ok ? "info" : "error",
        http_status: httpStatus, duration_ms: durationMs, bytes,
        error_message: errorMessage,
      });
      return json({ ok: true }, 200, cors);
    }


    // -------- LIST PARTS --------
    if (action === "list_parts") {
      const uploadRowId = String(body.uploadRowId || "");
      const uploadId = String(body.uploadId || "");
      if (!uploadRowId || !uploadId) return json({ error: "missing uploadRowId/uploadId" }, 400, cors);

      const { data: row } = await admin.from("recent_uploads")
        .select("user_id, object_key, oci_upload_id")
        .eq("id", uploadRowId).maybeSingle();
      if (!row || row.user_id !== userId) return json({ error: "not_found" }, 404, cors);
      if (row.oci_upload_id !== uploadId) return json({ error: "uploadId mismatch" }, 400, cors);

      const path = `/n/${ns}/b/${bucket}/u/${encodeURIComponent(row.object_key)}?uploadId=${encodeURIComponent(uploadId)}`;
      const sig = await buildOciSignature({
        method: "GET", host, path, contentSha256: "", keyId, privateKey,
      });
      const resp = await fetch(`https://${host}${path}`, {
        method: "GET",
        headers: { host, date: sig.date, Authorization: sig.authorization },
      });
      const text = await resp.text();
      if (!resp.ok) return json({ error: `OCI list-parts ${resp.status}`, detail: text.slice(0, 400) }, 502, cors);
      let parts: Array<{ partNumber: number; etag: string; size?: number }> = [];
      try {
        const arr = JSON.parse(text);
        if (Array.isArray(arr)) {
          parts = arr.map((p: any) => ({
            partNumber: Number(p.partNumber ?? p.uploadPartNum ?? p.part_num),
            etag: String(p.etag ?? p.ETag ?? "").replace(/^"|"$/g, ""),
            size: typeof p.size === "number" ? p.size : undefined,
          })).filter((p) => Number.isInteger(p.partNumber) && p.etag);
        }
      } catch { /* leave empty */ }
      return json({ parts }, 200, cors);
    }

    // -------- COMPLETE --------
    if (action === "complete") {
      const uploadRowId = String(body.uploadRowId || "");
      const uploadId = String(body.uploadId || "");
      const parts = Array.isArray(body.parts) ? body.parts : [];
      if (!uploadRowId || !uploadId) return json({ error: "missing uploadRowId/uploadId" }, 400, cors);
      if (!parts.length) return json({ error: "missing parts" }, 400, cors);

      const { data: row } = await admin.from("recent_uploads")
        .select("user_id, object_key, oci_upload_id, status")
        .eq("id", uploadRowId).maybeSingle();
      if (!row || row.user_id !== userId) return json({ error: "not_found" }, 404, cors);
      if (row.oci_upload_id !== uploadId) return json({ error: "uploadId mismatch" }, 400, cors);
      if (row.status === "uploaded") {
        const { data: full } = await admin.from("recent_uploads").select("*").eq("id", uploadRowId).single();
        return json({ upload: full, idempotent: true }, 200, cors);
      }

      const partsToCommit = parts
        .map((p: any) => ({ partNum: Number(p.partNumber ?? p.partNum), etag: String(p.etag).replace(/^"|"$/g, "") }))
        .filter((p) => Number.isInteger(p.partNum) && p.etag)
        .sort((a, b) => a.partNum - b.partNum);
      if (partsToCommit.length !== parts.length) return json({ error: "invalid parts list" }, 400, cors);

      const commitBody = JSON.stringify({ partsToCommit });
      const commitBytes = new TextEncoder().encode(commitBody);
      const commitSha = await sha256B64Bytes(commitBytes);
      const path = `/n/${ns}/b/${bucket}/u/${encodeURIComponent(row.object_key)}?uploadId=${encodeURIComponent(uploadId)}`;
      const sig = await buildOciSignature({
        method: "POST", host, path,
        contentSha256: commitSha, contentType: "application/json",
        contentLength: commitBytes.byteLength, keyId, privateKey,
      });
      const resp = await fetch(`https://${host}${path}`, {
        method: "POST",
        headers: {
          host, date: sig.date,
          Authorization: sig.authorization,
          "x-content-sha256": commitSha,
          "content-type": "application/json",
          "content-length": String(commitBytes.byteLength),
        },
        body: commitBytes,
      });
      if (!resp.ok) {
        const text = await resp.text().catch(() => "");
        await admin.from("recent_uploads")
          .update({ status: "failed", error_message: `OCI commit ${resp.status}: ${text.slice(0, 400)}` })
          .eq("id", uploadRowId);
        return json({ error: `OCI commit failed (${resp.status})`, detail: text.slice(0, 400) }, 502, cors);
      }
      await resp.text().catch(() => "");
      const { data: updated } = await admin.from("recent_uploads")
        .update({ status: "uploaded", error_message: null })
        .eq("id", uploadRowId).select().single();
      await admin.from("upload_sessions")
        .update({ status: "completed", uploaded_parts: partsToCommit })
        .eq("user_id", userId).eq("oci_upload_id", uploadId);
      await logIngest(admin, {
        user_id: userId, oci_upload_id: uploadId,
        event: "session.completed", severity: "info",
        metadata: { parts: partsToCommit.length },
      });
      return json({ upload: updated }, 200, cors);
    }

    // -------- ABORT --------
    if (action === "abort") {
      const uploadRowId = String(body.uploadRowId || "");
      const uploadId = String(body.uploadId || "");
      if (!uploadRowId || !uploadId) return json({ error: "missing uploadRowId/uploadId" }, 400, cors);
      const { data: row } = await admin.from("recent_uploads")
        .select("user_id, object_key, oci_upload_id")
        .eq("id", uploadRowId).maybeSingle();
      if (!row || row.user_id !== userId) return json({ error: "not_found" }, 404, cors);
      if (row.oci_upload_id !== uploadId) return json({ error: "uploadId mismatch" }, 400, cors);

      const r = await abortMultipart({ host, ns, bucket, objectKey: row.object_key, uploadId, keyId, privateKey });
      await admin.from("recent_uploads")
        .update({ status: "failed", error_message: "aborted by user" })
        .eq("id", uploadRowId);
      await admin.from("upload_sessions")
        .update({ status: "aborted", error_message: "aborted by user" })
        .eq("user_id", userId).eq("oci_upload_id", uploadId);
      await logIngest(admin, {
        user_id: userId, oci_upload_id: uploadId,
        event: "session.aborted", severity: "warn", http_status: r.status,
      });
      return json({ ok: r.ok, status: r.status }, 200, cors);
    }


    return json({ error: "unknown action" }, 400, cors);
  } catch (e) {
    console.error("oci-multipart unhandled error:", e);
    return json({ error: "INTERNAL_SERVER_ERROR", code: 500 }, 500, cors);
  }
});

async function abortMultipart(opts: {
  host: string; ns: string; bucket: string; objectKey: string; uploadId: string;
  keyId: string; privateKey: CryptoKey;
}): Promise<Response> {
  const { host, ns, bucket, objectKey, uploadId, keyId, privateKey } = opts;
  const path = `/n/${ns}/b/${bucket}/u/${encodeURIComponent(objectKey)}?uploadId=${encodeURIComponent(uploadId)}`;
  const sig = await buildOciSignature({
    method: "DELETE", host, path, contentSha256: "", keyId, privateKey,
  });
  return await fetch(`https://${host}${path}`, {
    method: "DELETE",
    headers: { host, date: sig.date, Authorization: sig.authorization },
  });
}

function json(body: unknown, status: number, cors: Record<string, string>) {
  return new Response(JSON.stringify(body), { status, headers: cors });
}
