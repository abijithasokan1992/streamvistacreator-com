import { useEffect } from "react";

/**
 * Prevents the browser back button from navigating away from the
 * current authenticated page (e.g. dashboard / admin panel) back to
 * the public landing page.
 *
 * Implementation: push a duplicate history entry on mount, and on every
 * `popstate` immediately re-push it so `history.back()` is a no-op.
 */
export function useBackGuard(enabled: boolean = true) {
  useEffect(() => {
    if (!enabled) return;
    if (typeof window === "undefined") return;

    // Seed a duplicate state entry so the first "back" lands on us again.
    window.history.pushState({ __guard: true }, "", window.location.href);

    const onPop = () => {
      window.history.pushState({ __guard: true }, "", window.location.href);
    };

    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [enabled]);
}
