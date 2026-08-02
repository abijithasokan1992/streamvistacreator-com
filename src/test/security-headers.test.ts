import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

const vercelConfig = JSON.parse(readFileSync(resolve("vercel.json"), "utf8")) as {
  headers?: Array<{ source: string; headers: Array<{ key: string; value: string }> }>;
};

describe("security headers configuration", () => {
  it("defines required headers for all routes on Vercel", () => {
    const globalHeaders = vercelConfig.headers?.find((entry) => entry.source === "/(.*)");
    expect(globalHeaders).toBeDefined();

    const headerKeys = new Set(globalHeaders?.headers.map((header) => header.key));
    for (const key of [
      "Content-Security-Policy",
      "X-Frame-Options",
      "Permissions-Policy",
      "Cross-Origin-Opener-Policy",
      "Cross-Origin-Embedder-Policy",
      "Cross-Origin-Resource-Policy",
    ]) {
      expect(headerKeys.has(key)).toBe(true);
    }
  });

  it("keeps sidebar cookie SameSite-protected", () => {
    const sidebarSource = readFileSync(resolve("src/components/ui/sidebar.tsx"), "utf8");
    expect(sidebarSource).toContain("SameSite=Lax");
    expect(sidebarSource).toContain("; Secure");
  });
});
