// Camera-to-Cloud Ingest — uploads a file to OCI Object Storage (server-side
// signed) and records metadata in public.recent_uploads.
//
// POST (multipart/form-data): { file: File }  → uploads + inserts row, returns row.
// POST (JSON): { action: "list" }             → returns the caller's recent uploads.

import { createClient } from "npm:@supabase/supabase-js@2";
import { buildCorsHeaders, handleOptions } from "../_shared/cors.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const MAX_BYTES = 5 * 1024 * 1024 * 1024; // 5 GB per file

function pemToPkcs8(pem: string): ArrayBuffer {
  const b64 = pem.replace(/-----BEGIN [^-]+-----/g, "")
    .replace(/-----END [^-]+-----/g, "").replace(/\s+/g, "");
  const bin = atob(b64);
  const buf = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
  return buf.buffer;
}

async function importPrivateKey(pem: string): Promise<CryptoKey> {
  return await crypto.subtle.importKey(
    "pkcs8", pemToPkcs8(pem),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false, ["sign"],
  );
}

async function sha256B64(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return btoa(String.fromCharCode(...new Uint8Array(digest)));
}

async function signString(key: CryptoKey, data: string): Promise<string> {
  const sig = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(data));
  return btoa(String.fromCharCode(...new Uint8Array(sig)));
}

async function ociPut(opts: {
  host: string; path: string; body: Uint8Array; contentType: string;
  keyId: string; privateKey: CryptoKey;
}): Promise<Response> {
  const { host, path, body, contentType, keyId, privateKey } = opts;
  const date = new Date().toUTCString();
  const xSha = await sha256B64(body);
  const len = body.byteLength.toString();
  const headers: Record<string, string> = {
    "(request-target)": `put ${path}`,
    host, date,
    "x-content-sha256": xSha,
    "content-type": contentType,
    "content-length": len,
  };
  const names = ["(request-target)", "host", "date", "x-content-sha256", "content-type", "content-length"];
  const signingString = names.map((h) => `${h}: ${headers[h]}`).join("\n");
  const signature = await signString(privateKey, signingString);
  const auth =
    `Signature version="1",keyId="${keyId}",algorithm="rsa-sha256",` +
    `headers="${names.join(" ")}",signature="${signature}"`;

  return await fetch(`https://${host}${path}`, {
    method: "PUT",
    headers: {
      host, date,
      Authorization: auth,
      "x-content-sha256": xSha,
      "content-type": contentType,
      "content-length": len,
    },
    body,
  });
}

