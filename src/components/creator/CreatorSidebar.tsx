import { cn } from "@/lib/utils";
import {
  Home, Film, Inbox, Bell, Wallet, LifeBuoy,
  BarChart3, Receipt, CalendarClock, Lock,
} from "lucide-react";

export type SectionId =
  | "home" | "titles" | "submissions" | "updates"
  | "billing" | "help"
  | "insights" | "statements" | "schedule"
  // legacy alias kept for old URLs
  | "upgrade";

type SectionDef = {
  id: SectionId;
  label: string;
  heading: string;
  subhead?: string;
  icon: React.ComponentType<{ className?: string }>;
  /** Hidden for Free-tier creators (kept reachable via direct route for paid users). */
  proOnly?: boolean;
};

export const SECTIONS: ReadonlyArray<SectionDef> = [
  { id: "home",        label: "Home",              heading: "Creator Workspace", subhead: "Your titles, submissions and account at a glance.",                          icon: Home },
  { id: "titles",      label: "My Titles",         heading: "My Titles",         subhead: "Create, manage and prepare your catalog for submission.",                   icon: Film },
  { id: "submissions", label: "Submissions",       heading: "Submissions",       subhead: "Cross-title view of submission state and review progress.",                  icon: Inbox },
  { id: "billing",     label: "Storage & Billing", heading: "Storage & Billing", subhead: "Plan access (founder-assisted) and self-serve storage add-ons.",            icon: Wallet },
  { id: "updates",     label: "Updates",           heading: "Updates",           subhead: "Announcements, review notes and admin messages.",                            icon: Bell },
  { id: "help",        label: "Help",              heading: "Help & Support",    subhead: "Contact us or submit a ticket.",                                             icon: LifeBuoy },

  // Paid-only — hidden entirely from Free sidebar to reduce noise.
  { id: "insights",    label: "Insights",          heading: "Insights",          subhead: "Catalog activity, performance and trends.",                                  icon: BarChart3,     proOnly: true },
  { id: "statements",  label: "Statements",        heading: "Statements",        subhead: "Invoices and account history.",                                              icon: Receipt,       proOnly: true },
  { id: "schedule",    label: "Schedule",          heading: "Schedule",          subhead: "Reviews, deadlines and delivery dates.",                                     icon: CalendarClock, proOnly: true },
];

/** Items visible in the sidebar for a given tier. Pro-only items are hidden for Free. */
export function visibleSections(isFree: boolean): ReadonlyArray<SectionDef & { locked: boolean }> {
  return SECTIONS
    .filter((s) => !(isFree && s.proOnly))
    .map((s) => ({ ...s, locked: false }));
}

export function CreatorSidebar({
  active, onSelect, mobileOpen, isFree,
}: {
  active: SectionId;
  onSelect: (s: SectionId) => void;
  mobileOpen: boolean;
  isFree: boolean;
}) {
  const items = visibleSections(isFree);
  return (
    <aside
      className={cn(
        "md:block",
        mobileOpen ? "block" : "hidden",
        "md:sticky md:top-[64px] md:self-start",
      )}
    >
      <nav className="rounded-xl border border-border/50 bg-secondary/10 p-2 space-y-0.5">
        {items.map((s) => {
          const Icon = s.icon;
          const isActive = s.id === active;
          return (
            <button
              key={s.id}
              onClick={() => onSelect(s.id)}
              className={cn(
                "w-full flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors text-left",
                isActive
                  ? "bg-accent/15 text-foreground"
                  : "text-muted-foreground hover:bg-secondary/30 hover:text-foreground",
              )}
            >
              <Icon className="w-4 h-4 shrink-0" />
              <span className="flex-1 truncate">{s.label}</span>
              {s.locked && (
                <span className="inline-flex items-center gap-1 text-[9px] uppercase tracking-wider text-amber-300/80">
                  <Lock className="w-3 h-3" /> Pro
                </span>
              )}
            </button>
          );
        })}
      </nav>
    </aside>
  );
}
