import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Cookie, X } from "lucide-react";

/**
 * Lightweight cookie consent banner.
 *
 * - Persists the user's decision in a first-party cookie
 *   `sv_cookie_consent` with `SameSite=Strict; Secure; Path=/; Max-Age=1y`.
 * - No tracking scripts are loaded from this component — it only records
 *   the visitor's decision. Downstream analytics code should read
 *   `readCookieConsent()` before firing.
 * - Suppresses itself on `/admin*`, `/dashboard*`, `/studio*` and the
 *   authenticated review/screening routes so authoring surfaces stay clean.
 */

const COOKIE_NAME = "sv_cookie_consent";
const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

type Decision = "accepted" | "essential-only";

function writeConsentCookie(value: Decision) {
  if (typeof document === "undefined") return;
  const secure =
    typeof window !== "undefined" && window.location.protocol === "https:"
      ? "; Secure"
      : "";
  document.cookie = `${COOKIE_NAME}=${value}; Path=/; Max-Age=${ONE_YEAR_SECONDS}; SameSite=Strict${secure}`;
}

function readConsentCookie(): Decision | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(
    new RegExp(`(?:^|; )${COOKIE_NAME}=([^;]+)`),
  );
  if (!match) return null;
  const v = decodeURIComponent(match[1]);
  return v === "accepted" || v === "essential-only" ? v : null;
}

export function readCookieConsent(): Decision | null {
  return readConsentCookie();
}

const SUPPRESSED_PREFIXES = [
  "/admin",
  "/dashboard",
  "/studio",
  "/review",
  "/screening-room",
  "/my-workspace",
  "/checkout",
  "/onboarding",
  "/.lovable",
];

export const CookieConsent = () => {
  const location = useLocation();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (readConsentCookie()) return;
    // Slight delay so it doesn't flash during route hydration.
    const t = setTimeout(() => setVisible(true), 500);
    return () => clearTimeout(t);
  }, []);

  const suppressed = SUPPRESSED_PREFIXES.some((p) =>
    location.pathname.startsWith(p),
  );
  if (suppressed || !visible) return null;

  const decide = (choice: Decision) => {
    writeConsentCookie(choice);
    setVisible(false);
  };

  return (
    <div
      role="dialog"
      aria-live="polite"
      aria-label="Cookie consent"
      // z-40 so the AssistantLauncher FAB (z-50+) sits above the banner on
      // desktop, and bottom-24 on mobile so the banner clears the FAB.
      className="fixed inset-x-3 bottom-24 sm:inset-x-auto sm:right-4 sm:bottom-4 z-40 max-w-md sm:w-[26rem] rounded-xl border border-border/60 bg-card/95 backdrop-blur-xl shadow-elevated animate-fade-in"
    >
      <div className="p-4 sm:p-5">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-lg grid place-items-center border border-border/50 bg-background/50 shrink-0">
            <Cookie className="w-4 h-4 text-accent" strokeWidth={1.75} />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="font-display text-sm font-bold uppercase tracking-[0.14em] text-foreground">
              Cookies on StreamVista
            </h2>
            <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
              We use strictly-necessary cookies to keep this site secure and
              signed-in sessions working. With your consent we also record
              anonymous usage for reliability.{" "}
              <Link
                to="/privacy"
                className="underline underline-offset-2 hover:text-foreground"
              >
                Privacy Policy
              </Link>
              .
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => decide("accepted")}
                className="inline-flex h-9 items-center rounded-full bg-gradient-primary text-primary-foreground px-4 text-[11px] font-semibold uppercase tracking-[0.14em] hover:opacity-90 transition-opacity"
              >
                Accept all
              </button>
              <button
                type="button"
                onClick={() => decide("essential-only")}
                className="inline-flex h-9 items-center rounded-full border border-border/60 hover:border-accent/60 px-4 text-[11px] font-semibold uppercase tracking-[0.14em] text-foreground transition-colors"
              >
                Essential only
              </button>
            </div>
          </div>
          <button
            type="button"
            aria-label="Dismiss"
            onClick={() => decide("essential-only")}
            className="shrink-0 -mt-1 -mr-1 w-7 h-7 grid place-items-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default CookieConsent;
