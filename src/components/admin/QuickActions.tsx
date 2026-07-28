import { useState } from "react";
import {
  CheckCircle2, Film, Scale, Send, Wrench, Loader2, ArrowRight,
  Receipt, Banknote, RefreshCcw,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { ADMIN_LABELS } from "@/lib/copy/adminLabels";

/**
 * Admin Quick Actions — unified responsive action grid.
 *
 * Every entry deep-links via `onJump(dept, section)` into the matching
 * department + sub-section. Global Maintenance is an inline RPC action.
 *
 * Layout: 1-col on mobile, 2-col on ≥sm, 4-col on ≥xl.
 * Styling: unified obsidian/indigo accent panel to match StreamVista brand.
 */

type Tone = "primary" | "accent" | "warn";

type Action = {
  id: string;
  label: string;
  desc: string;
  icon: JSX.Element;
  dept: string;
  section: string;
  tone: Tone;
};

const ACTIONS: Action[] = [
  {
    id: "approve-title",
    label: ADMIN_LABELS.reviewAndApproveContent,
    desc: "Review submitted content and clear it for distribution.",
    icon: <CheckCircle2 className="w-5 h-5" />,
    dept: "content", section: "approvals", tone: "primary",
  },
  {
    id: "publish-title",
    label: ADMIN_LABELS.releaseContent,
    desc: "Mark approved content ready for distribution.",
    icon: <Send className="w-5 h-5" />,
    dept: "content", section: "publish", tone: "primary",
  },
  {
    id: "qc-queue",
    label: ADMIN_LABELS.contentQualityReview,
    desc: ADMIN_LABELS.reviewTechnicalQuality + ".",
    icon: <Film className="w-5 h-5" />,
    dept: "content", section: "qc-queue", tone: "accent",
  },
  {
    id: "legal-queue",
    label: ADMIN_LABELS.rightsAndLegalReview,
    desc: ADMIN_LABELS.reviewRightsAndLegal + ".",
    icon: <Scale className="w-5 h-5" />,
    dept: "content", section: "legal-queue", tone: "accent",
  },
  {
    id: "approve-invoice",
    label: "Approve Invoice",
    desc: "Verify and settle pending billing invoices.",
    icon: <Receipt className="w-5 h-5" />,
    dept: "business", section: "billing", tone: "accent",
  },
  {
    id: "trigger-payout",
    label: ADMIN_LABELS.sendPartnerPayments,
    desc: "Release scheduled partner and creator payments.",
    icon: <Banknote className="w-5 h-5" />,
    dept: "business", section: "billing", tone: "accent",
  },
  {
    id: "restart-ingest",
    label: ADMIN_LABELS.retryFailedUploads,
    desc: "Retry failed uploads and process the upload queue again.",
    icon: <RefreshCcw className="w-5 h-5" />,
    dept: "cloud", section: "failed-uploads", tone: "warn",
  },
];

const toneClasses: Record<Tone, string> = {
  primary: cn(
    "border-primary/40 bg-gradient-to-br from-primary/20 via-primary/10 to-transparent",
    "hover:border-primary/70 hover:from-primary/30 hover:shadow-[0_10px_36px_-14px_hsl(var(--primary)/0.6)]",
    "focus-visible:ring-primary/60",
  ),
  accent: cn(
    "border-accent/40 bg-gradient-to-br from-accent/15 via-accent/5 to-transparent",
    "hover:border-accent/70 hover:from-accent/25 hover:shadow-[0_10px_36px_-14px_hsl(var(--accent)/0.55)]",
    "focus-visible:ring-accent/60",
  ),
  warn: cn(
    "border-amber-500/40 bg-gradient-to-br from-amber-500/15 via-amber-500/5 to-transparent",
    "hover:border-amber-500/70 hover:from-amber-500/25 hover:shadow-[0_10px_36px_-14px_hsl(38_92%_50%/0.5)]",
    "focus-visible:ring-amber-500/60",
  ),
};

const toneIconClasses: Record<Tone, string> = {
  primary: "bg-primary/25 text-primary ring-primary/40 group-hover:bg-primary/35",
  accent:  "bg-accent/25 text-accent ring-accent/40 group-hover:bg-accent/35",
  warn:    "bg-amber-500/25 text-amber-400 ring-amber-500/40 group-hover:bg-amber-500/35",
};

type MaintenanceResult = {
  uploads_requeued?: number;
  emails_requeued?: number;
  legal_reviews_reset?: number;
};

export default function QuickActions({ onJump }: { onJump: (dept: string, section: string) => void }) {
  const [isProcessing, setIsProcessing] = useState(false);
  const queryClient = useQueryClient();

  /** Force-refresh server state before navigating so the target panel never
   *  renders against a frozen cache. */
  const handleJump = (dept: string, section: string) => {
    try {
      queryClient.invalidateQueries();
    } catch { /* noop */ }
    onJump(dept, section);
  };

  const runGlobalMaintenance = async () => {
    if (isProcessing) return;
    setIsProcessing(true);
    try {
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) {
        toast.error("Authentication error", { description: `Could not read session: ${sessionError.message}` });
        return;
      }
      if (!sessionData.session) {
        toast.error("Not signed in", { description: "Sign in as an admin before running the system check." });
        return;
      }

      const { data, error } = await (supabase.rpc as unknown as (
        fn: "handle_global_platform_maintenance",
      ) => Promise<{
        data: MaintenanceResult | null;
        error: (Error & { code?: string; details?: string; hint?: string }) | null;
      }>)("handle_global_platform_maintenance");

      if (error) {
        const code = error.code ? ` [${error.code}]` : "";
        const hint = error.hint ? ` — ${error.hint}` : "";
        toast.error(`System check failed${code}`, { description: `${error.message}${hint}` });
        // eslint-disable-next-line no-console
        console.error("[handle_global_platform_maintenance]", error);
        return;
      }

      const r = (data ?? {}) as MaintenanceResult;
      try { queryClient.invalidateQueries(); } catch { /* noop */ }
      toast.success("System check complete", {
        description:
          `Uploads retried: ${r.uploads_requeued ?? 0} · ` +
          `Emails retried: ${r.emails_requeued ?? 0} · ` +
          `Legal reviews reset: ${r.legal_reviews_reset ?? 0}`,
      });
    } catch (e) {
      const err = e as { code?: string; message?: string };
      toast.error("System check failed", { description: err?.message ?? "Unknown error" });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <section className="mb-6 space-y-3">
      <div className="flex items-center justify-between">
        <div className="text-[11px] uppercase tracking-[0.18em] font-semibold text-muted-foreground">
          Quick Actions
        </div>
        <button
          onClick={runGlobalMaintenance}
          disabled={isProcessing}
          className={cn(
            "inline-flex items-center gap-1.5 h-8 px-3 rounded-lg border text-[11px] font-semibold transition-colors",
            "border-primary/60 bg-primary/15 hover:bg-primary/25 text-foreground",
            "disabled:opacity-60 disabled:cursor-not-allowed",
          )}
          title="Retry failed uploads and emails, and reset unassigned legal reviews"
        >
          {isProcessing
            ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
            : <Wrench className="w-3.5 h-3.5" />}
          <span>{isProcessing ? "Running system check…" : ADMIN_LABELS.runSystemCheck}</span>
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
        {ACTIONS.map((a) => (
          <button
            key={a.id}
            type="button"
            onClick={() => handleJump(a.dept, a.section)}
            className={cn(
              "group relative overflow-hidden text-left rounded-2xl border p-4 transition-all",
              "focus:outline-none focus-visible:ring-2",
              toneClasses[a.tone],
            )}
            data-testid={`quick-action-${a.id}`}
          >
            <div className="flex items-start gap-3">
              <div className={cn(
                "rounded-xl p-2.5 ring-1 transition-colors",
                toneIconClasses[a.tone],
              )}>
                {a.icon}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-foreground">{a.label}</span>
                  <ArrowRight className="w-4 h-4 opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all text-foreground/70" />
                </div>
                <p className="text-xs text-muted-foreground mt-1 leading-relaxed line-clamp-2">{a.desc}</p>
              </div>
            </div>
          </button>
        ))}
      </div>
    </section>
  );
}
