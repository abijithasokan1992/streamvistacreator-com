import { CheckCircle2, Film, Scale, Inbox, KeyRound, HardDrive, RefreshCw, Mail, Cloud, Send, UserCog } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Persistent Quick Actions strip.
 *
 * These are shortcuts, NOT new business logic. Each button routes to an
 * existing admin sub-section that already owns the action (approvals,
 * support inbox, email log, storage monitor, etc.). All routing happens
 * through the host's onJump(deptId, sectionId) function so URL, tab and
 * sub-nav state stay in sync.
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
  { id: "approve-title",  label: "Approve Title",       icon: <CheckCircle2 className="w-3.5 h-3.5" />, dept: "content",  section: "approvals",   tone: "accent" },
  { id: "qc-queue",       label: "QC Queue",            icon: <Film className="w-3.5 h-3.5" />,         dept: "content",  section: "approvals" },
  { id: "legal-queue",    label: "Legal Queue",         icon: <Scale className="w-3.5 h-3.5" />,        dept: "content",  section: "approvals" },
  { id: "publish-title",  label: "Publish Title",       icon: <Send className="w-3.5 h-3.5" />,         dept: "content",  section: "catalog-ops" },
  { id: "assign-reviewer",label: "Assign Reviewer",     icon: <UserCog className="w-3.5 h-3.5" />,      dept: "content",  section: "approvals" },
  { id: "reply-ticket",   label: "Reply Ticket",        icon: <Inbox className="w-3.5 h-3.5" />,        dept: "users",    section: "support" },
  { id: "reset-password", label: "Reset Password",      icon: <KeyRound className="w-3.5 h-3.5" />,     dept: "users",    section: "users" },
  { id: "increase-storage", label: "Increase Storage",  icon: <HardDrive className="w-3.5 h-3.5" />,    dept: "cloud",    section: "storage" },
  { id: "retry-upload",   label: "Retry Upload",        icon: <RefreshCw className="w-3.5 h-3.5" />,    dept: "cloud",    section: "storage",     tone: "danger" },
  { id: "retry-email",    label: "Retry Email",         icon: <Mail className="w-3.5 h-3.5" />,         dept: "platform", section: "email",       tone: "danger" },
  { id: "restart-backup", label: "Restart Backup",      icon: <Cloud className="w-3.5 h-3.5" />,        dept: "cloud",    section: "advanced" },
];

const TONE_CLS: Record<NonNullable<Action["tone"]>, string> = {
  default: "border-border/50 bg-secondary/30 hover:bg-secondary/60 text-foreground",
  accent:  "border-accent/40 bg-accent/10 hover:bg-accent/20 text-foreground",
  danger:  "border-red-500/30 bg-red-500/10 hover:bg-red-500/20 text-foreground",
};

export default function QuickActions({ onJump }: { onJump: (dept: string, section: string) => void }) {
  return (
    <div className="mb-6 rounded-2xl border border-border/50 bg-secondary/10 px-3 py-2.5">
      <div className="flex items-center gap-2 flex-wrap">
        <div className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground pr-2 border-r border-border/40">
          Quick Actions
        </div>
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
