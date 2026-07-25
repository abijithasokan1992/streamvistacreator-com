import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

describe("homepage cleanup contract", () => {
  it("does not render the unverified partner badge strip", () => {
    const index = source("src/pages/Index.tsx");
    expect(index).not.toContain("TrustedDistributionPartners");
  });

  it("does not repeat trust badges in the footer", () => {
    const footer = source("src/components/streamvista/Footer.tsx");
    expect(footer).not.toContain("HTTPS Encrypted");
    expect(footer).not.toContain("StreamVista Cloud X");
    expect(footer).not.toContain("IP & Copyright Compliance");
  });

  it("lists AI licensing only in its dedicated homepage section", () => {
    const rights = source("src/components/streamvista/RightsDistribution.tsx");
    const ai = source("src/components/home/AIContentLicensingSection.tsx");
    expect(rights).not.toContain("AI Training & Machine Learning");
    expect(ai).toContain("AI Training &amp; Machine Learning");
  });

  it("keeps both creator and buyer entry points wired", () => {
    const hero = source("src/components/streamvista/Hero.tsx");
    expect(hero).toContain('/auth?intent=signup');
    expect(hero).toContain('/contact?topic=buyer-access');
    expect(hero).toContain("dashboardForRole(role)");
  });
});
