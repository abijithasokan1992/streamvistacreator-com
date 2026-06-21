import { Moon, Sun, Monitor } from "lucide-react";
import { useTheme, type ThemeMode } from "./ThemeProvider";
import { cn } from "@/lib/utils";

const OPTIONS: { value: ThemeMode; label: string; Icon: typeof Sun }[] = [
  { value: "light", label: "Light", Icon: Sun },
  { value: "dark", label: "Dark", Icon: Moon },
  { value: "system", label: "System", Icon: Monitor },
];

interface Props {
  className?: string;
  size?: "sm" | "md";
}

export function ThemeToggle({ className, size = "sm" }: Props) {
  const { mode, setMode } = useTheme();
  const dim = size === "sm" ? "h-7 px-2 text-[11px]" : "h-9 px-3 text-xs";
  return (
    <div
      role="radiogroup"
      aria-label="Theme"
      className={cn(
        "inline-flex items-center gap-0.5 rounded-full border border-border/70 bg-surface/60 p-0.5 backdrop-blur",
        className,
      )}
    >
      {OPTIONS.map(({ value, label, Icon }) => {
        const active = mode === value;
        return (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={active}
            title={label}
            onClick={() => setMode(value)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full transition-colors",
              dim,
              active
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground hover:bg-secondary/60",
            )}
          >
            <Icon className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">{label}</span>
          </button>
        );
      })}
    </div>
  );
}

export default ThemeToggle;
