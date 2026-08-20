#!/usr/bin/env node
/**
 * StreamVista Oracle Free Control
 *
 * Read-only verification tool for Oracle Cloud Always Free / Free Tier resources.
 * It never creates, upgrades, deletes, or purchases resources.
 *
 * Usage:
 *   node scripts/oracle-free-control.mjs
 *
 * Required for OCI Object Storage verification:
 *   OCI_TENANCY_OCID
 *   OCI_USER_OCID
 *   OCI_FINGERPRINT
 *   OCI_PRIVATE_KEY or OCI_PRIVATE_KEY_PATH
 *   OCI_REGION
 *   OCI_NAMESPACE
 *   OCI_BUCKET (or OCI_BUCKET_NAME)
 *
 * Optional database verification through ORDS:
 *   ORACLE_ORDS_HEALTH_URL
 *   ORACLE_ORDS_BEARER_TOKEN
 */

import fs from "node:fs";
import crypto from "node:crypto";

const env = process.env;
const PAID_ACTION_ENV = [
  "ALLOW_CREATE_ORACLE_RESOURCE",
  "ALLOW_ORACLE_UPGRADE",
  "ALLOW_PAID_ACTION",
  "ALLOW_CARD_CHARGE",
];

function value(name, aliases = []) {
  for (const key of [name, ...aliases]) {
    const v = env[key]?.trim();
    if (v) return v;
  }
  return "";
}

function mask(v) {
  if (!v) return "missing";
  if (v.length < 10) return "configured";
  return `${v.slice(0, 4)}…${v.slice(-4)}`;
}

function result(name, ok, detail) {
  return { name, ok, detail };
}

function loadPrivateKey() {
  const inline = value("OCI_PRIVATE_KEY", ["ORACLE_PRIVATE_KEY"]);
  if (inline) return inline.replace(/\\n/g, "\n");
  const path = value("OCI_PRIVATE_KEY_PATH", ["ORACLE_PRIVATE_KEY_PATH"]);
  if (!path) return "";
  if (!fs.existsSync(path)) throw new Error(`Private key file not found: ${path}`);
  return fs.readFileSync(path, "utf8");
}

function signRequest({ method, host, path, keyId, privateKey }) {
  const date = new Date().toUTCString();
  const signingString = `(request-target): ${method.toLowerCase()} ${path}\nhost: ${host}\ndate: ${date}`;
  const signer = crypto.createSign("RSA-SHA256");
  signer.update(signingString);
  signer.end();
  const signature = signer.sign(privateKey, "base64");
  const authorization =
    `Signature version="1",keyId="${keyId}",algorithm="rsa-sha256",` +
    `headers="(request-target) host date",signature="${signature}"`;
  return { date, authorization };
}

async function signedFetch({ method = "GET", region, path, keyId, privateKey }) {
  const host = `objectstorage.${region}.oraclecloud.com`;
  const { date, authorization } = signRequest({ method, host, path, keyId, privateKey });
  return fetch(`https://${host}${path}`, {
    method,
    headers: { host, date, Authorization: authorization },
    redirect: "manual",
  });
}

async function verifyObjectStorage(cfg) {
  const checks = [];
  try {
    const keyId = `${cfg.tenancy}/${cfg.user}/${cfg.fingerprint}`;

    const namespaceResponse = await signedFetch({
      region: cfg.region,
      path: "/n",
      keyId,
      privateKey: cfg.privateKey,
    });
    const namespaceBody = await namespaceResponse.text();
    const namespaceOk = namespaceResponse.ok;
    checks.push(result(
      "OCI namespace API",
      namespaceOk,
      namespaceOk ? `reachable (${namespaceBody.replaceAll('"', '')})` : `HTTP ${namespaceResponse.status}: ${namespaceBody.slice(0, 180)}`,
    ));

    const bucketPath = `/n/${encodeURIComponent(cfg.namespace)}/b/${encodeURIComponent(cfg.bucket)}`;
    const bucketResponse = await signedFetch({
      method: "HEAD",
      region: cfg.region,
      path: bucketPath,
      keyId,
      privateKey: cfg.privateKey,
    });
    checks.push(result(
      "OCI bucket",
      bucketResponse.ok,
      bucketResponse.ok ? `${cfg.bucket} reachable` : `HTTP ${bucketResponse.status}`,
    ));
  } catch (error) {
    checks.push(result("OCI signed request", false, error instanceof Error ? error.message : String(error)));
  }
  return checks;
}

