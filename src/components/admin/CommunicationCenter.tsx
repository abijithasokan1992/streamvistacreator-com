/**
 * CommunicationCenter
 * ------------------------------------------------------------------
 * Unified admin surface for platform communication. This is a THIN
 * orchestration layer — it reuses existing services and components:
 *
 *   - Inbox         → SupportInbox + ContactInbox
 *   - Notifications → `notifications` table (read-only + mark read)
 *   - Invitations   → PremiumInvitations
 *   - Broadcast     → UniversalBroadcast (email / SMS / in-app)
 *   - Support       → SupportInbox (filtered)
 *   - Activity      → admin_audit_log + email_send_log (read-only)
 *
 * No new messaging systems. No duplicate logic. No schema changes.
 */
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  Inbox as InboxIcon,
  Bell,
  Send,
  Megaphone,
  LifeBuoy,
  Activity as ActivityIcon,
  Search,
  Plus,
  Download,
  UserPlus,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { toast } from "@/hooks/use-toast";

import SupportInbox from "@/components/admin/SupportInbox";
import ContactInbox from "@/components/admin/ContactInbox";
import EmailLogMonitor from "@/components/admin/EmailLogMonitor";
import UniversalBroadcast from "@/components/admin/UniversalBroadcast";
import PremiumInvitations from "@/components/admin/PremiumInvitations";

type TabKey =
  | "inbox"
  | "notifications"
  | "invitations"
  | "broadcast"
  | "support"
  | "activity";

const TABS: { key: TabKey; label: string; icon: React.ReactNode; hint: string }[] = [
  { key: "inbox",         label: "Inbox",         icon: <InboxIcon className="w-4 h-4" />,     hint: "Support & contact form submissions" },
  { key: "notifications", label: "Notifications", icon: <Bell className="w-4 h-4" />,          hint: "System notifications" },
  { key: "invitations",   label: "Invitations",   icon: <Send className="w-4 h-4" />,          hint: "Studio, buyer, team invites" },
  { key: "broadcast",     label: "Broadcast",     icon: <Megaphone className="w-4 h-4" />,     hint: "Email · SMS · RCS · in-app" },
  { key: "support",       label: "Support",       icon: <LifeBuoy className="w-4 h-4" />,      hint: "Support conversations" },
  { key: "activity",      label: "Activity",      icon: <ActivityIcon className="w-4 h-4" />,  hint: "Recent communication activity" },
];

