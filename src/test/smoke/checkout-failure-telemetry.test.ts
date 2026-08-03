/**
 * Regression tests for Razorpay checkout failure + dismiss behaviour.
 *
 * Covers:
 *  - `payment.failed` clears checkout-open state, toasts a safe message,
 *    logs `checkout.handler_error` telemetry and invokes `onError` once.
 *  - modal `ondismiss` logs `checkout.modal_dismissed` telemetry and still
 *    invokes the caller's `onDismiss`.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { RazorpayFailedEvent } from "@/lib/payments/initializeCheckout";

const telemetry = vi.hoisted(() => ({ log: vi.fn() }));
const toastMock = vi.hoisted(() => ({
  loading: vi.fn(() => "toast-1"),
  success: vi.fn(),
  error: vi.fn(),
  dismiss: vi.fn(),
}));

vi.mock("sonner", () => ({ toast: toastMock }));
vi.mock("@/lib/paymentTelemetry", () => ({ logCheckoutTelemetry: telemetry.log }));
vi.mock("@/lib/payments/checkoutHostGuard", () => ({ assertLiveCheckoutHost: () => {} }));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      refreshSession: vi.fn(async () => ({ data: { session: { access_token: "tok" } } })),
      getSession: vi.fn(async () => ({
        data: { session: { access_token: "tok", user: { id: "u1", email: "a@b.com" } } },
      })),
    },
    functions: {
      invoke: vi.fn(async () => ({
        data: { keyId: "rzp_test", orderId: "order_123", amount: 100, currency: "INR" },
        error: null,
      })),
    },
  },
}));

type FailedHandler = (evt: RazorpayFailedEvent) => void;

interface CapturedOptions {
  modal: { ondismiss: () => void };
}

let capturedOptions: CapturedOptions;
let failedHandlers: FailedHandler[];
let opened: number;

class FakeRazorpay {
  constructor(options: CapturedOptions) {
    capturedOptions = options;
  }
  on(event: string, handler: FailedHandler) {
    if (event === "payment.failed") failedHandlers.push(handler);
  }
  open() {
    opened += 1;
  }
}

async function openCheckout(overrides: Record<string, unknown> = {}) {
  const { initializeCheckout } = await import("@/lib/payments/initializeCheckout");
  await initializeCheckout({
    purpose: "storage_topup",
    payload: { planId: "p1" },
    ...overrides,
  } as Parameters<typeof initializeCheckout>[0]);
}

describe("initializeCheckout — Razorpay failure and dismiss", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    failedHandlers = [];
    opened = 0;
    (window as unknown as { Razorpay: unknown }).Razorpay = FakeRazorpay;
    document.body.removeAttribute("data-checkout-open");
  });

  afterEach(() => {
    delete (window as unknown as { Razorpay?: unknown }).Razorpay;
  });

  it("registers a payment.failed listener and opens the modal", async () => {
    await openCheckout();
    expect(failedHandlers).toHaveLength(1);
    expect(opened).toBe(1);
    expect(document.body.getAttribute("data-checkout-open")).toBe("true");
  });

  it("clears checkout state, toasts, logs telemetry and calls onError once on payment.failed", async () => {
    const onError = vi.fn();
    await openCheckout({ onError });

    failedHandlers[0]({
      error: {
        code: "BAD_REQUEST_ERROR",
        description: "Your card was declined by the issuing bank.",
        source: "bank",
        step: "payment_authentication",
        metadata: { order_id: "order_999", payment_id: "pay_1" },
      },
    });

    expect(document.body.hasAttribute("data-checkout-open")).toBe(false);
    expect(toastMock.error).toHaveBeenCalledWith(
      "Your card was declined by the issuing bank.",
      expect.anything(),
    );
    expect(telemetry.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action_type: "checkout.handler_error",
        severity: "ERROR",
        order_id: "order_999",
        payment_id: "pay_1",
        error_message: "Your card was declined by the issuing bank.",
        extra: expect.objectContaining({ code: "BAD_REQUEST_ERROR", source: "bank" }),
      }),
    );
    expect(onError).toHaveBeenCalledTimes(1);

    // A repeated event must not double-fire the caller callback.
    failedHandlers[0]({ error: { description: "again" } });
    expect(onError).toHaveBeenCalledTimes(1);
  });

  it("falls back to reason, then to a generic message, and uses the create order id", async () => {
    const onError = vi.fn();
    await openCheckout({ onError });
    failedHandlers[0]({ error: { reason: "payment_failed" } });
    expect(toastMock.error).toHaveBeenCalledWith("payment_failed", expect.anything());
    expect(telemetry.log).toHaveBeenCalledWith(
      expect.objectContaining({ order_id: "order_123", payment_id: null }),
    );

    vi.clearAllMocks();
    failedHandlers = [];
    await openCheckout({ onError: vi.fn() });
    failedHandlers[0]({});
    expect(toastMock.error).toHaveBeenCalledWith(
      "Payment failed. No amount was charged — please try again.",
      expect.anything(),
    );
  });

  it("logs checkout.modal_dismissed telemetry and preserves onDismiss", async () => {
    const onDismiss = vi.fn();
    await openCheckout({ onDismiss });

    capturedOptions.modal.ondismiss();

    expect(document.body.hasAttribute("data-checkout-open")).toBe(false);
    expect(telemetry.log).toHaveBeenCalledWith({
      action_type: "checkout.modal_dismissed",
      severity: "WARN",
      order_id: "order_123",
    });
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });
});
