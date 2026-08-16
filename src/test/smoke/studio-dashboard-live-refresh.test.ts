import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  new URL("../../components/studio/dashboard/StudioMvpHome.tsx", import.meta.url),
  "utf8",
);

describe("Studio dashboard live-data contract", () => {
  it("refreshes every 15 minutes and when the browser regains focus", () => {
    expect(source).toContain("const AUTO_REFRESH_MS = 15 * 60 * 1000");
    expect(source).toContain('window.addEventListener("focus", refreshOnFocus)');
    expect(source).toContain("setRefreshTick((n) => n + 1)");
  });

  it("shows explicit data freshness and a manual refresh action", () => {
    expect(source).toContain("Live workspace data");
    expect(source).toContain("Auto-refreshes every 15 min and on focus");
    expect(source).toContain('aria-label="Refresh studio dashboard data"');
  });

  it("uses a single unit-aware formatter for storage usage", () => {
    expect(source).toContain("fmtUsedCapacity(usedGb)");
    expect(source).toContain("Math.round(gb * 1024)");
    expect(source).not.toContain("GB GB");
  });
});
