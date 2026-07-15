/**
 * Feature-scoped error reporter.
 *
 * Each feature (onboarding, uploads, billing, auth, realtime, …) attributes
 * its own failures via reportError({ source, operation, severity, userVisible }).
 *
 * - userVisible=true  → surfaces a concise, sanitized SystemMessageBox toast
 * - userVisible=false → logs to console only (background retries, reconnects,
 *                        polling, cancellations, telemetry).
 *
 * The GlobalErrorListener no longer converts every unhandledrejection into a
 * modal — features own their own error surfaces via this helper.
 */

export type ErrorSource =
  | "onboarding"
  | "storage"
  | "upload"
  | "billing"
  | "authentication"
  | "realtime"
  | "analytics"
  | "profile"
  | "workspace"
  | "admin"
  | "ai"
  | "unknown";

export type ErrorSeverity = "info" | "warning" | "error" | "critical";

export interface ReportErrorInput {
  source: ErrorSource;
  operation: string;
  error: unknown;
  severity?: ErrorSeverity;
  userVisible?: boolean;
  /** Optional user-friendly overrides. If omitted a generic message is derived. */
  title?: string;
  message?: string;
}

type Presenter = (payload: {
  title: string;
  message: string;
  severity: ErrorSeverity;
  source: ErrorSource;
  operation: string;
  detail: string;
}) => void;

let presenter: Presenter | null = null;

/** Wired once at app root by SystemMessageProvider consumer. */
export function registerErrorPresenter(fn: Presenter | null) {
  presenter = fn;
}

export function reportError(input: ReportErrorInput) {
  const severity: ErrorSeverity = input.severity ?? "error";
  const userVisible = input.userVisible ?? true;
  const raw = extractMessage(input.error);
  const detail = sanitizeDetail(raw);

  // Structured log — always.
  const logPayload = {
    source: input.source,
    operation: input.operation,
    severity,
    userVisible,
    detail,
  };
  if (severity === "critical" || severity === "error") {
    // eslint-disable-next-line no-console
    console.error("[app-error]", logPayload);
  } else if (severity === "warning") {
    // eslint-disable-next-line no-console
    console.warn("[app-warn]", logPayload);
  } else {
    // eslint-disable-next-line no-console
    console.info("[app-info]", logPayload);
  }

  if (!userVisible) return;

  const friendly = classify(raw, input.source);
  const title = input.title ?? friendly.title;
  const message = input.message ?? friendly.body;

  if (presenter) {
    presenter({
      title,
      message,
      severity,
      source: input.source,
      operation: input.operation,
      detail,
    });
  }
}

export function extractMessage(raw: unknown): string {
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

export function sanitizeDetail(raw: string): string {
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

/**
 * Patterns for background/transient events that must NEVER open a dialog.
 * These are logged (debug) but suppressed from the user surface.
 */
export function isBackgroundNoise(msg: string): boolean {
  const m = (msg || "").toLowerCase();
  return (
    m.includes("resizeobserver") ||
    m.includes("script error.") ||
    m.includes("non-error promise rejection captured") ||
    m.includes("loading chunk") ||
    m.includes("the user aborted a request") ||
    m.includes("aborterror") ||
    m.includes("signal is aborted") ||
    m.includes("abortcontroller") ||
    m.includes("request was cancelled") ||
    m.includes("fetch aborted") ||
    m === "load failed" ||
    m.includes("websocket") ||
    m.includes("ws closed") ||
    m.includes("channel_error") ||
    m.includes("realtime") ||
    m.includes("supabase realtime") ||
    m.includes("phx_reply") ||
    m.includes("heartbeat") ||
    m.includes("reconnect") ||
    m.includes("offline") ||
    m.includes("visibilitychange") ||
    m.includes("network changed") ||
    m.includes("net::err_internet_disconnected") ||
    m.includes("net::err_network_changed")
  );
}

function classify(msg: string, source: ErrorSource): { title: string; body: string } {
  const m = (msg || "").toLowerCase();
  const sourceLabel = sourceLabels[source] ?? "Application";

  if (m.includes("quota") || m.includes("429") || m.includes("rate limit") || m.includes("too many requests")) {
    return {
      title: `${sourceLabel}: service is busy`,
      body: "We hit a request limit. Wait a moment and try again.",
    };
  }
  if (m.includes("payment required") || m.includes("402") || m.includes("insufficient credits")) {
    return {
      title: `${sourceLabel}: credits exhausted`,
      body: "The AI budget is empty. Your work is safe — an admin can top up.",
    };
  }
  if (m.includes("failed to fetch") || m.includes("networkerror")) {
    return {
      title: `${sourceLabel}: network hiccup`,
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
      title: `${sourceLabel}: permission denied`,
      body: "Your account doesn't have access to that action.",
    };
  }
  return {
    title: `${sourceLabel}: something went wrong`,
    body: `An unexpected error happened while completing this action. Your work is safe.`,
  };
}

const sourceLabels: Record<ErrorSource, string> = {
  onboarding: "Onboarding",
  storage: "Storage",
  upload: "Upload",
  billing: "Billing",
  authentication: "Sign-in",
  realtime: "Realtime",
  analytics: "Analytics",
  profile: "Profile",
  workspace: "Workspace",
  admin: "Admin",
  ai: "AI service",
  unknown: "Application",
};
