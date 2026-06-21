import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Loader2, ShoppingCart, Sparkles, ShieldCheck, CheckCircle2, XCircle } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { computePricePreview, fmtINR, fmtINRDecimal, INTERVAL_OPTIONS, IntervalMonths, STORAGE_CLASS_META, VaultProduct } from "@/lib/studioVault";

declare global { interface Window { Razorpay?: any } }

function loadRazorpay(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (window.Razorpay) return resolve();
    const s = document.createElement("script");
    s.src = "https://checkout.razorpay.com/v1/checkout.js";
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("Failed to load Razorpay SDK"));
    document.body.appendChild(s);
  });
}

type Step =
  | "idle"
  | "creating_order"
  | "checkout_open"
  | "payment_pending_verification"
  | "verified_success"
  | "verification_failed"
  | "payment_failed"
  | "payment_cancelled";

interface DebugInfo {
  topupId?: string;
  orderId?: string;
  paymentId?: string;
  webhookFinalized?: boolean;
  invoiceWritten?: boolean;
  entitlementWritten?: boolean;
  verifyResponse?: unknown;
  lastError?: string;
  updatedAt?: string;
}

const ACTIVE: Step[] = ["creating_order", "checkout_open", "payment_pending_verification"];

type Props = {
  product: VaultProduct | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onPurchased?: () => void;
};

