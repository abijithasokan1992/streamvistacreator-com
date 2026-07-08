import { LayoutDashboard, Search, Bookmark, Inbox, Film, Briefcase, Receipt, LifeBuoy } from "lucide-react";
import { cn } from "@/lib/utils";

export const BUYER_SECTIONS = [
  { id: "dashboard",  label: "Workspace",     icon: LayoutDashboard },
  { id: "find",       label: "Marketplace",   icon: Search },
  { id: "watchlist",  label: "Collections",   icon: Bookmark },
  { id: "requests",   label: "Requests",      icon: Inbox },
  { id: "screeners",  label: "Screeners",     icon: Film },
  { id: "commercial", label: "Licensing",     icon: Briefcase },
  { id: "billing",    label: "Billing",       icon: Receipt },
  { id: "help",       label: "Support",       icon: LifeBuoy },
] as const;


export type BuyerSectionId = typeof BUYER_SECTIONS[number]["id"];

export default function BuyerNav({
  section,
  onChange,
  badges,
}: {
  section: BuyerSectionId;
  onChange: (s: BuyerSectionId) => void;
  badges?: Partial<Record<BuyerSectionId, number>>;
}) {
  return (
    <>
      {/* Mobile / tablet */}
      <nav aria-label="Buyer workspace sections" className="lg:hidden -mx-2 px-2 overflow-x-auto">
        <ul className="flex gap-1.5 min-w-max pb-2">
          {BUYER_SECTIONS.map(s => {
            const Icon = s.icon;
            const active = s.id === section;
            const badge = badges?.[s.id];
            return (
              <li key={s.id}>
                <button
                  type="button"
                  onClick={() => onChange(s.id)}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs whitespace-nowrap transition",
                    "focus:outline-none focus-visible:ring-2 focus-visible:ring-accent",
                    active
                      ? "bg-accent text-accent-foreground border-accent"
                      : "bg-secondary/20 border-border/50 text-foreground hover:border-accent/50"
                  )}
                >
                  <Icon className="w-3.5 h-3.5" aria-hidden />
                  {s.label}
                  {badge ? <span className="ml-0.5 text-[10px] font-semibold">{badge}</span> : null}
                </button>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Desktop */}
      <nav aria-label="Buyer workspace sections" className="hidden lg:block sticky top-6 self-start">
        <ul className="space-y-1">
          {BUYER_SECTIONS.map(s => {
            const Icon = s.icon;
            const active = s.id === section;
            const badge = badges?.[s.id];
            return (
              <li key={s.id}>
                <button
                  type="button"
                  onClick={() => onChange(s.id)}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "w-full flex items-center justify-between gap-2 rounded-lg px-3 py-2 text-sm transition",
                    "focus:outline-none focus-visible:ring-2 focus-visible:ring-accent",
                    active
                      ? "bg-accent/15 text-foreground border border-accent/40"
                      : "text-muted-foreground hover:text-foreground hover:bg-secondary/30 border border-transparent"
                  )}
                >
                  <span className="inline-flex items-center gap-2">
                    <Icon className="w-4 h-4" aria-hidden />
                    {s.label}
                  </span>
                  {badge ? (
                    <span className="text-[10px] font-semibold rounded-full bg-accent/20 text-accent-foreground/90 px-1.5 py-0.5">
                      {badge}
                    </span>
                  ) : null}
                </button>
              </li>
            );
          })}
        </ul>
      </nav>
    </>
  );
}
