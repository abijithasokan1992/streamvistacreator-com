/**
 * PartnerMetadataMappingEditor
 *
 * Reusable inline editor for `distribution_metadata_mappings`. Renders a
 * compact table for a single partner and lets an admin add/update/remove
 * source→target field mappings that the distribution-dispatch worker will
 * apply to the manifest before the connector driver fires.
 *
 * Reuses existing distributionApi helpers — no new tables, no duplicate CRUD.
 */
import { useEffect, useState } from "react";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import {
  listPartnerMappings, upsertMapping, deleteMapping,
} from "@/lib/distribution/distributionApi";

type Mapping = {
  id?: string;
  partner_id: string;
  target_field: string;
  source_field: string | null;
  transform: string | null;
  is_required: boolean;
  default_value: string | null;
};

const TRANSFORMS = ["", "upper", "lower", "iso_date", "string", "number"];

export function PartnerMetadataMappingEditor({ partnerId }: { partnerId: string }) {
  const [rows, setRows] = useState<Mapping[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const reload = async () => {
    setLoading(true);
    const data = await listPartnerMappings(partnerId);
    setRows((data as Mapping[]) ?? []);
    setLoading(false);
  };
  useEffect(() => { void reload(); }, [partnerId]);

  const patch = (i: number, patch: Partial<Mapping>) =>
    setRows(prev => prev.map((r, idx) => idx === i ? { ...r, ...patch } : r));

  const addRow = () => setRows(prev => [
    ...prev,
    { partner_id: partnerId, target_field: "", source_field: "", transform: null, is_required: false, default_value: null },
  ]);

  const save = async (i: number) => {
    const r = rows[i];
    if (!r.target_field.trim()) {
      toast({ title: "Target field is required", variant: "destructive" });
      return;
    }
    setBusy(true);
    try {
      const saved = await upsertMapping({ ...r, target_field: r.target_field.trim() });
      if (saved) patch(i, saved as Partial<Mapping>);
      toast({ title: "Mapping saved" });
    } catch (e) {
      toast({ title: "Save failed", description: String((e as Error)?.message ?? e), variant: "destructive" });
    } finally { setBusy(false); }
  };

  const remove = async (i: number) => {
    const r = rows[i];
    setBusy(true);
    try {
      if (r.id) await deleteMapping(r.id);
      setRows(prev => prev.filter((_, idx) => idx !== i));
    } catch (e) {
      toast({ title: "Delete failed", description: String((e as Error)?.message ?? e), variant: "destructive" });
    } finally { setBusy(false); }
  };

  if (loading) return <div className="py-6 grid place-items-center"><Loader2 className="w-4 h-4 animate-spin text-accent" /></div>;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          Map manifest fields (dot-paths like <code className="font-mono">title.title</code>) into partner-specific fields. Applied automatically at dispatch.
        </p>
        <Button size="sm" variant="secondary" onClick={addRow} disabled={busy}>
          <Plus className="w-3.5 h-3.5 mr-1" /> Add field
        </Button>
      </div>

      {rows.length === 0 ? (
        <p className="text-xs text-muted-foreground py-3">No mappings yet. The raw manifest will be sent as-is.</p>
      ) : (
        <ul className="space-y-1.5 list-none">
          {rows.map((r, i) => (
            <li key={r.id ?? i} className="grid grid-cols-1 sm:grid-cols-12 gap-1.5 items-center rounded-md border border-border/40 bg-background/30 p-2">
              <input
                aria-label="Target field"
                placeholder="partner_field"
                value={r.target_field}
                onChange={e => patch(i, { target_field: e.target.value })}
                className="sm:col-span-3 rounded border border-border/50 bg-background/50 px-2 py-1 text-xs"
              />
              <input
                aria-label="Source field"
                placeholder="title.title"
                value={r.source_field ?? ""}
                onChange={e => patch(i, { source_field: e.target.value })}
                className="sm:col-span-3 rounded border border-border/50 bg-background/50 px-2 py-1 text-xs font-mono"
              />
              <select
                aria-label="Transform"
                value={r.transform ?? ""}
                onChange={e => patch(i, { transform: e.target.value || null })}
                className="sm:col-span-2 rounded border border-border/50 bg-background/50 px-2 py-1 text-xs"
              >
                {TRANSFORMS.map(t => <option key={t} value={t}>{t || "—"}</option>)}
              </select>
              <input
                aria-label="Default value"
                placeholder="default"
                value={r.default_value ?? ""}
                onChange={e => patch(i, { default_value: e.target.value || null })}
                className="sm:col-span-2 rounded border border-border/50 bg-background/50 px-2 py-1 text-xs"
              />
              <label className="sm:col-span-1 text-[11px] flex items-center gap-1 justify-center">
                <input type="checkbox" checked={r.is_required} onChange={e => patch(i, { is_required: e.target.checked })} />
                req
              </label>
              <div className="sm:col-span-1 flex justify-end gap-1">
                <Button size="sm" variant="secondary" className="h-7 px-2 text-[11px]" onClick={() => save(i)} disabled={busy}>Save</Button>
                <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => remove(i)} disabled={busy} aria-label="Delete mapping">
                  <Trash2 className="w-3.5 h-3.5 text-red-300" />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
