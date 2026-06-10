/**
 * useHostMode
 * ───────────
 * Determines whether the current browser is on the **admin** subdomain
 * (`admin.streamvistacreator.com`) or the **public** main domain.
 *
 * Both hosts serve the same Lovable build — this hook lets the app
 * render completely different route trees per host so the admin console
 * never appears on the public site, and vice-versa.
 *
 * For local dev / Lovable preview where no real subdomain exists, you
 * can force admin mode by appending `?host=admin` once — the choice is
 * stored in sessionStorage. Use `?host=public` (or clear storage) to
 * reset.
 */
export type HostMode = "admin" | "public";

const ADMIN_HOST_PREFIX = "admin.";
const OVERRIDE_KEY = "sv_host_mode";

export function detectHostMode(): HostMode {
  if (typeof window === "undefined") return "public";

  // 1. Explicit override via query string (dev/preview only)
  try {
    const url = new URL(window.location.href);
    const q = url.searchParams.get("host");
    if (q === "admin" || q === "public") {
      sessionStorage.setItem(OVERRIDE_KEY, q);
    }
    const stored = sessionStorage.getItem(OVERRIDE_KEY);
    if (stored === "admin") return "admin";
    if (stored === "public") return "public";
  } catch {
    /* sessionStorage unavailable — fall through to hostname check */
  }

  // 2. Real hostname check
  const host = window.location.hostname.toLowerCase();
  if (host.startsWith(ADMIN_HOST_PREFIX)) return "admin";
  return "public";
}

export function useHostMode(): HostMode {
  return detectHostMode();
}

/** Build the canonical URL for a given host mode (used for cross-host redirects). */
export function urlForHost(mode: HostMode, path = "/"): string {
  if (typeof window === "undefined") return path;
  const current = window.location.hostname.toLowerCase();
  // On preview / localhost we cannot actually switch hostnames — stay on
  // the same origin and use the ?host= override instead.
  const isRealDomain =
    current.endsWith("streamvistacreator.com") &&
    !current.includes("lovable.app") &&
    !current.includes("localhost");

  if (!isRealDomain) {
    const sep = path.includes("?") ? "&" : "?";
    return `${path}${sep}host=${mode}`;
  }

  const rootDomain = "streamvistacreator.com";
  const targetHost = mode === "admin" ? `admin.${rootDomain}` : rootDomain;
  return `https://${targetHost}${path}`;
}
