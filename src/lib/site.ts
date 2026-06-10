// Canonical production origin for the app. Used by auth redirects,
// transactional links, and anywhere we need a stable URL that survives
// preview/staging hostnames. Keep in sync with site_config.primary_domain.
export const APP_ORIGIN = "https://app.crayonspictures.com";

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
    hostname.endsWith(".lovableproject.com");
  return isLocal ? origin : APP_ORIGIN;
}
