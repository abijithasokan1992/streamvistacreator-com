// Admin God Mode Asset Manager — full CRUD over user files in OCI + DB,
// plus signed share-link generation. Admin-only.
//
// Actions (POST JSON):
//   { action: "list", userId? }        → uploads (joined with user info)
//   { action: "list-users" }           → all users (id, email, name, plan, role)
//   { action: "delete", id }           → delete OCI object + DB row
//   { action: "rename", id, newName }  → copy OCI object + delete old + update DB
//   { action: "create-upload-par", userId, fileName, contentType }
//                                       → PAR write URL for upload-on-behalf
//   { action: "register-upload", userId, fileName, fileSize, mimeType, objectKey }
//                                       → insert recent_uploads row after PAR upload
//   { action: "create-share", id, expiresInHours?, maxDownloads? }
//                                       → insert shared_files row + return /s/:token URL
//   { action: "download-par", id, expiresInMinutes? }
//                                       → short-lived PAR read URL for preview/download

import { createClient } from "npm:@supabase/supabase-js@2";
import { buildCorsHeaders, handleOptions, resolveSiteOrigin } from "../_shared/cors.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

type SiteCfg = {
  oracle_tenancy_ocid: string | null;
  oracle_user_ocid: string | null;
  oracle_fingerprint: string | null;
  oracle_region: string | null;
  oracle_namespace: string | null;
  oracle_bucket: string | null;
  oracle_private_key: string | null;
};

function pemToPkcs8(pem: string): ArrayBuffer {
  const b64 = pem.replace(/-----BEGIN [^-]+-----/g, "")
    .replace(/-----END [^-]+-----/g, "").replace(/\s+/g, "");
  const bin = atob(b64);
  const buf = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
  return buf.buffer;
}
async function importPrivateKey(pem: string): Promise<CryptoKey> {
  return await crypto.subtle.importKey("pkcs8", pemToPkcs8(pem),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"]);
}
async function sha256B64(body: string | Uint8Array): Promise<string> {
  const bytes = typeof body === "string" ? new TextEncoder().encode(body) : body;
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return btoa(String.fromCharCode(...new Uint8Array(digest)));
}
async function signString(key: CryptoKey, data: string): Promise<string> {
  const sig = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(data));
  return btoa(String.fromCharCode(...new Uint8Array(sig)));
}
async function ociFetch(opts: {
  method: "GET" | "HEAD" | "POST" | "PUT" | "DELETE";
  host: string; path: string; body?: string; contentType?: string;
  keyId: string; privateKey: CryptoKey; extraHeaders?: Record<string, string>;
}): Promise<Response> {
  const { method, host, path, body, contentType, keyId, privateKey, extraHeaders } = opts;
  const date = new Date().toUTCString();
  const headersToSign: Record<string, string> = {
    "(request-target)": `${method.toLowerCase()} ${path}`,
    host, date,
  };
  let names = ["(request-target)", "host", "date"];
  if (body !== undefined && method !== "GET" && method !== "HEAD") {
    headersToSign["x-content-sha256"] = await sha256B64(body);
    headersToSign["content-length"] = new TextEncoder().encode(body).length.toString();
    headersToSign["content-type"] = contentType ?? "application/json";
    names = [...names, "x-content-sha256", "content-type", "content-length"];
  }
  const signingString = names.map((h) => `${h}: ${headersToSign[h]}`).join("\n");
  const signature = await signString(privateKey, signingString);
  const auth = `Signature version="1",keyId="${keyId}",algorithm="rsa-sha256",headers="${names.join(" ")}",signature="${signature}"`;
  const fetchHeaders: Record<string, string> = { host, date, Authorization: auth, ...(extraHeaders ?? {}) };
  if (headersToSign["x-content-sha256"]) {
    fetchHeaders["x-content-sha256"] = headersToSign["x-content-sha256"];
    fetchHeaders["content-length"] = headersToSign["content-length"];
    fetchHeaders["content-type"] = headersToSign["content-type"];
  }
  return await fetch(`https://${host}${path}`, {
    method, headers: fetchHeaders,
    body: body && method !== "GET" && method !== "HEAD" ? body : undefined,
  });
}

