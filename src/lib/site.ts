// Canonical production origin for the app. Used by auth redirects,
// transactional links, and anywhere we need a stable URL that survives
// preview/staging hostnames. Keep in sync with site_config.primary_domain.
//
// Production payment + app domain (Studio Vault, auth callbacks, invoices,
// post-checkout returns):  https://streamvista.in (bare domain is canonical)
// Preview-only fallback:    https://streamvista-creator.lovable.app
// Corporate / parent brand: https://www.crayonspictures.com  (NOT used for
//   app/payment/auth callbacks anymore — historically `app.crayonspictures.com`
//   was used and is now deprecated.)
export const APP_ORIGIN = "https://streamvista.in";
export const APP_ORIGIN_WWW = "https://www.streamvista.in";
export const PREVIEW_ORIGIN = "https://streamvista-creator.lovable.app";
export const CORPORATE_SITE = "https://www.crayonspictures.com";

/**
 * Legacy production origins retained during the streamvistacreator.com →
 * streamvista.in migration. Kept in the CORS/redirect allow-list as a
 * fallback until SSL, auth, and OAuth on the new domain are verified.
 * Do NOT use for new outbound links.
 */
export const LEGACY_APP_ORIGINS = [
  "https://streamvistacreator.com",
  "https://www.streamvistacreator.com",
];

/** Domains explicitly retired from active app/payment/auth use. */
export const DEPRECATED_APP_ORIGINS = [
  "https://app.crayonspictures.com",
  "https://www.app.crayonspictures.com",
  "https://https-app-crayonspictures-com.lovable.app",
];


/**
 * Returns the origin to use for outbound links (email redirects, OAuth
 * callbacks, shareable URLs). In production we always pin to APP_ORIGIN so
 * that emails sent from preview deploys still land on the live domain.
 * On localhost / preview hosts we keep the current origin so dev flows work.
 */
export function getAppOrigin(): string {
  if (typeof window === "undefined") return APP_ORIGIN;
  const { hostname, origin } = window.location;
  const isLocal =
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname.endsWith(".lovable.app") ||
    hostname.endsWith(".lovableproject.com") ||
    hostname.endsWith(".vercel.app");
  return isLocal ? origin : APP_ORIGIN;
}

/**
 * Classify the current browser origin for operator-facing diagnostics.
 * Returns 'production' on the canonical streamvista.in domains,
 * 'preview' on supported preview hosts / localhost, and 'deprecated' if the
 * app is somehow being served from a retired domain.
 */
export function classifyOrigin(origin?: string): "production" | "preview" | "deprecated" | "unknown" {
  const o = (origin ?? (typeof window !== "undefined" ? window.location.origin : "")).toLowerCase();
  if (!o) return "unknown";
  if (DEPRECATED_APP_ORIGINS.some(d => o.startsWith(d))) return "deprecated";
  if (o.includes("streamvista.in")) return "production";
  if (
    o.includes(".lovable.app") ||
    o.includes(".lovableproject.com") ||
    o.includes(".vercel.app") ||
    o.includes("localhost") ||
    o.includes("127.0.0.1")
  ) return "preview";
  return "unknown";
}
