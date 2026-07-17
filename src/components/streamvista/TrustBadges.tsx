import { Lock, CreditCard, Cloud, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { BRAND_NAME } from "@/lib/brand";

const BADGES = [
  { icon: Lock, label: "HTTPS Encrypted", emoji: "🔒" },
  { icon: CreditCard, label: "Secure Payment Processing", emoji: "💳" },
  { icon: Cloud, label: BRAND_NAME, emoji: "🎬" },
  { icon: ShieldCheck, label: "IP & Copyright Compliance", emoji: "🛡️" },
];

export const TrustBadges = ({
  className,
  compact = false,
}: {
  className?: string;
  compact?: boolean;
}) => {
  return (
    <ul
      className={cn(
        "flex flex-wrap items-center gap-2 md:gap-3",
        compact ? "justify-center" : "justify-start",
        className,
      )}
    >
      {BADGES.map(({ icon: Icon, label }) => (
        <li
          key={label}
          className={cn(
            "group inline-flex items-center gap-2 rounded-full glass border border-border/60 backdrop-blur-xl",
            "px-3 py-1.5 text-[10px] md:text-[11px] uppercase tracking-[0.18em] text-muted-foreground",
            "hover:border-primary/40 hover:text-foreground transition-all",
          )}
          title={label}
        >
          <Icon className="w-3.5 h-3.5 text-accent group-hover:text-primary transition-colors" />
          <span className="font-mono-tech">{label}</span>
        </li>
      ))}
    </ul>
  );
};
