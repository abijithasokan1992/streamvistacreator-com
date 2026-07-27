/**
 * Creator Revenue Summary — Phase D2A.
 *
 * Plain-language, compact view of revenue for the signed-in creator's titles.
 * Never fabricates revenue: if there are no revenue_lines rows, we show an
 * empty state. Runtime and other metadata never appear as revenue.
 */
import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { formatMinorAsINR } from "@/lib/revenue/money";
import { humanModelLabel, isCommercialModel } from "@/lib/revenue/commercialModels";

interface RevenueRow {
  id: string;
  title_id: string | null;
  partner_id: string | null;
  gross_amount_paise: number;
  net_amount_paise: number;
  platform_fee_paise: number;
  occurred_on: string | null;
  currency: string;
  metadata: Record<string, unknown> | null;
}

interface Props {
  titleIds?: string[];
  limit?: number;
}

export function CreatorRevenueSummary({ titleIds, limit = 50 }: Props) {
  const [rows, setRows] = useState<RevenueRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      // Workspace isolation: if the caller provides `titleIds` (even empty),
      // we scope strictly to that set. An empty array means "no owned titles
      // in this workspace" and MUST resolve to zero rows — never fall back to
      // an unscoped select that would leak across workspaces.
      if (titleIds && titleIds.length === 0) {
        setRows([]);
        setLoading(false);
        return;
      }
      let q = supabase
        .from("revenue_lines")
        .select("id,title_id,partner_id,gross_amount_paise,net_amount_paise,platform_fee_paise,occurred_on,currency,metadata")
        .order("occurred_on", { ascending: false })
        .limit(limit);
      if (titleIds && titleIds.length) q = q.in("title_id", titleIds);
      const { data, error } = await q;
      if (cancelled) return;
      if (error) {
        if (error.code === "42P01") setPending(true);
        setRows([]);
      } else {
        setRows((data ?? []) as RevenueRow[]);
      }
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [titleIds, limit]);

  const totalGross = rows.reduce((s, r) => s + (r.gross_amount_paise ?? 0), 0);
  const totalNet = rows.reduce((s, r) => s + (r.net_amount_paise ?? 0), 0);
  const totalCreator = rows.reduce(
    (s, r) => s + Number((r.metadata as any)?.creator_share_paise ?? 0),
    0,
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>Your revenue</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {pending && (
          <div className="text-sm text-muted-foreground">Database update pending — check back shortly.</div>
        )}
        {loading && <div className="text-sm text-muted-foreground">Loading…</div>}
        {!loading && !pending && rows.length === 0 && (
          <div className="text-sm text-muted-foreground">
            No revenue statements yet. As soon as a buyer statement is imported, you'll see it here.
          </div>
        )}
        {!loading && rows.length > 0 && (
          <>
            <div className="grid grid-cols-3 gap-3 text-sm">
              <Stat label="Gross" value={formatMinorAsINR(totalGross)} />
              <Stat label="After fees & tax" value={formatMinorAsINR(totalNet)} />
              <Stat label="Your share" value={formatMinorAsINR(totalCreator)} />
            </div>
            <div className="divide-y">
              {rows.map((r) => {
                const meta = (r.metadata ?? {}) as Record<string, unknown>;
                const model = meta.model;
                return (
                  <div key={r.id} className="py-2 flex items-center justify-between text-sm">
                    <div className="min-w-0">
                      <div className="truncate font-medium">
                        {String(meta.title_external_ref ?? r.title_id ?? "Untitled")}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {r.occurred_on ?? "—"} · {isCommercialModel(model) ? humanModelLabel(model) : "—"}
                      </div>
                    </div>
                    <div className="text-right">
                      <div>{formatMinorAsINR(r.net_amount_paise)}</div>
                      <Badge variant="outline" className="text-xs mt-1">
                        share {formatMinorAsINR(Number(meta.creator_share_paise ?? 0))}
                      </Badge>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-sm font-medium mt-1">{value}</div>
    </div>
  );
}

export default CreatorRevenueSummary;
