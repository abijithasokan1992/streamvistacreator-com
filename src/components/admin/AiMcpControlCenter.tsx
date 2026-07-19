import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Brain, ShieldAlert, ShieldCheck, RefreshCw, Power, Activity, Lock, Unlock, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import {
  DEFAULT_MCP_PERMISSIONS,
  type McpPermissions,
  invalidateMcpPermissionsCache,
} from "@/lib/mcpClient";
import {
  normalizeAuditRow,
  filterAudit,
  type NormalizedAudit,
  type RawAuditRow,
  type AuditFilter,
  UNKNOWN,
} from "@/lib/mcp/auditNormalize";

const TOGGLES: Array<{
  key: keyof Omit<McpPermissions, "master_kill_switch">;
  label: string;
  desc: string;
  dangerous?: boolean;
}> = [
  { key: "allow_db_read", label: "Allow DB Read", desc: "AI agent may read records from the database (respecting RLS)." },
  { key: "allow_db_write", label: "Allow DB Write", desc: "AI agent may insert/update/delete records.", dangerous: true },
  { key: "allow_storage_read", label: "Allow Storage Read", desc: "AI agent may download files from OCI / Supabase storage." },
  { key: "allow_storage_write", label: "Allow Storage Write", desc: "AI agent may upload or overwrite files.", dangerous: true },
  { key: "allow_edge_invoke", label: "Allow Edge Function Invoke", desc: "AI agent may call edge functions." },
  { key: "allow_user_data_export", label: "Allow User Data Export", desc: "AI agent may export personal user data.", dangerous: true },
];

