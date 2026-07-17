import { useEffect, useMemo, useState } from "react";
import { Bell, AlertTriangle, AlertCircle, Info, X, CheckCheck, Filter } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { supabase } from "@/integrations/supabase/client";
import { useMissionSignals, type MissionSignal } from "@/components/admin/hooks/useMissionSignals";
import { cn } from "@/lib/utils";

/**
 * Priority Inbox
 *
 * Unified notification surface for the single admin. Replaces per-module
 * badges with a single dropdown grouped into Critical / Needs Attention /
 * Information. Reuses:
 *   - useMissionSignals()      → pending-work counts (queues, failures)
 *   - public.notifications     → per-user in-app notification feed
 *
 * Emits a CustomEvent("admin:jump", { detail: { dept, section } }) so the
 * host <AdminMainPanel/> can route to the exact department + sub-section
 * without duplicating routing logic.
 */

type Tone = "critical" | "warn" | "info";

type InboxItem = {
  id: string;
  tone: Tone;
  title: string;
  subtitle?: string;
  timestamp?: string;
  priority: "P1" | "P2" | "P3";
  dept?: string;
  section?: string;
  onOpen?: () => void;
  isRead?: boolean;
};

function relTime(ts?: string) {
  if (!ts) return "";
  const d = new Date(ts).getTime();
  if (Number.isNaN(d)) return "";
  const s = Math.max(1, Math.floor((Date.now() - d) / 1000));
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

function signalToItem(s: MissionSignal): InboxItem {
  const tone: Tone = s.tone === "danger" ? "critical" : s.tone === "warn" ? "warn" : "info";
  const priority: "P1" | "P2" | "P3" = tone === "critical" ? "P1" : tone === "warn" ? "P2" : "P3";
  return {
    id: `sig-${s.key}`,
    tone,
    title: s.label,
    subtitle: `${s.count} pending`,
    priority,
    dept: s.dept,
    section: s.section,
  };
}

function jump(dept: string, section: string) {
  window.dispatchEvent(new CustomEvent("admin:jump", { detail: { dept, section } }));
}

const FILTERS: Array<{ id: "all" | Tone; label: string; icon: JSX.Element }> = [
  { id: "all",      label: "All",       icon: <Filter className="w-3 h-3" /> },
  { id: "critical", label: "Critical",  icon: <AlertTriangle className="w-3 h-3" /> },
  { id: "warn",     label: "Attention", icon: <AlertCircle className="w-3 h-3" /> },
  { id: "info",     label: "Info",      icon: <Info className="w-3 h-3" /> },
];

export default function PriorityInbox() {
  const { signals, critical, attention, info, refresh } = useMissionSignals(60_000);
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState<"all" | Tone>("all");
  const [notifications, setNotifications] = useState<any[]>([]);
  const [readIds, setReadIds] = useState<Set<string>>(() => {
    try { return new Set(JSON.parse(localStorage.getItem("admin:inbox:read") ?? "[]")); }
    catch { return new Set(); }
  });
  // Persistent dismissal set — survives tab switches, remounts, and reloads.
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(() => {
    try { return new Set(JSON.parse(localStorage.getItem("admin:inbox:dismissed") ?? "[]")); }
    catch { return new Set(); }
  });

  // Load notifications only once on mount and when the popover is (re)opened.
  // Local dismissal state stays authoritative and is NOT invalidated on tab switches.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data } = await (supabase as any)
          .from("notifications")
          .select("id, title, message, is_read, created_at")
          .order("created_at", { ascending: false })
          .limit(30);
        if (!cancelled) setNotifications(data ?? []);
      } catch { /* noop */ }
    })();
    return () => { cancelled = true; };
  }, [open]);

  const persistDismissed = (next: Set<string>) => {
    try { localStorage.setItem("admin:inbox:dismissed", JSON.stringify([...next])); } catch {}
  };

  const dismiss = (id: string) => {
    setDismissedIds(prev => {
      const next = new Set(prev); next.add(id);
      persistDismissed(next);
      return next;
    });
  };

  const markRead = (id: string) => {
    setReadIds(prev => {
      const next = new Set(prev); next.add(id);
      try { localStorage.setItem("admin:inbox:read", JSON.stringify([...next])); } catch {}
      return next;
    });
  };

  const clearAll = () => {
    // Global "Clear all": dismiss every currently-visible item (all tones,
    // including legacy P3 test logs) and mark unread notifications as read.
    const visibleIds = items.map(i => i.id);
    setDismissedIds(prev => {
      const next = new Set(prev); visibleIds.forEach(x => next.add(x));
      persistDismissed(next);
      return next;
    });
    setReadIds(prev => {
      const next = new Set(prev); visibleIds.forEach(x => next.add(x));
      try { localStorage.setItem("admin:inbox:read", JSON.stringify([...next])); } catch {}
      return next;
    });
    const nIds = notifications.filter(n => !n.is_read).map(n => n.id);
    if (nIds.length) {
      (supabase as any).from("notifications").update({ is_read: true }).in("id", nIds).then(() => {});
    }
  };

  const items: InboxItem[] = useMemo(() => {
    const fromSignals = signals.filter(s => s.count > 0).map(signalToItem);
    const fromNotif: InboxItem[] = notifications.map(n => ({
      id: `n-${n.id}`,
      tone: "info" as Tone,
      title: n.title ?? "Notification",
      subtitle: n.message ?? "",
      timestamp: n.created_at,
      priority: "P3" as const,
      isRead: !!n.is_read,
      onOpen: () => jump("users", "support"),
    }));
    // Apply dismissal here so both filter groupings and unread counts respect it.
    return [...fromSignals, ...fromNotif].filter(i => !dismissedIds.has(i.id));
  }, [signals, notifications, dismissedIds]);

  const filtered = useMemo(() => {
    if (filter === "all") return items;
    return items.filter(i => i.tone === filter);
  }, [items, filter]);

  const grouped = useMemo(() => ({
    critical: filtered.filter(i => i.tone === "critical"),
    warn:     filtered.filter(i => i.tone === "warn"),
    info:     filtered.filter(i => i.tone === "info"),
  }), [filtered]);

  const unreadCount = items.filter(i => !readIds.has(i.id) && !i.isRead).length;
  const criticalCount = critical.reduce((s, x) => s + x.count, 0);

  return (
    <Popover open={open} onOpenChange={(v) => { setOpen(v); if (v) refresh(); }}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label="Priority Inbox"
          className="relative h-9 w-9 grid place-items-center rounded-lg border border-border/60 bg-secondary/40 hover:bg-secondary/70 transition-colors"
        >
          <Bell className="w-4 h-4" />
          {unreadCount > 0 && (
            <span
              className={cn(
                "absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold grid place-items-center border border-background",
                criticalCount > 0 ? "bg-red-500 text-white" : "bg-amber-400 text-black",
              )}
            >
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[380px] p-0 overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border/50">
          <div className="flex items-center gap-2">
            <Bell className="w-4 h-4 text-accent" />
            <div className="font-display font-bold text-sm">Priority Inbox</div>
            {unreadCount > 0 && <span className="text-[10px] font-mono text-muted-foreground">{unreadCount} unread</span>}
          </div>
          <button
            onClick={clearAll}
            className="text-[11px] text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
          >
            <CheckCheck className="w-3 h-3" /> Clear all
          </button>
        </div>

        <div className="flex items-center gap-1 px-3 py-2 border-b border-border/40 bg-secondary/20">
          {FILTERS.map(f => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              className={cn(
                "inline-flex items-center gap-1 h-7 px-2 rounded-md text-[11px] font-medium transition-colors",
                filter === f.id ? "bg-foreground text-background" : "text-muted-foreground hover:bg-secondary/60",
              )}
            >
              {f.icon}{f.label}
            </button>
          ))}
        </div>

        <div className="max-h-[520px] overflow-y-auto">
          {(["critical","warn","info"] as const).map(tone => {
            const label = tone === "critical" ? "Critical" : tone === "warn" ? "Needs Attention" : "Information";
            return (
              <Group
                key={tone}
                label={label}
                tone={tone}
                items={grouped[tone]}
                readIds={readIds}
                onDismiss={dismiss}
                onOpen={(i) => { markRead(i.id); if (i.onOpen) i.onOpen(); else if (i.dept && i.section) jump(i.dept, i.section); setOpen(false); }}
              />
            );
          })}
          {filtered.length === 0 && (
            <div className="py-10 text-center text-xs text-muted-foreground">All clear. Nothing needs your attention.</div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

function Group({
  label, tone, items, readIds, onOpen, onDismiss,
}: {
  label: string; tone: Tone;
  items: InboxItem[]; readIds: Set<string>;
  onOpen: (i: InboxItem) => void;
  onDismiss: (id: string) => void;
}) {
  if (items.length === 0) return null;
  const dot =
    tone === "critical" ? "bg-red-500" :
    tone === "warn"     ? "bg-amber-400" :
                          "bg-sky-400";
  return (
    <div>
      <div className="flex items-center gap-2 px-4 py-2 bg-secondary/10 border-b border-border/30">
        <span className={cn("w-2 h-2 rounded-full", dot)} />
        <div className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">{label}</div>
        <span className="text-[10px] text-muted-foreground/70">· {items.length}</span>
      </div>
      <ul className="divide-y divide-border/30">
        {items.map(i => {
          const unread = !readIds.has(i.id) && !i.isRead;
          return (
            <li
              key={i.id}
              className={cn(
                "group relative flex items-stretch hover:bg-secondary/40 transition-all",
                unread && "bg-accent/[0.03]",
              )}
            >
              <button
                onClick={() => onOpen(i)}
                className="flex-1 min-w-0 text-left px-4 py-2.5 flex items-start gap-3"
              >
                <div className={cn("mt-1.5 w-1.5 h-1.5 rounded-full shrink-0", unread ? dot : "bg-transparent border border-border")} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <div className={cn("text-sm truncate", unread ? "font-semibold text-foreground" : "text-muted-foreground")}>
                      {i.title}
                    </div>
                    <span className="ml-auto shrink-0 text-[9px] font-mono text-muted-foreground/80">{i.priority}</span>
                  </div>
                  {i.subtitle && <div className="text-[11px] text-muted-foreground truncate">{i.subtitle}</div>}
                  {i.timestamp && <div className="text-[10px] text-muted-foreground/70 mt-0.5">{relTime(i.timestamp)}</div>}
                </div>
              </button>
              <button
                type="button"
                aria-label="Dismiss notification"
                title="Dismiss"
                onClick={(e) => { e.stopPropagation(); onDismiss(i.id); }}
                className="shrink-0 self-center mr-2 h-6 w-6 grid place-items-center rounded-md text-muted-foreground/60 hover:text-foreground hover:bg-secondary/70 opacity-60 group-hover:opacity-100 transition-opacity"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
