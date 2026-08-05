#!/usr/bin/env node

/**
 * StreamVista Deployment Control
 *
 * Zero-cost, read-first deployment preflight for the private control site.
 * It does not create paid resources, charge cards, purchase domains, or change
 * DNS unless ALLOW_DNS_WRITE=true is explicitly supplied.
 */

const required = [
  "APP_URL",
  "FOUNDER_EMAIL",
  "SUPABASE_URL",
  "SUPABASE_PUBLISHABLE_KEY",
];

const optional = [
  "SUPABASE_STORAGE_BUCKET",
  "CLOUDFLARE_API_TOKEN",
  "CLOUDFLARE_ZONE_ID",
  "CLOUDFLARE_RECORD_NAME",
  "CLOUDFLARE_TARGET_HOST",
  "ALLOW_DNS_WRITE",
];

const env = process.env;
const results = [];

function add(check, ok, detail, blocking = true) {
  results.push({ check, ok, detail, blocking });
}

function requireEnv() {
  for (const name of required) {
    add(`env:${name}`, Boolean(env[name]?.trim()), env[name]?.trim() ? "present" : "missing");
  }
  for (const name of optional) {
    add(`env:${name}`, Boolean(env[name]?.trim()), env[name]?.trim() ? "present" : "not configured", false);
  }
}

async function checkHttp(url, label, init = {}) {
  try {
    const response = await fetch(url, {
      redirect: "manual",
      signal: AbortSignal.timeout(12000),
      ...init,
    });
    const ok = response.status >= 200 && response.status < 500;
    add(label, ok, `HTTP ${response.status}`);
    return response;
  } catch (error) {
    add(label, false, error instanceof Error ? error.message : String(error));
    return null;
  }
}

async function checkApp() {
  if (!env.APP_URL) return;
  await checkHttp(env.APP_URL, "app:reachable");
}

async function checkSupabase() {
  if (!env.SUPABASE_URL || !env.SUPABASE_PUBLISHABLE_KEY) return;

  const base = env.SUPABASE_URL.replace(/\/$/, "");
  const headers = {
    apikey: env.SUPABASE_PUBLISHABLE_KEY,
    Authorization: `Bearer ${env.SUPABASE_PUBLISHABLE_KEY}`,
  };

  await checkHttp(`${base}/auth/v1/settings`, "supabase:auth", { headers });
  await checkHttp(`${base}/rest/v1/`, "supabase:database-api", { headers });

  if (env.SUPABASE_STORAGE_BUCKET) {
    const encoded = encodeURIComponent(env.SUPABASE_STORAGE_BUCKET);
    const response = await checkHttp(`${base}/storage/v1/object/list/${encoded}`, "supabase:storage-bucket", {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({ limit: 1, offset: 0, prefix: "" }),
    });
    if (response?.status === 400 || response?.status === 404) {
      add("supabase:storage-bucket-config", false, "bucket missing or inaccessible");
    }
  } else {
    add("supabase:storage-bucket", false, "SUPABASE_STORAGE_BUCKET not configured", false);
  }
}

async function cloudflareRequest(path, init = {}) {
  const response = await fetch(`https://api.cloudflare.com/client/v4${path}`, {
    signal: AbortSignal.timeout(12000),
    ...init,
    headers: {
      Authorization: `Bearer ${env.CLOUDFLARE_API_TOKEN}`,
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
  });
  const payload = await response.json().catch(() => null);
  return { response, payload };
}

async function checkCloudflare() {
  const configured = env.CLOUDFLARE_API_TOKEN && env.CLOUDFLARE_ZONE_ID && env.CLOUDFLARE_RECORD_NAME;
  if (!configured) {
    add("cloudflare:dns", false, "Cloudflare token/zone/record not configured", false);
    return;
  }

  try {
    const name = encodeURIComponent(env.CLOUDFLARE_RECORD_NAME);
    const { response, payload } = await cloudflareRequest(`/zones/${env.CLOUDFLARE_ZONE_ID}/dns_records?name=${name}`);
    const records = Array.isArray(payload?.result) ? payload.result : [];
    const found = response.ok && records.length > 0;
    add("cloudflare:dns-record", found, found ? `${records[0].type} → ${records[0].content}` : "record not found");

    const shouldWrite = env.ALLOW_DNS_WRITE === "true";
    if (!found && shouldWrite && env.CLOUDFLARE_TARGET_HOST) {
      const create = await cloudflareRequest(`/zones/${env.CLOUDFLARE_ZONE_ID}/dns_records`, {
        method: "POST",
        body: JSON.stringify({
          type: "CNAME",
          name: env.CLOUDFLARE_RECORD_NAME,
          content: env.CLOUDFLARE_TARGET_HOST,
          proxied: true,
          ttl: 1,
        }),
      });
      add(
        "cloudflare:dns-write",
        create.response.ok && create.payload?.success === true,
        create.response.ok ? "CNAME created" : JSON.stringify(create.payload?.errors || "write failed"),
      );
    } else if (!found) {
      add("cloudflare:dns-write", false, "read-only mode; set ALLOW_DNS_WRITE=true only after owner approval", false);
    }
  } catch (error) {
    add("cloudflare:dns", false, error instanceof Error ? error.message : String(error));
  }
}

function checkFounderIdentity() {
  if (!env.FOUNDER_EMAIL) return;
  const official = /@(?:streamvista\.in|crayonspictures\.com)$/i.test(env.FOUNDER_EMAIL);
  add(
    "auth:founder-email",
    official,
    official ? `official founder email: ${env.FOUNDER_EMAIL}` : "use an approved official company-domain email",
  );
}

function printReport() {
  console.log("\nStreamVista Deployment Control\n");
  for (const row of results) {
    const symbol = row.ok ? "PASS" : row.blocking ? "FAIL" : "WARN";
    console.log(`${symbol.padEnd(4)}  ${row.check.padEnd(34)} ${row.detail}`);
  }

  const blockers = results.filter((row) => row.blocking && !row.ok);
  console.log(`\nBlocking failures: ${blockers.length}`);
  if (blockers.length) {
    console.log("Activation status: NOT READY");
    process.exitCode = 1;
  } else {
    console.log("Activation status: PREFLIGHT PASSED");
  }
}

async function main() {
  requireEnv();
  checkFounderIdentity();
  await checkApp();
  await checkSupabase();
  await checkCloudflare();
  printReport();
}

main().catch((error) => {
  console.error("Deployment control failed:", error);
  process.exitCode = 1;
});
