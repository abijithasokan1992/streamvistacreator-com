// Oracle OCI proxy — signs Object Storage API requests using ORACLE_PRIVATE_KEY
// secret + non-secret config from public.site_config. Admin-only.
//
// Actions:
//   { action: "test" }                        → HEAD bucket, returns ok/fail
//   { action: "create-par", name, objectName, expiresAt, accessType }
//                                             → creates a Pre-Authenticated
//                                               Request URL the camera/uploader
//                                               can use without OCI creds.

import { createClient } from "npm:@supabase/supabase-js@2";
import { buildCorsHeaders, handleOptions } from "../_shared/cors.ts";

type SiteConfig = {
  oracle_tenancy_ocid: string | null;
  oracle_user_ocid: string | null;
  oracle_fingerprint: string | null;
  oracle_region: string | null;
  oracle_namespace: string | null;
  oracle_bucket: string | null;
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

function pemToPkcs8(pem: string): ArrayBuffer {
  const b64 = pem
    .replace(/-----BEGIN [^-]+-----/g, "")
    .replace(/-----END [^-]+-----/g, "")
    .replace(/\s+/g, "");
  const bin = atob(b64);
  const buf = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
  return buf.buffer;
}

async function importPrivateKey(pem: string): Promise<CryptoKey> {
  return await crypto.subtle.importKey(
    "pkcs8",
    pemToPkcs8(pem),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
}

async function sha256B64(body: string | Uint8Array): Promise<string> {
  const bytes = typeof body === "string" ? new TextEncoder().encode(body) : body;
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return btoa(String.fromCharCode(...new Uint8Array(digest)));
}

async function signString(key: CryptoKey, data: string): Promise<string> {
  const sig = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    key,
    new TextEncoder().encode(data),
  );
  return btoa(String.fromCharCode(...new Uint8Array(sig)));
}

async function ociFetch(opts: {
  method: "GET" | "HEAD" | "POST" | "PUT" | "DELETE";
  host: string;
  path: string;
  body?: string;
  contentType?: string;
  keyId: string;
  privateKey: CryptoKey;
}): Promise<Response> {
  const { method, host, path, body, contentType, keyId, privateKey } = opts;
  const date = new Date().toUTCString();
  const requestTarget = `${method.toLowerCase()} ${path}`;

  const headersToSign: Record<string, string> = {
    "(request-target)": requestTarget,
    host,
    date,
  };
  let signedHeaderNames = ["(request-target)", "host", "date"];

  if (body !== undefined && method !== "GET" && method !== "HEAD") {
    const xSha = await sha256B64(body);
    const len = new TextEncoder().encode(body).length.toString();
    headersToSign["x-content-sha256"] = xSha;
    headersToSign["content-length"] = len;
    headersToSign["content-type"] = contentType ?? "application/json";
    signedHeaderNames = [
      "(request-target)",
      "host",
      "date",
      "x-content-sha256",
      "content-type",
      "content-length",
    ];
  }

  const signingString = signedHeaderNames
    .map((h) => `${h}: ${headersToSign[h]}`)
    .join("\n");
  const signature = await signString(privateKey, signingString);

  const authHeader =
    `Signature version="1",keyId="${keyId}",algorithm="rsa-sha256",` +
    `headers="${signedHeaderNames.join(" ")}",signature="${signature}"`;

  const fetchHeaders: Record<string, string> = {
    host,
    date,
    Authorization: authHeader,
  };
  if (headersToSign["x-content-sha256"]) {
    fetchHeaders["x-content-sha256"] = headersToSign["x-content-sha256"];
    fetchHeaders["content-length"] = headersToSign["content-length"];
    fetchHeaders["content-type"] = headersToSign["content-type"];
  }

  return await fetch(`https://${host}${path}`, {
    method,
    headers: fetchHeaders,
    body: body && method !== "GET" && method !== "HEAD" ? body : undefined,
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return handleOptions(req);

  const cors = { ...buildCorsHeaders(req), "Content-Type": "application/json" };

  // Verify caller is an authenticated admin
  const authHeader = req.headers.get("authorization") ?? "";
  const token = authHeader.replace(/^Bearer\s+/i, "");
  if (!token) {
    return new Response(JSON.stringify({ error: "unauthenticated" }), {
      status: 401, headers: cors,
    });
  }

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });
  const { data: userRes } = await admin.auth.getUser(token);
  const userId = userRes?.user?.id;
  if (!userId) {
    return new Response(JSON.stringify({ error: "invalid token" }), {
      status: 401, headers: cors,
    });
  }
  const { data: isAdmin } = await admin.rpc("has_role", { _user_id: userId, _role: "admin" });
  if (!isAdmin) {
    return new Response(JSON.stringify({ error: "forbidden" }), {
      status: 403, headers: cors,
    });
  }

  let body: any = {};
  try { body = await req.json(); } catch { /* empty */ }
  const action = String(body.action ?? "test");

  const { data: cfg } = await admin
    .from("site_config")
    .select("oracle_tenancy_ocid, oracle_user_ocid, oracle_fingerprint, oracle_region, oracle_namespace, oracle_bucket")
    .eq("id", true)
    .maybeSingle<SiteConfig>();

  const pem = Deno.env.get("ORACLE_PRIVATE_KEY");
  const missing: string[] = [];
  if (!pem) missing.push("private key (set ORACLE_PRIVATE_KEY backend secret)");
  if (!cfg?.oracle_tenancy_ocid) missing.push("tenancy OCID");
  if (!cfg?.oracle_user_ocid) missing.push("user OCID");
  if (!cfg?.oracle_fingerprint) missing.push("fingerprint");
  if (!cfg?.oracle_region) missing.push("region");
  if (!cfg?.oracle_namespace) missing.push("namespace");
  if (!cfg?.oracle_bucket) missing.push("bucket");
  if (missing.length) {
    return new Response(JSON.stringify({ ok: false, error: `Missing: ${missing.join(", ")}` }), {
      status: 400, headers: cors,
    });
  }

  let privateKey: CryptoKey;
  try {
    privateKey = await importPrivateKey(pem!);
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: `Invalid private key PEM: ${(e as Error).message}` }), {
      status: 400, headers: cors,
    });
  }

  const region = cfg!.oracle_region!;
  const ns = cfg!.oracle_namespace!;
  const bucket = cfg!.oracle_bucket!;
  const host = `objectstorage.${region}.oraclecloud.com`;
  const keyId = `${cfg!.oracle_tenancy_ocid}/${cfg!.oracle_user_ocid}/${cfg!.oracle_fingerprint}`;

  try {
    if (action === "test") {
      const r = await ociFetch({
        method: "HEAD",
        host,
        path: `/n/${ns}/b/${bucket}/`,
        keyId,
        privateKey,
      });
      if (r.ok) {
        return new Response(JSON.stringify({ ok: true, status: r.status, bucket, region }), { headers: cors });
      }
      const text = await r.text().catch(() => "");
      return new Response(JSON.stringify({ ok: false, status: r.status, error: text || r.statusText }), {
        status: 200, headers: cors,
      });
    }

    if (action === "usage") {
      // Paginate ListObjects, summing 'size'. Capped to avoid runaway costs.
      let totalBytes = 0;
      let count = 0;
      let start: string | undefined = undefined;
      const MAX_PAGES = 20; // 20 * 1000 = up to 20k objects sampled
      let pages = 0;
      let truncated = false;
      while (pages < MAX_PAGES) {
        const qs = new URLSearchParams({ fields: "size", limit: "1000" });
        if (start) qs.set("start", start);
        const r = await ociFetch({
          method: "GET",
          host,
          path: `/n/${ns}/b/${bucket}/o?${qs.toString()}`,
          keyId,
          privateKey,
        });
        if (!r.ok) {
          const text = await r.text().catch(() => "");
          return new Response(JSON.stringify({ ok: false, status: r.status, error: text || r.statusText }), { status: 200, headers: cors });
        }
        const json = await r.json();
        const objects = (json.objects ?? []) as Array<{ size?: number }>;
        for (const o of objects) {
          totalBytes += Number(o.size ?? 0);
          count += 1;
        }
        pages += 1;
        if (json.nextStartWith) { start = json.nextStartWith; }
        else { start = undefined; break; }
      }
      if (start) truncated = true;
      return new Response(JSON.stringify({ ok: true, bucket, region, totalBytes, objectCount: count, truncated, sampledPages: pages }), { headers: cors });
    }

    if (action === "create-par") {
      const name = String(body.name ?? `par-${Date.now()}`);
      const objectName = String(body.objectName ?? "uploads/");
      const accessType = String(body.accessType ?? "AnyObjectWrite"); // ObjectRead | ObjectWrite | ObjectReadWrite | AnyObjectWrite | AnyObjectRead | AnyObjectReadWrite
      const expiresAt = String(
        body.expiresAt ?? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      );
      const payload = JSON.stringify({
        name,
        objectName,
        accessType,
        timeExpires: expiresAt,
      });
      const r = await ociFetch({
        method: "POST",
        host,
        path: `/n/${ns}/b/${bucket}/p/`,
        body: payload,
        contentType: "application/json",
        keyId,
        privateKey,
      });
      const text = await r.text();
      if (!r.ok) {
        return new Response(JSON.stringify({ ok: false, status: r.status, error: text }), {
          status: 200, headers: cors,
        });
      }
      const data = JSON.parse(text);
      const fullUrl = `https://${host}${data.accessUri ?? ""}`;
      return new Response(JSON.stringify({ ok: true, par: data, url: fullUrl }), { headers: cors });
    }

    if (action === "change-storage-tier") {
      // OCI updateObjectStorageTier — POST /n/{ns}/b/{bucket}/actions/updateObjectStorageTier
      // body: { objectName, storageTier: "Archive"|"InfrequentAccess"|"Standard" }
      const objectName = String(body.objectName ?? "");
      const storageTier = String(body.storageTier ?? "Archive");
      if (!objectName) {
        return new Response(JSON.stringify({ ok: false, error: "objectName required" }), { status: 400, headers: cors });
      }
      const payload = JSON.stringify({ objectName, storageTier });
      const r = await ociFetch({
        method: "POST",
        host,
        path: `/n/${ns}/b/${bucket}/actions/updateObjectStorageTier`,
        body: payload,
        contentType: "application/json",
        keyId,
        privateKey,
      });
      const text = await r.text().catch(() => "");
      if (!r.ok) {
        return new Response(JSON.stringify({ ok: false, status: r.status, error: text || r.statusText }), { status: 200, headers: cors });
      }
      return new Response(JSON.stringify({ ok: true, objectName, storageTier }), { headers: cors });
    }

    if (action === "restore-objects") {
      // OCI restoreObjects — POST /n/{ns}/b/{bucket}/actions/restoreObjects
      const objectName = String(body.objectName ?? "");
      const hours = Number(body.hours ?? 24);
      if (!objectName) {
        return new Response(JSON.stringify({ ok: false, error: "objectName required" }), { status: 400, headers: cors });
      }
      const payload = JSON.stringify({ objectName, hours });
      const r = await ociFetch({
        method: "POST",
        host,
        path: `/n/${ns}/b/${bucket}/actions/restoreObjects`,
        body: payload,
        contentType: "application/json",
        keyId,
        privateKey,
      });
      const text = await r.text().catch(() => "");
      if (!r.ok && r.status !== 200 && r.status !== 202) {
        return new Response(JSON.stringify({ ok: false, status: r.status, error: text || r.statusText }), { status: 200, headers: cors });
      }
      return new Response(JSON.stringify({ ok: true, objectName, hours, status: r.status }), { headers: cors });
    }

    return new Response(JSON.stringify({ ok: false, error: `Unknown action: ${action}` }), {
      status: 400, headers: cors,
    });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: (e as Error).message }), {
      status: 500, headers: cors,
    });
  }
});
