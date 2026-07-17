// Release-visibility helpers.
//
// The MCP edge function ships its own `version` inside the manifest.
// The source tree ships a git commit + package version through Vite at
// build time. Exposing both separately lets Admin surfaces flag drift
// between what was deployed and what's checked in without touching or
// deploying the edge function.
//
// Vite exposes:
//   __APP_VERSION__  → package.json version (defined in vite.config.ts)
//   __APP_COMMIT__   → short git sha              (defined in vite.config.ts)
// Both fall back to "unknown" when not injected (e.g. in Vitest).

declare const __APP_VERSION__: string | undefined;
declare const __APP_COMMIT__: string | undefined;

export function getSourceVersion(): { version: string; commit: string } {
  const version = typeof __APP_VERSION__ === "string" ? __APP_VERSION__ : "unknown";
  const commit = typeof __APP_COMMIT__ === "string" ? __APP_COMMIT__ : "unknown";
  return { version, commit };
}

export type ManifestSummary = {
  serverName: string;
  deployedVersion: string;
  toolCount: number;
};

export function summarizeManifest(manifest: unknown): ManifestSummary | null {
  const m = manifest as {
    mcp?: {
      server?: { name?: string; version?: string };
      tools?: unknown[];
    };
  } | null;
  if (!m?.mcp) return null;
  return {
    serverName: m.mcp.server?.name ?? "unknown",
    deployedVersion: m.mcp.server?.version ?? "unknown",
    toolCount: Array.isArray(m.mcp.tools) ? m.mcp.tools.length : 0,
  };
}

export type DriftReport = {
  hasDrift: boolean;
  sourceVersion: string;
  sourceCommit: string;
  deployedVersion: string;
  deployedToolCount: number;
  expectedToolCount: number;
  /** Tools present in source but not advertised by the deployed manifest. */
  missingRemote: string[];
  /** Tools advertised by the deployed manifest but not present in source. */
  extraRemote: string[];
  reasons: string[];
  status: "pass" | "warn";
};

/** Best-effort extraction of advertised tool names from a manifest blob. */
export function extractDeployedToolNames(manifest: unknown): string[] {
  const m = manifest as { mcp?: { tools?: Array<{ name?: unknown }> } } | null;
  const list = Array.isArray(m?.mcp?.tools) ? m!.mcp!.tools! : [];
  return list
    .map((t) => (typeof t?.name === "string" ? t.name : ""))
    .filter((n) => n.length > 0);
}

/**
 * Compare deployed manifest against local expectations without hitting
 * the network or triggering any deployment. Callers pass in the local
 * tool list (names) so this module does not have to import the MCP
 * registration at admin-page load time.
 */
export function detectMcpDrift(
  manifest: unknown,
  expected: { toolNames: string[] } | number,
): DriftReport {
  const src = getSourceVersion();
  const summary = summarizeManifest(manifest) ?? {
    serverName: "unknown",
    deployedVersion: "unknown",
    toolCount: 0,
  };
  const nameDiffAvailable = typeof expected !== "number";
  const expectedToolNames = nameDiffAvailable ? expected.toolNames : [];
  const expectedToolCount = typeof expected === "number" ? expected : expected.toolNames.length;
  const deployedNames = extractDeployedToolNames(manifest);
  const deployedSet = new Set(deployedNames);
  const expectedSet = new Set(expectedToolNames);

  // Only compute name-based drift when the caller supplied the source-side
  // tool name list; otherwise fall back to the legacy count-only comparison.
  const missingRemote = nameDiffAvailable ? expectedToolNames.filter((n) => !deployedSet.has(n)).sort() : [];
  const extraRemote = nameDiffAvailable ? deployedNames.filter((n) => !expectedSet.has(n)).sort() : [];

  const reasons: string[] = [];
  if (summary.deployedVersion === "unknown") reasons.push("deployed manifest missing version");
  if (summary.toolCount !== expectedToolCount) {
    reasons.push(`tool count drift (deployed=${summary.toolCount}, source=${expectedToolCount})`);
  }
  if (missingRemote.length > 0) reasons.push(`missing in remote: ${missingRemote.join(", ")}`);
  if (extraRemote.length > 0) reasons.push(`extra in remote: ${extraRemote.join(", ")}`);

  return {
    hasDrift: reasons.length > 0,
    sourceVersion: src.version,
    sourceCommit: src.commit,
    deployedVersion: summary.deployedVersion,
    deployedToolCount: summary.toolCount,
    expectedToolCount,
    missingRemote,
    extraRemote,
    reasons,
    status: reasons.length > 0 ? "warn" : "pass",
  };
}
