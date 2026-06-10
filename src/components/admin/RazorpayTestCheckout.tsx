import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { FlaskConical, CheckCircle2, XCircle, Loader2 } from "lucide-react";

declare global { interface Window { Razorpay?: any } }

type Step = "idle" | "creating" | "checkout" | "verifying" | "paid" | "failed";

export default function RazorpayTestCheckout() {
  const { isAdmin } = useAuth();
  const [step, setStep] = useState<Step>("idle");
  const [detail, setDetail] = useState<string>("");
  const [lastOrder, setLastOrder] = useState<string>("");

  if (!isAdmin) return null;

  const ensureSdk = () =>
    new Promise<void>((resolve, reject) => {
      if (window.Razorpay) return resolve();
      const s = document.createElement("script");
      s.src = "https://checkout.razorpay.com/v1/checkout.js";
      s.onload = () => resolve();
      s.onerror = () => reject(new Error("Failed to load Razorpay SDK"));
      document.body.appendChild(s);
    });

  const handleTest = async () => {
    setStep("creating");
    setDetail("Creating test order…");
    try {
      await ensureSdk();

      const { data, error } = await supabase.functions.invoke("generate-test-razorpay-order", {
        body: {},
      });
      if (error || !data?.orderId) {
        setStep("failed");
        setDetail(error?.message ?? "Order create failed");
        toast.error("Test order failed");
        return;
      }

      setLastOrder(data.orderId);
      setStep("checkout");
      setDetail(`Order ${data.orderId} (${data.mode}). Opening checkout…`);

      const rzp = new window.Razorpay!({
        key: data.keyId,
        amount: data.amount,
        currency: data.currency,
        order_id: data.orderId,
        name: "Admin E2E Test",
        description: "Razorpay connectivity check — ₹1",
        notes: { admin_test: "true" },
        handler: async (resp: any) => {
          setStep("verifying");
          setDetail("Verifying signature & simulating webhook…");
          const { data: vr, error: verr } = await supabase.functions.invoke(
            "simulate-razorpay-verify",
            {
              body: {
                razorpay_order_id: resp.razorpay_order_id,
                razorpay_payment_id: resp.razorpay_payment_id,
                razorpay_signature: resp.razorpay_signature,
              },
            },
          );
          if (verr || !vr?.ok) {
            setStep("failed");
            setDetail(verr?.message ?? vr?.error ?? "Verification failed");
            toast.error("Verification failed");
            return;
          }
          setStep("paid");
          setDetail(`✅ status='paid' logged for order ${resp.razorpay_order_id}`);
          toast.success("Test payment verified");
        },
        modal: {
          ondismiss: () => {
            if (step !== "paid") {
              setStep("idle");
              setDetail("Checkout dismissed.");
            }
          },
        },
        theme: { color: "#6366f1" },
      });
      rzp.open();
    } catch (e: any) {
      setStep("failed");
      setDetail(e?.message ?? "Unexpected error");
      toast.error("Test failed");
    }
  };

  const badge =
    step === "paid" ? <Badge className="bg-emerald-600">paid</Badge> :
    step === "failed" ? <Badge variant="destructive">failed</Badge> :
    step === "idle" ? <Badge variant="secondary">idle</Badge> :
    <Badge variant="outline" className="gap-1"><Loader2 className="w-3 h-3 animate-spin" />{step}</Badge>;

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
          opens the Checkout SDK, then verifies the signature and writes a
          <code className="mx-1">status='paid'</code> row to the audit log.
          No onboarding rows or user roles are modified.
        </p>
        <div className="flex items-center gap-3 flex-wrap">
          <Button
            onClick={handleTest}
            disabled={step !== "idle" && step !== "paid" && step !== "failed"}
            size="sm"
          >
            {step === "creating" || step === "verifying" ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : step === "paid" ? (
              <CheckCircle2 className="w-4 h-4 mr-2" />
            ) : step === "failed" ? (
              <XCircle className="w-4 h-4 mr-2" />
            ) : null}
            Trigger Test Checkout
          </Button>
          {badge}
          {lastOrder && (
            <span className="text-xs text-muted-foreground font-mono">{lastOrder}</span>
          )}
        </div>
        {detail && (
          <div className="text-xs text-muted-foreground bg-muted/50 rounded p-2 font-mono">
            {detail}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
