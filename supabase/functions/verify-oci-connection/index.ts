// Verify OCI connection by issuing a signed HEAD against the namespace bucket.
// Reads the private key strictly from the ORACLE_PRIVATE_KEY backend secret;
// admin-supplied public fields (tenancy, fingerprint, namespace, bucket) come
// in the request body. Returns a precise diagnosis on failure.

import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";

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

interface Body {
  tenancyOcid?: string;
  userOcid?: string;
  keyFingerprint?: string;
  region?: string;
  namespace?: string;
  bucketName?: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const json = (status: number, b: unknown) =>
    new Response(JSON.stringify(b), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  try {
    // Require an authenticated admin to call this.
    const authHeader = req.headers.get("Authorization") ?? "";
    const supaUrl = Deno.env.get("SUPABASE_URL")!;
    const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
    const svc = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const userClient = createClient(supaUrl, anon, { global: { headers: { Authorization: authHeader } } });
    const { data: ures } = await userClient.auth.getUser();
    const user = ures?.user;
    if (!user) return json(401, { error: "auth_required" });
    const admin = createClient(supaUrl, svc, { auth: { persistSession: false } });
    const { data: roles } = await admin
      .from("user_roles").select("role").eq("user_id", user.id);
    if (!(roles ?? []).some((r: any) => r.role === "admin")) {
      return json(403, { error: "admin_required" });
    }

    const body = (await req.json().catch(() => ({}))) as Body;
    const tenancy = (body.tenancyOcid ?? "").trim();
    const fingerprint = (body.keyFingerprint ?? "").trim();
    const namespace = (body.namespace ?? "").trim();
    const bucket = (body.bucketName ?? "").trim();
    // userOcid + region are needed to sign; fall back to env if the card
    // doesn't expose them (keeps the new lock/modify UI minimal).
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
      return json(502, { error: `Network/CORS unreachable: ${(e as Error).message}` });
    }

    if (res.status === 200 || res.status === 204) {
      return json(200, { ok: true, status: res.status, host, namespace, bucket });
    }
    if (res.status === 401) return json(401, { error: "Auth failed (401): check fingerprint, user OCID, or that the public key is uploaded to OCI." });
    if (res.status === 403) return json(403, { error: "Forbidden (403): tenancy/user lacks permission on this bucket." });
    if (res.status === 404) return json(404, { error: "Not found (404): namespace or bucket name is wrong." });
    return json(res.status, { error: `OCI responded ${res.status}` });
  } catch (e) {
    return json(500, { error: (e as Error).message || "Unknown error" });
  }
});
