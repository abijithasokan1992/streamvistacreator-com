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
import { useTranslation } from "react-i18next";

export type SectionId =
  | "home" | "titles"
  | "delivery_vault" | "distribution"
  | "business" | "messages" | "activity" | "storage"
  | "billing" | "help"
  | "profile"
  // legacy aliases kept so old URLs resolve cleanly
  | "submissions" | "updates"
  | "insights" | "statements" | "schedule" | "upgrade";

export type SectionGroup = "work" | "business" | "account";

type SectionDef = {
  id: SectionId;
  /** i18n key under `creator.sidebar` for the label. */
  labelKey: string;
  /** i18n key under `creator.sidebar` for the heading (falls back to labelKey). */
  headingKey?: string;
  /** i18n key under `creator.sidebar` for the subhead (optional). */
  subheadKey?: string;
  /** i18n key under `creator.tips` for the hover tooltip. */
  tipKey?: string;
  icon: React.ComponentType<{ className?: string }>;
  group: SectionGroup;
  /** Hidden for Free-tier creators (kept reachable via direct route for paid users). */
  proOnly?: boolean;
  /** Hidden from the sidebar entirely, but still routable via section id. */
  hidden?: boolean;
};

export const SECTIONS: ReadonlyArray<SectionDef> = [
  // Work — what am I working on?
  { id: "home",           labelKey: "home",         tipKey: "home",     icon: Home,     group: "work" },
  { id: "titles",         labelKey: "titles",       tipKey: "titles",   icon: Film,     group: "work" },
  { id: "delivery_vault", labelKey: "library",      subheadKey: "librarySub", tipKey: "library", icon: Database, group: "work" },
  { id: "distribution",   labelKey: "distribution", subheadKey: "distributionSub", tipKey: "distribution", icon: Radio, group: "work" },

  // Business — where is the commercial activity?
  { id: "business",       labelKey: "business", subheadKey: "businessSub", tipKey: "business", icon: Briefcase, group: "business", proOnly: true },
  { id: "messages",       labelKey: "messages", subheadKey: "messagesSub", tipKey: "messages", icon: Bell, group: "business" },
  { id: "activity",       labelKey: "activity", subheadKey: "activitySub", tipKey: "activity", icon: ActivityIcon, group: "business" },

  // Account
  { id: "storage", labelKey: "storage", subheadKey: "storageSub", tipKey: "storage", icon: HardDrive, group: "account" },
  { id: "billing", labelKey: "billing", subheadKey: "billingSub", tipKey: "billing", icon: Wallet, group: "account" },
  { id: "help",    labelKey: "help",    tipKey: "help",    icon: LifeBuoy, group: "account" },

  // Hidden but still routable (legacy deep links keep working)
  { id: "submissions", labelKey: "business", tipKey: "business", icon: Briefcase, group: "business", proOnly: true, hidden: true },
  { id: "updates",     labelKey: "messages", tipKey: "messages", icon: Bell,      group: "business", hidden: true },
  { id: "profile",     labelKey: "profile",  icon: UserCircle, group: "account", hidden: true },
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
  const { t } = useTranslation();
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
                  const tip = s.tipKey ? t(`creator.tips.${s.tipKey}`) : undefined;
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
                          <span className="flex-1 truncate">{t(`creator.sidebar.${s.labelKey}`)}</span>
                          {s.locked && (
                            <span className="inline-flex items-center gap-1 text-[9px] uppercase tracking-wider text-amber-300/80">
                              <Lock className="w-3 h-3" /> Pro
                            </span>
                          )}
                        </button>
                      </TooltipTrigger>
                      {tip && (
                        <TooltipContent side="right" className="max-w-[220px] text-xs">
                          {tip}
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

/**
 * Resolve the translated label/heading/subhead for a section id. Callers
 * outside the sidebar (dashboard header) use this to keep breadcrumbs and
 * page titles consistent with the sidebar labels.
 */
export function useSectionLabels(id: SectionId): { label: string; heading: string; subhead?: string } {
  const { t } = useTranslation();
  const def = SECTIONS.find((s) => s.id === id) ?? SECTIONS[0];
  const label = t(`creator.sidebar.${def.labelKey}`);
  const heading = t(`creator.sidebar.${def.headingKey ?? def.labelKey}`);
  const subhead = def.subheadKey ? t(`creator.sidebar.${def.subheadKey}`) : undefined;
  return { label, heading, subhead };
}
