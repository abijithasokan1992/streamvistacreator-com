/**
 * Central sanitizer for post-login `next` redirects.
 *
 * Must be shared by every entry point that consumes a caller-supplied path:
 * the /auth page, the /auth/callback route, magic-link/OAuth stashing, and
 * any protected route guard that appends `?next=`. A single implementation
 * prevents open-redirect drift between call sites.
 *
 * Rules:
 *  - Must be a same-origin relative path starting with a single `/`.
 *  - Reject protocol-relative `//host`, backslash trick `/\host`, and any
 *    absolute URL (`http:`, `https:`, `javascript:`, `data:`, etc.).
 *  - Reject `/auth`, `/auth/callback`, `/reset-password` — bouncing back into
 *    the auth flow creates loops.
 *  - Reject strings longer than 512 chars to keep URLs sane.
 */
export function safeNextPath(input: string | null | undefined): string | null {
  if (!input) return null;
  if (typeof input !== "string") return null;
  if (input.length > 512) return null;
  if (!input.startsWith("/")) return null;
  if (input.startsWith("//")) return null;
  if (input.startsWith("/\\")) return null;
  // Belt-and-braces: reject anything that parses as an absolute URL.
  if (/^[a-z][a-z0-9+.-]*:/i.test(input)) return null;
  // Loop-prevention: never bounce back into the auth surfaces.
  const path = input.split("?")[0].split("#")[0];
  if (path === "/auth" || path.startsWith("/auth/") || path === "/reset-password") {
    return null;
  }
  return input;
}

/** Extract `next` from a search string / URLSearchParams and sanitize. */
export function readSafeNext(search: string | URLSearchParams | null | undefined): string | null {
  if (!search) return null;
  const params = typeof search === "string" ? new URLSearchParams(search) : search;
  return safeNextPath(params.get("next"));
}
