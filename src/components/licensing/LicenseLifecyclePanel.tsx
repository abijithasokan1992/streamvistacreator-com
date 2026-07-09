import { useEffect, useState } from "react";
import { Loader2, Activity, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/useAuth";
import { addLicenseEvent, listLicenseEvents, type LicenseEvent } from "@/lib/licensing/licensingApi";

const EVENT_TYPES: LicenseEvent["event_type"][] = [
  "executed", "activated", "delivery_started", "delivery_completed",
  "expiring_soon", "expired", "renewed", "terminated", "breach_notice", "note",
];

/**
 * License Workflow — lifecycle event log for a signed deal_memo.
 * Reuses deal_memos + deal_deliveries; adds only a chronological event stream.
 */
export function LicenseLifecyclePanel({
  dealMemoId, canManage, className,
}: { dealMemoId: string; canManage: boolean; className?: string }) {
  const { user } = useAuth();
  const [events, setEvents] = useState<LicenseEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [type, setType] = useState<LicenseEvent["event_type"]>("note");
  const [notes, setNotes] = useState("");

  const load = async () => {
    try { setLoading(true); setEvents(await listLicenseEvents(dealMemoId)); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Failed to load license events"); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [dealMemoId]);

  const add = async () => {
    setSaving(true);
    try {
      await addLicenseEvent({ deal_memo_id: dealMemoId, event_type: type, actor_user_id: user?.id, notes: notes.trim() || null });
      setNotes(""); setType("note");
      toast.success("Event logged");
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not log event");
    } finally { setSaving(false); }
  };

  return (
    <div className={className}>
      <div className="flex items-center justify-between mb-2">
        <h4 className="text-sm font-semibold inline-flex items-center gap-1.5">
          <Activity className="w-4 h-4 text-accent" aria-hidden /> License lifecycle
        </h4>
        <Badge variant="outline" className="text-[10px]">{events.length} event{events.length !== 1 ? "s" : ""}</Badge>
      </div>

      {loading ? (
        <div className="py-6 grid place-items-center"><Loader2 className="w-4 h-4 animate-spin text-accent" aria-hidden /></div>
      ) : events.length === 0 ? (
        <p className="text-xs text-muted-foreground rounded-lg border border-dashed border-border/50 bg-secondary/10 p-3">
          No lifecycle events yet.
        </p>
      ) : (
        <ol className="space-y-1.5 list-none">
          {events.map(e => (
            <li key={e.id} className="rounded-md border border-border/40 bg-secondary/10 p-2.5 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-semibold capitalize">{e.event_type.replace(/_/g, " ")}</span>
                <span className="text-muted-foreground">{new Date(e.event_at).toLocaleString()}</span>
              </div>
              {e.notes && <p className="mt-1 whitespace-pre-wrap text-muted-foreground">{e.notes}</p>}
            </li>
          ))}
        </ol>
      )}

      {canManage && (
        <div className="mt-3 grid gap-2 rounded-lg border border-border/40 bg-secondary/5 p-3">
          <div className="grid grid-cols-[180px_1fr] gap-2">
            <Select value={type} onValueChange={(v) => setType(v as LicenseEvent["event_type"])}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {EVENT_TYPES.map(t => (
                  <SelectItem key={t} value={t} className="capitalize">{t.replace(/_/g, " ")}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input value={notes} onChange={(ev) => setNotes(ev.target.value)} placeholder="Notes (optional)" />
          </div>
          <div className="flex justify-end">
            <Button size="sm" onClick={add} disabled={saving}>
              {saving ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" aria-hidden /> : <Plus className="w-3.5 h-3.5 mr-1.5" aria-hidden />}
              Log event
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
