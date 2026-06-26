import { useEffect, useMemo, useState } from "react";
import { Search, Command } from "lucide-react";
import {
  CommandDialog, CommandEmpty, CommandGroup, CommandInput,
  CommandItem, CommandList, CommandSeparator,
} from "@/components/ui/command";
import { cn } from "@/lib/utils";

export type AdminSection = {
  id: string;
  label: string;
  hint?: string;
};

export type AdminDepartment = {
  id: string;
  label: string;
  sections: AdminSection[];
};

export default function AdminCommandBar({
  departments,
  onJump,
  className,
}: {
  departments: AdminDepartment[];
  onJump: (deptId: string, sectionId: string) => void;
  className?: string;
}) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  const flat = useMemo(() => {
    return departments.flatMap((d) =>
      d.sections.map((s) => ({ dept: d, section: s })),
    );
  }, [departments]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          "flex items-center gap-2 h-9 px-3 rounded-lg border border-border/60 bg-secondary/30 hover:bg-secondary/50 text-xs text-muted-foreground transition-colors min-w-[240px]",
          className,
        )}
        aria-label="Search admin sections"
      >
        <Search className="w-3.5 h-3.5" />
        <span className="flex-1 text-left">Search admin…</span>
        <kbd className="hidden sm:inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded border border-border/60 bg-background/50 text-[10px] font-mono">
          <Command className="w-2.5 h-2.5" />K
        </kbd>
      </button>

      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput placeholder="Search departments and sections…" />
        <CommandList>
          <CommandEmpty>No matching admin section.</CommandEmpty>
          {departments.map((dept, di) => (
            <div key={dept.id}>
              {di > 0 && <CommandSeparator />}
              <CommandGroup heading={dept.label}>
                {dept.sections.map((s) => (
                  <CommandItem
                    key={`${dept.id}/${s.id}`}
                    value={`${dept.label} ${s.label} ${s.hint ?? ""}`}
                    onSelect={() => {
                      setOpen(false);
                      onJump(dept.id, s.id);
                    }}
                  >
                    <span className="flex-1">{s.label}</span>
                    {s.hint && (
                      <span className="text-[10px] text-muted-foreground ml-2 truncate max-w-[180px]">
                        {s.hint}
                      </span>
                    )}
                  </CommandItem>
                ))}
              </CommandGroup>
            </div>
          ))}
        </CommandList>
      </CommandDialog>
    </>
  );
}
