import { Moon, Sun, Monitor, Check } from "lucide-react";
import { useTheme, type ThemeMode } from "./ThemeProvider";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

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
  const { mode, resolved, setMode } = useTheme();
  const dim = size === "sm" ? "h-7 w-7" : "h-9 w-9";
  const ActiveIcon =
    mode === "system" ? Monitor : resolved === "dark" ? Moon : Sun;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={`Theme: ${mode}`}
        title="Theme"
        className={cn(
          "inline-flex items-center justify-center rounded-full border border-border/70 bg-surface/60 text-muted-foreground hover:text-foreground hover:bg-secondary/60 backdrop-blur transition-colors",
          dim,
          className,
        )}
      >
        <ActiveIcon className="h-3.5 w-3.5" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[9rem]">
        {OPTIONS.map(({ value, label, Icon }) => {
          const active = mode === value;
          return (
            <DropdownMenuItem
              key={value}
              onSelect={() => setMode(value)}
              className="text-xs gap-2"
            >
              <Icon className="h-3.5 w-3.5" />
              <span className="flex-1">{label}</span>
              {active && <Check className="h-3.5 w-3.5 text-accent" />}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export default ThemeToggle;
