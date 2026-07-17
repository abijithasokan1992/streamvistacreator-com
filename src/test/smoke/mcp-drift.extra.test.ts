import { describe, it, expect } from "vitest";
import { detectMcpDrift } from "@/lib/build/version";

const manifest = (tools: string[], version = "1.0.0") => ({
  mcp: { server: { name: "streamvista-mcp", version }, tools: tools.map((name) => ({ name })) },
});

describe("mcp drift · tool name diffing", () => {
  it("PASS when names + count align", () => {
    const d = detectMcpDrift(manifest(["a", "b", "c"]), { toolNames: ["a", "b", "c"] });
    expect(d.status).toBe("pass");
    expect(d.hasDrift).toBe(false);
    expect(d.missingRemote).toEqual([]);
    expect(d.extraRemote).toEqual([]);
  });

  it("WARN with missingRemote when source has a tool the deployment doesn't advertise", () => {
    const d = detectMcpDrift(manifest(["a"]), { toolNames: ["a", "b"] });
    expect(d.status).toBe("warn");
    expect(d.missingRemote).toEqual(["b"]);
    expect(d.reasons.some((r) => r.includes("missing"))).toBe(true);
  });

  it("WARN with extraRemote when deployed advertises unknown tools", () => {
    const d = detectMcpDrift(manifest(["a", "b", "c"]), { toolNames: ["a"] });
    expect(d.status).toBe("warn");
    expect(d.extraRemote).toEqual(["b", "c"]);
  });

  it("tolerates missing manifest (fully unknown deployment)", () => {
    const d = detectMcpDrift(null, { toolNames: ["a"] });
    expect(d.status).toBe("warn");
    expect(d.deployedVersion).toBe("unknown");
  });
});
