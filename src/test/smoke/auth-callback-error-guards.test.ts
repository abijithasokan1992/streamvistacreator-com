import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("../../pages/AuthCallback.tsx", import.meta.url), "utf8");

describe("auth callback error guards", () => {
  it("checks initial role assignment errors", () => {
    expect(source).toContain("error: roleError");
    expect(source).toContain("if (roleError) throw roleError");
  });

  it("checks profile upsert errors", () => {
    expect(source).toContain("error: profileError");
    expect(source).toContain("if (profileError) throw profileError");
  });

  it("checks user role reload errors", () => {
    expect(source).toContain("error: rolesError");
    expect(source).toContain("if (rolesError) throw rolesError");
  });

  it("logs optional legacy-claim failures without blocking login", () => {
    expect(source).toContain("error: claimError");
    expect(source).toContain('console.warn("legacy claim skipped", e)');
  });
});
