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
  reasons: string[];
};

/**
 * Compare deployed manifest against local expectations without hitting
 * the network or triggering any deployment. `expectedToolCount` is the
 * count from the local MCP registration; caller passes it in so we
 * don't import the MCP module at admin-page load time.
 */
export function detectMcpDrift(
  manifest: unknown,
  expectedToolCount: number,
): DriftReport {
  const src = getSourceVersion();
  const summary = summarizeManifest(manifest) ?? {
    serverName: "unknown",
    deployedVersion: "unknown",
    toolCount: 0,
  };
  const reasons: string[] = [];
  if (summary.deployedVersion === "unknown") reasons.push("deployed manifest missing version");
  if (summary.toolCount !== expectedToolCount) {
    reasons.push(
      `tool count drift (deployed=${summary.toolCount}, source=${expectedToolCount})`,
    );
  }
  return {
    hasDrift: reasons.length > 0,
    sourceVersion: src.version,
    sourceCommit: src.commit,
    deployedVersion: summary.deployedVersion,
    deployedToolCount: summary.toolCount,
    expectedToolCount,
    reasons,
  };
}
