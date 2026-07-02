import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2, HardDrive, History } from "lucide-react";

/**
 * Admin tool to grant / reduce / set a creator's bonus storage (GB).
 * Backed by RPC `admin_adjust_storage`. Shows current entitlement breakdown
 * (plan / included / paid / bonus / total / used) and full adjustment history.
 */
export default function StorageGrantPanel({ userId }: { userId: string }) {
  const [ent, setEnt] = useState<any>(null);
  const [adjustments, setAdjustments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [type, setType] = useState<"grant" | "reduce" | "set">("grant");
  const [gb, setGb] = useState<string>("0");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  const refresh = async () => {
    setLoading(true);
    const [e, a] = await Promise.all([
      (supabase as any).rpc("get_workspace_storage_entitlement", { _user_id: userId }),
      (supabase as any)
        .from("workspace_storage_admin_adjustments")
        .select("id, adjustment_type, delta_gb, resulting_bonus_gb, reason, created_by_admin, created_at, expires_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(20),
    ]);
    setEnt(e.data || null);
    setAdjustments(a.data || []);
    setLoading(false);
  };
  useEffect(() => { if (userId) refresh(); }, [userId]);

  const submit = async () => {
    const delta = Number(gb);
    if (!isFinite(delta) || delta < 0) { toast.error("Enter a non-negative GB value"); return; }
    setBusy(true);
    const { data, error } = await (supabase as any).rpc("admin_adjust_storage", {
      _user_id: userId, _type: type, _delta_gb: delta, _reason: reason || null,
    });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success(`Bonus storage now ${data?.new_bonus_gb ?? "?"} GB`);
    setGb("0"); setReason("");
    refresh();
  };

  return (
    <div className="rounded-xl border border-border/60 p-4 space-y-4 bg-card/40">
      <div className="flex items-center gap-2 text-sm font-semibold">
        <HardDrive className="w-4 h-4 text-accent" /> Storage Entitlement
      </div>
      {loading || !ent ? (
        <div className="grid place-items-center h-20"><Loader2 className="w-4 h-4 animate-spin" /></div>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
            <Cell label="Plan" value={String(ent.plan_code)} />
            <Cell label="Included" value={`${Number(ent.included_storage_gb).toFixed(0)} GB`} />
            <Cell label="Paid" value={`${Number(ent.paid_storage_gb).toFixed(0)} GB (${ent.storage_addon_blocks} blocks)`} />
            <Cell label="Admin Bonus" value={`${Number(ent.admin_bonus_storage_gb).toFixed(0)} GB`} />
            <Cell label="Total" value={`${Number(ent.total_storage_gb).toFixed(0)} GB`} highlight />
            <Cell label="Used" value={`${Number(ent.used_gb).toFixed(2)} GB (${ent.usage_pct}%)`} />
          </div>
          <div className="grid grid-cols-12 gap-2 items-end">
            <div className="col-span-3">
              <label className="text-[10px] uppercase tracking-wider text-muted-foreground">Action</label>
              <Select value={type} onValueChange={(v: any) => setType(v)}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="grant">Grant +GB</SelectItem>
                  <SelectItem value="reduce">Reduce −GB</SelectItem>
                  <SelectItem value="set">Set exact GB</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-3">
              <label className="text-[10px] uppercase tracking-wider text-muted-foreground">GB</label>
              <Input type="number" min={0} value={gb} onChange={e => setGb(e.target.value)} className="h-9" />
            </div>
            <div className="col-span-4">
              <label className="text-[10px] uppercase tracking-wider text-muted-foreground">Reason</label>
              <Input value={reason} onChange={e => setReason(e.target.value)} className="h-9" placeholder="e.g. partner deal" />
            </div>
            <div className="col-span-2">
              <Button onClick={submit} disabled={busy} className="w-full h-9">
                {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Apply"}
              </Button>
            </div>
          </div>

          {/* Adjustment history */}
          <div>
            <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-muted-foreground mb-1.5">
              <History className="w-3 h-3" /> Adjustment history
            </div>
            {adjustments.length === 0 ? (
              <p className="text-xs text-muted-foreground px-2 py-2">No admin adjustments yet.</p>
            ) : (
              <div className="rounded-md border border-border/40 overflow-hidden">
                <table className="w-full text-xs">
                  <thead className="bg-secondary/20 text-[10px] uppercase tracking-wider text-muted-foreground">
                    <tr>
                      <th className="text-left px-2 py-1.5">When</th>
                      <th className="text-left px-2 py-1.5">Type</th>
                      <th className="text-right px-2 py-1.5">Δ GB</th>
                      <th className="text-right px-2 py-1.5">New bonus</th>
                      <th className="text-left px-2 py-1.5">Reason</th>
                    </tr>
                  </thead>
                  <tbody>
                    {adjustments.map((a) => (
                      <tr key={a.id} className="border-t border-border/30">
                        <td className="px-2 py-1.5 text-muted-foreground">{new Date(a.created_at).toLocaleString()}</td>
                        <td className="px-2 py-1.5 capitalize">{a.adjustment_type}</td>
                        <td className="px-2 py-1.5 text-right font-mono">{Number(a.delta_gb).toFixed(0)}</td>
                        <td className="px-2 py-1.5 text-right font-mono">{Number(a.resulting_bonus_gb).toFixed(0)}</td>
                        <td className="px-2 py-1.5 text-muted-foreground truncate max-w-[180px]">{a.reason || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function Cell({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className={`rounded-md border border-border/40 px-2 py-1.5 ${highlight ? "bg-accent/10" : "bg-background/40"}`}>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="text-xs font-mono">{value}</div>
    </div>
  );
}
