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
  const [audit, setAudit] = useState<AuditRow[]>([]);
  const [filter, setFilter] = useState<"all" | "allowed" | "denied">("all");

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
    if (!error && data) setAudit(data as AuditRow[]);
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
        (payload: { new: AuditRow }) =>
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

  const save = async (next: McpPermissions) => {
    setSaving(true);
    setPerms(next);
    const { error } = await supabase
      .from("admin_settings")
      .upsert({ key: "mcp_permissions", value: { ...next, updated_at: new Date().toISOString() } }, { onConflict: "key" });
    setSaving(false);
    if (error) {
      toast.error("Failed to save MCP permissions");
      loadPerms();
      return;
    }
    invalidateMcpPermissionsCache();
    toast.success("MCP permissions updated");
  };

  const toggle = (key: keyof McpPermissions) => (v: boolean) => save({ ...perms, [key]: v });

  const filtered = audit.filter((r) =>
    filter === "all" ? true : filter === "allowed" ? r.allowed : !r.allowed
  );

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
          onClick={() => save({ ...perms, master_kill_switch: !perms.master_kill_switch })}
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
                      High risk
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-1">{t.desc}</p>
              </div>
              <Switch
                checked={on}
                disabled={disabled}
                onCheckedChange={toggle(t.key)}
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
            {(["all", "allowed", "denied"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-2.5 py-1 rounded-md text-[11px] font-mono uppercase tracking-wider transition ${
                  filter === f ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40" : "text-muted-foreground border border-border/50 hover:border-border"
                }`}
              >
                {f}
              </button>
            ))}
            <Button variant="ghost" size="sm" onClick={loadAudit} className="ml-1">
              <RefreshCw className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>

        <div className="rounded-xl border border-border/50 bg-background/40 max-h-80 overflow-y-auto divide-y divide-border/30">
          {filtered.length === 0 ? (
            <div className="p-6 text-center text-xs text-muted-foreground">
              No audit entries yet. Agent actions will stream in live.
            </div>
          ) : (
            filtered.map((r) => (
              <div key={r.id} className="px-4 py-2.5 flex items-center gap-3 text-xs hover:bg-background/60 transition">
                {r.allowed ? (
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                ) : (
                  <ShieldAlert className="w-3.5 h-3.5 text-red-400 shrink-0" />
                )}
                <span className="font-mono text-muted-foreground tabular-nums whitespace-nowrap">
                  {new Date(r.created_at).toLocaleTimeString()}
                </span>
                <span className="font-semibold truncate min-w-0 flex-1">
                  {r.action}
                  {r.resource && <span className="text-muted-foreground"> · {r.resource}</span>}
                </span>
                {r.permission_key && (
                  <span className="px-1.5 py-0.5 rounded bg-muted/40 text-[10px] font-mono">{r.permission_key}</span>
                )}
                <span className="text-muted-foreground truncate max-w-[200px] hidden md:inline">
                  {r.actor_email ?? "—"}
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
