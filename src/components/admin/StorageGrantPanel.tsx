import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2, HardDrive } from "lucide-react";

/**
 * Compact admin tool to grant / reduce / set a creator's bonus storage (GB).
 * Backed by RPC `admin_adjust_storage`. Shows current entitlement breakdown.
 * Drop into any admin user/workspace detail screen with the target userId.
 */
export default function StorageGrantPanel({ userId }: { userId: string }) {
  const [ent, setEnt] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [type, setType] = useState<"grant" | "reduce" | "set">("grant");
  const [gb, setGb] = useState<string>("0");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  const refresh = async () => {
    setLoading(true);
    const { data } = await (supabase as any).rpc("get_workspace_storage_entitlement", { _user_id: userId });
    setEnt(data || null);
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
          <div className="grid grid-cols-2 gap-2 text-xs">
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
