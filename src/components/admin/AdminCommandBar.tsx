import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search, Command, Zap, User as UserIcon, Film, AlertCircle, HardDrive, CreditCard, Inbox } from "lucide-react";
import {
  CommandDialog, CommandEmpty, CommandGroup, CommandInput,
  CommandItem, CommandList, CommandSeparator,
} from "@/components/ui/command";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";

export type AdminSection = { id: string; label: string; hint?: string };
export type AdminDepartment = { id: string; label: string; sections: AdminSection[] };

type QuickCmd = { id: string; label: string; hint?: string; icon: React.ReactNode; run: () => void };
type SearchHit = { id: string; label: string; sub?: string; icon: React.ReactNode; run: () => void };

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
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [searching, setSearching] = useState(false);
  const nav = useNavigate();

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault(); setOpen((o) => !o);
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  // Natural quick-commands. Match phrases → direct navigation.
  const quickCmds: QuickCmd[] = useMemo(() => [
    { id: "failed-uploads", label: "Show failed uploads",   icon: <AlertCircle className="w-3.5 h-3.5" />, run: () => onJump("cloud", "storage") },
    { id: "failed-emails",  label: "Show failed emails",    icon: <AlertCircle className="w-3.5 h-3.5" />, run: () => onJump("platform", "email") },
    { id: "failed-pay",     label: "Show failed payments",  icon: <CreditCard className="w-3.5 h-3.5" />,  run: () => onJump("business", "billing") },
    { id: "today-tickets",  label: "Open today's tickets",  icon: <Inbox className="w-3.5 h-3.5" />,       run: () => onJump("users", "support") },
    { id: "open-payments",  label: "Open payments",         icon: <CreditCard className="w-3.5 h-3.5" />, run: () => onJump("business", "billing") },
    { id: "storage-status", label: "Storage status",        icon: <HardDrive className="w-3.5 h-3.5" />,  run: () => onJump("cloud", "storage") },
    { id: "qc-queue",       label: "Open QC queue",         icon: <Film className="w-3.5 h-3.5" />,       run: () => onJump("content", "approvals") },
    { id: "legal-queue",    label: "Open Legal queue",      icon: <Film className="w-3.5 h-3.5" />,       run: () => onJump("content", "approvals") },
    { id: "mission",        label: "Open Mission Control",  icon: <Zap className="w-3.5 h-3.5" />,        run: () => onJump("mission", "mission") },
    { id: "onboarding",     label: "Open onboarding queue", icon: <UserIcon className="w-3.5 h-3.5" />,   run: () => onJump("users", "onboarding") },
  ], [onJump]);

  // Live search: users + titles when query looks like a lookup ("open …", "find …", or bare noun).
  const runSearch = useCallback(async (raw: string) => {
    const q = raw.trim().replace(/^(open|find|show)\s+/i, "").replace(/^(creator|user|title)\s+/i, "").trim();
    if (q.length < 2) { setHits([]); return; }
    setSearching(true);
    try {
      const [users, titles] = await Promise.all([
        (supabase as any).from("user_profiles")
          .select("user_id, display_name, full_name, email, job_title")
          .or(`display_name.ilike.%${q}%,full_name.ilike.%${q}%,email.ilike.%${q}%`)
          .limit(6),
        (supabase as any).from("content_titles")
          .select("id, title, status")
          .ilike("title", `%${q}%`)
          .limit(6),
      ]);
      const out: SearchHit[] = [];
      (users?.data ?? []).forEach((u: any) => out.push({
        id: `u-${u.user_id}`,
        label: u.display_name ?? u.full_name ?? u.email ?? u.user_id,
        sub: u.job_title ?? u.email ?? "",
        icon: <UserIcon className="w-3.5 h-3.5" />,
        run: () => { setOpen(false); nav(`/admin?dept=users&section=users&q=${encodeURIComponent(q)}`); },
      }));
      (titles?.data ?? []).forEach((t: any) => out.push({
        id: `t-${t.id}`,
        label: t.title,
        sub: `Title · ${t.status}`,
        icon: <Film className="w-3.5 h-3.5" />,
        run: () => { setOpen(false); nav(`/admin?dept=content&section=approvals&q=${encodeURIComponent(t.title)}`); },
      }));
      setHits(out);
    } catch { setHits([]); }
    setSearching(false);
  }, [nav]);

  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => runSearch(query), 200);
    return () => clearTimeout(t);
  }, [query, open, runSearch]);

  const filteredQuick = query.trim().length < 2
    ? quickCmds
    : quickCmds.filter(c => c.label.toLowerCase().includes(query.toLowerCase()));

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          "flex items-center gap-2 h-9 px-3 rounded-lg border border-border/60 bg-secondary/30 hover:bg-secondary/50 text-xs text-muted-foreground transition-colors min-w-[240px]",
          className,
        )}
        aria-label="Search admin"
      >
        <Search className="w-3.5 h-3.5" />
        <span className="flex-1 text-left">Search or run command…</span>
        <kbd className="hidden sm:inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded border border-border/60 bg-background/50 text-[10px] font-mono">
          <Command className="w-2.5 h-2.5" />K
        </kbd>
      </button>

      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput placeholder="Try 'show failed uploads', 'open creator Vyshak', 'storage status'…" value={query} onValueChange={setQuery} />
        <CommandList>
          <CommandEmpty>{searching ? "Searching…" : "No matches."}</CommandEmpty>

          {filteredQuick.length > 0 && (
            <CommandGroup heading="Quick actions">
              {filteredQuick.map(c => (
                <CommandItem key={c.id} value={c.label} onSelect={() => { setOpen(false); c.run(); }}>
                  {c.icon}<span className="ml-2 flex-1">{c.label}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          )}

          {hits.length > 0 && (
            <>
              <CommandSeparator />
              <CommandGroup heading="Records">
                {hits.map(h => (
                  <CommandItem key={h.id} value={`${h.label} ${h.sub ?? ""}`} onSelect={() => h.run()}>
                    {h.icon}
                    <span className="ml-2 flex-1 truncate">{h.label}</span>
                    {h.sub && <span className="text-[10px] text-muted-foreground ml-2 truncate max-w-[180px]">{h.sub}</span>}
                  </CommandItem>
                ))}
              </CommandGroup>
            </>
          )}

          {departments.map((dept, di) => (
            <div key={dept.id}>
              {(di > 0 || hits.length > 0 || filteredQuick.length > 0) && <CommandSeparator />}
              <CommandGroup heading={dept.label}>
                {dept.sections.map((s) => (
                  <CommandItem
                    key={`${dept.id}/${s.id}`}
                    value={`${dept.label} ${s.label} ${s.hint ?? ""}`}
                    onSelect={() => { setOpen(false); onJump(dept.id, s.id); }}
                  >
                    <span className="flex-1">{s.label}</span>
                    {s.hint && <span className="text-[10px] text-muted-foreground ml-2 truncate max-w-[180px]">{s.hint}</span>}
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
