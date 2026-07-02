// Verify OCI connection by issuing a signed HEAD against the namespace bucket.
// Reads the private key strictly from the ORACLE_PRIVATE_KEY backend secret;
// admin-supplied public fields come in the request body.
// Bulletproof CORS + zero-crash JSON parsing.

import { createClient } from "npm:@supabase/supabase-js@2";

const ALLOWED_ORIGINS = [
  "https://www.streamvistacreator.com",
  "https://streamvistacreator.com",
  "https://streamvista-creator.lovable.app",
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
    if (!(roles ?? []).some((r: any) => r.role === "admin" || r.role === "super_admin")) {
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

    const { data: cfg } = await admin
      .from("site_config")
      .select("oracle_tenancy_ocid, oracle_user_ocid, oracle_fingerprint, oracle_region, oracle_namespace, oracle_bucket")
      .eq("id", true)
      .maybeSingle();

    const tenancy = (body.tenancyOcid ?? cfg?.oracle_tenancy_ocid ?? Deno.env.get("OCI_TENANCY_OCID") ?? "").trim();
    const fingerprint = (body.keyFingerprint ?? cfg?.oracle_fingerprint ?? Deno.env.get("OCI_FINGERPRINT") ?? "").trim();
    const namespace = (body.namespace ?? cfg?.oracle_namespace ?? Deno.env.get("OCI_NAMESPACE") ?? "").trim();
    const bucket = (body.bucketName ?? cfg?.oracle_bucket ?? Deno.env.get("OCI_BUCKET") ?? Deno.env.get("OCI_BUCKET_NAME") ?? "").trim();
    const userOcid = (body.userOcid ?? Deno.env.get("OCI_USER_OCID") ?? "").trim();
    const region = (body.region ?? cfg?.oracle_region ?? Deno.env.get("OCI_REGION") ?? "").trim();
    const pem = Deno.env.get("ORACLE_PRIVATE_KEY") || Deno.env.get("OCI_PRIVATE_KEY") || "";

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
    const keyId = `${tenancy}/${userOcid}/${fingerprint}`;
    const env = {
      OCI_TENANCY_OCID: Boolean(Deno.env.get("OCI_TENANCY_OCID") || cfg?.oracle_tenancy_ocid),
      OCI_USER_OCID: Boolean(Deno.env.get("OCI_USER_OCID") || cfg?.oracle_user_ocid),
      OCI_FINGERPRINT: Boolean(Deno.env.get("OCI_FINGERPRINT") || cfg?.oracle_fingerprint),
      OCI_PRIVATE_KEY: Boolean(Deno.env.get("OCI_PRIVATE_KEY") || Deno.env.get("ORACLE_PRIVATE_KEY")),
      OCI_REGION: Boolean(Deno.env.get("OCI_REGION") || cfg?.oracle_region),
      OCI_NAMESPACE: Boolean(Deno.env.get("OCI_NAMESPACE") || cfg?.oracle_namespace),
      OCI_BUCKET_NAME: Boolean(Deno.env.get("OCI_BUCKET_NAME") || Deno.env.get("OCI_BUCKET") || cfg?.oracle_bucket),
    };

    const readBody = async (r: Response) => (await r.text().catch(() => "")).slice(0, 500);
    const summarize = async (name: string, r: Response) => ({
      operation: name,
      ok: r.ok,
      status: r.status,
      body: await readBody(r),
    });
    const listBucketsPath = `/20160918/buckets?compartmentId=${encodeURIComponent(tenancy)}&namespaceName=${encodeURIComponent(namespace)}`;
    const getBucketPath = `/n/${encodeURIComponent(namespace)}/b/${encodeURIComponent(bucket)}/`;
    const objectName = `diagnostics/oci-verify-${crypto.randomUUID()}.txt`;
    const objectPath = `/n/${encodeURIComponent(namespace)}/b/${encodeURIComponent(bucket)}/o/${encodeURIComponent(objectName)}`;
    const testBody = new TextEncoder().encode(`ok ${new Date().toISOString()}\n`);
    let results: any[] = [];
    try {
      const listBuckets = await signedOciFetch({ method: "GET", host, path: listBucketsPath, key, keyId });
      results.push(await summarize("List Buckets", listBuckets.clone()));
      const getBucket = await signedOciFetch({ method: "HEAD", host, path: getBucketPath, key, keyId });
      results.push(await summarize("Get Bucket", getBucket.clone()));
      const putObject = await signedOciFetch({ method: "PUT", host, path: objectPath, key, keyId, body: testBody, contentType: "text/plain" });
      results.push(await summarize("Put Object", putObject.clone()));
      const getObject = await signedOciFetch({ method: "GET", host, path: objectPath, key, keyId });
      results.push(await summarize("Get Object", getObject.clone()));
      const deleteObject = await signedOciFetch({ method: "DELETE", host, path: objectPath, key, keyId });
      results.push(await summarize("Delete Object", deleteObject.clone()));
    } catch (e) {
      return json(502, { error: `Network unreachable to OCI: ${(e as Error).message}` });
    }

    const ok = results.every((r) => r.ok);
    return json(200, {
      ok,
      host,
      namespace,
      bucket,
      region,
      expectedNamespace: "bma8wibnommg",
      auth: {
        provider: "OCI request signature v1 / RSA-SHA256",
        privateKeyLoaded: true,
        authenticationDetailsProviderCreated: true,
        fingerprintConfigured: true,
        regionMatchesExpected: region === "ap-mumbai-1",
      },
      environment: env,
      results,
    });
  } catch (e) {
    return json(500, { error: (e as Error).message || "Unknown error" });
  }
});
