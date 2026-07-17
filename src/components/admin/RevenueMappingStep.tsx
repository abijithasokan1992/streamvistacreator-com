/**
 * Compact admin mapping surface — Phase D2B.
 *
 * Reuses shadcn primitives. Batch defaults at the top, per-row override
 * inline. "Confirm" is gated by canConfirmImport().
 */
import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";
import {
  proposeMappings,
  canConfirmImport,
} from "@/lib/revenue/mapping";
import type {
  RowMapping,
  TitleCandidate,
  DealCandidate,
  MappingBatchDefaults,
} from "@/lib/revenue/mapping";
import type { NormalizedRevenueRow } from "@/lib/revenue/normalize";

interface Props {
  rows: NormalizedRevenueRow[];
  titles: TitleCandidate[];
  deals: DealCandidate[];
  onConfirm(mappings: RowMapping[]): void;
  onBack?(): void;
}

export function RevenueMappingStep({ rows, titles, deals, onConfirm, onBack }: Props) {
  const [defaults, setDefaults] = useState<MappingBatchDefaults>({
    buyerUserId: null,
    dealMemoId: null,
    workspaceId: null,
  });
  const [overrides, setOverrides] = useState<Record<string, Partial<RowMapping>>>({});

  const result = useMemo(
    () => proposeMappings(rows, titles, deals, defaults, overrides),
    [rows, titles, deals, defaults, overrides],
  );

  const confirmDisabled = !canConfirmImport(result);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Map statement rows</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-3 gap-3">
          <div>
            <Label>Buyer (default)</Label>
            <Input
              placeholder="buyer user id"
              value={defaults.buyerUserId ?? ""}
              onChange={(e) =>
                setDefaults((d) => ({ ...d, buyerUserId: e.target.value || null }))
              }
            />
          </div>
          <div>
            <Label>Contract / Deal Memo (default)</Label>
            <Input
              placeholder="deal memo id"
              value={defaults.dealMemoId ?? ""}
              onChange={(e) =>
                setDefaults((d) => ({ ...d, dealMemoId: e.target.value || null }))
              }
            />
          </div>
          <div>
            <Label>Workspace (default)</Label>
            <Input
              placeholder="workspace id"
              value={defaults.workspaceId ?? ""}
              onChange={(e) =>
                setDefaults((d) => ({ ...d, workspaceId: e.target.value || null }))
              }
            />
          </div>
        </div>

        <div className="text-sm text-muted-foreground">
          {result.mappedCount} mapped · {result.holdCount} on hold ·
          Confirm requires no conflicts.
        </div>

        <div className="divide-y border rounded-md">
          {result.rows.map((rm) => {
            const row = rows.find((r) => r.rowKey === rm.rowKey)!;
            return (
              <div key={rm.rowKey} className="p-3 flex items-center gap-3 text-sm">
                <div className="min-w-0 flex-1">
                  <div className="font-medium truncate">
                    {row.titleExternalRef || "(no title on row)"}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {row.occurredOn ?? "—"} · {row.units ?? "—"} unit(s)
                  </div>
                  {rm.reasons.length > 0 && (
                    <div className="text-xs text-amber-700 mt-1">
                      {rm.reasons.join(", ")}
                    </div>
                  )}
                </div>
                <Input
                  className="w-52"
                  placeholder="title id"
                  value={rm.titleId ?? ""}
                  onChange={(e) =>
                    setOverrides((o) => ({
                      ...o,
                      [rm.rowKey]: {
                        ...o[rm.rowKey],
                        titleId: e.target.value || null,
                        status: e.target.value ? "mapped" : "hold_for_review",
                      },
                    }))
                  }
                />
                <Button
                  size="sm"
                  variant={rm.status === "hold_for_review" ? "default" : "outline"}
                  onClick={() =>
                    setOverrides((o) => ({
                      ...o,
                      [rm.rowKey]: { status: "hold_for_review" },
                    }))
                  }
                >
                  Hold
                </Button>
                <StatusBadge status={rm.status} />
              </div>
            );
          })}
        </div>

        {confirmDisabled && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Cannot confirm yet</AlertTitle>
            <AlertDescription>
              Resolve conflicts or move ambiguous rows to Hold before confirming.
            </AlertDescription>
          </Alert>
        )}

        <div className="flex justify-between">
          {onBack && (
            <Button variant="outline" onClick={onBack}>
              Back
            </Button>
          )}
          <Button
            disabled={confirmDisabled}
            onClick={() => onConfirm(result.rows)}
          >
            Confirm mapping
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function StatusBadge({ status }: { status: RowMapping["status"] }) {
  if (status === "mapped") return <Badge variant="outline">mapped</Badge>;
  if (status === "hold_for_review") return <Badge>hold</Badge>;
  return <Badge variant="destructive">conflict</Badge>;
}

export default RevenueMappingStep;
