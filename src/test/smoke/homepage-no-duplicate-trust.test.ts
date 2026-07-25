import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * P1 guard: the homepage used to render trust surfaces twice — once as a
 * standalone <TrustBadges /> band under the hero, and again as the footer
 * trust chip row (isHome branch in Footer.tsx). We resolved this by removing
 * the standalone band from Index.tsx. This test locks that decision in so a
 * future refactor can't silently re-introduce the duplicate.
 *
 * Kept as a source-file assertion (not a full render) to stay hermetic and
 * fast — Index.tsx pulls in the auth provider, router, Seo etc.
 */

const read = (rel: string) => readFileSync(resolve(process.cwd(), rel), "utf8");

describe("homepage — trust surfaces render only once", () => {
  const index = read("src/pages/Index.tsx");

  it("Index.tsx does NOT import the standalone TrustBadges band", () => {
    // The footer already renders trust chips on the home route; a standalone
    // <TrustBadges /> band immediately below the hero created visual + a11y
    // duplication.
    expect(index).not.toMatch(/from ["']@\/components\/streamvista\/TrustBadges["']/);
    expect(index).not.toMatch(/<TrustBadges\b/);
  });

  it("Index.tsx renders TrustedDistributionPartners at most once", () => {
    const matches = index.match(/<TrustedDistributionPartners\b/g) ?? [];
    expect(matches.length).toBeLessThanOrEqual(1);
  });

  it("Footer trust chips are gated behind isHome so they render on '/' only", () => {
    const footer = read("src/components/streamvista/Footer.tsx");
    expect(footer).toMatch(/const\s+isHome\s*=\s*location\.pathname\s*===\s*["']\/["']/);
    // The chip <ul> must sit inside the {isHome && (...)} branch.
    expect(footer).toMatch(/isHome\s*&&/);
  });

  it("each trust chip label is declared exactly once in the Footer TRUST array", () => {
    const footer = read("src/components/streamvista/Footer.tsx");
    const trustBlock = footer.match(/const TRUST[^=]*=\s*\[([\s\S]*?)\];/);
    expect(trustBlock, "Footer TRUST array not found").toBeTruthy();
    const labels = [...(trustBlock![1].matchAll(/label:\s*["']([^"']+)["']/g))].map((m) => m[1]);
    const seen = new Set<string>();
    for (const l of labels) {
      expect(seen.has(l), `Duplicate trust label "${l}" in Footer TRUST`).toBe(false);
      seen.add(l);
    }
    expect(labels.length).toBeGreaterThan(0);
  });
});
