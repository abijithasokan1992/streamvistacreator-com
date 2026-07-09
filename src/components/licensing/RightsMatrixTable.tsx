import { useEffect, useState } from "react";
import { Loader2, Globe } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { getRightsMatrix, type RightsMatrixRow } from "@/lib/licensing/licensingApi";

/**
 * Rights Matrix — read-only pivot over the existing title_rights_availability
 * table. No new rights data is stored here; this is a viewer.
 */
export function RightsMatrixTable({ titleId, className }: { titleId: string; className?: string }) {
  const [rows, setRows] = useState<RightsMatrixRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const data = await getRightsMatrix(titleId);
        if (!cancelled) setRows(data);
      } catch (e) {
        if (!cancelled) toast.error(e instanceof Error ? e.message : "Failed to load rights matrix");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [titleId]);

  return (
    <div className={className}>
      <div className="flex items-center justify-between mb-2">
        <h4 className="text-sm font-semibold inline-flex items-center gap-1.5">
          <Globe className="w-4 h-4 text-accent" aria-hidden /> Rights matrix
        </h4>
        <Badge variant="outline" className="text-[10px]">{rows.length} entr{rows.length === 1 ? "y" : "ies"}</Badge>
      </div>

      {loading ? (
        <div className="py-6 grid place-items-center"><Loader2 className="w-4 h-4 animate-spin text-accent" aria-hidden /></div>
      ) : rows.length === 0 ? (
        <p className="text-xs text-muted-foreground rounded-lg border border-dashed border-border/50 bg-secondary/10 p-3">
          No rights entries recorded for this title yet.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border/40">
          <table className="w-full text-xs">
            <thead className="bg-secondary/20 text-muted-foreground">
              <tr>
                <th scope="col" className="text-left p-2 font-semibold">Category</th>
                <th scope="col" className="text-left p-2 font-semibold">Territory</th>
                <th scope="col" className="text-left p-2 font-semibold">Language</th>
                <th scope="col" className="text-left p-2 font-semibold">Exclusivity</th>
                <th scope="col" className="text-left p-2 font-semibold">Status</th>
                <th scope="col" className="text-left p-2 font-semibold">Term</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.id} className="border-t border-border/40">
                  <td className="p-2 capitalize">{String(r.right_category ?? "—")}</td>
                  <td className="p-2">{r.territory ?? "—"}</td>
                  <td className="p-2">{r.language ?? "—"}</td>
                  <td className="p-2 capitalize">{String(r.exclusivity ?? "—")}</td>
                  <td className="p-2">
                    <Badge variant="outline" className="text-[10px] capitalize">{String(r.status ?? "—")}</Badge>
                  </td>
                  <td className="p-2 text-muted-foreground">
                    {r.term_start ? new Date(r.term_start).toLocaleDateString() : "—"}
                    {" → "}
                    {r.term_end ? new Date(r.term_end).toLocaleDateString() : "open"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
