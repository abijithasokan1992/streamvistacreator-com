/**
 * IngestAlertsManager
 * ===================
 * Configurable alerting rules for Studio Ingest. Rules fire when:
 *   - connection_drop : jobs paused/failed > N% in last N minutes
 *   - error_spike     : failure rate > N% over a window with min jobs
 *   - low_throughput  : avg completed-job throughput below floor
 *
 * Notifications: email (Lovable Emails) and / or WhatsApp (Twilio connector).
 * Backend evaluator: `evaluate-ingest-alerts` edge function, cron every 5 min.
 *
 * Lives inside Ingest Diagnostics — premium, operational tone.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { useStorageQuota } from "@/hooks/useStorageQuota";
import {
  BellRing, Plus, Trash2, Mail, MessageCircle, Play, Loader2,
  AlertTriangle, Zap, Gauge, Power, History, Webhook,
} from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";

type RuleType = "connection_drop" | "error_spike" | "low_throughput";

type Rule = {
  id: string;
  workspace_id: string;
  name: string;
  rule_type: RuleType;
  enabled: boolean;
  threshold: Record<string, number>;
  channels: string[];
  recipients: {
    emails?: string[];
    phones?: string[];
    webhooks?: Array<{ url: string; secret?: string }>;
  };
  cooldown_minutes: number;
  last_fired_at: string | null;
  last_evaluated_at: string | null;
};

type Event = {
  id: string;
  rule_id: string;
  rule_type: string;
  fired_at: string;
  payload: any;
  channels_attempted: string[];
  delivery_status: any;
};

const RULE_META: Record<RuleType, { label: string; icon: any; blurb: string; defaults: Record<string, number> }> = {
  connection_drop: {
    label: "Connection drop",
    icon: Power,
    blurb: "Sources stop reaching the engine — jobs pause or fail in a short window.",
    defaults: { paused_minutes: 10, failed_pct: 50 },
  },
  error_spike: {
    label: "Error spike",
    icon: AlertTriangle,
    blurb: "Unusual failure rate across the latest ingest jobs.",
    defaults: { window_minutes: 60, failed_pct: 20, min_jobs: 3 },
  },
  low_throughput: {
    label: "Low throughput",
    icon: Gauge,
    blurb: "Average completed-job throughput drops below your floor.",
    defaults: { window_minutes: 30, min_bytes_per_sec: 1_000_000, min_jobs: 1 },
  },
};

function relTime(iso: string | null): string {
  if (!iso) return "never";
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 60_000) return "just now";
  if (diff < 3_600_000) return `${Math.round(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.round(diff / 3_600_000)}h ago`;
  return `${Math.round(diff / 86_400_000)}d ago`;
}

export default function IngestAlertsManager({ workspaceId }: { workspaceId: string | null }) {
  const { user } = useAuth();
  const quota = useStorageQuota();
  const isPremium = !quota.isBasic; // paid storage block, admin bonus, or testing override unlocks
  const [rules, setRules] = useState<Rule[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState<Rule | null>(null);
  const [open, setOpen] = useState(false);

  const refresh = useCallback(async () => {
    if (!workspaceId) { setRules([]); setEvents([]); return; }
    setLoading(true);
    const [r, e] = await Promise.all([
      supabase.from("ingest_alert_rules")
        .select("id,workspace_id,name,rule_type,enabled,threshold,channels,recipients,cooldown_minutes,last_fired_at,last_evaluated_at")
        .eq("workspace_id", workspaceId)
        .order("created_at", { ascending: false }),
      supabase.from("ingest_alert_events")
        .select("id,rule_id,rule_type,fired_at,payload,channels_attempted,delivery_status")
        .eq("workspace_id", workspaceId)
        .order("fired_at", { ascending: false })
        .limit(10),
    ]);
    setRules((r.data as Rule[]) ?? []);
    setEvents((e.data as Event[]) ?? []);
    setLoading(false);
  }, [workspaceId]);

  useEffect(() => { refresh(); }, [refresh]);

  const startCreate = () => {
    setEditing({
      id: "",
      workspace_id: workspaceId ?? "",
      name: "Failure spike during shoot",
      rule_type: "error_spike",
      enabled: true,
      threshold: { ...RULE_META.error_spike.defaults },
      channels: ["email"],
      recipients: { emails: user?.email ? [user.email] : [], phones: [], webhooks: [] },
      cooldown_minutes: 30,
      last_fired_at: null,
      last_evaluated_at: null,
    });
    setOpen(true);
  };

  const startEdit = (rule: Rule) => {
    setEditing(JSON.parse(JSON.stringify(rule)));
    setOpen(true);
  };

  const saveRule = async () => {
    if (!editing || !workspaceId || !user) return;
    if (!editing.name.trim()) { toast.error("Give the rule a name"); return; }
    if (editing.channels.length === 0) { toast.error("Pick at least one notification channel"); return; }
    const emails = editing.recipients.emails ?? [];
    const phones = editing.recipients.phones ?? [];
    const webhooks = (editing.recipients.webhooks ?? []).filter(
      (w) => w.url && /^https?:\/\//i.test(w.url),
    );
    if (editing.channels.includes("email") && emails.length === 0) {
      toast.error("Add at least one email recipient"); return;
    }
    if (editing.channels.includes("whatsapp") && phones.length === 0) {
      toast.error("Add at least one WhatsApp number"); return;
    }
    if (editing.channels.includes("webhook") && webhooks.length === 0) {
      toast.error("Add at least one webhook URL (https://…)"); return;
    }

    const payload = {
      workspace_id: workspaceId,
      created_by: user.id,
      name: editing.name.trim(),
      rule_type: editing.rule_type,
      enabled: editing.enabled,
      threshold: editing.threshold,
      channels: editing.channels,
      recipients: { emails, phones, webhooks },
      cooldown_minutes: Math.max(5, Math.min(1440, Number(editing.cooldown_minutes) || 30)),
    };

    if (editing.id) {
      const { error } = await supabase.from("ingest_alert_rules").update(payload).eq("id", editing.id);
      if (error) { toast.error(error.message); return; }
      toast.success("Alert rule updated");
    } else {
      const { error } = await supabase.from("ingest_alert_rules").insert(payload);
      if (error) { toast.error(error.message); return; }
      toast.success("Alert rule created");
    }
    setOpen(false);
    setEditing(null);
    refresh();
  };

  const removeRule = async (id: string) => {
    const { error } = await supabase.from("ingest_alert_rules").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Rule deleted");
    refresh();
  };

  const toggleRule = async (rule: Rule, enabled: boolean) => {
    const { error } = await supabase.from("ingest_alert_rules").update({ enabled }).eq("id", rule.id);
    if (error) toast.error(error.message);
    else refresh();
  };

  const testRule = async (rule: Rule) => {
    const { error } = await supabase.functions.invoke("evaluate-ingest-alerts", {
      body: { ruleId: rule.id, test: true },
    });
    if (error) toast.error(error.message);
    else { toast.success("Test alert dispatched"); setTimeout(refresh, 1500); }
  };

  const ruleEvents = useMemo(() => {
    const map = new Map<string, Event[]>();
    for (const e of events) {
      const arr = map.get(e.rule_id) ?? [];
      arr.push(e);
      map.set(e.rule_id, arr);
    }
    return map;
  }, [events]);

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div className="text-[10px] uppercase tracking-widest text-muted-foreground font-mono flex items-center gap-2">
          <BellRing className="w-3.5 h-3.5" /> Alert rules
        </div>
        <div className="flex items-center gap-2">
          {loading && <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground" />}
          <Button size="sm" variant="outline" className="h-7 text-[11px]" onClick={startCreate} disabled={!workspaceId}>
            <Plus className="w-3 h-3 mr-1" /> New rule
          </Button>
        </div>
      </div>

      {rules.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          No alert rules yet. Create one to be notified when sources drop, errors spike or throughput stalls.
        </p>
      ) : (
        <ul className="divide-y divide-border/30 rounded-lg border border-border/30 bg-background/30">
          {rules.map((rule) => {
            const meta = RULE_META[rule.rule_type];
            const Icon = meta.icon;
            const lastEvents = ruleEvents.get(rule.id) ?? [];
            return (
              <li key={rule.id} className="p-3 space-y-2">
                <div className="flex items-start gap-3">
                  <Icon className={`w-4 h-4 mt-0.5 shrink-0 ${rule.enabled ? "text-accent" : "text-muted-foreground"}`} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm truncate">{rule.name}</span>
                      <Badge variant="outline" className="text-[10px] font-mono">{meta.label}</Badge>
                      {rule.channels.includes("email") && <Badge variant="outline" className="text-[10px]"><Mail className="w-2.5 h-2.5 mr-1" />email</Badge>}
                      {rule.channels.includes("whatsapp") && <Badge variant="outline" className="text-[10px]"><MessageCircle className="w-2.5 h-2.5 mr-1" />whatsapp</Badge>}
                      {rule.channels.includes("webhook") && <Badge variant="outline" className="text-[10px]"><Webhook className="w-2.5 h-2.5 mr-1" />webhook</Badge>}
                      {!rule.enabled && <Badge variant="outline" className="text-[10px] text-muted-foreground">disabled</Badge>}
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-1 leading-relaxed">
                      {summarizeThreshold(rule)} · cooldown {rule.cooldown_minutes}m
                      {" · "}last fired {relTime(rule.last_fired_at)}
                      {" · "}last checked {relTime(rule.last_evaluated_at)}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <Switch checked={rule.enabled} onCheckedChange={(v) => toggleRule(rule, v)} />
                    <Button size="sm" variant="ghost" className="h-7 px-2 text-[10px]" onClick={() => testRule(rule)}>
                      <Play className="w-3 h-3 mr-1" /> Test
                    </Button>
                    <Button size="sm" variant="ghost" className="h-7 px-2 text-[10px]" onClick={() => startEdit(rule)}>
                      Edit
                    </Button>
                    <Button size="sm" variant="ghost" className="h-7 px-2 text-destructive" onClick={() => removeRule(rule.id)}>
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
                {lastEvents.length > 0 && (
                  <div className="ml-7 pl-3 border-l border-border/30 space-y-1">
                    {lastEvents.slice(0, 3).map((ev) => (
                      <div key={ev.id} className="text-[10px] text-muted-foreground flex items-start gap-2">
                        <History className="w-2.5 h-2.5 mt-0.5 shrink-0" />
                        <span className="truncate">
                          {relTime(ev.fired_at)} · {ev.payload?.summary ?? "Fired"} · channels {ev.channels_attempted.join(", ") || "—"}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {/* Editor dialog */}
      <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setEditing(null); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing?.id ? "Edit alert rule" : "New alert rule"}</DialogTitle>
          </DialogHeader>
          {editing && (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label className="text-xs">Rule name</Label>
                <Input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Rule type</Label>
                <Select
                  value={editing.rule_type}
                  onValueChange={(v: RuleType) => setEditing({
                    ...editing,
                    rule_type: v,
                    threshold: { ...RULE_META[v].defaults },
                  })}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(Object.keys(RULE_META) as RuleType[]).map((k) => (
                      <SelectItem key={k} value={k}>{RULE_META[k].label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-[11px] text-muted-foreground">{RULE_META[editing.rule_type].blurb}</p>
              </div>

              <ThresholdEditor
                ruleType={editing.rule_type}
                value={editing.threshold}
                onChange={(t) => setEditing({ ...editing, threshold: t })}
              />

              <div className="space-y-1.5">
                <Label className="text-xs">Notification channels</Label>
                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-2 text-xs cursor-pointer">
                    <Switch
                      checked={editing.channels.includes("email")}
                      onCheckedChange={(v) => setEditing({
                        ...editing,
                        channels: v
                          ? Array.from(new Set([...editing.channels, "email"]))
                          : editing.channels.filter((c) => c !== "email"),
                      })}
                    />
                    <Mail className="w-3.5 h-3.5" /> Email
                  </label>
                  <label className="flex items-center gap-2 text-xs cursor-pointer">
                    <Switch
                      checked={editing.channels.includes("whatsapp")}
                      onCheckedChange={(v) => setEditing({
                        ...editing,
                        channels: v
                          ? Array.from(new Set([...editing.channels, "whatsapp"]))
                          : editing.channels.filter((c) => c !== "whatsapp"),
                      })}
                    />
                    <MessageCircle className="w-3.5 h-3.5" /> WhatsApp
                  </label>
                  <label className="flex items-center gap-2 text-xs cursor-pointer">
                    <Switch
                      checked={editing.channels.includes("webhook")}
                      onCheckedChange={(v) => setEditing({
                        ...editing,
                        channels: v
                          ? Array.from(new Set([...editing.channels, "webhook"]))
                          : editing.channels.filter((c) => c !== "webhook"),
                      })}
                    />
                    <Webhook className="w-3.5 h-3.5" /> Webhook
                  </label>
                </div>
              </div>

              {editing.channels.includes("email") && (
                <div className="space-y-1.5">
                  <Label className="text-xs">Email recipients (comma-separated)</Label>
                  <Input
                    value={(editing.recipients.emails ?? []).join(", ")}
                    onChange={(e) => setEditing({
                      ...editing,
                      recipients: {
                        ...editing.recipients,
                        emails: e.target.value.split(",").map((s) => s.trim()).filter(Boolean),
                      },
                    })}
                    placeholder="ops@studio.com, dit@studio.com"
                  />
                </div>
              )}

              {editing.channels.includes("whatsapp") && (
                <div className="space-y-1.5">
                  <Label className="text-xs">WhatsApp numbers (E.164, comma-separated)</Label>
                  <Input
                    value={(editing.recipients.phones ?? []).join(", ")}
                    onChange={(e) => setEditing({
                      ...editing,
                      recipients: {
                        ...editing.recipients,
                        phones: e.target.value.split(",").map((s) => s.trim()).filter(Boolean),
                      },
                    })}
                    placeholder="+919876543210, +14155550199"
                  />
                  <p className="text-[10px] text-muted-foreground">
                    Requires a connected WhatsApp business number on the StreamVista side.
                    If not configured, the email channel will still fire.
                  </p>
                </div>
              )}

              {editing.channels.includes("webhook") && (
                <div className="space-y-1.5">
                  <Label className="text-xs">Webhook endpoints (one per line)</Label>
                  <Textarea
                    rows={3}
                    className="font-mono text-[11px]"
                    value={(editing.recipients.webhooks ?? []).map((w) => w.url).join("\n")}
                    onChange={(e) => {
                      const urls = e.target.value.split("\n").map((s) => s.trim()).filter(Boolean);
                      const existing = editing.recipients.webhooks ?? [];
                      const next = urls.map((url) => {
                        const prev = existing.find((w) => w.url === url);
                        return prev ?? { url, secret: existing[0]?.secret };
                      });
                      setEditing({
                        ...editing,
                        recipients: { ...editing.recipients, webhooks: next },
                      });
                    }}
                    placeholder={"https://hooks.studio.com/ingest\nhttps://ops.internal/alerts"}
                  />
                  <Label className="text-xs pt-1">Shared secret (optional)</Label>
                  <Input
                    type="password"
                    placeholder="Used to sign X-StreamVista-Signature (HMAC-SHA256)"
                    value={editing.recipients.webhooks?.[0]?.secret ?? ""}
                    onChange={(e) => {
                      const secret = e.target.value;
                      const next = (editing.recipients.webhooks ?? []).map((w) => ({ ...w, secret }));
                      setEditing({
                        ...editing,
                        recipients: { ...editing.recipients, webhooks: next },
                      });
                    }}
                  />
                  <p className="text-[10px] text-muted-foreground">
                    POSTs JSON to each URL. If a secret is set, requests include
                    <code className="mx-1">X-StreamVista-Signature: sha256=…</code>
                    computed over the raw body. Only https:// endpoints are accepted.
                  </p>
                </div>
              )}


              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Cooldown (minutes)</Label>
                  <Input
                    type="number" min={5} max={1440}
                    value={editing.cooldown_minutes}
                    onChange={(e) => setEditing({ ...editing, cooldown_minutes: Number(e.target.value) })}
                  />
                </div>
                <div className="flex items-end gap-2">
                  <Switch checked={editing.enabled} onCheckedChange={(v) => setEditing({ ...editing, enabled: v })} />
                  <span className="text-xs text-muted-foreground">Enabled</span>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={saveRule}><Zap className="w-3.5 h-3.5 mr-1.5" /> Save rule</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}

function summarizeThreshold(rule: Rule): string {
  const t = rule.threshold ?? {};
  if (rule.rule_type === "connection_drop")
    return `${t.failed_pct ?? 50}% of jobs paused/failed in last ${t.paused_minutes ?? 10} min`;
  if (rule.rule_type === "error_spike")
    return `≥ ${t.failed_pct ?? 20}% failures over ${t.window_minutes ?? 60} min (min ${t.min_jobs ?? 3} jobs)`;
  const mb = Math.max(1, Math.round((Number(t.min_bytes_per_sec ?? 1_000_000)) / 1024 / 1024));
  return `avg throughput < ${mb} MB/s over ${t.window_minutes ?? 30} min`;
}

function ThresholdEditor({
  ruleType, value, onChange,
}: { ruleType: RuleType; value: Record<string, number>; onChange: (v: Record<string, number>) => void }) {
  const set = (k: string, v: number) => onChange({ ...value, [k]: v });
  if (ruleType === "connection_drop") {
    return (
      <div className="grid grid-cols-2 gap-3">
        <Field label="Paused window (min)" v={value.paused_minutes ?? 10} onChange={(n) => set("paused_minutes", n)} />
        <Field label="Drop % threshold" v={value.failed_pct ?? 50} onChange={(n) => set("failed_pct", n)} />
      </div>
    );
  }
  if (ruleType === "error_spike") {
    return (
      <div className="grid grid-cols-3 gap-3">
        <Field label="Window (min)" v={value.window_minutes ?? 60} onChange={(n) => set("window_minutes", n)} />
        <Field label="Failure %" v={value.failed_pct ?? 20} onChange={(n) => set("failed_pct", n)} />
        <Field label="Min jobs" v={value.min_jobs ?? 3} onChange={(n) => set("min_jobs", n)} />
      </div>
    );
  }
  return (
    <div className="grid grid-cols-3 gap-3">
      <Field label="Window (min)" v={value.window_minutes ?? 30} onChange={(n) => set("window_minutes", n)} />
      <Field
        label="Floor (MB/s)"
        v={Math.max(1, Math.round((value.min_bytes_per_sec ?? 1_000_000) / 1_048_576))}
        onChange={(n) => set("min_bytes_per_sec", Math.max(1, n) * 1_048_576)}
      />
      <Field label="Min jobs" v={value.min_jobs ?? 1} onChange={(n) => set("min_jobs", n)} />
    </div>
  );
}

function Field({ label, v, onChange }: { label: string; v: number; onChange: (n: number) => void }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      <Input type="number" min={1} value={v} onChange={(e) => onChange(Number(e.target.value) || 0)} />
    </div>
  );
}
