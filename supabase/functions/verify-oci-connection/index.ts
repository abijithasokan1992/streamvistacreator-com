// Verify OCI connection by issuing a signed HEAD against the namespace bucket.
// Reads the private key strictly from the ORACLE_PRIVATE_KEY backend secret;
// admin-supplied public fields come in the request body.
// Bulletproof CORS + zero-crash JSON parsing.

import { createClient } from "npm:@supabase/supabase-js@2";

const ALLOWED_ORIGINS = [
  "https://app.crayonspictures.com",
  "https://www.app.crayonspictures.com",
];

function corsFor(req: Request): Record<string, string> {
  const origin = req.headers.get("origin") ?? "";
  let allow = "*";
  try {
    if (origin) {
      const u = new URL(origin);
      const host = u.hostname;
      if (
        ALLOWED_ORIGINS.includes(origin) ||
        host.endsWith(".lovableproject.com") ||
        host.endsWith(".lovable.app") ||
        host.endsWith(".lovable.dev") ||
        host === "localhost" ||
        host === "127.0.0.1"
      ) {
        allow = origin;
      }
    }
  } catch { /* ignore */ }
  return {
    "Access-Control-Allow-Origin": allow,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type",
    "Access-Control-Max-Age": "3600",
    "Vary": "Origin",
  };
}

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

async function importKey(pem: string) {
  return await crypto.subtle.importKey(
    "pkcs8",
    pemToPkcs8(pem),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
}

async function sign(key: CryptoKey, data: string) {
  const sig = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    key,
    new TextEncoder().encode(data),
  );
  return btoa(String.fromCharCode(...new Uint8Array(sig)));
}

async function sha256B64(body: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", body);
  return btoa(String.fromCharCode(...new Uint8Array(digest)));
}

async function signedOciFetch(opts: {
  method: "GET" | "HEAD" | "PUT" | "DELETE";
  host: string;
  path: string;
  key: CryptoKey;
  keyId: string;
  body?: Uint8Array;
  contentType?: string;
}): Promise<Response> {
  const date = new Date().toUTCString();
  const headersToSign: Record<string, string> = {
    "(request-target)": `${opts.method.toLowerCase()} ${opts.path}`,
    host: opts.host,
    date,
  };
  const names = ["(request-target)", "host", "date"];
  const fetchHeaders: Record<string, string> = { host: opts.host, date };
  if (opts.body) {
    const xSha = await sha256B64(opts.body);
    headersToSign["x-content-sha256"] = xSha;
    headersToSign["content-type"] = opts.contentType ?? "application/octet-stream";
    headersToSign["content-length"] = String(opts.body.byteLength);
    names.push("x-content-sha256", "content-type", "content-length");
    fetchHeaders["x-content-sha256"] = xSha;
    fetchHeaders["content-type"] = headersToSign["content-type"];
    fetchHeaders["content-length"] = headersToSign["content-length"];
  }
  const signingString = names.map((h) => `${h}: ${headersToSign[h]}`).join("\n");
  const signature = await sign(opts.key, signingString);
  fetchHeaders.Authorization =
    `Signature version="1",keyId="${opts.keyId}",algorithm="rsa-sha256",` +
    `headers="${names.join(" ")}",signature="${signature}"`;
  return await fetch(`https://${opts.host}${opts.path}`, {
    method: opts.method,
    headers: fetchHeaders,
    body: opts.body,
  });
}

interface Body {
  tenancyOcid?: string;
  userOcid?: string;
  keyFingerprint?: string;
  region?: string;
  namespace?: string;
  bucketName?: string;
}

