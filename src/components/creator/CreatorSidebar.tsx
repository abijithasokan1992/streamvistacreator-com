import { cn } from "@/lib/utils";
import {
  Home, Film, Inbox, Bell, Wallet, LifeBuoy, Lock, Database, UserCircle,
  Briefcase, Activity as ActivityIcon, HardDrive, Radio,
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export type SectionId =
  | "home" | "titles"
  | "delivery_vault"
  | "business" | "messages" | "activity" | "storage"
  | "billing" | "help"
  | "profile"
  // legacy aliases kept so old URLs resolve cleanly
  | "submissions" | "updates"
  | "insights" | "statements" | "schedule" | "upgrade";

export type SectionGroup = "work" | "business" | "account";

type SectionDef = {
  id: SectionId;
  label: string;
  heading: string;
  subhead?: string;
  /** One-line hover tooltip for beginners. */
  tip?: string;
  icon: React.ComponentType<{ className?: string }>;
  group: SectionGroup;
  /** Hidden for Free-tier creators (kept reachable via direct route for paid users). */
  proOnly?: boolean;
  /** Hidden from the sidebar entirely, but still routable via section id. */
  hidden?: boolean;
};

export const SECTIONS: ReadonlyArray<SectionDef> = [
  // Work — what am I working on?
  { id: "home",           label: "Home",     heading: "Home",     tip: "Your workspace at a glance.",                     icon: Home,     group: "work" },
  { id: "titles",         label: "Titles",   heading: "Titles",   tip: "Add and manage your films and shows.",            icon: Film,     group: "work" },
  { id: "delivery_vault", label: "Library",  heading: "Library",  subhead: "Masters, deliveries, archives.", tip: "Secure storage for your master files.", icon: Database, group: "work" },

  // Business — where is the commercial activity?
  { id: "business",       label: "Business", heading: "Business", subhead: "Buyer interest, offers, and deals.", tip: "Buyer interest, offers and deals.", icon: Briefcase,   group: "business", proOnly: true },
  { id: "messages",       label: "Messages", heading: "Messages", subhead: "Notes from our team and buyers.", tip: "Messages and notes from our team.", icon: Bell,        group: "business" },
  { id: "activity",       label: "Activity", heading: "Activity", subhead: "Recent progress across your titles.", tip: "Everything that happened recently.", icon: ActivityIcon, group: "business" },

  // Account
  { id: "storage",        label: "Storage",  heading: "Storage",  subhead: "How much space you're using.", tip: "How much space you're using.", icon: HardDrive, group: "account" },
  { id: "billing",        label: "Billing",  heading: "Billing",  subhead: "Plan, invoices and payments.", tip: "Your plan, invoices and payments.", icon: Wallet,   group: "account" },
  { id: "help",           label: "Help",     heading: "Help",     tip: "Contact us or browse answers.",   icon: LifeBuoy, group: "account" },

  // Hidden but still routable (legacy deep links keep working)
  { id: "submissions",    label: "Business", heading: "Business", tip: "Buyer interest and deals.", icon: Briefcase, group: "business", proOnly: true, hidden: true },
  { id: "updates",        label: "Messages", heading: "Messages", tip: "Messages from our team.",   icon: Bell,      group: "business", hidden: true },
  { id: "profile",        label: "My Profile", heading: "My Profile", subhead: "Identity, contact, tax and billing details.", tip: "Your identity, contact, tax and billing details.", icon: UserCircle, group: "account", hidden: true },
];

const GROUP_ORDER: SectionGroup[] = ["work", "business", "account"];


/** Items visible in the sidebar for a given tier. Pro-only items are hidden for Free. */
export function visibleSections(isFree: boolean): ReadonlyArray<SectionDef & { locked: boolean }> {
  return SECTIONS
    .filter((s) => !s.hidden)
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
      <TooltipProvider delayDuration={300}>
        <nav className="rounded-xl border border-border/50 bg-secondary/10 p-2 space-y-2">
          {GROUP_ORDER.map((g) => {
            const groupItems = items.filter((i) => i.group === g);
            if (groupItems.length === 0) return null;
            return (
              <div key={g} className="space-y-0.5">
                {groupItems.map((s) => {
                  const Icon = s.icon;
                  const isActive = s.id === active;
                  return (
                    <Tooltip key={s.id}>
                      <TooltipTrigger asChild>
                        <button
                          data-tour={s.id}
                          onClick={() => onSelect(s.id)}
                          className={cn(
                            "w-full flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors text-left",
                            isActive
                              ? "bg-accent/[0.07] text-foreground ring-1 ring-inset ring-accent/20"
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
                      </TooltipTrigger>
                      {s.tip && (
                        <TooltipContent side="right" className="max-w-[220px] text-xs">
                          {s.tip}
                        </TooltipContent>
                      )}
                    </Tooltip>
                  );
                })}
              </div>
            );
          })}
        </nav>
      </TooltipProvider>

    </aside>
  );
}
