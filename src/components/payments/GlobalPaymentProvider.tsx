/**
 * GlobalPaymentProvider — app-wide context for opening the payment sheet
 * from anywhere (workspace settings, distribution modules, premium feature
 * gates, etc.) without importing the modal or wiring props through the tree.
 *
 * Uses `initializeCheckout` under the hood, so every caller benefits from
 * the same session-refresh + metadata-forwarding guarantees.
 */
import { createContext, useCallback, useContext, useMemo, useRef } from "react";
import {
  initializeCheckout,
  type InitializeCheckoutOptions,
} from "@/lib/payments/initializeCheckout";

type OpenCheckoutFn = (opts: InitializeCheckoutOptions) => Promise<void>;

const GlobalPaymentContext = createContext<OpenCheckoutFn | null>(null);

export function GlobalPaymentProvider({ children }: { children: React.ReactNode }) {
  // Guard against double-invocation (e.g. rapid double-click on a CTA).
  const inFlight = useRef(false);

  const openCheckout = useCallback<OpenCheckoutFn>(async (opts) => {
    if (inFlight.current) return;
    inFlight.current = true;
    try {
      await initializeCheckout({
        ...opts,
        onSuccess: (r) => {
          inFlight.current = false;
          opts.onSuccess?.(r);
        },
        onDismiss: () => {
          inFlight.current = false;
          opts.onDismiss?.();
        },
        onError: (e) => {
          inFlight.current = false;
          opts.onError?.(e);
        },
      });
    } catch {
      inFlight.current = false;
    }
  }, []);

  const value = useMemo(() => openCheckout, [openCheckout]);
  return (
    <GlobalPaymentContext.Provider value={value}>{children}</GlobalPaymentContext.Provider>
  );
}

/**
 * Access the global checkout opener. Returns a stable async function.
 * Any component in the tree can call this to open the Razorpay sheet
 * with dynamic metadata forwarded to the backend webhook.
 */
export function useGlobalCheckout(): OpenCheckoutFn {
  const ctx = useContext(GlobalPaymentContext);
  if (!ctx) {
    // Fall back to the raw helper if the provider is missing (e.g. tests).
    return initializeCheckout;
  }
  return ctx;
}
