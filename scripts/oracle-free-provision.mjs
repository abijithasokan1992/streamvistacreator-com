#!/usr/bin/env node
/**
 * StreamVista Oracle Always Free provisioner.
 *
 * Safety model:
 * - Dry-run by default.
 * - Creates only an Autonomous Database with --is-free-tier true.
 * - Creates only a Standard Object Storage bucket.
 * - Refuses paid/developer-tier flags and refuses destructive actions.
 * - Never prints passwords, private keys, or full config files.
 *
 * Prerequisite: OCI CLI authenticated with a local profile or instance principal.
 * Secrets must NOT be committed to GitHub or pasted into source files.
 */

import { spawnSync } from "node:child_process";
import process from "node:process";

const argv = new Set(process.argv.slice(2));
const APPLY = argv.has("--apply");
const CREATE_DB = argv.has("--create-db") || argv.has("--all");
const CREATE_BUCKET = argv.has("--create-bucket") || argv.has("--all");
const CHECK = argv.has("--check") || (!CREATE_DB && !CREATE_BUCKET);

const env = process.env;
const profile = env.OCI_CLI_PROFILE || "DEFAULT";
const region = env.OCI_REGION || "";
const compartmentId = env.OCI_COMPARTMENT_ID || "";
const dbName = (env.OCI_FREE_DB_NAME || "STREAMVISTA").replace(/[^A-Za-z0-9]/g, "").slice(0, 30);
const dbDisplayName = env.OCI_FREE_DB_DISPLAY_NAME || "StreamVista Free DB";
const adminPassword = env.OCI_FREE_DB_ADMIN_PASSWORD || "";
const bucketName = env.OCI_BUCKET || env.OCI_BUCKET_NAME || "streamvista-private-assets";
const namespace = env.OCI_NAMESPACE || "";

function fail(message) {
  console.error(`ERROR: ${message}`);
  process.exit(1);
}

function redact(text) {
  if (!text) return text;
  return String(text)
    .replace(/(password|private[_ -]?key|token|secret)(\s*[=:]\s*)[^\s,}]+/gi, "$1$2[REDACTED]")
    .replace(/ocid1\.user\.[^\s,}]+/g, "ocid1.user.[REDACTED]");
}

function run(args, { allowFailure = false, input } = {}) {
  const fullArgs = [...args, "--profile", profile];
  if (region && !fullArgs.includes("--region")) fullArgs.push("--region", region);
  const printable = ["oci", ...fullArgs].map((v) => (v === adminPassword ? "[REDACTED_PASSWORD]" : v));
  console.log(`$ ${printable.join(" ")}`);
  if (!APPLY) return { status: 0, stdout: "DRY_RUN", stderr: "" };

  const result = spawnSync("oci", fullArgs, {
    encoding: "utf8",
    input,
    stdio: [input ? "pipe" : "ignore", "pipe", "pipe"],
  });
  if (result.stdout?.trim()) console.log(redact(result.stdout.trim()));
  if (result.stderr?.trim()) console.error(redact(result.stderr.trim()));
  if (result.status !== 0 && !allowFailure) fail(`OCI CLI command failed with exit code ${result.status}`);
  return result;
}

function requireEnv(name, value) {
  if (!value) fail(`${name} is required.`);
}

function assertSafe() {
  if (argv.has("--paid") || argv.has("--developer-tier") || argv.has("--upgrade")) {
    fail("Paid, developer-tier, and upgrade operations are forbidden by this tool.");
  }
  if (!dbName || !/^[A-Za-z][A-Za-z0-9]{0,29}$/.test(dbName)) {
    fail("OCI_FREE_DB_NAME must start with a letter and contain at most 30 alphanumeric characters.");
  }
  if (!/^[A-Za-z0-9._-]+$/.test(bucketName)) {
    fail("OCI_BUCKET_NAME contains unsupported characters.");
  }
}

function checkCli() {
  const res = spawnSync("oci", ["--version"], { encoding: "utf8" });
  if (res.status !== 0) fail("OCI CLI is not installed or not available in PATH.");
  console.log(`OCI CLI: ${res.stdout.trim() || "available"}`);
}