function safeName(name: string): string {
  return name.replace(/[^\w.\-]+/g, "_").slice(0, 160);
}

function jsonRes(obj: unknown, status = 200, cors: HeadersInit = {}) {
  return new Response(JSON.stringify(obj), {
    status, headers: { ...cors, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return handleOptions(req);
  const cors = buildCorsHeaders(req);

  try {
    const token = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
    if (!token) return jsonRes({ error: "unauthenticated" }, 401, cors);
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });
    const { data: userRes } = await admin.auth.getUser(token);
    const uid = userRes?.user?.id;
    if (!uid) return jsonRes({ error: "invalid token" }, 401, cors);
    const { data: isAdmin } = await admin.rpc("has_role", { _user_id: uid, _role: "admin" });
    if (!isAdmin) return jsonRes({ error: "forbidden" }, 403, cors);

    const body = await req.json().catch(() => ({}));
    const action = String(body.action ?? "");

    if (action === "list-users") {
      const { data: list, error: lerr } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
      if (lerr) return jsonRes({ error: lerr.message }, 500, cors);
      const ids = list.users.map((u) => u.id);
      const [{ data: profiles }, { data: roles }] = await Promise.all([
        admin.from("user_profiles").select("user_id, display_name, studio_name, plan_tier").in("user_id", ids),
        admin.from("user_roles").select("user_id, role").in("user_id", ids),
      ]);
      const pmap = new Map((profiles ?? []).map((p: any) => [p.user_id, p]));
      const rmap = new Map<string, string[]>();
      for (const r of roles ?? []) {
        const arr = rmap.get((r as any).user_id) ?? [];
        arr.push((r as any).role);
        rmap.set((r as any).user_id, arr);
      }
      const users = list.users.map((u) => ({
        id: u.id,
        email: u.email,
        created_at: u.created_at,
        profile: pmap.get(u.id) ?? null,
        roles: rmap.get(u.id) ?? ["client"],
      }));
      return jsonRes({ ok: true, users }, 200, cors);
    }

    if (action === "list") {
      const userId = body.userId ? String(body.userId) : null;
      let q = admin.from("recent_uploads").select("*").order("created_at", { ascending: false }).limit(500);
      if (userId) q = q.eq("user_id", userId);
      const { data: uploads, error } = await q;
      if (error) return jsonRes({ error: error.message }, 500, cors);
      const ids = Array.from(new Set((uploads ?? []).map((u: any) => u.user_id)));
      const { data: profiles } = await admin.from("user_profiles")
        .select("user_id, display_name, studio_name, plan_tier").in("user_id", ids);
      const pmap = new Map((profiles ?? []).map((p: any) => [p.user_id, p]));
      return jsonRes({
        ok: true,
        uploads: (uploads ?? []).map((u: any) => ({ ...u, owner: pmap.get(u.user_id) ?? null })),
      }, 200, cors);
    }

    // All remaining actions need OCI config
    const { data: cfg } = await admin.from("site_config")
      .select("oracle_tenancy_ocid, oracle_user_ocid, oracle_fingerprint, oracle_region, oracle_namespace, oracle_bucket, oracle_private_key")
      .eq("id", true).maybeSingle<SiteCfg>();
    const pem = cfg?.oracle_private_key || Deno.env.get("ORACLE_PRIVATE_KEY");
    const tenancy = cfg?.oracle_tenancy_ocid || Deno.env.get("OCI_TENANCY_OCID");
    const ociUser = cfg?.oracle_user_ocid || Deno.env.get("OCI_USER_OCID");
    const fp = cfg?.oracle_fingerprint || Deno.env.get("OCI_FINGERPRINT");
    const region = cfg?.oracle_region || Deno.env.get("OCI_REGION");
    const namespace = cfg?.oracle_namespace || Deno.env.get("OCI_NAMESPACE");
    const bucketDefault = cfg?.oracle_bucket || Deno.env.get("OCI_BUCKET");
    if (!pem || !tenancy || !ociUser || !fp || !region || !namespace || !bucketDefault) {
      return jsonRes({ error: "Oracle OCI not fully configured" }, 400, cors);
    }
    const privateKey = await importPrivateKey(pem);
    const host = `objectstorage.${region}.oraclecloud.com`;
    const keyId = `${tenancy}/${ociUser}/${fp}`;

    if (action === "delete") {
      const id = String(body.id ?? "");
      if (!id) return jsonRes({ error: "id required" }, 400, cors);
      const { data: row } = await admin.from("recent_uploads").select("*").eq("id", id).maybeSingle();
      if (!row) return jsonRes({ error: "not found" }, 404, cors);
      const r = await ociFetch({
        method: "DELETE", host,
        path: `/n/${row.namespace}/b/${row.bucket}/o/${encodeURIComponent(row.object_key)}`,
        keyId, privateKey,
      });
      if (!r.ok && r.status !== 404) {
        const t = await r.text().catch(() => "");
        return jsonRes({ error: `OCI delete failed: ${r.status} ${t}` }, 502, cors);
      }
      await admin.from("recent_uploads").delete().eq("id", id);
      return jsonRes({ ok: true }, 200, cors);
    }

    if (action === "rename") {
      const id = String(body.id ?? "");
      const newName = safeName(String(body.newName ?? ""));
      if (!id || !newName) return jsonRes({ error: "id and newName required" }, 400, cors);
      const { data: row } = await admin.from("recent_uploads").select("*").eq("id", id).maybeSingle();
      if (!row) return jsonRes({ error: "not found" }, 404, cors);
      const prefix = row.object_key.substring(0, row.object_key.lastIndexOf("/") + 1);
      const newKey = `${prefix}${Date.now()}-${newName}`;
      // OCI copyObject: POST /n/{ns}/b/{src}/actions/copyObject
      const payload = JSON.stringify({
        sourceObjectName: row.object_key,
        destinationRegion: row.region,
        destinationNamespace: row.namespace,
        destinationBucket: row.bucket,
        destinationObjectName: newKey,
      });
      const r = await ociFetch({
        method: "POST", host,
        path: `/n/${row.namespace}/b/${row.bucket}/actions/copyObject`,
        body: payload, contentType: "application/json",
        keyId, privateKey,
      });
      if (!r.ok && r.status !== 202) {
        const t = await r.text().catch(() => "");
        return jsonRes({ error: `OCI copy failed: ${r.status} ${t}` }, 502, cors);
      }
      // Delete original
      await ociFetch({
        method: "DELETE", host,
        path: `/n/${row.namespace}/b/${row.bucket}/o/${encodeURIComponent(row.object_key)}`,
        keyId, privateKey,
      });
      await admin.from("recent_uploads").update({ file_name: newName, object_key: newKey }).eq("id", id);
      return jsonRes({ ok: true, newKey }, 200, cors);
    }

    if (action === "create-upload-par") {
      const userId = String(body.userId ?? "");
      const fileName = safeName(String(body.fileName ?? ""));
      if (!userId || !fileName) return jsonRes({ error: "userId & fileName required" }, 400, cors);
      const objectKey = `vault/${userId}/${Date.now()}-${fileName}`;
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
      const payload = JSON.stringify({
        name: `admin-upload-${Date.now()}`,
        objectName: objectKey,
        accessType: "ObjectWrite",
        timeExpires: expiresAt,
      });
      const r = await ociFetch({
        method: "POST", host,
        path: `/n/${namespace}/b/${bucketDefault}/p/`,
        body: payload, contentType: "application/json",
        keyId, privateKey,
      });
      const text = await r.text();
      if (!r.ok) return jsonRes({ error: `OCI PAR failed: ${r.status} ${text}` }, 502, cors);
      const data = JSON.parse(text);
      return jsonRes({
        ok: true,
        url: `https://${host}${data.accessUri}`,
        objectKey, bucket: bucketDefault, namespace, region,
      }, 200, cors);
    }

    if (action === "register-upload") {
      const { userId, fileName, fileSize, mimeType, objectKey } = body;
      if (!userId || !fileName || !objectKey) return jsonRes({ error: "missing fields" }, 400, cors);
      const { data, error } = await admin.from("recent_uploads").insert({
        user_id: userId,
        file_name: safeName(String(fileName)),
        file_size: Number(fileSize) || 0,
        mime_type: mimeType || null,
        bucket: bucketDefault, namespace, region,
        object_key: objectKey,
        status: "complete",
      }).select().maybeSingle();
      if (error) return jsonRes({ error: error.message }, 500, cors);
      return jsonRes({ ok: true, row: data }, 200, cors);
    }

    if (action === "create-share") {
      const id = String(body.id ?? "");
      const expiresInHours = Number(body.expiresInHours ?? 168); // 7 days default
      const maxDownloads = body.maxDownloads ? Number(body.maxDownloads) : null;
      if (!id) return jsonRes({ error: "id required" }, 400, cors);
      const { data: row } = await admin.from("recent_uploads").select("*").eq("id", id).maybeSingle();
      if (!row) return jsonRes({ error: "not found" }, 404, cors);
      const shareTokenBytes = new Uint8Array(24);
      crypto.getRandomValues(shareTokenBytes);
      const shareToken = btoa(String.fromCharCode(...shareTokenBytes))
        .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
      const expiresAt = new Date(Date.now() + expiresInHours * 3600_000).toISOString();
      const { data: sf, error: sferr } = await admin.from("shared_files").insert({
        owner_id: row.user_id,
        storage_path: row.object_key,
        filename: row.file_name,
        size_bytes: row.file_size,
        mime_type: row.mime_type,
        tier: "admin",
        share_token: shareToken,
        expires_at: expiresAt,
        max_downloads: maxDownloads,
        download_count: 0,
        revoked: false,
        view_only: false,
        has_password: false,
      }).select().maybeSingle();
      if (sferr) return jsonRes({ error: sferr.message }, 500, cors);
      const origin = resolveSiteOrigin(req);
      return jsonRes({ ok: true, url: `${origin}/s/${shareToken}`, record: sf }, 200, cors);
    }

    if (action === "download-par") {
      const id = String(body.id ?? "");
      const expiresInMinutes = Number(body.expiresInMinutes ?? 30);
      if (!id) return jsonRes({ error: "id required" }, 400, cors);
      const { data: row } = await admin.from("recent_uploads").select("*").eq("id", id).maybeSingle();
      if (!row) return jsonRes({ error: "not found" }, 404, cors);
      const expiresAt = new Date(Date.now() + expiresInMinutes * 60_000).toISOString();
      const payload = JSON.stringify({
        name: `admin-read-${Date.now()}`,
        objectName: row.object_key,
        accessType: "ObjectRead",
        timeExpires: expiresAt,
      });
      const r = await ociFetch({
        method: "POST", host,
        path: `/n/${row.namespace}/b/${row.bucket}/p/`,
        body: payload, contentType: "application/json",
        keyId, privateKey,
      });
      const text = await r.text();
      if (!r.ok) return jsonRes({ error: `OCI PAR failed: ${r.status} ${text}` }, 502, cors);
      const data = JSON.parse(text);
      return jsonRes({ ok: true, url: `https://${host}${data.accessUri}` }, 200, cors);
    }

    return jsonRes({ error: `Unknown action: ${action}` }, 400, cors);
  } catch (e) {
    return jsonRes({ error: (e as Error).message }, 500, cors);
  }
});
