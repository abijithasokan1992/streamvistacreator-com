import { useState } from "react";
import { CheckCircle2, Film, Scale, Inbox, KeyRound, HardDrive, Cloud, Send, Wrench, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

/**
 * Persistent Quick Actions strip.
 *
 * Individual "Retry Upload", "Retry Email" and "Assign Reviewer" buttons have
 * been consolidated into a single primary "Execute Global Maintenance" action
 * that calls the `handle_global_platform_maintenance` RPC. The RPC atomically
 * requeues failed uploads, requeues failed emails, and nudges legal-review
 * titles that have no assigned reviewer.
 */

type Action = {
  id: string;
  label: string;
  icon: JSX.Element;
  dept: string;
  section: string;
  tone?: "default" | "accent" | "danger";
};

const ACTIONS: Action[] = [
  { id: "approve-title",   label: "Approve Title",   icon: <CheckCircle2 className="w-3.5 h-3.5" />, dept: "content",  section: "approvals",   tone: "accent" },
  { id: "qc-queue",        label: "QC Queue",        icon: <Film className="w-3.5 h-3.5" />,         dept: "content",  section: "qc-queue" },
  { id: "legal-queue",     label: "Legal Queue",     icon: <Scale className="w-3.5 h-3.5" />,        dept: "content",  section: "legal-queue" },
  { id: "publish-title",   label: "Publish Title",   icon: <Send className="w-3.5 h-3.5" />,         dept: "content",  section: "catalog-ops" },
  { id: "reply-ticket",    label: "Reply Ticket",    icon: <Inbox className="w-3.5 h-3.5" />,        dept: "users",    section: "support" },
  { id: "reset-password",  label: "Reset Password",  icon: <KeyRound className="w-3.5 h-3.5" />,     dept: "users",    section: "users" },
  { id: "increase-storage",label: "Increase Storage",icon: <HardDrive className="w-3.5 h-3.5" />,    dept: "cloud",    section: "storage" },
  { id: "restart-backup",  label: "Restart Backup",  icon: <Cloud className="w-3.5 h-3.5" />,        dept: "cloud",    section: "advanced" },
];

const TONE_CLS: Record<NonNullable<Action["tone"]>, string> = {
  default: "border-border/50 bg-secondary/30 hover:bg-secondary/60 text-foreground",
  accent:  "border-accent/40 bg-accent/10 hover:bg-accent/20 text-foreground",
  danger:  "border-red-500/30 bg-red-500/10 hover:bg-red-500/20 text-foreground",
};

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
      // Verify we have an authenticated session before invoking the RPC so
      // any failure is unambiguously attributable (auth vs. RLS vs. RPC).
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) {
        toast.error("Authentication error", {
          description: `Could not read session: ${sessionError.message}`,
        });
        return;
      }
      if (!sessionData.session) {
        toast.error("Not signed in", {
          description: "Sign in as an admin before running global maintenance.",
        });
        return;
      }

      // Invoke via the standard authenticated client. The user's JWT is
      // attached automatically; the RPC's has_role() gate enforces admin-only.
      const { data, error } = await (supabase.rpc as unknown as (
        fn: "handle_global_platform_maintenance",
      ) => Promise<{
        data: MaintenanceResult | null;
        error: (Error & { code?: string; details?: string; hint?: string }) | null;
      }>)("handle_global_platform_maintenance");

      if (error) {
        const code = error.code ? ` [${error.code}]` : "";
        const hint = error.hint ? ` — ${error.hint}` : "";
        toast.error(`Global maintenance failed${code}`, {
          description: `${error.message}${hint}`,
        });
        // eslint-disable-next-line no-console
        console.error("[handle_global_platform_maintenance]", {
          code: error.code,
          message: error.message,
          details: error.details,
          hint: error.hint,
        });
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
      const code = err?.code ? ` [${err.code}]` : "";
      toast.error(`Global maintenance failed${code}`, {
        description: err?.message ?? "Unknown error",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="mb-6 rounded-2xl border border-border/50 bg-secondary/10 px-3 py-2.5">
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

        {ACTIONS.map(a => (
          <button
            key={a.id}
            onClick={() => onJump(a.dept, a.section)}
            className={cn(
              "inline-flex items-center gap-1.5 h-8 px-2.5 rounded-lg border text-[11px] font-medium transition-colors",
              TONE_CLS[a.tone ?? "default"],
            )}
            title={a.label}
          >
            {a.icon}
            <span>{a.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
