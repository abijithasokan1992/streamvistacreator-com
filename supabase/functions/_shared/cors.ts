// Strict CORS helper for StreamVista edge functions.
// Allow-list is taken from the SITE_ORIGIN env var (comma-separated). Wildcards
// are NEVER returned — if the request's Origin header is not on the list, no
// Access-Control-Allow-Origin is sent and the browser blocks the response.
// We also explicitly refuse any *.lovableproject.com / *.lovable.dev fallback.

const RAW = Deno.env.get("SITE_ORIGIN") ?? "";
const ALLOW_LIST = RAW.split(",")
  .map((s) => s.trim().replace(/\/$/, ""))
  .filter(Boolean);

const FORBIDDEN_HOST_SUFFIXES = [".lovableproject.com", ".lovable.dev"];

function isAllowed(origin: string | null): string | null {
  if (!origin) return null;
  const normalized = origin.replace(/\/$/, "");
  try {
    const host = new URL(normalized).hostname;
    if (FORBIDDEN_HOST_SUFFIXES.some((s) => host.endsWith(s))) return null;
  } catch {
    return null;
  }
  return ALLOW_LIST.includes(normalized) ? normalized : null;
}

export function buildCorsHeaders(req: Request): HeadersInit {
  const origin = isAllowed(req.headers.get("origin"));
  const headers: Record<string, string> = {
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
    "Access-Control-Max-Age": "600",
    Vary: "Origin",
  };
  if (origin) headers["Access-Control-Allow-Origin"] = origin;
  return headers;
}

export function handleOptions(req: Request): Response {
  return new Response("ok", { headers: buildCorsHeaders(req) });
}

// Resolve the canonical site origin for building outbound links (emails, etc.).
// Order: SITE_ORIGIN first entry → request Origin (if allow-listed) → throw.
// Never returns a lovableproject/lovable.dev URL.
export function resolveSiteOrigin(req?: Request): string {
  if (ALLOW_LIST[0]) return ALLOW_LIST[0];
  if (req) {
    const o = isAllowed(req.headers.get("origin"));
    if (o) return o;
  }
  throw new Error("SITE_ORIGIN is not configured");
}
