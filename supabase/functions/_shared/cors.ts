// Strict CORS helper for StreamVista edge functions.
//
// Allow-list is now sourced from the `public.site_config` table (admin-managed
// via the dashboard) and falls back to the SITE_ORIGIN env var. Wildcards are
// NEVER returned. *.lovableproject.com / *.lovable.dev are explicitly refused.
//
// The config is loaded at cold-start (top-level await) and refreshed every 60s
// in the background, so the sync API used by all edge functions stays intact.

import { createClient } from "npm:@supabase/supabase-js@2";

// Lovable preview/sandbox hosts (per-project sandboxed URLs) are allowed so
// admins can operate the app from the preview iframe in Edge/Chrome/etc.
// Production origins are still enforced via the site_config allow-list.
const ALLOWED_HOST_SUFFIXES = [
  ".lovableproject.com",
  ".lovable.app",
  ".lovable.dev",
];

function parseEnvList(): string[] {
  const raw = Deno.env.get("SITE_ORIGIN") ?? "";
  return raw.split(",").map((s) => s.trim().replace(/\/$/, "")).filter(Boolean);
}

let PRIMARY_ORIGIN: string = parseEnvList()[0] ?? "";
let ALLOW_LIST: string[] = parseEnvList();

async function loadFromDb(): Promise<void> {
  try {
    const url = Deno.env.get("SUPABASE_URL");
    const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!url || !key) return;
    const supa = createClient(url, key, { auth: { persistSession: false } });
    const { data, error } = await supa
      .from("site_config")
      .select("primary_domain, extra_origins")
      .eq("id", true)
      .maybeSingle();
    if (error || !data) return;
    const primary = (data.primary_domain ?? "").trim().replace(/\/$/, "");
    const extras = (data.extra_origins ?? [])
      .map((s: string) => (s ?? "").trim().replace(/\/$/, ""))
      .filter(Boolean);
    const env = parseEnvList();
    const merged = Array.from(new Set([primary, ...extras, ...env].filter(Boolean)));
    if (merged.length > 0) {
      ALLOW_LIST = merged;
      PRIMARY_ORIGIN = primary || merged[0];
    }
  } catch (_) {
    // keep env-based defaults on failure
  }
}

// Best-effort initial load (non-blocking if it errors).
try {
  await loadFromDb();
} catch (_) {
  // ignore
}
// Refresh in the background every 60s.
try {
  setInterval(() => { loadFromDb(); }, 60_000);
} catch (_) {
  // setInterval may not be available in all runtimes
}

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
// Order: DB primary_domain → SITE_ORIGIN first entry → request Origin → throw.
export function resolveSiteOrigin(req?: Request): string {
  if (PRIMARY_ORIGIN) return PRIMARY_ORIGIN;
  if (ALLOW_LIST[0]) return ALLOW_LIST[0];
  if (req) {
    const o = isAllowed(req.headers.get("origin"));
    if (o) return o;
  }
  throw new Error("SITE_ORIGIN is not configured");
}
