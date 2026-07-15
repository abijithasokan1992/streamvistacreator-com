import { useEffect, useRef } from "react";
import { useSystemMessage } from "./SystemMessageProvider";
import {
  extractMessage,
  isBackgroundNoise,
  registerErrorPresenter,
  sanitizeDetail,
  type ErrorSeverity,
  type ErrorSource,
} from "@/lib/errors/reportError";

/**
 * Final safety net for *uncaught* application exceptions.
 *
 * Design (per StreamVista error-attribution spec):
 *
 * - Features own their own error UI via `reportError({ source, operation, … })`.
 *   This component wires that reporter to the SystemMessageBox surface.
 *
 * - `unhandledrejection` and `window.onerror` are treated as **background
 *   signals**: they are structured-logged but NOT shown to the user, because
 *   the feature that owns the operation is expected to surface its own error.
 *   Only truly unattributed *critical* exceptions (uncaught synchronous JS
 *   errors) still fall through to a generic dialog.
 *
 * - Transient noise (aborts, realtime reconnects, heartbeats, offline,
 *   visibility changes, chunk reloads) is filtered out entirely.
 */
export default function GlobalErrorListener() {
  const { showMessage } = useSystemMessage();
  const lastKeyRef = useRef<{ key: string; at: number } | null>(null);

  useEffect(() => {
    // Wire the feature-scoped reporter to SystemMessageBox.
    registerErrorPresenter(({ title, message, severity, source, operation, detail }) => {
      const sysSeverity: "info" | "warning" | "error" =
        severity === "critical" ? "error" : severity === "info" ? "info" : severity;
      const key = `${source}:${operation}:${detail}`;
      const now = Date.now();
      if (lastKeyRef.current && lastKeyRef.current.key === key && now - lastKeyRef.current.at < 4000) return;
      lastKeyRef.current = { key, at: now };
      showMessage({
        severity: sysSeverity,
        title,
        message: detail ? `${message}\n\nDetails: ${detail}` : message,
        context: `source=${source}; operation=${operation}; path=${window.location.pathname}`,
      });
    });

    const onRejection = (e: PromiseRejectionEvent) => {
      const raw = extractMessage(e.reason);
      if (!raw || isBackgroundNoise(raw)) return;
      // Attributed features handle their own surfacing. Log for observability.
      // eslint-disable-next-line no-console
      console.warn("[unhandledrejection]", { detail: sanitizeDetail(raw) });
    };

    const onError = (e: ErrorEvent) => {
      const raw = extractMessage(e.error ?? e.message);
      if (!raw || isBackgroundNoise(raw)) return;
      // Truly uncaught synchronous JS error — show a minimal fallback dialog.
      const key = `uncaught::${raw}`;
      const now = Date.now();
      if (lastKeyRef.current && lastKeyRef.current.key === key && now - lastKeyRef.current.at < 4000) return;
      lastKeyRef.current = { key, at: now };
      const detail = sanitizeDetail(raw);
      showMessage({
        severity: "error" satisfies ErrorSeverity as "error",
        title: "Unexpected error",
        message:
          "An unexpected error happened. Your work is safe — try again, and report it if it repeats." +
          (detail ? `\n\nDetails: ${detail}` : ""),
        context: `source=${"unknown" satisfies ErrorSource}; path=${window.location.pathname}`,
      });
    };

    window.addEventListener("unhandledrejection", onRejection);
    window.addEventListener("error", onError);
    return () => {
      window.removeEventListener("unhandledrejection", onRejection);
      window.removeEventListener("error", onError);
      registerErrorPresenter(null);
    };
  }, [showMessage]);

  return null;
}
