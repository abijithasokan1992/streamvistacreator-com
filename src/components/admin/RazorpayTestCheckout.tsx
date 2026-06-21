import { useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { FlaskConical, CheckCircle2, XCircle, Loader2 } from "lucide-react";

declare global { interface Window { Razorpay?: any } }

type Step =
  | "idle"
  | "creating_order"
  | "checkout_open"
  | "payment_pending_verification"
  | "verified_success"
  | "payment_failed"
  | "payment_cancelled"
  | "verification_failed";

interface DebugInfo {
  orderId?: string;
  paymentId?: string;
  signature?: string;
  mode?: string;
  verifyResponse?: unknown;
  lastError?: string;
  webhookFinalized?: boolean;
  updatedAt?: string;
}

const TERMINAL: Step[] = [
  "idle",
  "verified_success",
  "payment_failed",
  "payment_cancelled",
  "verification_failed",
];

export default function RazorpayTestCheckout() {
  const { isAdmin } = useAuth();
  const [step, setStep] = useState<Step>("idle");
  const [detail, setDetail] = useState<string>("");
  const [debug, setDebug] = useState<DebugInfo>({});
  // ref so async Razorpay callbacks see the current step (avoid stale closure)
  const stepRef = useRef<Step>("idle");

  if (!isAdmin) return null;

  const updateStep = (s: Step, d?: string, patch?: Partial<DebugInfo>) => {
    stepRef.current = s;
    setStep(s);
    if (d !== undefined) setDetail(d);
    setDebug((prev) => ({
      ...prev,
      ...(patch ?? {}),
      updatedAt: new Date().toISOString(),
    }));
  };

  const ensureSdk = () =>
    new Promise<void>((resolve, reject) => {
      if (window.Razorpay) return resolve();
      const s = document.createElement("script");
      s.src = "https://checkout.razorpay.com/v1/checkout.js";
      s.onload = () => resolve();
      s.onerror = () => reject(new Error("Failed to load Razorpay SDK"));
      document.body.appendChild(s);
    });

  const verifyPayment = async (resp: {
    razorpay_order_id: string;
    razorpay_payment_id: string;
    razorpay_signature: string;
  }) => {
    updateStep("payment_pending_verification", "Verifying signature server-side…", {
      orderId: resp.razorpay_order_id,
      paymentId: resp.razorpay_payment_id,
      signature: resp.razorpay_signature,
    });

    const { data: vr, error: verr } = await supabase.functions.invoke(
      "simulate-razorpay-verify",
      { body: resp },
    );

    if (verr || !vr?.ok) {
      const errMsg =
        verr?.message ??
        (vr && typeof vr === "object" && "error" in vr ? String((vr as any).error) : null) ??
        "Verification failed";
      updateStep("verification_failed", `❌ ${errMsg}`, {
        verifyResponse: vr ?? null,
        lastError: errMsg,
      });
      toast.error("Verification failed");
      return;
    }

    updateStep(
      "verified_success",
      `✅ Verified. order=${resp.razorpay_order_id} payment=${resp.razorpay_payment_id}`,
      {
        verifyResponse: vr,
        mode: (vr as any)?.mode,
        webhookFinalized: Boolean((vr as any)?.alreadyProcessed),
      },
    );
    toast.success("Test payment verified");
  };

  const handleTest = async () => {
    setDebug({});
    updateStep("creating_order", "Creating test order…");
    try {
      await ensureSdk();

      const { data, error } = await supabase.functions.invoke(
        "generate-test-razorpay-order",
        { body: {} },
      );
      if (error || !data?.orderId) {
        const msg = error?.message ?? (data as any)?.error ?? "Order create failed";
        updateStep("payment_failed", msg, { lastError: msg });
        toast.error("Test order failed");
        return;
      }

      updateStep(
        "checkout_open",
        `Order ${data.orderId} (${data.mode}). Opening checkout…`,
        { orderId: data.orderId, mode: data.mode },
      );

      const rzp = new window.Razorpay!({
        key: data.keyId,
        amount: data.amount,
        currency: data.currency,
        order_id: data.orderId,
        name: "Admin E2E Test",
        description: "Razorpay connectivity check — ₹1",
        notes: { admin_test: "true" },
        handler: async (resp: any) => {
          try {
            await verifyPayment({
              razorpay_order_id: resp.razorpay_order_id,
              razorpay_payment_id: resp.razorpay_payment_id,
              razorpay_signature: resp.razorpay_signature,
            });
          } catch (e: any) {
            const msg = e?.message ?? "Unexpected verify error";
            updateStep("verification_failed", msg, { lastError: msg });
            toast.error("Verification failed");
          }
        },
        modal: {
          ondismiss: () => {
            // Use ref to avoid stale closure — Razorpay fires ondismiss after
            // the success handler runs, so we must not clobber a verifying /
            // verified state.
            const current = stepRef.current;
            if (
              current === "payment_pending_verification" ||
              current === "verified_success" ||
              current === "verification_failed"
            ) {
              return;
            }
            updateStep("payment_cancelled", "Checkout dismissed before payment.");
          },
        },
        "payment.failed": (resp: any) => {
          const err = resp?.error;
          const msg = err?.description ?? err?.reason ?? "Payment failed at gateway";
          updateStep("payment_failed", msg, {
            lastError: msg,
            paymentId: err?.metadata?.payment_id,
            orderId: err?.metadata?.order_id,
          });
        },
        theme: { color: "#6366f1" },
      });

      rzp.on?.("payment.failed", (resp: any) => {
        const err = resp?.error;
        const msg = err?.description ?? err?.reason ?? "Payment failed at gateway";
        updateStep("payment_failed", msg, {
          lastError: msg,
          paymentId: err?.metadata?.payment_id,
          orderId: err?.metadata?.order_id,
        });
      });

      rzp.open();
    } catch (e: any) {
      const msg = e?.message ?? "Unexpected error";
      updateStep("payment_failed", msg, { lastError: msg });
      toast.error("Test failed");
    }
  };

  const badge = (() => {
    switch (step) {
      case "verified_success":
        return <Badge className="bg-emerald-600">verified</Badge>;
      case "payment_failed":
        return <Badge variant="destructive">payment failed</Badge>;
      case "verification_failed":
        return <Badge variant="destructive">verify failed</Badge>;
      case "payment_cancelled":
        return <Badge variant="secondary">cancelled</Badge>;
      case "idle":
        return <Badge variant="secondary">idle</Badge>;
      default:
        return (
          <Badge variant="outline" className="gap-1">
            <Loader2 className="w-3 h-3 animate-spin" />
            {step.replace(/_/g, " ")}
          </Badge>
        );
    }
  })();

  const disabled = !TERMINAL.includes(step);

  return (
    <Card className="border-dashed">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <FlaskConical className="w-4 h-4" />
          Admin E2E Razorpay Test
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">
          Creates a real ₹1 order against the currently configured Razorpay key,
          opens the Checkout SDK, then verifies the signature server-side and
          writes an audit row. No onboarding rows or user roles are modified.
        </p>
        <div className="flex items-center gap-3 flex-wrap">
          <Button onClick={handleTest} disabled={disabled} size="sm">
            {step === "creating_order" ||
            step === "payment_pending_verification" ||
            step === "checkout_open" ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : step === "verified_success" ? (
              <CheckCircle2 className="w-4 h-4 mr-2" />
            ) : step === "payment_failed" || step === "verification_failed" ? (
              <XCircle className="w-4 h-4 mr-2" />
            ) : null}
            Trigger Test Checkout
          </Button>
          {badge}
        </div>
        {detail && (
          <div className="text-xs text-muted-foreground bg-muted/50 rounded p-2 font-mono break-all">
            {detail}
          </div>
        )}
        {(debug.orderId || debug.paymentId || debug.lastError) && (
          <div className="text-xs bg-muted/30 rounded p-2 font-mono space-y-1 border">
            <div className="font-semibold text-foreground">Debug</div>
            {debug.orderId && <div>order_id: {debug.orderId}</div>}
            {debug.paymentId && <div>payment_id: {debug.paymentId}</div>}
            {debug.mode && <div>mode: {debug.mode}</div>}
            <div>state: {step}</div>
            {debug.webhookFinalized !== undefined && (
              <div>webhook_finalized: {String(debug.webhookFinalized)}</div>
            )}
            {debug.lastError && (
              <div className="text-destructive">last_error: {debug.lastError}</div>
            )}
            {debug.verifyResponse !== undefined && (
              <details>
                <summary className="cursor-pointer">verify_response</summary>
                <pre className="whitespace-pre-wrap break-all mt-1">
                  {JSON.stringify(debug.verifyResponse, null, 2)}
                </pre>
              </details>
            )}
            {debug.updatedAt && (
              <div className="text-muted-foreground">updated: {debug.updatedAt}</div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
