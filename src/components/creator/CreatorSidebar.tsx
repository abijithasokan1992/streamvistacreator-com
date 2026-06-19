import { cn } from "@/lib/utils";
import {
  Home, Film, Bell, Radio, BarChart3, Receipt, CalendarClock,
  Crown, Gift, LifeBuoy,
} from "lucide-react";

export type SectionId =
  | "home" | "titles" | "updates" | "distribution" | "insights"
  | "statements" | "schedule" | "upgrade" | "referrals" | "help";

export const SECTIONS: ReadonlyArray<{
  id: SectionId;
  label: string;
  heading: string;
  subhead?: string;
  icon: React.ComponentType<{ className?: string }>;
  comingSoon?: boolean;
}> = [
  { id: "home",         label: "Home",         heading: "Home",                  subhead: "Your studio at a glance.",                                       icon: Home },
  { id: "titles",       label: "My Titles",    heading: "My Titles",             subhead: "Create, manage and submit your catalog.",                        icon: Film },
  { id: "updates",      label: "Updates",      heading: "Updates",               subhead: "System notices, approvals, review notes and admin messages.",   icon: Bell },
  { id: "distribution", label: "Distribution", heading: "Distribution",          subhead: "Distribution channels.",                                         icon: Radio, comingSoon: true },
  { id: "insights",     label: "Insights",     heading: "Insights",              subhead: "Storage, catalog activity and upload trends.",                   icon: BarChart3 },
  { id: "statements",   label: "Statements",   heading: "Statements",            subhead: "Invoices, subscriptions and billing history.",                   icon: Receipt },
  { id: "schedule",     label: "Schedule",     heading: "Schedule",              subhead: "Upcoming reviews, approval deadlines and delivery dates.",       icon: CalendarClock },
  { id: "upgrade",      label: "Upgrade",      heading: "Upgrade",               subhead: "Manage plan and storage.",                                       icon: Crown },
  { id: "referrals",    label: "Referrals",    heading: "Referrals",             subhead: "Refer creators and partners.",                                   icon: Gift, comingSoon: true },
  { id: "help",         label: "Help",         heading: "Help & Support",        subhead: "Contact us, read docs, or submit a ticket.",                     icon: LifeBuoy },
];

export function CreatorSidebar({
  active, onSelect, mobileOpen,
}: {
  active: SectionId;
  onSelect: (s: SectionId) => void;
  mobileOpen: boolean;
}) {
  return (
    <aside
      className={cn(
        "md:block",
        mobileOpen ? "block" : "hidden",
        "md:sticky md:top-[64px] md:self-start",
      )}
    >
      <nav className="rounded-xl border border-border/50 bg-secondary/10 p-2 space-y-0.5">
        {SECTIONS.map((s) => {
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
              {s.comingSoon && (
                <span className="text-[9px] uppercase tracking-wider text-muted-foreground/60">Soon</span>
              )}
            </button>
          );
        })}
      </nav>
    </aside>
  );
}
