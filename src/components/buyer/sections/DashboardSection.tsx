import { useEffect, useState } from "react";
import { Search, Inbox, Film, Briefcase, Clock, Bell, CheckCircle2, Package } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { STATE_LABEL, STATE_TONE, OPEN_STATES, ACTIVE_STATES, CLOSED_STATES, type Row } from "../requests/shared";
import { cn } from "@/lib/utils";
import type { BuyerSectionId } from "./BuyerNav";

type PendingDelivery = { id: string; status: string; buyer_org_name: string | null; updated_at: string };

const DELIVERED = "(delivered,completed,downloaded)";
const APPROVAL_STATES = ["approved_for_negotiation", "agreement_pending"];

export default function DashboardSection({
  rows,
  screenerCount,
  onGo,
}: {
  rows: Row[];
  screenerCount: number;
  onGo: (s: BuyerSectionId) => void;
}) {
  const { user } = useAuth();
  const [pending, setPending] = useState<PendingDelivery[]>([]);
  const [unread, setUnread] = useState(0);
  const [pendingScreeners, setPendingScreeners] = useState(0);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      const nowIso = new Date().toISOString();
      const [deliv, notif, screeners] = await Promise.all([
        supabase
          .from("deal_deliveries")
          .select("id,status,buyer_org_name,updated_at")
          .eq("buyer_user_id", user.id)
          .not("status", "in", DELIVERED)
          .order("updated_at", { ascending: false })
          .limit(5),
        supabase
          .from("notifications")
          .select("id", { count: "exact", head: true })
          .eq("user_id", user.id)
          .eq("is_read", false),
        supabase
          .from("screening_invites")
          .select("id", { count: "exact", head: true })
          .eq("buyer_user_id", user.id)
          .eq("completed", false)
          .gt("expires_at", nowIso),
      ]);
      if (cancelled) return;
      setPending((deliv.data as unknown as PendingDelivery[]) ?? []);
      setUnread(notif.count ?? 0);
      setPendingScreeners(screeners.count ?? 0);
    })();
    return () => { cancelled = true; };
  }, [user]);

  const openRequests = rows.filter(r => OPEN_STATES.includes(r.state)).length;
  const activeConversations = rows.filter(r => ACTIVE_STATES.includes(r.state)).length;
  const awaitingApproval = rows.filter(r => APPROVAL_STATES.includes(r.state)).length;
  const recent = rows.filter(r => !CLOSED_STATES.includes(r.state)).slice(0, 5);
  const nextActions = buildNextActions({ openRequests, pendingScreeners, awaitingApproval, pendingDeliveries: pending.length, unread });

  return (
    <div className="space-y-6">
      <section aria-labelledby="today" className="rounded-2xl border border-border/40 bg-secondary/10 p-5">
        <h2 id="today" className="font-display text-base mb-3">Today's overview</h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <Metric icon={Inbox}       label="Open requests"        value={openRequests}       onClick={() => onGo("requests")} />
          <Metric icon={Film}        label="Pending screeners"    value={pendingScreeners}   onClick={() => onGo("screeners")} />
          <Metric icon={Package}     label="Pending deliveries"   value={pending.length}     onClick={() => onGo("commercial")} />
          <Metric icon={Bell}        label="Unread notifications" value={unread}             onClick={() => onGo("requests")} />
          <Metric icon={CheckCircle2} label="Awaiting approval"   value={awaitingApproval}   onClick={() => onGo("requests")} />
          <Metric icon={Briefcase}   label="Active conversations" value={activeConversations} onClick={() => onGo("commercial")} />
        </div>
      </section>

      <section aria-labelledby="actions" className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <h2 id="actions" className="sr-only">Primary actions</h2>
        <BigAction icon={Search}    label="Find Content"       onClick={() => onGo("find")} primary />
        <BigAction icon={Inbox}     label="Continue Request"   onClick={() => onGo("requests")} />
        <BigAction icon={Film}      label="View Screeners"     onClick={() => onGo("screeners")} />
        <BigAction icon={Briefcase} label="View Commercial"    onClick={() => onGo("commercial")} />
      </section>

      <div className="grid lg:grid-cols-3 gap-4">
        <section aria-labelledby="next" className="rounded-2xl border border-border/40 bg-secondary/10 p-5">
          <h2 id="next" className="font-display text-base mb-3">Next actions</h2>
          {nextActions.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nothing needs your attention right now.</p>
          ) : (
            <ul className="space-y-2 list-none">
              {nextActions.map((a, i) => (
                <li key={i}>
                  <button
                    type="button"
                    onClick={() => onGo(a.go)}
                    className="w-full text-left rounded-lg border border-border/40 bg-background/30 p-3 hover:border-accent/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                  >
                    <div className="text-sm font-medium">{a.label}</div>
                    <div className="text-[11px] text-muted-foreground mt-0.5">{a.hint}</div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section aria-labelledby="activity" className="lg:col-span-2 rounded-2xl border border-border/40 bg-secondary/10 p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 id="activity" className="font-display text-base">Recent activity</h2>
            <Button size="sm" variant="ghost" onClick={() => onGo("requests")}>View all</Button>
          </div>
          {recent.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">No activity yet.</p>
          ) : (
            <ul className="divide-y divide-border/40 list-none">
              {recent.map(r => (
                <li key={r.id} className="py-2.5 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-sm font-medium truncate">{r.title_query || "Untitled brief"}</div>
                    <div className="text-[11px] text-muted-foreground flex items-center gap-1.5 mt-0.5">
                      <Clock className="w-3 h-3" aria-hidden /> {new Date(r.updated_at).toLocaleString()}
                    </div>
                  </div>
                  <span className={cn("text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded border whitespace-nowrap",
                    STATE_TONE[r.state] ?? "bg-secondary text-muted-foreground border-border/60")}>
                    {STATE_LABEL[r.state] ?? r.state}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <p className="text-xs text-muted-foreground">
        Screener count in your account · {screenerCount}
      </p>
    </div>
  );
}

type NextAction = { label: string; hint: string; go: BuyerSectionId };
function buildNextActions(x: { openRequests: number; pendingScreeners: number; awaitingApproval: number; pendingDeliveries: number; unread: number }): NextAction[] {
  const out: NextAction[] = [];
  if (x.pendingScreeners) out.push({ label: `Watch ${x.pendingScreeners} pending screener${x.pendingScreeners > 1 ? "s" : ""}`, hint: "Access expires soon", go: "screeners" });
  if (x.awaitingApproval) out.push({ label: `Review ${x.awaitingApproval} commercial discussion${x.awaitingApproval > 1 ? "s" : ""}`, hint: "Move toward agreement", go: "commercial" });
  if (x.pendingDeliveries) out.push({ label: `Confirm ${x.pendingDeliveries} delivery${x.pendingDeliveries > 1 ? "ies" : ""}`, hint: "Approved packages awaiting download", go: "commercial" });
  if (x.openRequests) out.push({ label: `Track ${x.openRequests} open request${x.openRequests > 1 ? "s" : ""}`, hint: "Admin review in progress", go: "requests" });
  if (x.unread) out.push({ label: `Read ${x.unread} update${x.unread > 1 ? "s" : ""}`, hint: "New notifications", go: "requests" });
  if (out.length === 0) out.push({ label: "Discover new content", hint: "Browse the licensing catalogue", go: "find" });
  return out.slice(0, 5);
}

function Metric({ icon: Icon, label, value, onClick }: {
  icon: React.ComponentType<{ className?: string }>;
  label: string; value: number | string; onClick?: () => void;
}) {
  const Comp: any = onClick ? "button" : "div";
  return (
    <Comp
      type={onClick ? "button" : undefined}
      onClick={onClick}
      className={cn(
        "rounded-xl border border-border/40 bg-background/30 p-4 text-left w-full",
        onClick && "hover:border-accent/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent transition"
      )}
    >
      <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider text-muted-foreground">
        <Icon className="w-3.5 h-3.5" aria-hidden /> {label}
      </div>
      <div className="font-display text-2xl mt-1.5 tabular-nums">{value}</div>
    </Comp>
  );
}

function BigAction({ icon: Icon, label, onClick, primary }: {
  icon: React.ComponentType<{ className?: string }>;
  label: string; onClick: () => void; primary?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-2xl border p-5 text-left transition flex flex-col gap-3 min-h-[112px]",
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-accent",
        primary
          ? "bg-accent text-accent-foreground border-accent hover:opacity-90"
          : "bg-secondary/10 border-border/40 hover:border-accent/50"
      )}
    >
      <Icon className="w-5 h-5" aria-hidden />
      <span className="font-display text-base">{label}</span>
    </button>
  );
}