export default function AiMcpControlCenter() {
  const [perms, setPerms] = useState<McpPermissions>(DEFAULT_MCP_PERMISSIONS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [audit, setAudit] = useState<RawAuditRow[]>([]);
  const [detail, setDetail] = useState<NormalizedAudit | null>(null);
  const [pendingChange, setPendingChange] = useState<{
    key: keyof McpPermissions;
    label: string;
    nextValue: boolean;
    dangerous: boolean;
  } | null>(null);
  const [reason, setReason] = useState("");
  const [filter, setFilter] = useState<AuditFilter>("all");

  const loadPerms = useCallback(async () => {
    const { data } = await supabase
      .from("admin_settings")
      .select("value")
      .eq("key", "mcp_permissions")
      .maybeSingle();
    if (data?.value) setPerms({ ...DEFAULT_MCP_PERMISSIONS, ...(data.value as Partial<McpPermissions>) });
    setLoading(false);
  }, []);

  const loadAudit = useCallback(async () => {
    const { data, error } = await supabase
      .from("mcp_audit_log")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50);
    if (!error && data) setAudit(data as RawAuditRow[]);
  }, []);

  // Guard against duplicate realtime subscriptions across rerenders / StrictMode
  // double-invokes. We keep both a ref to the active channel and a module-style
  // id so we can detect and log any accidental second subscription attempt.
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const subIdRef = useRef<string | null>(null);

  useEffect(() => {
    loadPerms();
    loadAudit();

    if (channelRef.current) {
      console.warn(
        "[mcp-audit-live] duplicate subscription prevented; existing id=",
        subIdRef.current
      );
      return;
    }

    const id = `mcp-audit-live-${Date.now().toString(36)}-${Math.random()
      .toString(36)
      .slice(2, 8)}`;
    subIdRef.current = id;

    try {
      const channel = supabase.channel(id);
      // Attach ALL callbacks BEFORE .subscribe()
      channel.on(
        "postgres_changes" as never,
        { event: "INSERT", schema: "public", table: "mcp_audit_log" },
        (payload: { new: RawAuditRow }) =>
          setAudit((prev) => [payload.new, ...prev].slice(0, 50))
      );
      channel.subscribe((status) => {
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          console.warn(`[mcp-audit-live:${id}] realtime status:`, status);
        }
      });
      channelRef.current = channel;
    } catch (err) {
      console.warn("[mcp-audit-live] realtime setup failed (non-fatal):", err);
    }

    return () => {
      const ch = channelRef.current;
      channelRef.current = null;
      subIdRef.current = null;
      if (ch) {
        try {
          supabase.removeChannel(ch);
        } catch (e) {
          console.warn("[mcp-audit-live] cleanup failed:", e);
        }
      }
    };
  }, [loadPerms, loadAudit]);

  const save = async (next: McpPermissions, changed?: { key: keyof McpPermissions; label: string; oldValue: boolean; newValue: boolean; reason: string }) => {
    setSaving(true);
    const prev = perms;
    setPerms(next);
    const { error } = await supabase
      .from("admin_settings")
      .upsert({ key: "mcp_permissions", value: { ...next, updated_at: new Date().toISOString() } }, { onConflict: "key" });
    setSaving(false);
    if (error) {
      toast.error("Failed to save MCP permissions");
      setPerms(prev);
      loadPerms();
      return;
    }
    invalidateMcpPermissionsCache();
    toast.success("MCP permissions updated");

    // Audit the admin's toggle action itself (separate from AI tool-call audits).
    if (changed) {
      try {
        const { data: u } = await supabase.auth.getUser();
        await supabase.from("mcp_audit_log").insert({
          actor_user_id: u.user?.id ?? null,
          actor_email: u.user?.email ?? null,
          action: "admin_permission_change",
          resource: changed.key,
          permission_key: changed.key,
          allowed: true,
          details: {
            decision: "allowed",
            label: changed.label,
            old_value: changed.oldValue,
            new_value: changed.newValue,
            reason: changed.reason,
            changed_at: new Date().toISOString(),
          } as never,
        });
      } catch (e) {
        console.warn("[mcp-audit] failed to log admin permission change:", e);
      }
    }
  };

  const requestToggle = (key: keyof McpPermissions, dangerous: boolean, label: string) => (v: boolean) => {
    setReason("");
    setPendingChange({ key, label, nextValue: v, dangerous });
  };

  const confirmPending = () => {
    if (!pendingChange) return;
    const trimmed = reason.trim();
    if (trimmed.length < 3) {
      toast.error("Please enter a short reason (min 3 characters).");
      return;
    }
    const { key, label, nextValue } = pendingChange;
    const oldValue = !!perms[key];
    setPendingChange(null);
    setReason("");
    save({ ...perms, [key]: nextValue }, { key, label, oldValue, newValue: nextValue, reason: trimmed });
  };


  const normalized = useMemo(() => audit.map(normalizeAuditRow), [audit]);
  const filtered = useMemo(() => filterAudit(normalized, filter), [normalized, filter]);

  const decisionIcon = (d: NormalizedAudit["decision"]) => {
    if (d === "allowed") return <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />;
    if (d === "denied") return <ShieldAlert className="w-3.5 h-3.5 text-amber-400 shrink-0" />;
    return <AlertTriangle className="w-3.5 h-3.5 text-red-400 shrink-0" />;
  };

  return (
    <div className="rounded-2xl border border-border/60 bg-card/40 backdrop-blur-xl p-6 space-y-6">
      <header className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="rounded-xl bg-gradient-to-br from-cyan-500/20 to-purple-500/20 p-2.5 border border-cyan-500/30">
            <Brain className="w-5 h-5 text-cyan-300" />
          </div>
          <div>
            <h2 className="font-display text-xl font-bold flex items-center gap-2">
              AI & MCP Control Center
              {perms.master_kill_switch ? (
                <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded bg-red-500/15 text-red-400 border border-red-500/30">Killed</span>
              ) : (
                <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">Active</span>
              )}
            </h2>
            <p className="text-xs text-muted-foreground mt-1 max-w-xl">
              Govern what the AI agent (Model Context Protocol) is allowed to do across the platform. Every attempt is logged in real time.
            </p>
          </div>
        </div>
        <Button
          variant={perms.master_kill_switch ? "default" : "destructive"}
          size="sm"
          disabled={saving}
          onClick={() => {
            setReason("");
            setPendingChange({
              key: "master_kill_switch",
              label: "Master Kill Switch",
              nextValue: !perms.master_kill_switch,
              dangerous: true,
            });
          }}
          className="gap-2"
        >
          <Power className="w-4 h-4" />
          {perms.master_kill_switch ? "Re-enable Agent" : "Kill Switch"}
        </Button>
      </header>

      {/* Toggles */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {TOGGLES.map((t) => {
          const on = !!perms[t.key];
          const disabled = perms.master_kill_switch || saving || loading;
          return (
            <label
              key={t.key}
              className={`flex items-start justify-between gap-3 rounded-xl border p-4 transition ${
                on ? "border-cyan-500/30 bg-cyan-500/5" : "border-border/50 bg-background/30"
              } ${disabled ? "opacity-60" : ""}`}
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2 text-sm font-semibold">
                  {on ? <Unlock className="w-3.5 h-3.5 text-cyan-300" /> : <Lock className="w-3.5 h-3.5 text-muted-foreground" />}
                  {t.label}
                  {t.dangerous && (
                    <span className="text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-400 border border-amber-500/30">
                      High risk · off by default
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-1">{t.desc}</p>
              </div>
              <Switch
                checked={on}
                disabled={disabled}
                onCheckedChange={requestToggle(t.key, !!t.dangerous, t.label)}
                aria-label={`${t.label}${t.dangerous ? " (high risk)" : ""}`}
              />
            </label>
          );
        })}
      </div>

      {/* Audit Log */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-cyan-300" />
            <h3 className="font-semibold text-sm">Real-Time Audit Log</h3>
            <span className="text-[10px] text-muted-foreground">last 50</span>
          </div>
          <div className="flex items-center gap-1.5">
            {(["all", "allowed", "denied", "error"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-2.5 py-1 rounded-md text-[11px] font-mono uppercase tracking-wider transition ${
                  filter === f ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40" : "text-muted-foreground border border-border/50 hover:border-border"
                }`}
                aria-pressed={filter === f}
              >
                {f}
              </button>
            ))}
            <Button variant="ghost" size="sm" onClick={loadAudit} className="ml-1" aria-label="Refresh audit log">
              <RefreshCw className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>

        <div className="rounded-xl border border-border/50 bg-background/40 max-h-80 overflow-y-auto divide-y divide-border/30" role="list" aria-label="Audit log entries">
          {filtered.length === 0 ? (
            <div className="p-6 text-center text-xs text-muted-foreground">
              No audit entries yet. Agent actions will stream in live.
            </div>
          ) : (
            filtered.map((r) => (
              <button
                type="button"
                key={r.id}
                role="listitem"
                onClick={() => setDetail(r)}
                className="w-full text-left px-4 py-2.5 flex items-center gap-3 text-xs hover:bg-background/60 transition focus:outline-none focus:ring-1 focus:ring-cyan-500/40"
                aria-label={`Audit entry ${r.action} at ${r.timestampLabel}, decision ${r.decision}`}
              >
                {decisionIcon(r.decision)}
                <span className="font-mono text-muted-foreground tabular-nums whitespace-nowrap" title={r.timestampIso}>
                  {r.timestampLabel}
                </span>
                <span className="font-semibold truncate min-w-0 flex-1">
                  {r.toolName}
                  <span className="text-muted-foreground"> · {r.resource}</span>
                </span>
                <span className="px-1.5 py-0.5 rounded bg-muted/40 text-[10px] font-mono">{r.category}</span>
                <span className="px-1.5 py-0.5 rounded bg-muted/40 text-[10px] font-mono">{r.permissionKey}</span>
                {r.durationMs != null && (
                  <span className="text-muted-foreground tabular-nums whitespace-nowrap">{r.durationMs}ms</span>
                )}
                <span className="text-muted-foreground truncate max-w-[200px] hidden md:inline">
                  {r.actorEmail}
                </span>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Detail dialog — accessible, keyboard-dismissible */}
      <Dialog open={!!detail} onOpenChange={(v) => !v && setDetail(null)}>
        <DialogContent className="max-w-lg">
          {detail && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  {decisionIcon(detail.decision)}
                  {detail.toolName}
                </DialogTitle>
                <DialogDescription>
                  {detail.timestampLabel}
                </DialogDescription>
              </DialogHeader>
              <dl className="text-xs grid grid-cols-3 gap-y-2 gap-x-4">
                <dt className="text-muted-foreground">Decision</dt>
                <dd className="col-span-2 font-mono">{detail.decision}</dd>
                <dt className="text-muted-foreground">Outcome</dt>
                <dd className="col-span-2 font-mono">{detail.outcome}</dd>
                <dt className="text-muted-foreground">Category</dt>
                <dd className="col-span-2 font-mono">{detail.category}</dd>
                <dt className="text-muted-foreground">Permission</dt>
                <dd className="col-span-2 font-mono">{detail.permissionKey}</dd>
                <dt className="text-muted-foreground">Actor</dt>
                <dd className="col-span-2 font-mono">{detail.actorEmail}</dd>
                <dt className="text-muted-foreground">User id</dt>
                <dd className="col-span-2 font-mono">{detail.actorUserId}</dd>
                <dt className="text-muted-foreground">OAuth client</dt>
                <dd className="col-span-2 font-mono">{detail.clientId}</dd>
                <dt className="text-muted-foreground">Resource</dt>
                <dd className="col-span-2 font-mono break-all">{detail.resource}</dd>
                <dt className="text-muted-foreground">Correlation id</dt>
                <dd className="col-span-2 font-mono break-all">{detail.correlationId}</dd>
                <dt className="text-muted-foreground">Duration</dt>
                <dd className="col-span-2 font-mono">{detail.durationMs != null ? `${detail.durationMs} ms` : UNKNOWN}</dd>
                <dt className="text-muted-foreground">Timestamp</dt>
                <dd className="col-span-2 font-mono break-all">{detail.timestampIso}</dd>
                {detail.errorMessage && (
                  <>
                    <dt className="text-muted-foreground">Error</dt>
                    <dd className="col-span-2 font-mono text-red-400 break-all">{detail.errorMessage}</dd>
                  </>
                )}
              </dl>
              <DialogFooter>
                <Button variant="outline" size="sm" onClick={() => setDetail(null)}>Close</Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* High-risk confirm dialog */}
      <Dialog open={!!confirmEnable} onOpenChange={(v) => !v && setConfirmEnable(null)}>
        <DialogContent className="max-w-md">
          {confirmEnable && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-amber-300">
                  <AlertTriangle className="w-4 h-4" /> Enable “{confirmEnable.label}”?
                </DialogTitle>
                <DialogDescription>
                  This is a high-risk capability and is off by default. Enabling it will let the AI agent perform this action. Confirm you have the authority to grant this.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter className="gap-2">
                <Button variant="outline" size="sm" onClick={() => setConfirmEnable(null)}>Cancel</Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => {
                    const k = confirmEnable.key;
                    setConfirmEnable(null);
                    save({ ...perms, [k]: true });
                  }}
                >
                  Yes, enable
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
