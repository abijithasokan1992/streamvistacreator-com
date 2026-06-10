import { Lock, CreditCard, Cloud, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";

const BADGES = [
  { icon: Lock, label: "256-bit SSL Secure", emoji: "🔒" },
  { icon: CreditCard, label: "100% Secure Payments", emoji: "💳" },
  { icon: Cloud, label: "C CLOUD · 99.9% UPTIME SLA", emoji: "☁️" },
  { icon: ShieldCheck, label: "DMCA Protected", emoji: "🛡️" },
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
