// Canonical production origin for auth callbacks, payments, emails, and shared links.
export const APP_ORIGIN = "https://streamvista.in";
export const APP_ORIGIN_WWW = "https://www.streamvista.in";
export const PREVIEW_ORIGIN = "https://streamvista-creator.lovable.app";
export const CORPORATE_SITE = "https://www.crayonspictures.com";

/**
 * Public deployments always return to the canonical StreamVista domain.
 * Local development keeps its own origin so developers can test auth locally.
 */
export function getAppOrigin(): string {
  if (typeof window === "undefined") return APP_ORIGIN;

  const { hostname, origin } = window.location;
  const isLocal = hostname === "localhost" || hostname === "127.0.0.1";

  return isLocal ? origin : APP_ORIGIN;
}

/** Classify the current host for operator-facing diagnostics. */
export function classifyOrigin(
  origin?: string,
): "production" | "preview" | "deprecated" | "unknown" {
  const value = (
    origin ?? (typeof window !== "undefined" ? window.location.origin : "")
  ).toLowerCase();

  if (!value) return "unknown";
  if (value.includes("streamvista.in")) return "production";
  if (
    value.includes(".lovable.app") ||
    value.includes(".lovableproject.com") ||
    value.includes("localhost") ||
    value.includes("127.0.0.1")
  ) {
    return "preview";
  }
  if (
    value.includes("streamvistacreator.com") ||
    value.includes("app.crayonspictures.com")
  ) {
    return "deprecated";
  }

  return "unknown";
}
