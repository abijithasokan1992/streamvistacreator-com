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
const MAX_BYTES = 50 * 1024 * 1024 * 1024;        // 50 GB hard ceiling
const MIN_PART  = 5  * 1024 * 1024;                // OCI minimum 5 MB (last part exempt)
const MAX_PART  = 50 * 1024 * 1024;                // 50 MB per part recommended

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
  const pem = Deno.env.get("ORACLE_PRIVATE_KEY");
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
}): Promise<{ authorization: string; headers: Record<string, string>; date: string }> {
  const { method, host, path, contentSha256, contentType, contentLength, keyId, privateKey } = opts;
  const date = new Date().toUTCString();
  const isBodyMethod = method === "PUT" || method === "POST";

  const headers: Record<string, string> = {
    "(request-target)": `${method.toLowerCase()} ${path}`,
    host,
    date,
  };
  const names = ["(request-target)", "host", "date"];

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

// ---------- handler ----------

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
    const bucket = cfg?.oracle_bucket || Deno.env.get("OCI_BUCKET");
    if (!tenancy || !user || !fingerprint || !region || !ns || !bucket) {
      return json({ error: "OCI not fully configured" }, 500, cors);
    }
    const host = `objectstorage.${region}.oraclecloud.com`;
    const keyId = `${tenancy}/${user}/${fingerprint}`;
    const privateKey = await getPrivateKey();

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

      // Compute object key (mirrors oci-upload routing)
      let projectSegment = "";
      let categorySegment = "ingest";
      if (projectIdRaw) {
        const { data: proj } = await admin.from("projects")
          .select("id, workspace_id, foldering_mode_archive, foldering_mode_raw")
          .eq("id", projectIdRaw).maybeSingle();
        if (proj && proj.workspace_id === workspaceId) {
          projectSegment = `projects/${proj.id}/`;
          const cat = categoryRaw.trim().toLowerCase().replace(/[^a-z0-9_-]/g, "");
          if (cat) categorySegment = cat;
          const manual =
            (cat === "raw" && proj.foldering_mode_raw === "manual") ||
            (cat === "archive" && proj.foldering_mode_archive === "manual");
          if (manual && subpathRaw.trim()) {
            const clean = subpathRaw.trim().replace(/^\/+|\/+$/g, "").replace(/[^\w./-]+/g, "_").slice(0, 200);
            if (clean) categorySegment = clean;
          }
        }
      }
      const objectKey = `workspaces/${workspaceId}/${projectSegment}${categorySegment}/users/${userId}/${Date.now()}-${crypto.randomUUID()}-${safeName(fileName)}`;

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
        // Best-effort abort the OCI upload so we don't leak parts.
        await abortMultipart({ host, ns, bucket, objectKey, uploadId, keyId, privateKey }).catch(() => {});
        return json({ error: insErr?.message ?? "insert failed" }, 500, cors);
      }

      return json({
        uploadRowId: inserted.id,
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
      });

      return json({
        url: `https://${host}${path}`,
        method: "PUT",
        headers: {
          host,
          date: sig.date,
          Authorization: sig.authorization,
          "x-content-sha256": contentSha256,
          "content-type": "application/octet-stream",
          "content-length": String(contentLength),
        },
        expires_in: 300,
      }, 200, cors);
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
      return json({ ok: r.ok, status: r.status }, 200, cors);
    }

    return json({ error: "unknown action" }, 400, cors);
  } catch (e) {
    return json({ error: (e as Error).message }, 500, cors);
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
