import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const read = (rel: string) => readFileSync(resolve(process.cwd(), rel), "utf8");
const index = read("src/pages/Index.tsx");
const hero = read("src/components/streamvista/Hero.tsx");
const navbar = read("src/components/streamvista/Navbar.tsx");
const finalCta = read("src/components/streamvista/FinalCta.tsx");

const CANONICAL_SUBMIT_URL = "https://www.crayonsloop.com/login";

describe("public homepage contract", () => {
  it("keeps the Solutions navigation target on a real homepage section", () => {
    expect(index).toContain('id="platform"');
    expect(navbar).toContain('/#platform');
  });

  it("uses one canonical creator submission path across public CTAs", () => {
    for (const [name, source] of [
      ["Navbar", navbar],
      ["Hero", hero],
      ["Index", index],
      ["FinalCta", finalCta],
    ] as const) {
      expect(source, `${name} must use the canonical creator intake`).toContain(CANONICAL_SUBMIT_URL);
    }
  });

  it("keeps the full desktop nav out of tablet widths", () => {
    expect(navbar).toContain('hidden xl:flex');
    expect(navbar).toContain('xl:hidden');
  });

  it("exposes the page main target for keyboard skip navigation", () => {
    expect(index).toContain('id="main-content"');
  });
});
