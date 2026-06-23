import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Loader2, CreditCard, Check, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { usePaddleCheckout } from "@/hooks/usePaddleCheckout";
import { PaymentTestModeBanner } from "@/components/PaymentTestModeBanner";
import { getPaddleEnvironment } from "@/lib/paddle";

/**
 * Paddle-powered storage checkout (international card payments).
 * Coexists with the existing Razorpay flow inside the dashboard.
 */
export default function CheckoutStorage() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { openCheckout, loading } = usePaddleCheckout();
  const [success, setSuccess] = useState(params.get("checkout") === "success");

  useEffect(() => {
    if (params.get("checkout") === "success") {
      setSuccess(true);
      toast.success("Payment successful — your storage block is being activated.");
    }
  }, [params]);

  const handleBuy = async () => {
    if (!user) {
      navigate("/auth?intent=signin&next=/checkout/storage");
      return;
    }
    try {
      await openCheckout({
        priceId: "creator_storage_1tb_monthly",
        customerEmail: user.email ?? undefined,
        customData: { userId: user.id },
        successUrl: `${window.location.origin}/checkout/storage?checkout=success`,
      });
    } catch (e: any) {
      toast.error(e?.message ?? "Could not open checkout");
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-dvh grid place-items-center">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-background">
      <PaymentTestModeBanner />
      <div className="container max-w-2xl py-16">
        <button
          onClick={() => navigate(-1)}
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-8"
        >
          <ArrowLeft className="w-4 h-4" /> Back
        </button>

        <div className="rounded-2xl border border-border/60 bg-card p-8 md:p-10">
          {success ? (
            <div className="text-center py-8">
              <div className="w-12 h-12 rounded-full bg-primary/10 grid place-items-center mx-auto mb-4">
                <Check className="w-6 h-6 text-primary" />
              </div>
              <h1 className="font-display font-black text-3xl mb-2">Payment received</h1>
              <p className="text-muted-foreground mb-6">
                Your +1 TB storage block is being activated. You'll see it in your dashboard shortly.
              </p>
              <button
                onClick={() => navigate("/dashboard")}
                className="cta-guide bg-gradient-primary text-primary-foreground h-11 px-6 rounded-md font-semibold uppercase tracking-[0.18em] text-xs"
              >
                Go to dashboard
              </button>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-3 mb-6">
                <div className="font-mono-tech text-[10px] uppercase tracking-[0.3em] text-accent">
                  Storage add-on
                </div>
                <div className="h-px flex-1 bg-border/60" />
                <CreditCard className="w-4 h-4 text-muted-foreground" />
              </div>

              <h1 className="font-display font-black text-4xl md:text-5xl mb-3">
                +1 TB Storage
              </h1>
              <div className="flex items-baseline gap-2 mb-6">
                <span className="font-display font-black text-3xl">₹767</span>
                <span className="font-mono-tech text-xs uppercase tracking-widest text-muted-foreground">
                  / TB · month · incl GST
                </span>
              </div>

              <ul className="space-y-2.5 text-sm mb-8 border-t border-border/60 pt-6">
                {[
                  "1 TB cinema-grade storage (1024 GB)",
                  "Recurring monthly — cancel anytime",
                  "Stackable — buy more blocks as you grow",
                  "Storage retained until end of paid period after cancellation",
                ].map((f) => (
                  <li key={f} className="flex items-start gap-3">
                    <Check className="w-3.5 h-3.5 text-primary mt-1 shrink-0" />
                    <span className="text-muted-foreground">{f}</span>
                  </li>
                ))}
              </ul>

              <button
                onClick={handleBuy}
                disabled={loading}
                className="w-full h-12 cta-guide bg-gradient-primary text-primary-foreground rounded-md font-semibold uppercase tracking-[0.18em] text-xs inline-flex items-center justify-center gap-2 disabled:opacity-60"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" /> Opening checkout…
                  </>
                ) : (
                  <>
                    <CreditCard className="w-4 h-4" /> Pay with card
                  </>
                )}
              </button>

              <p className="text-[11px] text-muted-foreground text-center mt-4">
                {getPaddleEnvironment() === "sandbox"
                  ? "Test mode — use card 4242 4242 4242 4242, any future expiry, CVC 123."
                  : "Secure checkout. You can cancel any time from your dashboard."}
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
