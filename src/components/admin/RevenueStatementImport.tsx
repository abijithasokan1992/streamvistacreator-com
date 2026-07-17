/**
 * Admin Revenue Statement Import — Phase D2A preview UI.
 * Three compact steps: Upload/Map → Review totals/errors → Confirm import.
 * Uses shadcn primitives already used elsewhere in Admin.
 */
import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle, CheckCircle2, Upload, FileText } from "lucide-react";
import { normalizeStatement, getAdapter } from "@/lib/revenue/normalize";
import type { NormalizationResult } from "@/lib/revenue/normalize";
import { formatMinorAsINR } from "@/lib/revenue/money";
import {
  persistStatement,
  DatabasePendingError,
  StatementAlreadyImportedError,
} from "@/lib/revenue/importApi";
import { toast } from "sonner";

type Step = "upload" | "review" | "done";

function parseCsv(text: string): Array<Record<string, string>> {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length);
  if (!lines.length) return [];
  const headers = lines[0].split(",").map((h) => h.trim());
  return lines.slice(1).map((line) => {
    const cells = line.split(",");
    const obj: Record<string, string> = {};
    headers.forEach((h, i) => (obj[h] = (cells[i] ?? "").trim()));
    return obj;
  });
}

export function RevenueStatementImport() {
  const [step, setStep] = useState<Step>("upload");
  const [sourceType, setSourceType] = useState("bookmyshow");
  const [sourceStatementId, setSourceStatementId] = useState("");
  const [sourceLabel, setSourceLabel] = useState("");
  const [periodStart, setPeriodStart] = useState("");
  const [periodEnd, setPeriodEnd] = useState("");
  const [csvText, setCsvText] = useState("");
  const [normalized, setNormalized] = useState<NormalizationResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [dbPending, setDbPending] = useState(false);

  const adapter = useMemo(() => getAdapter(sourceType), [sourceType]);

  const preview = () => {
    if (!adapter) {
      toast.error(`No adapter for source "${sourceType}"`);
      return;
    }
    if (!sourceStatementId.trim()) {
      toast.error("Statement ID is required");
      return;
    }
    const rows = parseCsv(csvText);
    if (!rows.length) {
      toast.error("No CSV rows detected");
      return;
    }
    const result = normalizeStatement(rows, {
      sourceType,
      sourceStatementId,
      periodStart: periodStart || null,
      periodEnd: periodEnd || null,
      currency: "INR",
    }, adapter);
    setNormalized(result);
    setStep("review");
  };

  const confirm = async () => {
    if (!normalized) return;
    setBusy(true);
    try {
      const res = await persistStatement({
        sourceType,
        sourceLabel: sourceLabel || sourceStatementId,
        sourceStatementId,
        partnerId: null,
        workspaceId: null,
        currency: "INR",
        periodStart: periodStart || null,
        periodEnd: periodEnd || null,
        notes: null,
        normalization: normalized,
      });
      toast.success(`Imported ${res.inserted} rows (${res.skipped} skipped)`);
      setStep("done");
    } catch (e) {
      if (e instanceof DatabasePendingError) {
        setDbPending(true);
      } else if (e instanceof StatementAlreadyImportedError) {
        toast.error(`Statement already imported (${e.existingImportId.slice(0, 8)}…)`);
      } else {
        toast.error((e as Error).message ?? "Import failed");
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5" /> Revenue Statement Import
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {dbPending && (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Database update pending</AlertTitle>
            <AlertDescription>
              Extended revenue import fields are not yet applied to this environment. Preview is
              available; import will resume automatically once the pending migration lands.
            </AlertDescription>
          </Alert>
        )}

        {step === "upload" && (
          <div className="grid gap-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Source</Label>
                <Input value={sourceType} onChange={(e) => setSourceType(e.target.value)} placeholder="bookmyshow" />
              </div>
              <div>
                <Label>Statement ID</Label>
                <Input value={sourceStatementId} onChange={(e) => setSourceStatementId(e.target.value)} placeholder="BMS-2026-07" />
              </div>
              <div>
                <Label>Label</Label>
                <Input value={sourceLabel} onChange={(e) => setSourceLabel(e.target.value)} placeholder="BookMyShow July 2026" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label>Period start</Label>
                  <Input type="date" value={periodStart} onChange={(e) => setPeriodStart(e.target.value)} />
                </div>
                <div>
                  <Label>Period end</Label>
                  <Input type="date" value={periodEnd} onChange={(e) => setPeriodEnd(e.target.value)} />
                </div>
              </div>
            </div>
            <div>
              <Label>Paste CSV (headers on first row)</Label>
              <Textarea
                rows={8}
                value={csvText}
                onChange={(e) => setCsvText(e.target.value)}
                placeholder="title,date,gross,gst,gateway_fee,in_app_fee,units,share_rate"
              />
            </div>
            <div className="flex justify-end">
              <Button onClick={preview}>
                <Upload className="h-4 w-4 mr-2" /> Preview
              </Button>
            </div>
          </div>
        )}

        {step === "review" && normalized && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
              <StatBox label="Rows" value={String(normalized.totals.rowCount)} />
              <StatBox label="Errors" value={String(normalized.totals.errorRowCount)} tone={normalized.totals.errorRowCount ? "warn" : "ok"} />
              <StatBox label="Gross" value={formatMinorAsINR(normalized.totals.grossMinor)} />
              <StatBox label="Net" value={formatMinorAsINR(normalized.totals.netMinor)} />
              <StatBox label="Creator share" value={formatMinorAsINR(normalized.totals.creatorShareMinor)} />
              <StatBox label="Platform share" value={formatMinorAsINR(normalized.totals.platformShareMinor)} />
              <StatBox label="Tax" value={formatMinorAsINR(normalized.totals.taxMinor)} />
              <StatBox label="Fees" value={formatMinorAsINR(normalized.totals.gatewayFeeMinor + normalized.totals.inAppFeeMinor)} />
            </div>
            {normalized.totals.errorRowCount > 0 && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Some rows will be skipped</AlertTitle>
                <AlertDescription>
                  {normalized.totals.errorRowCount} row(s) contain invalid amounts or duplicates. Fix the CSV
                  and re-preview to include them.
                </AlertDescription>
              </Alert>
            )}
            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setStep("upload")}>Back</Button>
              <Button onClick={confirm} disabled={busy}>Confirm import</Button>
            </div>
          </div>
        )}

        {step === "done" && (
          <Alert>
            <CheckCircle2 className="h-4 w-4" />
            <AlertTitle>Statement imported</AlertTitle>
            <AlertDescription>Creator will now see this revenue in their summary.</AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}

function StatBox({ label, value, tone }: { label: string; value: string; tone?: "ok" | "warn" }) {
  return (
    <div className="rounded-md border p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-sm font-medium mt-1 flex items-center gap-2">
        {value}
        {tone === "warn" && <Badge variant="destructive">check</Badge>}
      </div>
    </div>
  );
}

export default RevenueStatementImport;
