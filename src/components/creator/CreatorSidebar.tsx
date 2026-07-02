import { cn } from "@/lib/utils";
import {
  Home, Film, Inbox, Bell, Wallet, LifeBuoy, Lock, Database, UserCircle,
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export type SectionId =
  | "home" | "titles" | "submissions" | "updates"
  | "delivery_vault"
  | "profile"
  | "billing" | "help"
  // legacy aliases kept so old URLs resolve cleanly
  | "insights" | "statements" | "schedule" | "upgrade";

export type SectionGroup = "main" | "storage" | "account";

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
  // Main
  { id: "home",           label: "Home",         heading: "Home",         tip: "Your dashboard overview.",                              icon: Home,    group: "main" },
  { id: "titles",         label: "Titles",       heading: "Titles",       tip: "Add and manage your films and shows.",                  icon: Film,    group: "main" },

  // Storage
  { id: "delivery_vault", label: "Library",      heading: "Library",      subhead: "Masters, deliveries, archives.", tip: "Secure storage for your master files.", icon: Database, group: "storage" },

  // Account
  { id: "billing",        label: "Billing",      heading: "Billing",      subhead: "Plan, storage, invoices.",       tip: "Your plan, storage and invoices.",       icon: Wallet,  group: "account" },
  { id: "help",           label: "Help",         heading: "Help",         tip: "Contact us or get answers fast.",                         icon: LifeBuoy, group: "account" },

  // Hidden from sidebar but still routable (deep links + Home cards still work)
  { id: "submissions",    label: "Review Queue", heading: "Review Queue", tip: "Track which titles are being reviewed.",                icon: Inbox,   group: "main", proOnly: true, hidden: true },
  { id: "updates",        label: "Inbox",        heading: "Inbox",        tip: "Messages and notes from our team.",                     icon: Bell,    group: "main", proOnly: true, hidden: true },
  { id: "profile",        label: "My Profile",   heading: "My Profile",   subhead: "Identity, contact, tax and billing details.", tip: "Your identity, contact, tax and billing details.", icon: UserCircle, group: "account", hidden: true },
];

const GROUP_ORDER: SectionGroup[] = ["main", "storage", "account"];


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
