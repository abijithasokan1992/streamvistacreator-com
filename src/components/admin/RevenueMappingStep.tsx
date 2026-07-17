/**
 * Compact admin mapping surface — Phase D2B, upgraded for Revenue MVP.
 *
 * Reuses shadcn primitives. Batch defaults at the top, per-row override
 * inline. Raw ID text inputs are replaced with searchable Select dropdowns
 * backed by workspace-scoped candidate lists supplied by the caller.
 * "Confirm" is gated by canConfirmImport().
 */
import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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

export interface BuyerCandidate {
  id: string;
  displayName: string;
}
export interface WorkspaceCandidate {
  id: string;
  name: string;
}

interface Props {
  rows: NormalizedRevenueRow[];
  titles: TitleCandidate[];
  deals: DealCandidate[];
  buyers?: BuyerCandidate[];
  workspaces?: WorkspaceCandidate[];
  onConfirm(mappings: RowMapping[]): void;
  onBack?(): void;
}

const NONE = "__none__";

export function RevenueMappingStep({
  rows,
  titles,
  deals,
  buyers = [],
  workspaces = [],
  onConfirm,
  onBack,
}: Props) {
  const [defaults, setDefaults] = useState<MappingBatchDefaults>({
    buyerUserId: null,
    dealMemoId: null,
    workspaceId: workspaces[0]?.id ?? null,
  });
  const [overrides, setOverrides] = useState<Record<string, Partial<RowMapping>>>({});

  const result = useMemo(
    () => proposeMappings(rows, titles, deals, defaults, overrides),
    [rows, titles, deals, defaults, overrides],
  );

  const confirmDisabled = !canConfirmImport(result);

  const dealsForTitle = (titleId: string | null) =>
    deals.filter((d) => !d.titleId || !titleId || d.titleId === titleId);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Map statement rows</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <Label>Workspace (default)</Label>
            <Select
              value={defaults.workspaceId ?? NONE}
              onValueChange={(v) =>
                setDefaults((d) => ({ ...d, workspaceId: v === NONE ? null : v }))
              }
            >
              <SelectTrigger><SelectValue placeholder="Select workspace" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>—</SelectItem>
                {workspaces.map((w) => (
                  <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Buyer (default)</Label>
            <Select
              value={defaults.buyerUserId ?? NONE}
              onValueChange={(v) =>
                setDefaults((d) => ({ ...d, buyerUserId: v === NONE ? null : v }))
              }
            >
              <SelectTrigger><SelectValue placeholder="Select buyer" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>—</SelectItem>
                {buyers.map((b) => (
                  <SelectItem key={b.id} value={b.id}>{b.displayName}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Contract / Deal (default)</Label>
            <Select
              value={defaults.dealMemoId ?? NONE}
              onValueChange={(v) =>
                setDefaults((d) => ({ ...d, dealMemoId: v === NONE ? null : v }))
              }
            >
              <SelectTrigger><SelectValue placeholder="Select deal" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>—</SelectItem>
                {deals.map((d) => (
                  <SelectItem key={d.id} value={d.id}>{d.id.slice(0, 8)}…</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="text-sm text-muted-foreground">
          {result.mappedCount} mapped · {result.holdCount} on hold · Confirm requires no conflicts.
        </div>

        <div className="divide-y border rounded-md">
          {result.rows.map((rm) => {
            const row = rows.find((r) => r.rowKey === rm.rowKey)!;
            const titleCandidates = rm.candidates.length
              ? titles.filter((t) => rm.candidates.includes(t.id))
              : titles;
            return (
              <div key={rm.rowKey} className="p-3 flex flex-col md:flex-row md:items-center gap-3 text-sm">
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
                <div className="w-full md:w-56">
                  <Select
                    value={rm.titleId ?? NONE}
                    onValueChange={(v) =>
                      setOverrides((o) => ({
                        ...o,
                        [rm.rowKey]: {
                          ...o[rm.rowKey],
                          titleId: v === NONE ? null : v,
                          status: v === NONE ? "hold_for_review" : "mapped",
                        },
                      }))
                    }
                  >
                    <SelectTrigger><SelectValue placeholder="Pick title" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NONE}>—</SelectItem>
                      {titleCandidates.map((t) => (
                        <SelectItem key={t.id} value={t.id}>{t.title}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="w-full md:w-48">
                  <Select
                    value={overrides[rm.rowKey]?.dealMemoId ?? defaults.dealMemoId ?? NONE}
                    onValueChange={(v) =>
                      setOverrides((o) => ({
                        ...o,
                        [rm.rowKey]: {
                          ...o[rm.rowKey],
                          dealMemoId: v === NONE ? null : v,
                        },
                      }))
                    }
                  >
                    <SelectTrigger><SelectValue placeholder="Deal" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NONE}>—</SelectItem>
                      {dealsForTitle(rm.titleId).map((d) => (
                        <SelectItem key={d.id} value={d.id}>{d.id.slice(0, 8)}…</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
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
