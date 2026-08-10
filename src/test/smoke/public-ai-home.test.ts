import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const read = (rel: string) => readFileSync(resolve(process.cwd(), rel), "utf8");

describe("public AI homepage", () => {
  const index = read("src/pages/Index.tsx");
  const home = read("src/components/streamvista/PublicAiHome.tsx");
  const config = read("supabase/config.toml");
  const assistant = read("supabase/functions/public-assistant/index.ts");

  it("uses one canonical AI-first homepage surface", () => {
    expect(index).toContain("PublicAiHome");
    expect(index).not.toMatch(/<Hero\b/);
    expect(index).not.toMatch(/<Navbar\b/);
  });

  it("keeps creator submission and buyer access visible", () => {
    expect(home).toContain("https://www.crayonsloop.com/login");
    expect(home).toContain("/contact?topic=buyer-access");
  });

  it("routes public chat through a server-side edge function", () => {
    expect(home).toContain('supabase.functions.invoke("public-assistant"');
    expect(config).toMatch(/\[functions\.public-assistant\][\s\S]*?verify_jwt\s*=\s*false/);
  });

  it("caps anonymous request size and output", () => {
    expect(assistant).toContain("MAX_REQUESTS_PER_WINDOW = 20");
    expect(assistant).toContain("totalChars > 18000");
    expect(assistant).toContain("maxOutputTokens: 700");
  });

  it("does not grant public assistant private-data access", () => {
    expect(assistant).toContain("has no access to private dashboards");
    expect(assistant).not.toMatch(/createClient\(/);
    expect(assistant).not.toMatch(/service_role/i);
  });
});