function safeName(name: string): string {
  return name.replace(/[^\w.\-]+/g, "_").slice(0, 120);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return handleOptions(req);
  const cors = { ...buildCorsHeaders(req), "Content-Type": "application/json" };

  const token = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!token) {
    return new Response(JSON.stringify({ error: "unauthenticated" }), { status: 401, headers: cors });
  }
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });
  const { data: userRes } = await admin.auth.getUser(token);
  const userId = userRes?.user?.id;
  if (!userId) {
    return new Response(JSON.stringify({ error: "invalid token" }), { status: 401, headers: cors });
  }

  const ct = req.headers.get("content-type") ?? "";

  // JSON action path
  if (ct.includes("application/json")) {
    const body = await req.json().catch(() => ({}));
    if (body.action === "list") {
      // RLS scopes to workspaces the caller belongs to; service-role bypasses,
      // so we filter explicitly via the user's memberships.
      const { data: memberships } = await admin
        .from("workspace_members")
        .select("workspace_id")
        .eq("user_id", userId);
      const wsIds = (memberships ?? []).map((m: any) => m.workspace_id);
      if (wsIds.length === 0) {
        return new Response(JSON.stringify({ uploads: [] }), { headers: cors });
      }
      let q = admin
        .from("recent_uploads")
        .select("*")
        .in("workspace_id", wsIds)
        .order("created_at", { ascending: false })
        .limit(50);
      if (typeof body.workspaceId === "string" && body.workspaceId) {
        if (!wsIds.includes(body.workspaceId)) {
          return new Response(JSON.stringify({ error: "forbidden_workspace" }), { status: 403, headers: cors });
        }
        q = admin
          .from("recent_uploads")
          .select("*")
          .eq("workspace_id", body.workspaceId)
          .order("created_at", { ascending: false })
          .limit(50);
      }
      const { data, error } = await q;
      if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: cors });
      return new Response(JSON.stringify({ uploads: data ?? [] }), { headers: cors });
    }
    return new Response(JSON.stringify({ error: "unknown action" }), { status: 400, headers: cors });
  }

  if (!ct.startsWith("multipart/form-data")) {
    return new Response(JSON.stringify({ error: "expected multipart/form-data" }), { status: 400, headers: cors });
  }

  // Load OCI config
  const { data: cfg } = await admin
    .from("site_config")
    .select("oracle_tenancy_ocid, oracle_user_ocid, oracle_fingerprint, oracle_region, oracle_namespace, oracle_bucket, oracle_private_key")
    .eq("id", true)
    .maybeSingle();

  const pem = cfg?.oracle_private_key || Deno.env.get("ORACLE_PRIVATE_KEY");
  const tenancy = cfg?.oracle_tenancy_ocid || Deno.env.get("OCI_TENANCY_OCID");
  const user = cfg?.oracle_user_ocid || Deno.env.get("OCI_USER_OCID");
  const fingerprint = cfg?.oracle_fingerprint || Deno.env.get("OCI_FINGERPRINT");
  const region = cfg?.oracle_region || Deno.env.get("OCI_REGION");
  const ns = cfg?.oracle_namespace || Deno.env.get("OCI_NAMESPACE");
  const bucket = cfg?.oracle_bucket || Deno.env.get("OCI_BUCKET");
  if (!pem || !tenancy || !user || !fingerprint || !region || !ns || !bucket) {
    return new Response(JSON.stringify({ error: "OCI not fully configured" }), { status: 500, headers: cors });
  }

  let form: FormData;
  try { form = await req.formData(); }
  catch (e) {
    return new Response(JSON.stringify({ error: `bad form: ${(e as Error).message}` }), { status: 400, headers: cors });
  }
  const file = form.get("file");
  if (!(file instanceof File)) {
    return new Response(JSON.stringify({ error: "missing file" }), { status: 400, headers: cors });
  }
  if (file.size > MAX_BYTES) {
    return new Response(JSON.stringify({ error: `file exceeds ${MAX_BYTES} bytes` }), { status: 413, headers: cors });
  }

  // Workspace routing: the caller must specify which workspace this asset belongs
  // to, and they must be a writer (owner/admin/editor) in that workspace. The
  // object key is then scoped to /workspaces/{workspace_id}/... so OCI assets
  // are physically isolated per tenant.
  const workspaceIdRaw = form.get("workspaceId");
  const workspaceId = typeof workspaceIdRaw === "string" ? workspaceIdRaw.trim() : "";
  if (!workspaceId) {
    return new Response(JSON.stringify({ error: "missing workspaceId" }), { status: 400, headers: cors });
  }
  const { data: membership } = await admin
    .from("workspace_members")
    .select("role")
    .eq("workspace_id", workspaceId)
    .eq("user_id", userId)
    .maybeSingle();
  if (!membership || !["owner", "admin", "editor"].includes(membership.role)) {
    return new Response(JSON.stringify({ error: "forbidden_workspace" }), { status: 403, headers: cors });
  }

  // Idempotency: clients pass a stable pendingId so retrying the same upload
  // reuses the existing row + objectKey instead of creating a duplicate.
  const pendingIdRaw = form.get("pendingId");
  const pendingId = typeof pendingIdRaw === "string" ? pendingIdRaw.slice(0, 80) : null;
  const mime = file.type || "application/octet-stream";

  let row: { id: string; object_key: string; status: string } | null = null;

  if (pendingId) {
    const { data: existing } = await admin
      .from("recent_uploads")
      .select("id, object_key, status")
      .eq("user_id", userId)
      .eq("workspace_id", workspaceId)
      .eq("client_pending_id", pendingId)
      .maybeSingle();
    if (existing) {
      // Already completed → return the prior row, no second OCI PUT.
      if (existing.status === "uploaded") {
        const { data: full } = await admin
          .from("recent_uploads").select("*").eq("id", existing.id).single();
        return new Response(JSON.stringify({ upload: full, idempotent: true }), { headers: cors });
      }
      // Re-attempt: reuse the same object_key so OCI overwrites in place.
      await admin.from("recent_uploads")
        .update({ status: "uploading", error_message: null })
        .eq("id", existing.id);
      row = existing;
    }
  }

  if (!row) {
    // Direct ingest path: workspaces/{workspace_id}/users/{user_id}/{timestamp}-{uuid}-{name}
    const objectKey = `workspaces/${workspaceId}/users/${userId}/${Date.now()}-${crypto.randomUUID()}-${safeName(file.name)}`;
    const { data: inserted, error: insErr } = await admin
      .from("recent_uploads")
      .insert({
        user_id: userId,
        workspace_id: workspaceId,
        file_name: file.name,
        file_size: file.size,
        mime_type: mime,
        bucket, namespace: ns, region,
        object_key: objectKey,
        status: "uploading",
        client_pending_id: pendingId,
      })
      .select("id, object_key, status").single();
    if (insErr || !inserted) {
      // Race: another concurrent retry inserted first — fetch and reuse it.
      if (pendingId) {
        const { data: again } = await admin
          .from("recent_uploads")
          .select("id, object_key, status")
          .eq("user_id", userId)
          .eq("workspace_id", workspaceId)
          .eq("client_pending_id", pendingId)
          .maybeSingle();
        if (again) {
          if (again.status === "uploaded") {
            const { data: full } = await admin
              .from("recent_uploads").select("*").eq("id", again.id).single();
            return new Response(JSON.stringify({ upload: full, idempotent: true }), { headers: cors });
          }
          row = again;
        }
      }
      if (!row) {
        return new Response(JSON.stringify({ error: insErr?.message ?? "insert failed" }), { status: 500, headers: cors });
      }
    } else {
      row = inserted;
    }
  }

  const objectKey = row.object_key;

  try {
    const privateKey = await importPrivateKey(pem);
    const buf = new Uint8Array(await file.arrayBuffer());
    const host = `objectstorage.${region}.oraclecloud.com`;
    const path = `/n/${ns}/b/${bucket}/o/${encodeURIComponent(objectKey)}`;
    const keyId = `${tenancy}/${user}/${fingerprint}`;
    const r = await ociPut({ host, path, body: buf, contentType: mime, keyId, privateKey });
    if (!r.ok) {
      const text = await r.text().catch(() => "");
      await admin.from("recent_uploads").update({ status: "failed", error_message: `OCI ${r.status}: ${text.slice(0, 500)}` }).eq("id", row.id);
      return new Response(JSON.stringify({ error: `OCI upload failed (${r.status}): ${text.slice(0, 300)}` }), { status: 502, headers: cors });
    }
    const { data: updated } = await admin
      .from("recent_uploads").update({ status: "uploaded" }).eq("id", row.id).select().single();
    return new Response(JSON.stringify({ upload: updated ?? row }), { headers: cors });
  } catch (e) {
    const msg = (e as Error).message;
    await admin.from("recent_uploads").update({ status: "failed", error_message: msg.slice(0, 500) }).eq("id", row.id);
    return new Response(JSON.stringify({ error: msg }), { status: 500, headers: cors });
  }
});
