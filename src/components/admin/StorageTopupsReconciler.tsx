import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

type Action = "mark_failed" | "cancel" | "mark_paid";

interface TopupRow {
  id: string;
  user_id: string;
  amount_inr: number;
  status: string;
  razorpay_order_id: string | null;
  created_at: string;
  notes: string | null;
}

interface RowResult {
  topup_id: string;
  status: "ok" | "skipped" | "error";
  message: string;
  action?: Action;
}

const ACTION_LABEL: Record<Action, string> = {
  mark_failed: "Mark failed",
  cancel: "Cancel",
  mark_paid: "Mark paid (verify RZP)",
};

/**
 * Admin reconciler for stuck storage top-ups (PR-C).
 *
 * Lists `storage_topups` rows still in `created`/`pending` status older than
 * 24 h and lets an admin resolve them one-by-one or in bulk. Every action is
 * routed through the `reconcile-storage-topups` edge function, which enforces
 * the role gate, runs the same entitlement projection as the live checkout on
 * `mark_paid`, and writes an `admin_audit_log` row per action.
 */
export function StorageTopupsReconciler({ className }: { className?: string }) {
  const [rows, setRows] = useState<TopupRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [rowAction, setRowAction] = useState<Record<string, Action>>({});
  const [rowReason, setRowReason] = useState<Record<string, string>>({});
  const [bulkReason, setBulkReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [lastResults, setLastResults] = useState<RowResult[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data, error } = await supabase
      .from("storage_topups")
      .select("id,user_id,amount_inr,status,razorpay_order_id,created_at,notes")
      .in("status", ["created", "pending"])
      .lt("created_at", cutoff)
      .order("created_at", { ascending: true });
    if (error) {
      toast.error("Failed to load top-ups", { description: error.message });
      setRows([]);
    } else {
      setRows((data ?? []) as TopupRow[]);
    }
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  const selectedIds = useMemo(
    () => rows.filter((r) => selected[r.id]).map((r) => r.id),
    [rows, selected],
  );

  const invoke = useCallback(async (
    actions: Array<{ topup_id: string; action: Action; reason: string }>,
  ) => {
    if (actions.length === 0) return;
    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke("reconcile-storage-topups", {
        body: { actions },
      });
      if (error) {
        toast.error("Reconciler failed", { description: error.message });
        return;
      }
      const results: RowResult[] = data?.results ?? [];
      setLastResults(results);
      const ok = results.filter((r) => r.status === "ok").length;
      const skipped = results.filter((r) => r.status === "skipped").length;
      const failed = results.filter((r) => r.status === "error").length;
      toast.success(`Reconciler: ${ok} ok · ${skipped} skipped · ${failed} error`);
      await load();
      setSelected({});
    } finally {
      setBusy(false);
    }
  }, [load]);

  const submitRow = (row: TopupRow) => {
    const action = rowAction[row.id] ?? "mark_failed";
    const reason = (rowReason[row.id] ?? "").trim();
    if (reason.length < 5) {
      toast.error("Reason must be at least 5 characters");
      return;
    }
    void invoke([{ topup_id: row.id, action, reason }]);
  };

  const submitBulk = () => {
    const reason = bulkReason.trim();
    if (reason.length < 5) {
      toast.error("Bulk reason must be at least 5 characters");
      return;
    }
    if (selectedIds.length === 0) {
      toast.error("Select at least one row");
      return;
    }
    void invoke(selectedIds.map((id) => ({ topup_id: id, action: "mark_failed" as Action, reason })));
  };

  const toggleAll = (checked: boolean) => {
    const next: Record<string, boolean> = {};
    if (checked) rows.forEach((r) => { next[r.id] = true; });
    setSelected(next);
  };

  return (
    <div className={cn("rounded-xl border border-border/50 bg-card p-4 space-y-4", className)}>
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
            Storage top-ups — reconciler
          </div>
          <div className="text-sm font-medium mt-0.5">
            Pending &gt; 24h ({loading ? "…" : rows.length})
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading || busy}>
          <RefreshCw className={cn("w-3.5 h-3.5 mr-1.5", loading && "animate-spin")} />
          Refresh
        </Button>
      </div>

      {rows.length > 0 && (
        <div className="flex items-end gap-2 p-3 rounded-lg border border-dashed border-border/60 bg-secondary/20">
          <div className="flex-1">
            <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Bulk mark selected as failed ({selectedIds.length})
            </label>
            <Input
              value={bulkReason}
              onChange={(e) => setBulkReason(e.target.value)}
              placeholder="Reason (min 5 chars) — required, written to audit log"
              className="mt-1"
              disabled={busy}
            />
          </div>
          <Button
            onClick={submitBulk}
            disabled={busy || selectedIds.length === 0 || bulkReason.trim().length < 5}
          >
            {busy && <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />}
            Mark {selectedIds.length || ""} failed
          </Button>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="text-left text-muted-foreground">
            <tr className="border-b border-border/50">
              <th className="py-2 pr-2 w-6">
                <input
                  type="checkbox"
                  aria-label="Select all"
                  checked={rows.length > 0 && selectedIds.length === rows.length}
                  onChange={(e) => toggleAll(e.target.checked)}
                />
              </th>
              <th className="py-2 pr-2">Top-up</th>
              <th className="py-2 pr-2">User</th>
              <th className="py-2 pr-2 text-right">₹</th>
              <th className="py-2 pr-2">Created</th>
              <th className="py-2 pr-2">RZP order</th>
              <th className="py-2 pr-2">Status</th>
              <th className="py-2 pr-2">Action</th>
              <th className="py-2 pr-2">Reason</th>
              <th className="py-2 pr-2"></th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={10} className="py-6 text-center text-muted-foreground">Loading…</td></tr>
            )}
            {!loading && rows.length === 0 && (
              <tr><td colSpan={10} className="py-6 text-center text-muted-foreground">No stuck top-ups. All clear.</td></tr>
            )}
            {rows.map((r) => (
              <tr key={r.id} className="border-b border-border/30 align-top">
                <td className="py-2 pr-2">
                  <input
                    type="checkbox"
                    checked={!!selected[r.id]}
                    onChange={(e) => setSelected((s) => ({ ...s, [r.id]: e.target.checked }))}
                    aria-label={`Select ${r.id}`}
                  />
                </td>
                <td className="py-2 pr-2 font-mono">{r.id.slice(0, 8)}…</td>
                <td className="py-2 pr-2 font-mono">{r.user_id.slice(0, 8)}…</td>
                <td className="py-2 pr-2 text-right">{Number(r.amount_inr).toLocaleString("en-IN")}</td>
                <td className="py-2 pr-2">{new Date(r.created_at).toISOString().slice(0, 16).replace("T", " ")}</td>
                <td className="py-2 pr-2 font-mono">{r.razorpay_order_id ?? "—"}</td>
                <td className="py-2 pr-2">{r.status}</td>
                <td className="py-2 pr-2">
                  <Select
                    value={rowAction[r.id] ?? "mark_failed"}
                    onValueChange={(v) => setRowAction((s) => ({ ...s, [r.id]: v as Action }))}
                  >
                    <SelectTrigger className="h-8 w-[180px]"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {(Object.keys(ACTION_LABEL) as Action[]).map((a) => (
                        <SelectItem key={a} value={a}>{ACTION_LABEL[a]}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </td>
                <td className="py-2 pr-2 min-w-[220px]">
                  <Textarea
                    value={rowReason[r.id] ?? ""}
                    onChange={(e) => setRowReason((s) => ({ ...s, [r.id]: e.target.value }))}
                    placeholder="Required (min 5 chars)"
                    rows={2}
                    className="text-xs"
                  />
                </td>
                <td className="py-2 pr-2">
                  <Button size="sm" onClick={() => submitRow(r)} disabled={busy}>
                    Apply
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {lastResults.length > 0 && (
        <div className="rounded-lg border border-border/50 bg-secondary/10 p-3">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">
            Last reconciler run
          </div>
          <ul className="space-y-1 text-xs">
            {lastResults.map((r) => (
              <li key={r.topup_id} className="flex gap-2">
                <span className={cn(
                  "font-medium",
                  r.status === "ok" && "text-emerald-600",
                  r.status === "skipped" && "text-amber-600",
                  r.status === "error" && "text-red-600",
                )}>[{r.status}]</span>
                <span className="font-mono">{r.topup_id.slice(0, 8)}…</span>
                <span className="text-muted-foreground">{r.message}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
