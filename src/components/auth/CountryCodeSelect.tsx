import { useState } from "react";
import { Check, ChevronDown, Search } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { COUNTRIES, type Country } from "@/lib/countries";
import { cn } from "@/lib/utils";

interface Props {
  value: Country;
  onChange: (c: Country) => void;
}

export function CountryCodeSelect({ value, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");

  const needle = q.trim().toLowerCase();
  const filtered = !needle
    ? COUNTRIES
    : COUNTRIES.filter(
        (c) =>
          c.name.toLowerCase().includes(needle) ||
          c.code.toLowerCase().includes(needle) ||
          c.dial.replace("+", "").includes(needle.replace("+", ""))
      );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label="Select country code"
          className="h-12 px-3 rounded-l-xl bg-input/40 border border-r-0 border-border/60 text-sm text-foreground flex items-center gap-1.5 hover:bg-input/60 transition-colors focus:outline-none focus:border-accent/70"
        >
          <span className="text-base leading-none">{value.flag}</span>
          <span className="font-mono text-xs text-muted-foreground">{value.dial}</span>
          <ChevronDown className="w-3.5 h-3.5 text-muted-foreground/70" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        sideOffset={6}
        className="w-[280px] p-0 overflow-hidden border-border/60 bg-background/80 backdrop-blur-2xl"
      >
        <div className="flex items-center gap-2 px-3 py-2.5 border-b border-border/50">
          <Search className="w-3.5 h-3.5 text-muted-foreground/70" />
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search country or code…"
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
        </div>
        <ul className="max-h-72 overflow-y-auto py-1">
          {filtered.length === 0 && (
            <li className="px-3 py-6 text-center text-xs text-muted-foreground">No matches</li>
          )}
          {filtered.map((c) => {
            const active = c.code === value.code;
            return (
              <li key={c.code}>
                <button
                  type="button"
                  onClick={() => {
                    onChange(c);
                    setOpen(false);
                    setQ("");
                  }}
                  className={cn(
                    "w-full flex items-center gap-2.5 px-3 py-2 text-sm text-left hover:bg-white/5 transition-colors",
                    active && "bg-white/5"
                  )}
                >
                  <span className="text-base leading-none">{c.flag}</span>
                  <span className="flex-1 truncate">{c.name}</span>
                  <span className="font-mono text-xs text-muted-foreground">{c.dial}</span>
                  {active && <Check className="w-3.5 h-3.5 text-accent" />}
                </button>
              </li>
            );
          })}
        </ul>
      </PopoverContent>
    </Popover>
  );
}
