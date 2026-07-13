import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";
import robotsParser from "robots-parser";

const ROBOTS_URL = "https://streamvista.in/robots.txt";
const BASE = "https://streamvista.in";

const robotsTxt = readFileSync(resolve("public/robots.txt"), "utf8");
const robots = robotsParser(ROBOTS_URL, robotsTxt);

const AGENTS = [
  "Googlebot",
  "Bingbot",
  "Twitterbot",
  "facebookexternalhit",
  "LinkedInBot",
  "Slackbot",
  "GenericCrawler/1.0", // exercises the User-agent: * block
];

// Prerendered/public routes that MUST stay crawlable.
const ALLOWED_ROUTES = [
  "/",
  "/pricing",
  "/about",
  "/dmca",
  "/ip-copyright",
  "/blog/camera-to-cloud-guide",
];

// Transactional / token / auth routes that MUST be blocked.
const DISALLOWED_ROUTES = [
  "/checkout/abc123",
  "/billing/invoice-9",
  "/invoice/xyz",
  "/s/share-token",
  "/review/r-1",
  "/screening/sc-1",
  "/unsubscribe?token=abc",
  "/ingest-test",
  "/home",
  "/auth/login",
  "/admin/users",
  "/dashboard/overview",
  "/reset-password",
];

describe("robots.txt policy", () => {
  it("declares the canonical sitemap URL", () => {
    const sitemaps = robots.getSitemaps();
    expect(sitemaps).toContain(`${BASE}/sitemap.xml`);
  });

  for (const ua of AGENTS) {
    describe(`user-agent: ${ua}`, () => {
      for (const path of ALLOWED_ROUTES) {
        it(`allows ${path}`, () => {
          expect(robots.isAllowed(`${BASE}${path}`, ua)).toBe(true);
        });
      }
      for (const path of DISALLOWED_ROUTES) {
        it(`disallows ${path}`, () => {
          expect(robots.isDisallowed(`${BASE}${path}`, ua)).toBe(true);
        });
      }
    });
  }
});
