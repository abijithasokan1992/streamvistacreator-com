// Shared OCI Object Storage helpers used by edge functions that need to
// sign requests against the Oracle Cloud Infrastructure API.
//
// Currently exposes only what we need for tear-down/cleanup flows:
//   - loadOciConfig: read OCI credentials (DB row first, env vars second)
//   - ociDelete: signed DELETE for a single object
//   - ociListAll: paginated list of every object under an optional prefix
//   - deleteUserObjects: best-effort purge of every object owned by a user

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

async function signString(key: CryptoKey, data: string): Promise<string> {
  const sig = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    key,
    new TextEncoder().encode(data),
  );
  return btoa(String.fromCharCode(...new Uint8Array(sig)));
}

export interface OciConfig {
  tenancy: string;
  user: string;
  fingerprint: string;
  region: string;
  namespace: string;
  bucket: string;
  privateKey: CryptoKey;
  keyId: string;
  host: string;
}

/** Load OCI credentials from site_config (admin-managed) with env fallbacks. */
export async function loadOciConfig(admin: any): Promise<OciConfig | null> {
  const { data: cfg } = await admin
    .from("site_config")
    .select(
      "oracle_tenancy_ocid, oracle_user_ocid, oracle_fingerprint, oracle_region, oracle_namespace, oracle_bucket, oracle_private_key",
    )
    .eq("id", true)
    .maybeSingle();

  const pem = cfg?.oracle_private_key || Deno.env.get("ORACLE_PRIVATE_KEY");
  const tenancy = cfg?.oracle_tenancy_ocid || Deno.env.get("OCI_TENANCY_OCID");
  const user = cfg?.oracle_user_ocid || Deno.env.get("OCI_USER_OCID");
  const fingerprint = cfg?.oracle_fingerprint || Deno.env.get("OCI_FINGERPRINT");
  const region = cfg?.oracle_region || Deno.env.get("OCI_REGION");
  const namespace = cfg?.oracle_namespace || Deno.env.get("OCI_NAMESPACE");
  const bucket = cfg?.oracle_bucket || Deno.env.get("OCI_BUCKET");
  if (!pem || !tenancy || !user || !fingerprint || !region || !namespace || !bucket) {
    return null;
  }
  const privateKey = await importPrivateKey(pem);
  return {
    tenancy, user, fingerprint, region, namespace, bucket,
    privateKey,
    keyId: `${tenancy}/${user}/${fingerprint}`,
    host: `objectstorage.${region}.oraclecloud.com`,
  };
}

/**
 * Sign-and-send an arbitrary OCI request (no body). Used by both DELETE and GET.
 */
async function signedRequest(
  cfg: OciConfig,
  method: "GET" | "DELETE",
  path: string,
): Promise<Response> {
  const date = new Date().toUTCString();
  const lcMethod = method.toLowerCase();
  const headers: Record<string, string> = {
    "(request-target)": `${lcMethod} ${path}`,
    host: cfg.host,
    date,
  };
  const names = ["(request-target)", "host", "date"];
  const signingString = names.map((h) => `${h}: ${headers[h]}`).join("\n");
  const signature = await signString(cfg.privateKey, signingString);
  const auth =
    `Signature version="1",keyId="${cfg.keyId}",algorithm="rsa-sha256",` +
    `headers="${names.join(" ")}",signature="${signature}"`;
  return await fetch(`https://${cfg.host}${path}`, {
    method,
    headers: { host: cfg.host, date, Authorization: auth },
  });
}

/** DELETE a single object. Returns true on 2xx or 404 (already gone). */
export async function ociDelete(cfg: OciConfig, objectKey: string): Promise<boolean> {
  const path = `/n/${cfg.namespace}/b/${cfg.bucket}/o/${encodeURIComponent(objectKey)}`;
  const res = await signedRequest(cfg, "DELETE", path);
  if (res.ok || res.status === 404) return true;
  const body = await res.text().catch(() => "");
  console.error("ociDelete failed", res.status, objectKey, body.slice(0, 200));
  return false;
}

/**
 * List every object name under `prefix` by following the `nextStartWith` cursor.
 * Caps the total to `maxObjects` as a safety valve.
 */
export async function ociListAll(
  cfg: OciConfig,
  prefix: string,
  maxObjects = 50_000,
): Promise<string[]> {
  const out: string[] = [];
  let start: string | undefined;
  while (out.length < maxObjects) {
    const params = new URLSearchParams({ prefix, limit: "1000" });
    if (start) params.set("start", start);
    const path = `/n/${cfg.namespace}/b/${cfg.bucket}/o?${params.toString()}`;
    const res = await signedRequest(cfg, "GET", path);
    if (!res.ok) {
      console.error("ociListAll failed", res.status, await res.text().catch(() => ""));
      break;
    }
    const json = await res.json().catch(() => ({}));
    const objects: { name: string }[] = json.objects ?? [];
    for (const o of objects) if (o?.name) out.push(o.name);
    const next = json.nextStartWith;
    if (!next) break;
    start = next;
  }
  return out;
}

/**
 * Purge every OCI object belonging to a user. Uses two sources:
 *   1. `recent_uploads` rows for that user (object_keys we already know).
 *   2. A defensive list of any object under the `users/<uid>/` prefix in case
 *      historical writes happened outside `recent_uploads`.
 *
 * Returns the count of objects deleted plus the count that failed.
 */
export async function deleteUserObjects(
  admin: any,
  cfg: OciConfig,
  userId: string,
): Promise<{ deleted: number; failed: number; total: number }> {
  const keys = new Set<string>();

  const { data: rows } = await admin
    .from("recent_uploads")
    .select("object_key")
    .eq("user_id", userId);
  for (const r of rows ?? []) {
    const k = (r as any).object_key as string | null;
    if (k) keys.add(k);
  }

  try {
    const listed = await ociListAll(cfg, `users/${userId}/`);
    for (const k of listed) keys.add(k);
  } catch (e) {
    console.error("deleteUserObjects: list failed", e);
  }

  let deleted = 0;
  let failed = 0;
  for (const key of keys) {
    const ok = await ociDelete(cfg, key);
    if (ok) deleted++;
    else failed++;
  }
  return { deleted, failed, total: keys.size };
}
