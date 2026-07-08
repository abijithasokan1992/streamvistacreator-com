import { Search, Sparkles } from "lucide-react";
import { useState, type KeyboardEvent } from "react";
import { cn } from "@/lib/utils";

/**
 * StreamVista Universal Search — one input for Productions, Assets,
 * Organizations, People, Rights, Metadata, Collections, Scenes, Shots,
 * and AI tags. Accepts natural-language queries.
 *
 * Emits `onSubmit(query)`; the caller wires it to the search backend.
 * Phase 1 is UI-only — no logic change to existing search endpoints.
 */
export function UniversalSearch({
  placeholder = "Search productions, media, rights, people…",
  onSubmit,
  className,
}: {
  placeholder?: string;
  onSubmit?: (q: string) => void;
  className?: string;
}) {
  const [value, setValue] = useState("");
  const handleKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && value.trim()) onSubmit?.(value.trim());
  };
  return (
    <div
      className={cn(
        "group flex items-center gap-2 rounded-lg border border-border/60 bg-surface/60 px-3 py-2 backdrop-blur-sm",
        "focus-within:border-accent/60 focus-within:bg-surface/80 transition-colors",
        className,
      )}
    >
      <Search className="w-4 h-4 text-muted-foreground shrink-0" aria-hidden="true" />
      <input
        type="search"
        role="searchbox"
        aria-label="Universal search across productions, media, rights, and people"
        placeholder={placeholder}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKey}
        className="flex-1 bg-transparent border-0 outline-none text-sm placeholder:text-muted-foreground/70 focus-visible:outline-none"
      />
      <span className="hidden md:inline-flex items-center gap-1 text-[10px] font-mono-tech uppercase tracking-[0.16em] text-muted-foreground">
        <Sparkles className="w-3 h-3 text-accent" aria-hidden="true" />
        <span>Media Intelligence</span>
      </span>
      <kbd className="hidden md:inline-block text-[10px] font-mono-tech text-muted-foreground/70 border border-border/50 rounded px-1.5 py-0.5">⌘K</kbd>
    </div>
  );
}