export default function BuyVaultDialog({ product, open, onOpenChange, onPurchased }: Props) {
  const { user } = useAuth();
  const meta = product ? STORAGE_CLASS_META[product.storage_class] : null;
  const [tb, setTb] = useState<number>(product?.default_tb_options?.[0] ?? 1);
  const [customTb, setCustomTb] = useState<number | "">("");
  const [months, setMonths] = useState<IntervalMonths>(1);
  const [step, setStep] = useState<Step>("idle");
  const [detail, setDetail] = useState<string>("");
  const [debug, setDebug] = useState<DebugInfo>({});
  const stepRef = useRef<Step>("idle");

  useEffect(() => {
    if (product) {
      setTb(product.default_tb_options?.[0] ?? product.min_tb ?? 1);
      setCustomTb("");
      setMonths(1);
      setStep("idle");
      stepRef.current = "idle";
      setDetail("");
      setDebug({});
    }
  }, [product?.id]);

  const effectiveTb = customTb === "" ? tb : Math.max(product?.min_tb ?? 1, Math.min(product?.max_tb ?? 500, Number(customTb)));
  const priced = useMemo(() => {
    if (!product) return null;
    return computePricePreview(product, effectiveTb, months);
  }, [product, effectiveTb, months]);

  if (!product || !meta) return null;

  const updateStep = (s: Step, d?: string, patch?: Partial<DebugInfo>) => {
    stepRef.current = s;
    setStep(s);
    if (d !== undefined) setDetail(d);
    setDebug((prev) => ({ ...prev, ...(patch ?? {}), updatedAt: new Date().toISOString() }));
  };

  const verifyPayment = async (
    topupId: string,
    resp: { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string },
  ) => {
    updateStep("payment_pending_verification", "Verifying payment with our servers…", {
      topupId,
      orderId: resp.razorpay_order_id,
      paymentId: resp.razorpay_payment_id,
    });

    try {
      const { data: vr, error: verr } = await supabase.functions.invoke("verify-storage-topup", {
        body: {
          topupId,
          razorpay_order_id: resp.razorpay_order_id,
          razorpay_payment_id: resp.razorpay_payment_id,
          razorpay_signature: resp.razorpay_signature,
        },
      });

      const v = (vr ?? {}) as {
        ok?: boolean;
        error?: string;
        alreadyProcessed?: boolean;
        webhookFinalized?: boolean;
        invoice_id?: string;
        tb_added?: number;
      };

      if (verr || !v.ok) {
        const msg = verr?.message ?? v.error ?? "Verification failed";
        updateStep("verification_failed", `❌ ${msg}`, {
          verifyResponse: vr ?? null,
          lastError: msg,
        });
        toast.error(`Payment verification failed — ${msg}`);
        return;
      }

      updateStep(
        "verified_success",
        `✅ ${product.name} activated — ${effectiveTb} TB added to your vault.`,
        {
          verifyResponse: vr,
          webhookFinalized: Boolean(v.webhookFinalized || v.alreadyProcessed),
          invoiceWritten: Boolean(v.invoice_id),
          entitlementWritten: true,
        },
      );
      toast.success(`${product.name} activated — ${effectiveTb} TB added to your vault.`);
      onPurchased?.();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Unexpected verification error";
      updateStep("verification_failed", msg, { lastError: msg });
      toast.error(`Payment verification failed — ${msg}`);
    }
  };

  const buy = async () => {
    if (!user) { toast.error("Sign in to purchase"); return; }
    setDebug({});
    updateStep("creating_order", "Preparing secure checkout…");

    try {
      await loadRazorpay();

      const { data, error } = await supabase.functions.invoke("create-vault-purchase", {
        body: { productId: product.id, tb: effectiveTb, months },
      });
      if (error) throw error;
      const d = data as { topupId: string; orderId: string; amount: number; keyId: string; error?: string };
      if (d?.error) throw new Error(d.error);
      if (!d?.orderId || !d?.topupId) throw new Error("Invalid order response");

      updateStep("checkout_open", "Opening Razorpay checkout…", {
        topupId: d.topupId,
        orderId: d.orderId,
      });

      // Forensic trace: checkout opened on the client.
      supabase.rpc("record_payment_trace_event", {
        p_order_id: d.orderId,
        p_event: "checkout_opened",
        p_extra: { topup_id: d.topupId } as any,
      }).then(() => {}, () => {});

      const rzp = new window.Razorpay!({
        key: d.keyId,
        order_id: d.orderId,
        amount: d.amount,
        currency: "INR",
        name: "StreamVista Studio Vault",
        description: `${product.name} · ${effectiveTb} TB · ${months}mo`,
        prefill: { email: user.email },
        theme: { color: "#a855f7" },
        handler: async (resp: { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string }) => {
          // Forensic trace: payment success callback fired on client.
          supabase.rpc("record_payment_trace_event", {
            p_order_id: resp.razorpay_order_id,
            p_event: "payment_success_callback",
            p_extra: { payment_id: resp.razorpay_payment_id } as any,
          }).then(() => {}, () => {});
          try {
            await verifyPayment(d.topupId, resp);
          } catch (e) {
            const msg = e instanceof Error ? e.message : "Unexpected verify error";
            updateStep("verification_failed", msg, { lastError: msg });
            toast.error("Payment verification failed");
          }
        },
        modal: {
          ondismiss: () => {
            const cur = stepRef.current;
            if (
              cur === "payment_pending_verification" ||
              cur === "verified_success" ||
              cur === "verification_failed" ||
              cur === "payment_failed"
            ) return;
            updateStep("payment_cancelled", "Checkout dismissed before payment completed.");
            supabase.rpc("record_payment_trace_event", {
              p_order_id: d.orderId,
              p_event: "checkout_dismissed",
              p_extra: {} as any,
            }).then(() => {}, () => {});
          },
        },
      });

      rzp.on?.("payment.failed", (resp: any) => {
        const err = resp?.error;
        const msg = err?.description ?? err?.reason ?? "Payment failed at gateway";
        updateStep("payment_failed", msg, {
          lastError: msg,
          paymentId: err?.metadata?.payment_id,
          orderId: err?.metadata?.order_id,
        });
        supabase.rpc("record_payment_trace_event", {
          p_order_id: d.orderId,
          p_event: "payment_failed",
          p_extra: { message: msg, payment_id: err?.metadata?.payment_id } as any,
        }).then(() => {}, () => {});
        toast.error(msg);
      });

      rzp.open();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Could not start checkout";
      updateStep("payment_failed", msg, { lastError: msg });
      toast.error(msg);
    }
  };

  const isActive = ACTIVE.includes(step);
  const isTerminalSuccess = step === "verified_success";

  const stepBadge = (() => {
    switch (step) {
      case "verified_success":
        return <Badge className="bg-emerald-600 gap-1"><CheckCircle2 className="w-3 h-3" />verified</Badge>;
      case "verification_failed":
        return <Badge variant="destructive" className="gap-1"><XCircle className="w-3 h-3" />verify failed</Badge>;
      case "payment_failed":
        return <Badge variant="destructive" className="gap-1"><XCircle className="w-3 h-3" />payment failed</Badge>;
      case "payment_cancelled":
        return <Badge variant="secondary">cancelled</Badge>;
      case "idle":
        return null;
      default:
        return <Badge variant="outline" className="gap-1"><Loader2 className="w-3 h-3 animate-spin" />{step.replace(/_/g, " ")}</Badge>;
    }
  })();

  const handleDialogChange = (v: boolean) => {
    // Don't allow closing while actively verifying — user needs to see the outcome.
    if (!v && step === "payment_pending_verification") return;
    onOpenChange(v);
  };

  return (
    <Dialog open={open} onOpenChange={handleDialogChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-display text-xl flex items-center gap-2">
            <Sparkles className={`w-5 h-5 ${meta.tone}`} />
            Buy {product.name}
          </DialogTitle>
          <DialogDescription>{meta.tagline}</DialogDescription>
        </DialogHeader>

        {isTerminalSuccess ? (
          <div className="space-y-4 py-2">
            <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-4 flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-emerald-400 mt-0.5" />
              <div className="space-y-1">
                <div className="font-semibold">Payment verified</div>
                <div className="text-sm text-muted-foreground">{detail}</div>
              </div>
            </div>
            {(debug.orderId || debug.paymentId) && (
              <div className="text-xs bg-muted/30 rounded p-2 font-mono space-y-1 border">
                <div className="font-semibold text-foreground">Receipt</div>
                {debug.topupId && <div>topup_id: {debug.topupId}</div>}
                {debug.orderId && <div>order_id: {debug.orderId}</div>}
                {debug.paymentId && <div>payment_id: {debug.paymentId}</div>}
                <div>webhook_finalized: {String(Boolean(debug.webhookFinalized))}</div>
                <div>invoice_written: {String(Boolean(debug.invoiceWritten))}</div>
                <div>entitlement_written: {String(Boolean(debug.entitlementWritten))}</div>
              </div>
            )}
            <DialogFooter>
              <Button onClick={() => onOpenChange(false)} className="bg-gradient-primary text-primary-foreground glow-primary">
                Done
              </Button>
            </DialogFooter>
          </div>
        ) : (
        <>
        <div className="space-y-5">
          <div>
            <div className="text-xs uppercase tracking-widest text-muted-foreground mb-2">Storage size</div>
            <div className="flex flex-wrap gap-2">
              {(product.default_tb_options ?? []).map((opt) => (
                <button
                  key={opt}
                  type="button"
                  onClick={() => { setTb(opt); setCustomTb(""); }}
                  disabled={isActive}
                  className={`px-3 py-1.5 rounded-lg border text-sm transition-colors disabled:opacity-50 ${
                    customTb === "" && tb === opt
                      ? "border-accent bg-accent/10 text-foreground"
                      : "border-border/50 text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {opt} TB
                </button>
              ))}
              <input
                type="number"
                min={product.min_tb}
                max={product.max_tb}
                placeholder="Custom TB"
                value={customTb}
                disabled={isActive}
                onChange={(e) => setCustomTb(e.target.value === "" ? "" : Number(e.target.value))}
                className="px-3 py-1.5 rounded-lg border border-border/50 bg-transparent text-sm w-28 focus:border-accent outline-none disabled:opacity-50"
              />
            </div>
            <p className="text-[11px] text-muted-foreground mt-1.5">
              Allowed range: {product.min_tb}–{product.max_tb} TB
            </p>
          </div>

          <div>
            <div className="text-xs uppercase tracking-widest text-muted-foreground mb-2">Billing duration</div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {INTERVAL_OPTIONS.map((opt) => (
                <button
                  key={opt.months}
                  type="button"
                  onClick={() => setMonths(opt.months)}
                  disabled={isActive}
                  className={`rounded-lg border px-2 py-2 text-xs transition-colors disabled:opacity-50 ${
                    months === opt.months
                      ? "border-accent bg-accent/10 text-foreground"
                      : "border-border/50 text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <div className="font-medium">{opt.label}</div>
                  <div className="text-[10px] mt-0.5 opacity-70">{opt.discountPct ? `${opt.discountPct}% off` : "Base price"}</div>
                </button>
              ))}
            </div>
          </div>

          {priced && (
            <div className="rounded-xl border border-border/50 bg-secondary/20 p-4 space-y-2 text-sm">
              <div className="flex justify-between text-muted-foreground">
                <span>{effectiveTb} TB × {months} month{months > 1 ? "s" : ""} @ {fmtINR(product.sell_price_per_tb_paise)}/TB/mo</span>
                <span>{fmtINR(product.sell_price_per_tb_paise * effectiveTb * months)}</span>
              </div>
              {priced.discount > 0 && (
                <div className="flex justify-between text-emerald-300">
                  <span>Duration discount</span>
                  <span>−{priced.discount}%</span>
                </div>
              )}
              <div className="flex justify-between">
                <span>Subtotal</span>
                <span className="font-medium">{fmtINRDecimal(priced.subtotal)}</span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>GST ({product.gst_percent}%)</span>
                <span>{fmtINRDecimal(priced.gst)}</span>
              </div>
              <div className="border-t border-border/40 pt-2 flex justify-between items-baseline">
                <span className="font-semibold">Total payable now</span>
                <span className="font-display text-xl">{fmtINRDecimal(priced.total)}</span>
              </div>
              <p className="text-[11px] text-muted-foreground pt-1">
                Storage is added to your vault immediately after payment. Renewal in {months} month{months > 1 ? "s" : ""}.
              </p>
            </div>
          )}

          {(stepBadge || detail) && step !== "idle" && (
            <div className="flex items-start gap-2 flex-wrap">
              {stepBadge}
              {detail && (
                <div className="text-xs text-muted-foreground bg-muted/50 rounded p-2 font-mono break-all flex-1 min-w-[200px]">
                  {detail}
                </div>
              )}
            </div>
          )}

          {(debug.orderId || debug.paymentId || debug.lastError) && step !== "idle" && (
            <details className="text-xs bg-muted/30 rounded p-2 font-mono space-y-1 border">
              <summary className="cursor-pointer font-semibold text-foreground">Debug</summary>
              <div className="mt-2 space-y-1">
                {debug.topupId && <div>topup_id: {debug.topupId}</div>}
                {debug.orderId && <div>order_id: {debug.orderId}</div>}
                {debug.paymentId && <div>payment_id: {debug.paymentId}</div>}
                <div>state: {step}</div>
                {debug.webhookFinalized !== undefined && (
                  <div>webhook_finalized: {String(debug.webhookFinalized)}</div>
                )}
                {debug.lastError && <div className="text-destructive">last_error: {debug.lastError}</div>}
                {debug.updatedAt && <div className="text-muted-foreground">updated: {debug.updatedAt}</div>}
              </div>
            </details>
          )}
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={step === "payment_pending_verification"}>
            {step === "verification_failed" || step === "payment_failed" || step === "payment_cancelled" ? "Close" : "Cancel"}
          </Button>
          <Button
            onClick={buy}
            disabled={isActive || !priced}
            className="bg-gradient-primary text-primary-foreground glow-primary"
          >
            {isActive ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <ShoppingCart className="w-4 h-4 mr-2" />}
            {step === "verification_failed" || step === "payment_failed" || step === "payment_cancelled"
              ? `Retry · ${priced ? fmtINRDecimal(priced.total) : ""}`
              : `Pay ${priced ? fmtINRDecimal(priced.total) : ""}`}
          </Button>
        </DialogFooter>
        <p className="text-[11px] text-center text-muted-foreground flex items-center justify-center gap-1 -mt-1">
          <ShieldCheck className="w-3 h-3" /> Secured by Razorpay · Invoice issued automatically
        </p>
        </>
        )}
      </DialogContent>
    </Dialog>
  );
}
