// Camera-to-Cloud Ingest — uploads a file to OCI Object Storage (server-side
// signed) and records metadata in public.recent_uploads.
//
// POST (multipart/form-data): { file: File }  → uploads + inserts row, returns row.
// POST (JSON): { action: "list" }             → returns the caller's recent uploads.

import { createClient } from "npm:@supabase/supabase-js@2";
import { buildCorsHeaders, handleOptions } from "../_shared/cors.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const MAX_BYTES = 5 * 1024 * 1024 * 1024; // 5 GB per file (single-shot)

// Phase 3 / 4 / 7 — mirrors oci-multipart caps & prefix rules.
const GB = 1024 * 1024 * 1024;
const MB = 1024 * 1024;
const TB = 1024 * GB;
const CATEGORY_LIMITS: Record<string, number> = {
  trailer: 5 * GB, feature_film: 5 * GB, master: 5 * GB,
  prores: 5 * GB, dcp: 5 * GB,
  poster: 500 * MB, artwork: 500 * MB,
  subtitle: 50 * MB, captions: 50 * MB,
  censor_certificate: 200 * MB, censor_cert: 200 * MB,
  ownership_documents: 500 * MB, ownership: 500 * MB,
  legal: 200 * MB, sales: 500 * MB,
  audio: 5 * GB, audio_tracks: 5 * GB,
};
const CATEGORY_PREFIX: Record<string, string> = {
  trailer: "trailers",
  feature_film: "masters", master: "masters",
  prores: "prores", dcp: "dcp",
  poster: "artwork", artwork: "artwork",
  subtitle: "subtitles", captions: "subtitles",
  censor_certificate: "documents", censor_cert: "documents",
  ownership_documents: "documents", ownership: "documents",
  legal: "documents", sales: "documents",
  audio: "documents", audio_tracks: "documents",
};
const PLAN_QUOTA: Record<string, number> = {
  free: 100 * GB, creator: 1 * TB,
  monthly: 5 * TB, quarterly: 5 * TB, yearly: 5 * TB,
};
function planQuotaBytes(planTier: string | null | undefined, topupTb: number | null | undefined): number {
  const base = PLAN_QUOTA[String(planTier || "free").toLowerCase()] ?? PLAN_QUOTA.free;
  return base + Math.max(0, Number(topupTb || 0)) * TB;
}

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
      // Security invariant: recent_uploads rows (including par_url signed Oracle
      // URLs and object_key) must only be readable by the uploader OR a workspace
      // admin. Service-role bypasses RLS, so enforce the same predicate here.
      const { data: memberships } = await admin
        .from("workspace_members")
        .select("workspace_id, role")
        .eq("user_id", userId);
      const wsIds = (memberships ?? []).map((m: any) => m.workspace_id);
      const adminWsIds = (memberships ?? [])
        .filter((m: any) => m.role === "owner" || m.role === "admin")
        .map((m: any) => m.workspace_id);
      const { data: platformAdminRow } = await admin
        .from("user_roles")
        .select("role")
        .eq("user_id", userId)
        .eq("role", "admin")
        .maybeSingle();
      const isPlatformAdmin = !!platformAdminRow;

      const requestedWs = typeof body.workspaceId === "string" ? body.workspaceId.trim() : "";
      if (requestedWs && !wsIds.includes(requestedWs) && !isPlatformAdmin) {
        return new Response(JSON.stringify({ error: "forbidden_workspace" }), { status: 403, headers: cors });
      }

      let q = admin
        .from("recent_uploads")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);

      if (isPlatformAdmin) {
        if (requestedWs) q = q.eq("workspace_id", requestedWs);
      } else {
        // Caller sees only their own uploads, plus all uploads in workspaces
        // where they are workspace owner/admin.
        const orParts: string[] = [`user_id.eq.${userId}`];
        if (adminWsIds.length > 0) {
          orParts.push(`workspace_id.in.(${adminWsIds.join(",")})`);
        }
        q = q.or(orParts.join(","));
        if (requestedWs) q = q.eq("workspace_id", requestedWs);
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
    .select("oracle_tenancy_ocid, oracle_user_ocid, oracle_fingerprint, oracle_region, oracle_namespace, oracle_bucket")
    .eq("id", true)
    .maybeSingle();

  // Private key only lives in the encrypted backend secret — never in the DB.
  const pem = Deno.env.get("ORACLE_PRIVATE_KEY") || Deno.env.get("OCI_PRIVATE_KEY");
  const tenancy = cfg?.oracle_tenancy_ocid || Deno.env.get("OCI_TENANCY_OCID");
  const user = cfg?.oracle_user_ocid || Deno.env.get("OCI_USER_OCID");
  const fingerprint = cfg?.oracle_fingerprint || Deno.env.get("OCI_FINGERPRINT");
  const region = cfg?.oracle_region || Deno.env.get("OCI_REGION");
  const ns = cfg?.oracle_namespace || Deno.env.get("OCI_NAMESPACE");
  const bucket = cfg?.oracle_bucket || Deno.env.get("OCI_BUCKET") || Deno.env.get("OCI_BUCKET_NAME");
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

  // Optional project + category routing for DIT folder organization.
  // If a projectId is supplied (and belongs to the workspace) we build:
  //   workspaces/{ws}/projects/{proj}/{category}/users/{user}/{ts}-{uuid}-{name}
  // Category defaults to "ingest"; common values: raw, proxy, script, archive.
  // If the project is in "manual" foldering mode for that category, the
  // client may pass `subpath` to be used in place of the category segment.
  const projectIdRaw = form.get("projectId");
  const categoryRaw = form.get("category");
  const subpathRaw = form.get("subpath");
  let projectSegment = "";
  let categorySegment = "ingest";
  if (typeof projectIdRaw === "string" && projectIdRaw.trim()) {
    const { data: proj } = await admin
      .from("projects")
      .select("id, workspace_id, foldering_mode_archive, foldering_mode_raw")
      .eq("id", projectIdRaw.trim())
      .maybeSingle();
    if (proj && proj.workspace_id === workspaceId) {
      projectSegment = `projects/${proj.id}/`;
      const cat = typeof categoryRaw === "string" ? categoryRaw.trim().toLowerCase().replace(/[^a-z0-9_-]/g, "") : "";
      if (cat) categorySegment = cat;
      const manual =
        (cat === "raw" && proj.foldering_mode_raw === "manual") ||
        (cat === "archive" && proj.foldering_mode_archive === "manual");
      if (manual && typeof subpathRaw === "string" && subpathRaw.trim()) {
        const clean = subpathRaw.trim().replace(/^\/+|\/+$/g, "").replace(/[^\w./-]+/g, "_").slice(0, 200);
        if (clean) categorySegment = clean;
      }
    }
  }

  // Phase 4: server-derived prefix when titleId is supplied.
  const titleIdRaw = form.get("titleId");
  const titleId = typeof titleIdRaw === "string" ? titleIdRaw.trim() : "";
  const catKeyRaw = typeof categoryRaw === "string"
    ? categoryRaw.trim().toLowerCase().replace(/[^a-z0-9_-]/g, "")
    : "";

  // Phase 3: per-category limit
  if (titleId) {
    if (!catKeyRaw || !(catKeyRaw in CATEGORY_LIMITS)) {
      return new Response(JSON.stringify({ error: `invalid category '${catKeyRaw}'` }), { status: 400, headers: cors });
    }
    if (file.size > CATEGORY_LIMITS[catKeyRaw]) {
      return new Response(JSON.stringify({ error: `Upload Failed — ${catKeyRaw} exceeds category limit`, limitBytes: CATEGORY_LIMITS[catKeyRaw] }), { status: 413, headers: cors });
    }
  }

  // Phase 7: total storage quota — authoritative via creator entitlement RPC,
  // with a profile-based fallback when the RPC is unavailable.
  {
    let quota: number | null = null;
    let usedBytes = 0;
    try {
      const { data: ent } = await admin.rpc("get_workspace_storage_entitlement", { _user_id: userId });
      if (ent && typeof (ent as any).total_storage_gb !== "undefined") {
        quota = Number((ent as any).total_storage_gb) * GB;
        usedBytes = Number((ent as any).used_bytes ?? 0);
      }
    } catch (_) { /* fall through */ }
    if (quota === null) {
      // Legacy fallback for any environment still on the old RPC.
      try {
        const { data: entRows } = await admin.rpc("get_creator_storage_entitlement", { _user_id: userId });
        const e: any = Array.isArray(entRows) ? entRows[0] : entRows;
        if (e && typeof e.total_gb === "number") {
          quota = Number(e.total_gb) * GB;
          usedBytes = Math.round(Number(e.used_gb || 0) * GB);
        }
      } catch (_) { /* fall through */ }
    }
    if (quota === null) {
      const { data: prof } = await admin.from("user_profiles")
        .select("plan_tier, topup_tb").eq("user_id", userId).maybeSingle();
      quota = planQuotaBytes(prof?.plan_tier, prof?.topup_tb);
      const { data: usedRows } = await admin.from("recent_uploads")
        .select("file_size").eq("user_id", userId)
        .in("status", ["uploading", "uploaded", "verified", "ready", "completed", "done"]);
      usedBytes = (usedRows ?? []).reduce((s: number, r: any) => s + (Number(r.file_size) || 0), 0);
    }

    if (usedBytes + file.size > quota) {
      return new Response(JSON.stringify({
        error: `Storage limit reached — your workspace has used ${Math.round(usedBytes / GB)} GB of ${Math.round(quota / GB)} GB. Add another 1 TB block in Storage & Billing or request a higher plan.`,
        code: "storage_quota_exceeded",
        quotaBytes: quota, usedBytes,
      }), { status: 413, headers: cors });
    }
  }

  if (!row) {
    let objectKey: string;
    if (titleId) {
      const { data: t } = await admin.from("content_titles")
        .select("id, owner_user_id").eq("id", titleId).maybeSingle();
      if (!t || t.owner_user_id !== userId) {
        return new Response(JSON.stringify({ error: "forbidden_title" }), { status: 403, headers: cors });
      }
      const prefix = CATEGORY_PREFIX[catKeyRaw] ?? "documents";
      objectKey = `users/${userId}/titles/${titleId}/${prefix}/${Date.now()}-${crypto.randomUUID()}-${safeName(file.name)}`;
    } else {
      objectKey = `workspaces/${workspaceId}/${projectSegment}${categorySegment}/users/${userId}/${Date.now()}-${crypto.randomUUID()}-${safeName(file.name)}`;
    }
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
        project_id: titleId ? null : (projectSegment ? projectIdRaw : null),
        category: titleId ? catKeyRaw : (projectSegment ? categorySegment : null),
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
