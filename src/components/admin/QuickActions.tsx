import { useState } from "react";
import {
  CheckCircle2, Film, Scale, Inbox, KeyRound, HardDrive, Cloud, Send,
  Wrench, Loader2, ArrowRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

/**
 * Admin Quick Actions.
 *
 * Layout:
 *  1. Primary Actions row — highly visible hero buttons for the two most
 *     used editorial flows: Approve Title and Publish Title. These deep-link
 *     into the Content Review workflow with the correct tab pre-selected.
 *  2. Global Maintenance action — atomic RPC to requeue failed uploads &
 *     emails and reset stalled legal reviews.
 *  3. Secondary quick-jumps — remaining ops shortcuts.
 */

type Action = {
  id: string;
  label: string;
  desc?: string;
  icon: JSX.Element;
  dept: string;
  section: string;
};

const PRIMARY_ACTIONS: Action[] = [
  {
    id: "approve-title",
    label: "Approve Title",
    desc: "Review submitted titles and clear them for distribution.",
    icon: <CheckCircle2 className="w-5 h-5" />,
    dept: "content",
    section: "approvals",
  },
  {
    id: "publish-title",
    label: "Publish Title",
    desc: "Mark approved titles Ready for Distribution.",
    icon: <Send className="w-5 h-5" />,
    dept: "content",
    section: "publish",
  },
];

const SECONDARY_ACTIONS: Action[] = [
  { id: "qc-queue",         label: "QC Queue",         icon: <Film className="w-3.5 h-3.5" />,      dept: "content", section: "qc-queue" },
  { id: "legal-queue",      label: "Legal Queue",      icon: <Scale className="w-3.5 h-3.5" />,     dept: "content", section: "legal-queue" },
  { id: "reply-ticket",     label: "Reply Ticket",     icon: <Inbox className="w-3.5 h-3.5" />,     dept: "users",   section: "support" },
  { id: "reset-password",   label: "Reset Password",   icon: <KeyRound className="w-3.5 h-3.5" />,  dept: "users",   section: "users" },
  { id: "increase-storage", label: "Increase Storage", icon: <HardDrive className="w-3.5 h-3.5" />, dept: "cloud",   section: "storage" },
  { id: "restart-backup",   label: "Restart Backup",   icon: <Cloud className="w-3.5 h-3.5" />,     dept: "cloud",   section: "advanced" },
];

type MaintenanceResult = {
  uploads_requeued?: number;
  emails_requeued?: number;
  legal_reviews_reset?: number;
};

export default function QuickActions({ onJump }: { onJump: (dept: string, section: string) => void }) {
  const [isProcessing, setIsProcessing] = useState(false);

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
        toast.error("Not signed in", { description: "Sign in as an admin before running global maintenance." });
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
        toast.error(`Global maintenance failed${code}`, { description: `${error.message}${hint}` });
        // eslint-disable-next-line no-console
        console.error("[handle_global_platform_maintenance]", error);
        return;
      }

      const r = (data ?? {}) as MaintenanceResult;
      toast.success("Global maintenance complete", {
        description:
          `Uploads requeued: ${r.uploads_requeued ?? 0} · ` +
          `Emails requeued: ${r.emails_requeued ?? 0} · ` +
          `Legal reviews reset: ${r.legal_reviews_reset ?? 0}`,
      });
    } catch (e) {
      const err = e as { code?: string; message?: string };
      toast.error("Global maintenance failed", { description: err?.message ?? "Unknown error" });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <section className="mb-6 space-y-3">
      {/* Primary Actions — hero buttons */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {PRIMARY_ACTIONS.map((a) => (
          <button
            key={a.id}
            type="button"
            onClick={() => onJump(a.dept, a.section)}
            className={cn(
              "group relative overflow-hidden text-left rounded-2xl border p-4 sm:p-5 transition-all",
              "border-accent/40 bg-gradient-to-br from-accent/15 via-accent/5 to-transparent",
              "hover:border-accent/70 hover:from-accent/25 hover:shadow-[0_8px_32px_-12px_hsl(var(--accent)/0.55)]",
              "focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/60",
            )}
            data-testid={`quick-action-${a.id}`}
          >
            <div className="flex items-start gap-3">
              <div className="rounded-xl bg-accent/25 text-accent p-2.5 ring-1 ring-accent/40 group-hover:bg-accent/35 transition-colors">
                {a.icon}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm sm:text-base font-semibold text-foreground">{a.label}</span>
                  <ArrowRight className="w-4 h-4 text-accent opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all" />
                </div>
                {a.desc && (
                  <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{a.desc}</p>
                )}
              </div>
            </div>
          </button>
        ))}
      </div>

      {/* Secondary strip */}
      <div className="rounded-2xl border border-border/50 bg-secondary/10 px-3 py-2.5">
        <div className="flex items-center gap-2 flex-wrap">
          <div className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground pr-2 border-r border-border/40">
            Quick Actions
          </div>

          <button
            onClick={runGlobalMaintenance}
            disabled={isProcessing}
            className={cn(
              "inline-flex items-center gap-1.5 h-8 px-3 rounded-lg border text-[11px] font-semibold transition-colors",
              "border-accent/60 bg-accent/20 hover:bg-accent/30 text-foreground",
              "disabled:opacity-60 disabled:cursor-not-allowed",
            )}
            title="Requeue failed uploads & emails, and reset unassigned legal reviews"
          >
            {isProcessing
              ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
              : <Wrench className="w-3.5 h-3.5" />}
            <span>{isProcessing ? "Running maintenance…" : "Execute Global Maintenance"}</span>
          </button>

          {SECONDARY_ACTIONS.map((a) => (
            <button
              key={a.id}
              onClick={() => onJump(a.dept, a.section)}
              className={cn(
                "inline-flex items-center gap-1.5 h-8 px-2.5 rounded-lg border text-[11px] font-medium transition-colors",
                "border-border/50 bg-secondary/30 hover:bg-secondary/60 text-foreground",
              )}
              title={a.label}
            >
              {a.icon}
              <span>{a.label}</span>
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