async function verifyOrds() {
  const url = value("ORACLE_ORDS_HEALTH_URL");
  if (!url) {
    return [result(
      "Oracle Database runtime",
      false,
      "ORDS health URL missing. Browser apps cannot connect directly to Oracle DB; expose a server-side ORDS/API endpoint first.",
    )];
  }

  try {
    const token = value("ORACLE_ORDS_BEARER_TOKEN");
    const response = await fetch(url, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      redirect: "manual",
    });
    const text = await response.text();
    return [result(
      "Oracle ORDS/API",
      response.ok,
      response.ok ? `HTTP ${response.status}` : `HTTP ${response.status}: ${text.slice(0, 180)}`,
    )];
  } catch (error) {
    return [result("Oracle ORDS/API", false, error instanceof Error ? error.message : String(error))];
  }
}

async function main() {
  console.log("\nStreamVista Oracle Free Control — READ ONLY\n");

  const paidFlags = PAID_ACTION_ENV.filter((name) => /^(1|true|yes)$/i.test(env[name] ?? ""));
  if (paidFlags.length) {
    console.error(`Blocked: paid/provisioning flags are enabled: ${paidFlags.join(", ")}`);
    process.exitCode = 2;
    return;
  }

  const cfg = {
    tenancy: value("OCI_TENANCY_OCID"),
    user: value("OCI_USER_OCID"),
    fingerprint: value("OCI_FINGERPRINT"),
    region: value("OCI_REGION"),
    namespace: value("OCI_NAMESPACE"),
    bucket: value("OCI_BUCKET", ["OCI_BUCKET_NAME"]),
    privateKey: "",
  };

  try {
    cfg.privateKey = loadPrivateKey();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
  }

  const configRows = [
    ["OCI_TENANCY_OCID", cfg.tenancy],
    ["OCI_USER_OCID", cfg.user],
    ["OCI_FINGERPRINT", cfg.fingerprint],
    ["OCI_REGION", cfg.region],
    ["OCI_NAMESPACE", cfg.namespace],
    ["OCI_BUCKET", cfg.bucket],
    ["OCI_PRIVATE_KEY", cfg.privateKey],
  ];

  for (const [name, v] of configRows) {
    console.log(`${v ? "✓" : "✗"} ${name}: ${name.includes("KEY") ? (v ? "configured" : "missing") : mask(v)}`);
  }

  const missing = configRows.filter(([, v]) => !v).map(([name]) => name);
  const checks = [];

  if (missing.length === 0) {
    checks.push(...await verifyObjectStorage(cfg));
  } else {
    checks.push(result("OCI Object Storage", false, `Missing: ${missing.join(", ")}`));
  }

  checks.push(...await verifyOrds());

  console.log("\nVerification\n");
  for (const check of checks) {
    console.log(`${check.ok ? "PASS" : "BLOCK"} — ${check.name}: ${check.detail}`);
  }

  console.log("\nArchitecture rule\n");
  console.log("Frontend -> Vercel/Cloudflare");
  console.log("Auth/API -> existing Supabase until Oracle ORDS/API is verified");
  console.log("Large media storage -> OCI Object Storage");
  console.log("Oracle Database -> server-side ORDS/API only; never expose DB credentials in VITE_* variables");
  console.log("Official founder login -> abijithasokan@crayonspictures.com");

  const allPass = checks.every((c) => c.ok);
  if (!allPass) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