function checkIdentity() {
  requireEnv("OCI_COMPARTMENT_ID", compartmentId);
  run(["iam", "region-subscription", "list", "--all", "--query", "data[].\"region-name\""]);
  run(["iam", "compartment", "get", "--compartment-id", compartmentId]);
}

function listResources() {
  run([
    "db", "autonomous-database", "list",
    "--compartment-id", compartmentId,
    "--query", "data[].{name:\"display-name\",dbName:\"db-name\",free:\"is-free-tier\",state:\"lifecycle-state\",id:id}",
  ]);
  const nsArgs = ["os", "ns", "get"];
  run(nsArgs);
  run([
    "os", "bucket", "list",
    "--compartment-id", compartmentId,
    "--query", "data[].{name:name,tier:\"storage-tier\",created:\"time-created\"}",
  ]);
}

function createDatabase() {
  requireEnv("OCI_COMPARTMENT_ID", compartmentId);
  requireEnv("OCI_FREE_DB_ADMIN_PASSWORD", adminPassword);

  const existing = run([
    "db", "autonomous-database", "list",
    "--compartment-id", compartmentId,
    "--db-name", dbName,
    "--query", "length(data)",
    "--raw-output",
  ], { allowFailure: true });

  if (APPLY && existing.status === 0 && Number(existing.stdout.trim()) > 0) {
    console.log(`Database ${dbName} already exists; create skipped.`);
    return;
  }

  run([
    "db", "autonomous-database", "create",
    "--compartment-id", compartmentId,
    "--db-name", dbName,
    "--display-name", dbDisplayName,
    "--db-workload", "OLTP",
    "--is-free-tier", "true",
    "--admin-password", adminPassword,
    "--wait-for-state", "AVAILABLE",
    "--max-wait-seconds", "3600",
    "--query", "data.{id:id,name:\"display-name\",dbName:\"db-name\",free:\"is-free-tier\",state:\"lifecycle-state\",connectionUrls:\"connection-urls\"}",
  ]);
}

function createBucket() {
  requireEnv("OCI_COMPARTMENT_ID", compartmentId);
  const ns = namespace || (APPLY ? run(["os", "ns", "get", "--raw-output"]).stdout.trim() : "<resolved-at-runtime>");

  const existing = run([
    "os", "bucket", "get",
    "--namespace-name", ns,
    "--bucket-name", bucketName,
  ], { allowFailure: true });

  if (APPLY && existing.status === 0) {
    console.log(`Bucket ${bucketName} already exists; create skipped.`);
    return;
  }

  run([
    "os", "bucket", "create",
    "--compartment-id", compartmentId,
    "--namespace-name", ns,
    "--name", bucketName,
    "--storage-tier", "Standard",
    "--public-access-type", "NoPublicAccess",
    "--query", "data.{name:name,namespace:namespace,tier:\"storage-tier\",publicAccess:\"public-access-type\",created:\"time-created\"}",
  ]);
}

function printPlan() {
  console.log("\nStreamVista Oracle Free provisioning plan");
  console.log(`Mode: ${APPLY ? "APPLY" : "DRY RUN"}`);
  console.log(`Profile: ${profile}`);
  console.log(`Region: ${region || "profile/default"}`);
  console.log(`Database: ${dbDisplayName} (${dbName}), Always Free OLTP only`);
  console.log(`Bucket: ${bucketName}, Standard tier, private`);
  console.log("Forbidden: paid shapes, upgrades, public buckets, deletion, secret output\n");
}

assertSafe();
checkCli();
printPlan();

if (CHECK) {
  checkIdentity();
  listResources();
}
if (CREATE_DB) createDatabase();
if (CREATE_BUCKET) createBucket();

if (!APPLY && (CREATE_DB || CREATE_BUCKET)) {
  console.log("\nDry-run completed. Re-run with --apply only after confirming Oracle shows Always Free eligibility and no paid resource selection.");
}
