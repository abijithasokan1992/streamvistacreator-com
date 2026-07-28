/**
 * Admin Revenue Statement Import — Revenue MVP.
 *
 * Compact five-step flow: Upload → Review → Map → Confirm → Done. The Map
 * step reuses RevenueMappingStep and loads workspace-scoped candidate lists
 * (titles, buyers, deals, workspaces) through the standard supabase client so
 * RLS enforces access. Never fabricates defaults.
 *
 * CSV parsing uses the local RFC4180-safe parser in lib/revenue/csv.
 */
import { useEffect, useMemo, useState } from "react";
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
import { parseCsv, requireHeaders } from "@/lib/revenue/csv";
import { formatMinorAsINR } from "@/lib/revenue/money";
import {
  persistStatement,
  DatabasePendingError,
  StatementAlreadyImportedError,
} from "@/lib/revenue/importApi";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import RevenueMappingStep, {
  type BuyerCandidate,
  type WorkspaceCandidate,
} from "@/components/admin/RevenueMappingStep";
import type {
  TitleCandidate,
  DealCandidate,
  RowMapping,
} from "@/lib/revenue/mapping";

type Step = "upload" | "review" | "map" | "done";

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
  const [csvErrors, setCsvErrors] = useState<string[]>([]);

  const [titles, setTitles] = useState<TitleCandidate[]>([]);
  const [buyers, setBuyers] = useState<BuyerCandidate[]>([]);
  const [deals, setDeals] = useState<DealCandidate[]>([]);
  const [workspaces, setWorkspaces] = useState<WorkspaceCandidate[]>([]);
  const [mappings, setMappings] = useState<RowMapping[] | null>(null);
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);

  const adapter = useMemo(() => getAdapter(sourceType), [sourceType]);

  useEffect(() => {
    // Load workspace-scoped candidates. RLS on each table restricts what the
    // admin can see. We never fabricate defaults. Column names: content_titles
    // owner column is `owner_user_id`; deal_memos uses `buyer_user_id`.
    (async () => {
      const [tRes, bRes, dRes, wRes] = await Promise.all([
        (supabase as any).from("content_titles").select("id, title, owner_user_id, workspace_id").limit(500),
        (supabase as any).from("entity_profiles")
          .select("id, display_name")
          .eq("kind", "buyer")
          .limit(200),
        (supabase as any).from("deal_memos").select("id, title_id, buyer_user_id").limit(200),
        (supabase as any).from("workspaces").select("id, name").limit(100),
      ]);
      if (tRes.error) toast.error(`Titles load failed: ${tRes.error.message}`);
      if (bRes.error) toast.error(`Buyers load failed: ${bRes.error.message}`);
      if (dRes.error) toast.error(`Deals load failed: ${dRes.error.message}`);
      if (wRes.error) toast.error(`Workspaces load failed: ${wRes.error.message}`);
      setTitles((tRes.data ?? []).map((t: any) => ({
        id: t.id, title: t.title, externalRefs: [], ownerUserId: t.owner_user_id ?? null, workspaceId: t.workspace_id ?? null,
      })));
      setBuyers((bRes.data ?? []).map((b: any) => ({ id: b.id, displayName: b.display_name ?? b.id })));
      setDeals((dRes.data ?? []).map((d: any) => ({
        id: d.id, titleId: d.title_id ?? null, buyerUserId: d.buyer_user_id ?? null,
      })));
      setWorkspaces((wRes.data ?? []).map((w: any) => ({ id: w.id, name: w.name })));
    })();
  }, []);

  const preview = () => {
    if (!adapter) {
      toast.error(`No adapter for source "${sourceType}"`);
      return;
    }
    if (!sourceStatementId.trim()) {
      toast.error("Statement ID is required");
      return;
    }
    const parsed = parseCsv(csvText);
    if (parsed.errors.length) {
      setCsvErrors(parsed.errors);
      toast.error(`CSV parse error: ${parsed.errors.join(", ")}`);
      return;
    }
    const missing = requireHeaders(parsed.headers, ["gross"]);
    if (missing.length) {
      setCsvErrors([`missing_headers:${missing.join(",")}`]);
      toast.error(`Missing required headers: ${missing.join(", ")}`);
      return;
    }
    if (!parsed.rows.length) {
      toast.error("No CSV rows detected");
      return;
    }
    setCsvErrors([]);
    const result = normalizeStatement(parsed.rows, {
      sourceType,
      sourceStatementId,
      periodStart: periodStart || null,
      periodEnd: periodEnd || null,
      currency: "INR",
    }, adapter);
    setNormalized(result);
    setStep("review");
  };

  const confirm = async (finalMappings?: RowMapping[]) => {
    if (!normalized) return;
    const useMappings = finalMappings ?? mappings ?? [];
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
        mappings: useMappings,
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
          <FileText className="h-5 w-5" /> Revenue Statements
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <StepIndicator step={step} />

        {dbPending && (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Database update pending</AlertTitle>
            <AlertDescription>
              Extended revenue import fields are not yet applied to this environment. Preview and
              mapping are available; import will resume once the pending migration lands.
            </AlertDescription>
          </Alert>
        )}

        {step === "upload" && (
          <div className="grid gap-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
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
                placeholder='title,date,gross,gst,gateway_fee,in_app_fee,units,share_rate'
              />
              {csvErrors.length > 0 && (
                <p className="text-xs text-destructive mt-1">CSV: {csvErrors.join(", ")}</p>
              )}
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
            <UnmappedSummary normalized={normalized} />
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
              <Button onClick={() => setStep("map")}>Next: Map rows</Button>
            </div>
          </div>
        )}

        {step === "map" && normalized && (
          <RevenueMappingStep
            rows={normalized.rows.filter((r) => r.errors.length === 0)}
            titles={titles}
            deals={deals}
            buyers={buyers}
            workspaces={workspaces}
            onConfirm={(m) => { setMappings(m); void confirm(m); }}
            onBack={() => setStep("review")}
          />
        )}

        {step === "done" && (
          <Alert>
            <CheckCircle2 className="h-4 w-4" />
            <AlertTitle>Statement imported</AlertTitle>
            <AlertDescription>
              Creator will now see this revenue in their statements.
              {mappings ? ` ${mappings.filter((r) => r.status === "mapped").length} rows mapped.` : ""}
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}

function StepIndicator({ step }: { step: Step }) {
  const steps: Step[] = ["upload", "review", "map", "done"];
  const idx = steps.indexOf(step);
  return (
    <ol className="flex gap-1 text-[11px] uppercase tracking-wider text-muted-foreground">
      {steps.map((s, i) => (
        <li key={s} className={i <= idx ? "text-foreground font-semibold" : ""}>
          {i > 0 && <span className="mx-1">›</span>}{s}
        </li>
      ))}
    </ol>
  );
}

function UnmappedSummary({ normalized }: { normalized: NormalizationResult }) {
  const noTitleRef = normalized.rows.filter((r) => !r.titleExternalRef).length;
  const duplicates = normalized.rows.filter((r) => r.errors.includes("duplicate_row_in_statement")).length;
  if (!noTitleRef && !duplicates) return null;
  return (
    <div className="text-xs text-muted-foreground">
      {noTitleRef > 0 && <div>{noTitleRef} row(s) have no title reference and will need manual mapping.</div>}
      {duplicates > 0 && <div>{duplicates} duplicate row(s) will be skipped.</div>}
    </div>
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