Deno.serve(async (req) => {
  const cors = corsFor(req);

  // Preflight — always 200 with full CORS headers.
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: cors });
  }

  const json = (status: number, b: unknown) =>
    new Response(JSON.stringify(b), {
      status,
      headers: { ...cors, "Content-Type": "application/json" },
    });

  try {
    if (req.method !== "POST") {
      return json(405, { error: "method_not_allowed" });
    }

    const authHeader = req.headers.get("Authorization") ?? "";
    const supaUrl = Deno.env.get("SUPABASE_URL")!;
    const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
    const svc = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const userClient = createClient(supaUrl, anon, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: ures } = await userClient.auth.getUser();
    const user = ures?.user;
    if (!user) return json(401, { error: "auth_required" });
    const admin = createClient(supaUrl, svc, { auth: { persistSession: false } });
    const { data: roles } = await admin
      .from("user_roles").select("role").eq("user_id", user.id);
    if (!(roles ?? []).some((r: any) => r.role === "admin")) {
      return json(403, { error: "admin_required" });
    }

    // Zero-crash body parsing.
    let body: Body = {};
    try {
      const raw = await req.text();
      body = raw ? (JSON.parse(raw) as Body) : {};
    } catch (e) {
      return json(400, { error: `Invalid JSON body: ${(e as Error).message}` });
    }

    const tenancy = (body.tenancyOcid ?? "").trim();
    const fingerprint = (body.keyFingerprint ?? "").trim();
    const namespace = (body.namespace ?? "").trim();
    const bucket = (body.bucketName ?? "").trim();
    const userOcid = (body.userOcid ?? Deno.env.get("OCI_USER_OCID") ?? "").trim();
    const region = (body.region ?? Deno.env.get("OCI_REGION") ?? "").trim();
    const pem = Deno.env.get("ORACLE_PRIVATE_KEY") ?? "";

    if (!pem) return json(400, { error: "ORACLE_PRIVATE_KEY backend secret is not set." });
    if (!tenancy || !fingerprint || !namespace || !bucket) {
      return json(400, { error: "Missing one of: tenancyOcid, keyFingerprint, namespace, bucketName." });
    }
    if (!userOcid || !region) {
      return json(400, { error: "User OCID / region not configured. Set OCI_USER_OCID and OCI_REGION secrets." });
    }
    if (!/^-----BEGIN [A-Z ]*PRIVATE KEY-----/.test(pem.trim())) {
      return json(400, { error: "ORACLE_PRIVATE_KEY is not in valid PEM format (missing BEGIN/END headers)." });
    }

    let key: CryptoKey;
    try {
      key = await importKey(pem);
    } catch (e) {
      return json(400, { error: `PEM import failed: ${(e as Error).message}` });
    }

    const host = `objectstorage.${region}.oraclecloud.com`;
    const path = `/n/${encodeURIComponent(namespace)}/b/${encodeURIComponent(bucket)}/`;
    const date = new Date().toUTCString();
    const signingString =
      `(request-target): head ${path}\n` +
      `host: ${host}\n` +
      `date: ${date}`;
    const signature = await sign(key, signingString);
    const keyId = `${tenancy}/${userOcid}/${fingerprint}`;
    const authz =
      `Signature version="1",keyId="${keyId}",algorithm="rsa-sha256",` +
      `headers="(request-target) host date",signature="${signature}"`;

    const url = `https://${host}${path}`;
    let res: Response;
    try {
      res = await fetch(url, {
        method: "HEAD",
        headers: { host, date, Authorization: authz },
      });
    } catch (e) {
      return json(502, { error: `Network unreachable to OCI: ${(e as Error).message}` });
    }

    if (res.status === 200 || res.status === 204) {
      return json(200, { ok: true, status: res.status, host, namespace, bucket });
    }
    if (res.status === 401) return json(200, { ok: false, error: "Auth failed (401): check fingerprint, user OCID, or that the public key is uploaded to OCI." });
    if (res.status === 403) return json(200, { ok: false, error: "Forbidden (403): tenancy/user lacks permission on this bucket." });
    if (res.status === 404) return json(200, { ok: false, error: "Not found (404): namespace or bucket name is wrong." });
    return json(200, { ok: false, error: `OCI responded ${res.status}` });
  } catch (e) {
    return json(500, { error: (e as Error).message || "Unknown error" });
  }
});
