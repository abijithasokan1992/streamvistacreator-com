import { Crown, ArrowRight, Check } from "lucide-react";
import { Link } from "react-router-dom";

/**
 * Creator plan upgrade card.
 * Free Creator → Paid Creator (5 TB + multiple titles).
 * Reuses the existing admin-assisted upgrade request route
 * (`?section=upgrade` → resolves to Storage & Billing / Commercial onboarding).
 * Do NOT add a parallel Razorpay flow here.
 */
export const UPGRADE_BASE_INR = 25000;
export const UPGRADE_GST_PCT = 18;
export const UPGRADE_TOTAL_INR = Math.round(UPGRADE_BASE_INR * (1 + UPGRADE_GST_PCT / 100));

export default function UpgradeCreatorPlanCard({
  variant = "primary",
  reason,
}: {
  variant?: "primary" | "compact";
  reason?: string;
}) {
  const baseFmt = UPGRADE_BASE_INR.toLocaleString("en-IN");
  const totalFmt = UPGRADE_TOTAL_INR.toLocaleString("en-IN");

  if (variant === "compact") {
    return (
      <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="font-medium text-sm flex items-center gap-1.5">
            <Crown className="w-3.5 h-3.5 text-amber-300" /> Upgrade Creator Plan
          </p>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            ₹{baseFmt} + {UPGRADE_GST_PCT}% GST (₹{totalFmt}) · 5 TB storage · multiple titles
          </p>
        </div>
        <Link
          to="/dashboard/content?section=upgrade"
          className="inline-flex items-center gap-1.5 rounded-md bg-amber-500/90 hover:bg-amber-500 text-black text-xs px-3 py-1.5 font-medium"
        >
          Upgrade to 5 TB Plan <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>
    );
  }

  return (
    <section className="rounded-2xl border border-amber-500/30 bg-gradient-to-br from-amber-500/10 to-secondary/5 p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 max-w-xl">
          <span className="text-[11px] uppercase tracking-[0.25em] text-amber-300 font-mono inline-flex items-center gap-1.5">
            <Crown className="w-3 h-3" /> Creator upgrade
          </span>
          <h3 className="font-display text-2xl mt-1.5">Upgrade Creator Plan</h3>
          {reason && (
            <p className="text-xs text-amber-200/80 mt-1.5">{reason}</p>
          )}
          <p className="text-sm mt-3">
            <span className="font-display text-2xl">₹{totalFmt}</span>
            <span className="text-muted-foreground"> total</span>
            <span className="text-xs text-muted-foreground ml-2">
              (₹{baseFmt} + {UPGRADE_GST_PCT}% GST)
            </span>
          </p>
          <ul className="mt-4 space-y-1.5 text-sm">
            <li className="flex items-start gap-2"><Check className="w-3.5 h-3.5 mt-0.5 text-emerald-400 shrink-0" /> Create additional drafts &amp; titles beyond the free 1-title limit</li>
            <li className="flex items-start gap-2"><Check className="w-3.5 h-3.5 mt-0.5 text-emerald-400 shrink-0" /> 5 TB storage included</li>
            <li className="flex items-start gap-2"><Check className="w-3.5 h-3.5 mt-0.5 text-emerald-400 shrink-0" /> Paid creator / managed-service path with review queue access</li>
          </ul>
          <p className="text-[11px] text-muted-foreground mt-3">
            Free plan includes 1 title / 1 draft and the basic creator workspace. Storage limits on the free plan are defined under Storage &amp; Billing.
          </p>
        </div>
        <Link
          to="/dashboard/content?section=upgrade"
          className="inline-flex items-center gap-2 rounded-md bg-amber-500 hover:bg-amber-400 text-black text-sm px-4 py-2.5 font-semibold"
        >
          <Crown className="w-4 h-4" /> Upgrade to 5 TB Plan
        </Link>
      </div>
    </section>
  );
}
