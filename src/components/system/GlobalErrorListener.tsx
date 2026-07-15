import { useEffect, useRef } from "react";
import { useSystemMessage } from "./SystemMessageProvider";

/**
 * Global safety net for *async* errors that React's <ErrorBoundary> can't catch:
 *   - unhandled Promise rejections (failed fetch, supabase.functions.invoke throws, etc.)
 *   - uncaught `window.onerror` events (third-party SDKs, async setTimeout throws)
 *
 * Shown as a centered SystemMessageBox so the user always knows something failed
 * — and can OK / Report to Admin from one place. Deduped within a 4s window so
 * a burst of identical errors only opens one modal.
 */
export default function GlobalErrorListener() {
  const { showMessage } = useSystemMessage();
  const lastKeyRef = useRef<{ key: string; at: number } | null>(null);

  useEffect(() => {
    const present = (raw: unknown, source: string) => {
      const msg = extractMessage(raw);
      if (!msg) return;
      if (isIgnorable(msg)) return;

      // Dedupe identical message bursts within 4s
      const key = `${source}::${msg}`;
      const now = Date.now();
      if (lastKeyRef.current && lastKeyRef.current.key === key && now - lastKeyRef.current.at < 4000) return;
      lastKeyRef.current = { key, at: now };

      const friendly = classify(msg);
      const detail = sanitizeDetail(msg);
      showMessage({
        severity: "error",
        title: friendly.title,
        message: detail ? `${friendly.body}\n\nDetails: ${detail}` : friendly.body,
        context: `source=${source}; path=${window.location.pathname}; detail=${msg}`,
      });
    };

    const onRejection = (e: PromiseRejectionEvent) => present(e.reason, "unhandledrejection");
    const onError = (e: ErrorEvent) => present(e.error ?? e.message, "window.onerror");

    window.addEventListener("unhandledrejection", onRejection);
    window.addEventListener("error", onError);
    return () => {
      window.removeEventListener("unhandledrejection", onRejection);
      window.removeEventListener("error", onError);
    };
  }, [showMessage]);

  return null;
}

function extractMessage(raw: unknown): string {
  if (!raw) return "";
  if (raw instanceof Error) return raw.message || String(raw);
  if (typeof raw === "string") return raw;
  try {
    const anyErr = raw as { message?: string; error?: string };
    return anyErr?.message || anyErr?.error || JSON.stringify(raw);
  } catch {
    return String(raw);
  }
}


/**
 * Trim raw error text into a single-line, size-bounded excerpt safe to show
 * to end users. Strips URLs, tokens, and stack-trace tails so that internal
 * hostnames or JWTs never leak into a toast body, while preserving the
 * substantive backend message (e.g. RLS policy names, HTTP status, RPC error).
 */
function sanitizeDetail(raw: string): string {
  if (!raw) return "";
  let s = raw
    .replace(/https?:\/\/\S+/gi, "[url]")
    .replace(/eyJ[A-Za-z0-9._-]{10,}/g, "[token]")
    .replace(/Bearer\s+\S+/gi, "Bearer [token]")
    .replace(/\s+at\s+\S+.*$/s, "")
    .replace(/\s+/g, " ")
    .trim();
  if (s.length > 220) s = s.slice(0, 217) + "…";
  return s;
}


/** Filter noisy, non-actionable errors that would otherwise spam the modal. */
function isIgnorable(msg: string): boolean {
  const m = msg.toLowerCase();
  return (
    m.includes("resizeobserver") ||
    m.includes("script error.") ||
    m.includes("non-error promise rejection captured") ||
    m.includes("loading chunk") || // Vite chunk reload — handled by browser refresh
    m.includes("the user aborted a request") ||
    m.includes("aborterror") ||
    m === "load failed"
  );
}

/** Map common error patterns to user-friendly headings. */
function classify(msg: string): { title: string; body: string } {
  const m = msg.toLowerCase();
  if (m.includes("quota") || m.includes("429") || m.includes("rate limit") || m.includes("too many requests")) {
    return {
      title: "AI service is busy",
      body: "We hit the request limit for the AI provider. Wait a moment and try again — or report this so an admin can raise the quota.",
    };
  }
  if (m.includes("payment required") || m.includes("402") || m.includes("insufficient credits")) {
    return {
      title: "AI credits exhausted",
      body: "The platform AI budget is empty. Your work is safe — report this so an admin can top up the credits.",
    };
  }
  if (m.includes("oracle") || m.includes("oci") || m.includes("objectstorage")) {
    return {
      title: "C CLOUD storage error",
      body: "We couldn't reach C CLOUD Object Storage. Your files are safe, but the bridge needs attention.",
    };
  }
  if (m.includes("failed to fetch") || m.includes("network") || m.includes("networkerror")) {
    return {
      title: "Network hiccup",
      body: "Your connection dropped while talking to the server. Check your internet and try again.",
    };
  }
  if (m.includes("401") || m.includes("unauthorized") || m.includes("jwt") || m.includes("not signed in")) {
    return {
      title: "Session expired",
      body: "You've been signed out. Please sign in again to continue.",
    };
  }
  if (m.includes("permission") || m.includes("forbidden") || m.includes("403") || m.includes("rls")) {
    return {
      title: "Permission denied",
      body: "Your account doesn't have access to that action. Report this if you think it's a mistake.",
    };
  }
  return {
    title: "Something went wrong",
    body: "An unexpected error happened in the background. Your work is safe — you can dismiss, or report it so we can investigate.",
  };
}
