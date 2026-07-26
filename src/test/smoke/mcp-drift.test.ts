import { describe, it, expect } from "vitest";
import { detectMcpDrift, summarizeManifest } from "@/lib/build/version";
import manifest from "../../../public/.lovable/mcp/manifest.json";

describe("mcp manifest drift", () => {
  it("summarizes the deployed manifest", () => {
    const s = summarizeManifest(manifest);
    expect(s).not.toBeNull();
    expect(s!.toolCount).toBeGreaterThan(0);
    expect(s!.deployedVersion).toMatch(/\d+\.\d+\.\d+/);
  });

  it("flags drift when local tool count diverges", () => {
    const s = summarizeManifest(manifest)!;
    const drift = detectMcpDrift(manifest, s.toolCount + 5);
    expect(drift.hasDrift).toBe(true);
    expect(drift.reasons.join(" ")).toMatch(/tool count drift/);
  });

  it("reports no drift when counts match", () => {
    const s = summarizeManifest(manifest)!;
    const drift = detectMcpDrift(manifest, s.toolCount);
    expect(drift.hasDrift).toBe(false);
    expect(drift.reasons).toEqual([]);
  });
});

describe("MCP tools stay read-only by default", () => {
  // Explicitly reviewed write-capable tools. Anything else that ever gains
  // write capability must be added here in the same PR that flips its hint.
  const APPROVED_WRITE_TOOLS = new Set([
    "ctrl_delete_draft_titles",
    "ctrl_import_legacy_titles",
  ]);
  it("every deployed manifest tool declares readOnlyHint=true (or is on the approved write list)", () => {
    const tools = (manifest as any).mcp.tools as Array<{
      name: string;
      annotations?: { readOnlyHint?: boolean };
    }>;
    const unapproved = tools
      .filter((t) => t.annotations?.readOnlyHint !== true)
      .map((t) => t.name)
      .filter((n) => !APPROVED_WRITE_TOOLS.has(n));
    expect(unapproved).toEqual([]);
  });
});