export default function CommunicationCenter() {
  const [tab, setTab] = useState<TabKey>("inbox");
  const [q, setQ] = useState("");

  return (
    <div className="space-y-6">
      {/* Header + quick actions */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <InboxIcon className="w-5 h-5 text-primary" />
            Communication Center
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            One place for inbox, notifications, invitations, broadcasts, support, and activity.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="default" onClick={() => setTab("broadcast")}>
            <Plus className="w-4 h-4 mr-1.5" /> New Broadcast
          </Button>
          <Button size="sm" variant="secondary" onClick={() => setTab("invitations")}>
            <UserPlus className="w-4 h-4 mr-1.5" /> Invite User
          </Button>
          <Button size="sm" variant="secondary" onClick={() => setTab("broadcast")}>
            <Bell className="w-4 h-4 mr-1.5" /> Send Notification
          </Button>
          <ExportActivityButton />
        </div>
      </div>

      {/* Global search */}
      <div className="relative">
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search users, messages, invitations, broadcasts, support…"
          className="pl-9"
        />
        {q && (
          <p className="text-[11px] text-muted-foreground mt-1.5">
            Filtering the active tab by “{q}”. Search runs against loaded rows in this session.
          </p>
        )}
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as TabKey)}>
        <TabsList className="flex flex-wrap gap-1 h-auto p-1">
          {TABS.map((t) => (
            <TabsTrigger key={t.key} value={t.key} className="gap-1.5 text-xs">
              {t.icon}
              {t.label}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="inbox" className="mt-4 space-y-6">
          <SectionCaption title="Inbox" hint="Support requests, contact form messages, and buyer/studio enquiries. Reuses existing inboxes." />
          <SupportInbox />
          <ContactInbox />
        </TabsContent>

        <TabsContent value="notifications" className="mt-4 space-y-4">
          <SectionCaption title="Notifications" hint="Recent system notifications. Read-only monitor across all users." />
          <NotificationsList search={q} />
        </TabsContent>

        <TabsContent value="invitations" className="mt-4 space-y-4">
          <SectionCaption title="Invitations" hint="Studio, buyer, team, and premium invitations. Actions live inside the panel below." />
          <PremiumInvitations />
        </TabsContent>

        <TabsContent value="broadcast" className="mt-4 space-y-4">
          <SectionCaption title="Broadcast" hint="Send platform announcements over email, SMS, RCS or in-app. Reuses existing GatewayAPI + Gmail + notifications." />
          <UniversalBroadcast />
        </TabsContent>

        <TabsContent value="support" className="mt-4 space-y-4">
          <SectionCaption title="Support" hint="Support conversations. Filter and assign inside the panel." />
          <SupportInbox />
        </TabsContent>

        <TabsContent value="activity" className="mt-4 space-y-4">
          <SectionCaption title="Activity" hint="Recent communication activity — invites, emails, broadcasts, support. Newest first." />
          <ActivityFeed search={q} />
          <div className="pt-2">
            <p className="text-[11px] text-muted-foreground">
              Full email delivery log:{" "}
              <Link to="/admin/comms" className="text-primary hover:underline">open email monitor</Link>.
            </p>
            <div className="mt-3">
              <EmailLogMonitor />
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

function SectionCaption({ title, hint }: { title: string; hint: string }) {
  return (
    <div>
      <h3 className="text-sm font-semibold">{title}</h3>
      <p className="text-xs text-muted-foreground mt-0.5">{hint}</p>
    </div>
  );
}

type NotificationRow = {
  id: string;
  user_id: string | null;
  title: string | null;
  message: string | null;
  read_at: string | null;
  created_at: string;
};

function NotificationsList({ search }: { search: string }) {
  const [rows, setRows] = useState<NotificationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "unread">("all");

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data, error } = await (supabase as any)
        .from("notifications")
        .select("id, user_id, title, message, read_at, created_at")
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) {
        toast({ title: "Notifications unavailable", description: error.message, variant: "destructive" });
      }
      setRows((data ?? []) as NotificationRow[]);
      setLoading(false);
    })();
  }, []);

  const visible = useMemo(() => {
    const s = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (filter === "unread" && r.read_at) return false;
      if (!s) return true;
      return (
        (r.title ?? "").toLowerCase().includes(s) ||
        (r.message ?? "").toLowerCase().includes(s)
      );
    });
  }, [rows, filter, search]);

  const markRead = async (id: string) => {
    const { error } = await (supabase as any)
      .from("notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("id", id);
    if (error) {
      toast({ title: "Could not mark read", description: error.message, variant: "destructive" });
      return;
    }
    setRows((r) => r.map((n) => (n.id === id ? { ...n, read_at: new Date().toISOString() } : n)));
  };

  if (loading) return <p className="text-xs text-muted-foreground">Loading…</p>;

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <Button size="sm" variant={filter === "all" ? "default" : "outline"} onClick={() => setFilter("all")}>All</Button>
        <Button size="sm" variant={filter === "unread" ? "default" : "outline"} onClick={() => setFilter("unread")}>Unread</Button>
      </div>
      {visible.length === 0 ? (
        <Card className="p-6 text-center text-xs text-muted-foreground">No notifications match.</Card>
      ) : (
        <ul className="space-y-2">
          {visible.map((n) => (
            <li key={n.id} className="rounded-lg border border-border/40 bg-secondary/5 p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium truncate">{n.title || "Notification"}</p>
                    {!n.read_at && <Badge variant="secondary" className="text-[10px]">Unread</Badge>}
                  </div>
                  {n.message && <p className="text-xs text-muted-foreground mt-1 whitespace-pre-wrap">{n.message}</p>}
                  <p className="text-[10px] text-muted-foreground/70 mt-1">
                    {new Date(n.created_at).toLocaleString()} · user {n.user_id?.slice(0, 8) ?? "—"}
                  </p>
                </div>
                {!n.read_at && (
                  <Button size="sm" variant="ghost" onClick={() => markRead(n.id)}>Mark read</Button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

type ActivityRow = {
  id: string;
  kind: string;
  title: string;
  detail: string;
  at: string;
};

function ActivityFeed({ search }: { search: string }) {
  const [rows, setRows] = useState<ActivityRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const collected: ActivityRow[] = [];

      const { data: audit } = await (supabase as any)
        .from("admin_audit_log")
        .select("id, action, target_type, target_id, created_at, metadata")
        .order("created_at", { ascending: false })
        .limit(80);
      for (const a of audit ?? []) {
        collected.push({
          id: `au-${a.id}`,
          kind: humanKind(a.action),
          title: a.action,
          detail: `${a.target_type ?? ""}${a.target_id ? ` · ${String(a.target_id).slice(0, 8)}` : ""}`,
          at: a.created_at,
        });
      }

      const { data: emails } = await (supabase as any)
        .from("email_send_log")
        .select("id, template_name, recipient_email, status, created_at")
        .order("created_at", { ascending: false })
        .limit(60);
      for (const e of emails ?? []) {
        collected.push({
          id: `em-${e.id}`,
          kind: "Email",
          title: `Email ${e.status}`,
          detail: `${e.template_name ?? "—"} → ${e.recipient_email ?? "—"}`,
          at: e.created_at,
        });
      }

      collected.sort((a, b) => +new Date(b.at) - +new Date(a.at));
      setRows(collected.slice(0, 150));
      setLoading(false);
    })();
  }, []);

  const visible = useMemo(() => {
    const s = search.trim().toLowerCase();
    if (!s) return rows;
    return rows.filter(
      (r) =>
        r.kind.toLowerCase().includes(s) ||
        r.title.toLowerCase().includes(s) ||
        r.detail.toLowerCase().includes(s),
    );
  }, [rows, search]);

  if (loading) return <p className="text-xs text-muted-foreground">Loading…</p>;
  if (visible.length === 0) {
    return <Card className="p-6 text-center text-xs text-muted-foreground">No activity yet.</Card>;
  }

  return (
    <ul className="space-y-1.5">
      {visible.map((r) => (
        <li key={r.id} className="rounded-md border border-border/40 bg-secondary/5 px-3 py-2 text-xs flex items-center gap-3">
          <Badge variant="outline" className="text-[10px] shrink-0">{r.kind}</Badge>
          <span className="font-medium truncate">{r.title}</span>
          <span className="text-muted-foreground truncate">{r.detail}</span>
          <span className="ml-auto text-muted-foreground/70 shrink-0">
            {new Date(r.at).toLocaleString()}
          </span>
        </li>
      ))}
    </ul>
  );
}

function humanKind(action: string) {
  const a = action.toLowerCase();
  if (a.includes("invite")) return "Invitation";
  if (a.includes("broadcast")) return "Broadcast";
  if (a.includes("support")) return "Support";
  if (a.includes("sms")) return "SMS";
  if (a.includes("email")) return "Email";
  return "Activity";
}

function ExportActivityButton() {
  const [busy, setBusy] = useState(false);
  const onExport = async () => {
    setBusy(true);
    try {
      const { data } = await (supabase as any)
        .from("admin_audit_log")
        .select("id, action, target_type, target_id, actor_user_id, created_at")
        .order("created_at", { ascending: false })
        .limit(1000);
      const rows = data ?? [];
      const header = "id,action,target_type,target_id,actor_user_id,created_at";
      const body = rows
        .map((r: any) =>
          [r.id, r.action, r.target_type ?? "", r.target_id ?? "", r.actor_user_id ?? "", r.created_at]
            .map((v) => `"${String(v).replace(/"/g, '""')}"`)
            .join(","),
        )
        .join("\n");
      const blob = new Blob([header + "\n" + body], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `communication-activity-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast({ title: "Activity exported", description: `${rows.length} rows` });
    } catch (e: any) {
      toast({ title: "Export failed", description: e?.message ?? String(e), variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };
  return (
    <Button size="sm" variant="outline" onClick={onExport} disabled={busy}>
      <Download className="w-4 h-4 mr-1.5" /> {busy ? "Exporting…" : "Export Activity"}
    </Button>
  );
}
