/**
 * Per-route static HTML shell prerenderer.
 *
 * Vite SPAs serve the same index.html for every path, so social crawlers
 * (Facebook, WhatsApp, LinkedIn, Slack, X) — which don't run JS — only ever
 * see the homepage <head>. React Helmet mutations land too late for them.
 *
 * After `vite build`, this writes a route-specific `dist/<path>/index.html`
 * with the final <title>, description, canonical, og:*, twitter:* tags
 * already baked into the HTML response body. The SPA still hydrates and
 * routes normally after load.
 */
import fs from "node:fs";
import path from "node:path";

export const SITE_ORIGIN = "https://streamvistacreator.com";

export type RouteMeta = {
  path: string;          // e.g. "/dmca" or "/" for homepage
  title: string;
  description: string;
  ogImage: string;       // absolute URL
  ogType?: "website" | "article";
};

export const ROUTES: RouteMeta[] = [
  {
    path: "/",
    title: "StreamVista Cloud X — Creator Studio Cloud Storage",
    description:
      "StreamVista Cloud X is the secure creator studio cloud platform for media professionals to onboard, store, share and monetise content.",
    ogImage: `${SITE_ORIGIN}/og/home.jpg`,
    ogType: "website",
  },
  {
    path: "/pricing",
    title: "Pricing — StreamVista Cloud X Plans for Creators & Studios",
    description:
      "Transparent storage and licensing plans for filmmakers, creators and studios. Pay only for what you stream, store and license on StreamVista.",
    ogImage: `${SITE_ORIGIN}/og/pricing.jpg`,
    ogType: "website",
  },
  {
    path: "/about",
    title: "About StreamVista — Built for Filmmakers and Studios",
    description:
      "StreamVista is a secure cloud studio for media professionals — built around the camera-to-cloud workflow, rights management and direct licensing.",
    ogImage: `${SITE_ORIGIN}/og/about.jpg`,
    ogType: "website",
  },
  {
    path: "/dmca",
    title: "DMCA Policy — StreamVista Cloud X",
    description:
      "How to file a DMCA notice or counter-notice with StreamVista, our designated agent details, and how takedown requests are processed.",
    ogImage: `${SITE_ORIGIN}/og/dmca.jpg`,
    ogType: "website",
  },
  {
    path: "/onboarding",
    title: "Get Started with StreamVista — Creator & Studio Onboarding",
    description:
      "Onboard to StreamVista Cloud X in under a minute. Creators, studios and buyers set up a secure workspace for camera-to-cloud ingest, rights and licensing.",
    ogImage: `${SITE_ORIGIN}/og/onboarding.jpg`,
    ogType: "website",
  },
  {
    path: "/auth",
    title: "Sign in to StreamVista Cloud X",
    description:
      "Sign in or create your StreamVista Cloud X account to access your secure creator, studio or buyer workspace.",
    ogImage: `${SITE_ORIGIN}/og/home.jpg`,
    ogType: "website",
  },
  {
    path: "/ip-copyright",
    title: "IP & Copyright Policy — StreamVista Cloud X",
    description:
      "How StreamVista protects creator intellectual property, our copyright stance, rights metadata, and enforcement of licensed and original work.",
    ogImage: `${SITE_ORIGIN}/og/ip-copyright.jpg`,
    ogType: "website",
  },
  {
    path: "/blog/camera-to-cloud-guide",
    title: "Camera-to-Cloud Guide — StreamVista Cloud X",
    description:
      "A practical guide to camera-to-cloud workflows for filmmakers: proxies, dailies, secure uploads, and how StreamVista replaces ad-hoc transfer chains.",
    ogImage: `${SITE_ORIGIN}/og/camera-to-cloud-guide.jpg`,
    ogType: "article",
  },
];

function esc(v: string) {
  return v.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** Replace or insert a head tag identified by a regex. */
function upsertHead(html: string, matcher: RegExp, replacement: string): string {
  if (matcher.test(html)) return html.replace(matcher, replacement);
  return html.replace(/<\/head>/i, `  ${replacement}\n  </head>`);
}

/** Strip every occurrence (handles dupes from earlier appends). */
function stripAll(html: string, matcher: RegExp): string {
  return html.replace(matcher, "");
}

export function rewriteHead(template: string, meta: RouteMeta): string {
  const url = `${SITE_ORIGIN}${meta.path === "/" ? "/" : meta.path}`;
  let html = template;

  // <title>
  html = html.replace(/<title>[\s\S]*?<\/title>/i, `<title>${esc(meta.title)}</title>`);

  // Drop existing instances of every tag we manage, then write fresh ones,
  // so we never end up with the old generic value alongside the new one.
  html = stripAll(html, /\s*<meta\s+name=["']description["'][^>]*>/gi);
  html = stripAll(html, /\s*<link\s+rel=["']canonical["'][^>]*>/gi);
  html = stripAll(html, /\s*<meta\s+property=["']og:(title|description|url|image|type)["'][^>]*>/gi);
  html = stripAll(html, /\s*<meta\s+name=["']twitter:(card|title|description|image)["'][^>]*>/gi);

  const tags = [
    `<meta name="description" content="${esc(meta.description)}" />`,
    `<link rel="canonical" href="${esc(url)}" />`,
    `<meta property="og:type" content="${esc(meta.ogType ?? "website")}" />`,
    `<meta property="og:url" content="${esc(url)}" />`,
    `<meta property="og:title" content="${esc(meta.title)}" />`,
    `<meta property="og:description" content="${esc(meta.description)}" />`,
    `<meta property="og:image" content="${esc(meta.ogImage)}" />`,
    `<meta name="twitter:card" content="summary_large_image" />`,
    `<meta name="twitter:title" content="${esc(meta.title)}" />`,
    `<meta name="twitter:description" content="${esc(meta.description)}" />`,
    `<meta name="twitter:image" content="${esc(meta.ogImage)}" />`,
  ].join("\n    ");

  html = html.replace(/<\/head>/i, `    ${tags}\n  </head>`);
  return html;
}

export function prerender(distDir: string): { written: string[] } {
  const indexPath = path.join(distDir, "index.html");
  if (!fs.existsSync(indexPath)) return { written: [] };
  const template = fs.readFileSync(indexPath, "utf8");
  const written: string[] = [];

  for (const meta of ROUTES) {
    const html = rewriteHead(template, meta);
    let outPath: string;
    if (meta.path === "/") {
      outPath = indexPath; // overwrite the homepage shell with homepage-specific tags
    } else {
      const dir = path.join(distDir, meta.path.replace(/^\//, ""));
      fs.mkdirSync(dir, { recursive: true });
      outPath = path.join(dir, "index.html");
    }
    fs.writeFileSync(outPath, html, "utf8");
    written.push(path.relative(distDir, outPath));
  }
  return { written };
}
