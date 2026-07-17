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
  it("every deployed manifest tool declares readOnlyHint=true", () => {
    const tools = (manifest as any).mcp.tools as Array<{
      name: string;
      annotations?: { readOnlyHint?: boolean };
    }>;
    const writeCapable = tools.filter((t) => t.annotations?.readOnlyHint !== true);
    // If any tool ever gains write capability it must be an explicit,
    // reviewed change. Fail the build otherwise.
    expect(writeCapable.map((t) => t.name)).toEqual([]);
  });
});
