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

export const SITE_ORIGIN = "https://streamvista.in";

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
    title: "StreamVista — Film Sales, Content Licensing & OTT Distribution Network",
    description:
      "Connect films, series and screen content with verified OTT platforms, broadcasters, satellite TV, FAST channels, distributors and streaming services worldwide. StreamVista supports rights-ready catalogues, buyer discovery and professional delivery workflows.",
    ogImage: `${SITE_ORIGIN}/og/home.jpg`,
    ogType: "website",
  },
  {
    path: "/sell-your-film",
    title: "Sell Your Film — Connect With OTT, Broadcasters & Buyers | StreamVista",
    description:
      "List your feature film, series or documentary on StreamVista and connect with verified OTT platforms, broadcasters, satellite TV, FAST channels and digital streaming buyers worldwide.",
    ogImage: `${SITE_ORIGIN}/og/home.jpg`,
    ogType: "website",
  },
  {
    path: "/film-distribution",
    title: "Film Distribution Platform — OTT, Broadcast, Satellite & FAST | StreamVista",
    description:
      "Coordinate film distribution across OTT platforms, broadcasters, satellite television, FAST channels and digital streaming services on StreamVista.",
    ogImage: `${SITE_ORIGIN}/og/home.jpg`,
    ogType: "website",
  },
  {
    path: "/ott-content-licensing",
    title: "OTT Content Licensing — Films, Series & Documentaries | StreamVista",
    description:
      "License films, series and documentaries to OTT platforms, digital streaming services and FAST channels. Verified rights holders connect with acquisition teams worldwide.",
    ogImage: `${SITE_ORIGIN}/og/home.jpg`,
    ogType: "website",
  },
  {
    path: "/content-owners",
    title: "For Content Owners — Producers, Studios & Rights Holders | StreamVista",
    description:
      "A workflow platform for creators, filmmakers, producers, studios and rights holders to present rights-ready catalogues to OTT, broadcast, satellite and digital buyers.",
    ogImage: `${SITE_ORIGIN}/og/home.jpg`,
    ogType: "website",
  },
  {
    path: "/submit-content",
    title: "Submit Your Film or Series for Licensing | StreamVista",
    description:
      "Submit a film, series or documentary to StreamVista for rights review, buyer discovery and professional licensing workflows across OTT, broadcast, satellite, FAST and digital platforms.",
    ogImage: `${SITE_ORIGIN}/og/home.jpg`,
    ogType: "website",
  },
  {
    path: "/buyers",
    title: "For Buyers — OTT, Broadcast, Satellite, FAST & Digital | StreamVista",
    description:
      "OTT platforms, broadcasters, satellite TV, FAST channels, distributors and digital streaming services can discover rights-ready films, series and documentaries on StreamVista.",
    ogImage: `${SITE_ORIGIN}/og/home.jpg`,
    ogType: "website",
  },
  {
    path: "/film-rights",
    title: "Film Rights — Territory, Window & Platform Licensing | StreamVista",
    description:
      "Manage and present film rights across territory, language, exclusivity and window — OTT, satellite TV, FAST, digital and broadcast.",
    ogImage: `${SITE_ORIGIN}/og/home.jpg`,
    ogType: "website",
  },
  {
    path: "/regional-indian-cinema",
    title: "Regional Indian Cinema — Malayalam & South Indian Licensing | StreamVista",
    description:
      "License Malayalam, Tamil, Telugu, Kannada and other regional Indian films and series to OTT, satellite TV, FAST and digital streaming buyers worldwide.",
    ogImage: `${SITE_ORIGIN}/og/home.jpg`,
    ogType: "website",
  },
  {
    path: "/global-film-sales",
    title: "Global Film Sales — Multi-Territory Licensing Workflow | StreamVista",
    description:
      "Present films, series and documentaries to OTT, broadcast, satellite, FAST and digital buyers across global territories on StreamVista.",
    ogImage: `${SITE_ORIGIN}/og/home.jpg`,
    ogType: "website",
  },
  {
    path: "/how-it-works",
    title: "How StreamVista Works — Connecting Content Owners and Buyers",
    description:
      "A step-by-step overview of how creators, producers, studios and rights holders present titles and connect with OTT, broadcast and streaming buyers on StreamVista.",
    ogImage: `${SITE_ORIGIN}/og/home.jpg`,
    ogType: "website",
  },
  {
    path: "/trust-and-rights",
    title: "Trust & Rights — Verified Buyers and IP Protection | StreamVista",
    description:
      "How StreamVista verifies buyers, protects content owner IP, handles screener access and enforces rights and copyright policies.",
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
    title: "Get Started with StreamVista — Onboarding for Filmmakers & Studios",
    description:
      "Onboard to StreamVista Cloud X — the secure film industry platform for independent filmmakers, production studios and OTT/rights buyers. Store film masters, manage licensing rights and deliver titles studio-to-buyer.",
    ogImage: `${SITE_ORIGIN}/og/onboarding.jpg`,
    ogType: "website",
  },
  {
    path: "/solutions/ai-content-licensing",
    title: "AI Training Content Licensing — StreamVista",
    description:
      "License rights-verified, professionally produced audio-video content for approved AI and machine-learning use cases. Rights verification, technical QC, and written authorization required.",
    ogImage: `${SITE_ORIGIN}/og/home.jpg`,
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
    title: "Camera to Cloud Guide for Indie Filmmakers | StreamVista",
    description:
      "Practical Camera to Cloud (C2C) workflow guide for indie filmmakers: encoders, mobile rigs, NDI and cost-effective dailies delivery.",
    ogImage: `${SITE_ORIGIN}/og/camera-to-cloud-guide.jpg`,
    ogType: "article",
  },
  {
    path: "/blog/streamvista-vs-frame-io-camera-to-cloud",
    title: "StreamVista vs Frame.io — Best C2C Alternative",
    description:
      "Compare StreamVista and Frame.io for Camera to Cloud: pricing, rights management, data residency and Indian cinema workflows.",
    ogImage: `${SITE_ORIGIN}/og/home.jpg`,
    ogType: "article",
  },
  {
    path: "/guides/film-licensing-costs-and-agreements",
    title: "Film Licensing Costs & Agreements — 2026 Guide | StreamVista",
    description:
      "How film licensing fees are structured across OTT, satellite TV, FAST and theatrical windows — with agreement types, term sheets and negotiation levers.",
    ogImage: `${SITE_ORIGIN}/og/home.jpg`,
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
