/**
 * Client-side format allow / deny policy.
 *
 * Mirrors the server-side rules in
 * `supabase/functions/_shared/uploadValidation.ts` so we can reject unsafe
 * files in the planning stage — the server remains the source of truth.
 */

const FORBIDDEN_EXTENSIONS = new Set([
  "exe", "msi", "dll", "scr", "bat", "cmd", "ps1", "sh", "bash", "zsh",
  "com", "vbs", "vbe", "js", "jse", "jar", "wsf", "wsh", "hta", "cpl",
  "msc", "apk", "ipa",
  "php", "phtml", "asp", "aspx", "jsp",
  "html", "htm", "xhtml", "svg",
]);

export type PolicyVerdict =
  | { allowed: true }
  | { allowed: false; reason: string; code: "forbidden_extension" | "empty_file" };

export function checkPolicy(fileName: string, size: number): PolicyVerdict {
  if (!Number.isFinite(size) || size <= 0) {
    return { allowed: false, code: "empty_file", reason: "Empty or unreadable file" };
  }
  const ext = fileName.toLowerCase().split(".").pop() ?? "";
  if (ext && FORBIDDEN_EXTENSIONS.has(ext)) {
    return {
      allowed: false,
      code: "forbidden_extension",
      reason: `.${ext} is blocked for security reasons`,
    };
  }
  return { allowed: true };
}
