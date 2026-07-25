import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * P1 guard: the Footer links to /dmca#submit-notice, /dmca#grievance and a
 * handful of internal routes. Two ways this regressed historically:
 *   1. The IPCopyright page dropped the anchor id wrappers (LegalSection
 *      doesn't accept an id prop), so the hash scrolled nowhere.
 *   2. Footer link `to` values pointed at routes that were removed from
 *      App.tsx during route cleanups.
 *
 * This test locks both surfaces together.
 */

const read = (rel: string) => readFileSync(resolve(process.cwd(), rel), "utf8");

const footer = read("src/components/streamvista/Footer.tsx");
const app = read("src/App.tsx");
const dmca = read("src/pages/IPCopyright.tsx");

function extractFooterLinks(): { path: string; hash: string | null }[] {
  const toValues = [...footer.matchAll(/to:\s*["']([^"']+)["']/g)].map((m) => m[1]);
  return toValues
    .filter((v) => v.startsWith("/"))
    .map((v) => {
      const [path, hash = null] = v.split("#");
      return { path, hash };
    });
}

function routeIsRegistered(path: string): boolean {
  // Match <Route path="/foo" ... /> or Navigate to="/foo" in App.tsx.
  // Allow the "/" root and hash-scroll paths like "/#platform".
  if (path === "/") return true;
  const escaped = path.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`path=["']${escaped}["']`).test(app);
}

describe("footer anchor + route links resolve", () => {
  const links = extractFooterLinks();

  it("extracts a non-empty set of footer links", () => {
    expect(links.length).toBeGreaterThan(0);
  });

  it.each(links.map((l) => [l.path + (l.hash ? `#${l.hash}` : ""), l] as const))(
    "footer link %s points at a registered route",
    (_label, link) => {
      // Hash-only in-page anchors on the home route ("/#platform") are handled
      // by the browser, not react-router — accept them as long as the base
      // path resolves. All others must match a real <Route path=...>.
      expect(
        routeIsRegistered(link.path),
        `Footer link ${link.path} is not registered in App.tsx`,
      ).toBe(true);
    },
  );

  it("DMCA anchor targets (#submit-notice, #grievance) exist as ids on the DMCA page", () => {
    const dmcaAnchors = links.filter((l) => l.path === "/dmca" && l.hash);
    expect(dmcaAnchors.length).toBeGreaterThan(0);
    for (const link of dmcaAnchors) {
      const idPattern = new RegExp(`id=["']${link.hash}["']`);
      expect(
        idPattern.test(dmca),
        `IPCopyright.tsx is missing id="${link.hash}" for footer link /dmca#${link.hash}`,
      ).toBe(true);
    }
  });

  it("/dmca route is served by the IPCopyright page", () => {
    expect(app).toMatch(/path=["']\/dmca["']\s+element=\{<IPCopyright/);
  });

  it("core Trust & Safety footer targets are wired", () => {
    const labels = [...footer.matchAll(/label:\s*["']([^"']+)["']/g)].map((m) => m[1]);
    expect(labels).toEqual(expect.arrayContaining([
      "Report IP infringement",
      "Grievance officer",
      "IP policy",
    ]));
  });
});
