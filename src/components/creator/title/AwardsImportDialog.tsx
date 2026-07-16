import { useMemo, useRef, useState } from "react";
import { Upload, FileJson, FileSpreadsheet, AlertTriangle, Check, X } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  AwardSchema, AWARD_RESULTS, type AwardRow, type AwardResult,
} from "@/lib/creator/titleSchema";

/**
 * Smart Metadata Import — Awards
 * ──────────────────────────────
 * Accepts CSV or JSON. Presents a column → target-field mapper so creators
 * can align arbitrary spreadsheet headings to the strict Awards schema:
 *   award_name   (string, required)
 *   issuing_body (string)
 *   category     (string)
 *   year         (integer 1900..2100)
 *   result       (enum: Won | Nominated | Shortlisted | Honourable Mention)
 *
 * Every row is validated with zod (`AwardSchema`) before it is returned to
 * the caller — invalid rows are surfaced with a per-row error and excluded
 * from the confirm payload.
 */

type Field = "award_name" | "issuing_body" | "category" | "year" | "result";
const FIELDS: { key: Field; label: string; required?: boolean; hint?: string }[] = [
  { key: "award_name",   label: "Award name",   required: true },
  { key: "issuing_body", label: "Issuing body", hint: "Academy, jury, festival body" },
  { key: "category",     label: "Category",     hint: "Best Director, Best Feature…" },
  { key: "year",         label: "Year",         hint: "Integer 1900–2100" },
  { key: "result",       label: "Result",       hint: AWARD_RESULTS.join(" · ") },
];

const RESULT_LOOKUP: Record<string, AwardResult> = {
  won: "Won", winner: "Won", win: "Won",
  nominated: "Nominated", nominee: "Nominated", nomination: "Nominated",
  shortlisted: "Shortlisted", shortlist: "Shortlisted",
  "honourable mention": "Honourable Mention",
  "honorable mention": "Honourable Mention",
  "special mention": "Honourable Mention",
  hm: "Honourable Mention",
};

// ── CSV parsing (RFC 4180-ish; handles quoted fields with embedded commas / quotes) ──
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let field = "";
  let row: string[] = [];
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ",") { row.push(field); field = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field); field = "";
      if (row.some((v) => v.trim() !== "")) rows.push(row);
      row = [];
    } else field += c;
  }
  if (field !== "" || row.length) { row.push(field); if (row.some((v) => v.trim() !== "")) rows.push(row); }
  return rows;
}

function autoGuessMapping(headers: string[]): Record<Field, string> {
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
  const map: Record<Field, string> = { award_name: "", issuing_body: "", category: "", year: "", result: "" };
  const aliases: Record<Field, string[]> = {
    award_name:   ["award_name", "award", "name", "title", "prize"],
    issuing_body: ["issuing_body", "issuer", "body", "organization", "organisation", "festival", "presenter", "awarding_body"],
    category:     ["category", "section", "class"],
    year:         ["year", "yr", "edition"],
    result:       ["result", "status", "outcome", "verdict"],
  };
  for (const f of FIELDS) {
    const target = aliases[f.key].map(norm);
    const match = headers.find((h) => target.includes(norm(h)));
    if (match) map[f.key] = match;
  }
  return map;
}

type ParsedRow = { data: Record<string, unknown>; index: number };
type ValidatedRow = { ok: true; row: AwardRow; index: number } | { ok: false; error: string; index: number };

function coerceRow(raw: Record<string, unknown>, mapping: Record<Field, string>, index: number): ValidatedRow {
  const pick = (f: Field) => (mapping[f] ? raw[mapping[f]] : undefined);
  const rawYear = pick("year");
  const yearNum = rawYear === "" || rawYear == null ? null : Number(String(rawYear).trim());
  const rawResult = String(pick("result") ?? "").trim();
  const resultCanon = rawResult === "" ? "" : (RESULT_LOOKUP[rawResult.toLowerCase()] ?? rawResult);
  const candidate = {
    name: String(pick("award_name") ?? "").trim(),
    issuing_body: String(pick("issuing_body") ?? "").trim(),
    category: String(pick("category") ?? "").trim(),
    year: Number.isFinite(yearNum as number) ? yearNum : null,
    result: resultCanon,
    notes: "",
  };
  const parsed = AwardSchema.safeParse(candidate);
  if (parsed.success) return { ok: true, row: parsed.data, index };
  const first = parsed.error.issues[0];
  return { ok: false, error: `${first.path.join(".") || "row"}: ${first.message}`, index };
}

export interface AwardsImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called with the validated award rows to append/replace in the editor. */
  onImport: (rows: AwardRow[], mode: "append" | "replace") => void;
}

export function AwardsImportDialog({ open, onOpenChange, onImport }: AwardsImportDialogProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string>("");
  const [format, setFormat] = useState<"csv" | "json" | null>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [mapping, setMapping] = useState<Record<Field, string>>({
    award_name: "", issuing_body: "", category: "", year: "", result: "",
  });
  const [mode, setMode] = useState<"append" | "replace">("append");
  const [busy, setBusy] = useState(false);

  const reset = () => {
    setFileName(""); setFormat(null); setHeaders([]); setRows([]);
    setMapping({ award_name: "", issuing_body: "", category: "", year: "", result: "" });
    if (fileRef.current) fileRef.current.value = "";
  };

  const handleFile = async (file: File) => {
    setBusy(true);
    try {
      const text = await file.text();
      const isJson = file.name.toLowerCase().endsWith(".json") || text.trim().startsWith("[") || text.trim().startsWith("{");
      if (isJson) {
        const parsed = JSON.parse(text);
        const arr: any[] = Array.isArray(parsed) ? parsed : Array.isArray(parsed?.awards) ? parsed.awards : [];
        if (!arr.length) throw new Error("JSON must be an array of objects (or an object with `awards: []`).");
        const keys = Array.from(new Set(arr.flatMap((o) => Object.keys(o ?? {}))));
        setFormat("json");
        setHeaders(keys);
        setRows(arr.map((o, i) => ({ data: o ?? {}, index: i })));
        setMapping(autoGuessMapping(keys));
      } else {
        const table = parseCsv(text);
        if (table.length < 2) throw new Error("CSV must have a header row and at least one data row.");
        const [hdr, ...body] = table;
        const trimmed = hdr.map((h) => h.trim());
        setFormat("csv");
        setHeaders(trimmed);
        setRows(body.map((r, i) => ({
          data: Object.fromEntries(trimmed.map((h, ci) => [h, (r[ci] ?? "").trim()])),
          index: i,
        })));
        setMapping(autoGuessMapping(trimmed));
      }
      setFileName(file.name);
    } catch (e: any) {
      toast.error(e?.message || "Could not parse the file");
      reset();
    } finally {
      setBusy(false);
    }
  };

  const validated = useMemo<ValidatedRow[]>(() => {
    if (!rows.length || !mapping.award_name) return [];
    return rows.map((r) => coerceRow(r.data, mapping, r.index));
  }, [rows, mapping]);

  const okRows = validated.filter((v): v is Extract<ValidatedRow, { ok: true }> => v.ok);
  const badRows = validated.filter((v): v is Extract<ValidatedRow, { ok: false }> => !v.ok);
  const ready = okRows.length > 0 && mapping.award_name !== "";

  const confirm = () => {
    if (!ready) return;
    onImport(okRows.map((r) => r.row), mode);
    toast.success(`Imported ${okRows.length} award${okRows.length === 1 ? "" : "s"}${badRows.length ? ` · ${badRows.length} skipped` : ""}`);
    reset();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) reset(); onOpenChange(o); }}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="w-4 h-4" /> Smart Metadata Import · Awards
          </DialogTitle>
          <DialogDescription>
            Upload a CSV or JSON file, then map its columns to <b>award_name</b>, <b>issuing_body</b>, <b>category</b>, <b>year</b>, and <b>result</b>.
            Rows are strictly validated before they are added to your title.
          </DialogDescription>
        </DialogHeader>

        {/* Step 1 · file drop */}
        {!fileName && (
          <div
            onDragOver={(e) => { e.preventDefault(); }}
            onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files?.[0]; if (f) void handleFile(f); }}
            onClick={() => fileRef.current?.click()}
            className="border-2 border-dashed border-border/60 rounded-xl p-10 text-center hover:border-accent/60 cursor-pointer transition-colors bg-secondary/10"
          >
            <div className="flex justify-center gap-3 mb-3 text-muted-foreground">
              <FileSpreadsheet className="w-6 h-6" /> <FileJson className="w-6 h-6" />
            </div>
            <div className="text-sm font-medium">Drop a .csv or .json file, or click to browse</div>
            <div className="text-xs text-muted-foreground mt-1">Headers are auto-detected. Column mapping happens next.</div>
            <input
              ref={fileRef}
              type="file"
              accept=".csv,.json,text/csv,application/json"
              className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) void handleFile(f); }}
            />
          </div>
        )}

        {/* Step 2 · column mapping + preview */}
        {fileName && (
          <div className="space-y-4">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <div className="flex items-center gap-2">
                {format === "json" ? <FileJson className="w-4 h-4" /> : <FileSpreadsheet className="w-4 h-4" />}
                <span className="text-foreground font-medium">{fileName}</span>
                <span>· {rows.length} row{rows.length === 1 ? "" : "s"}</span>
              </div>
              <button className="underline hover:text-foreground" onClick={reset}>Change file</button>
            </div>

            <div className="rounded-lg border border-border/60 p-4 bg-card/30">
              <div className="text-xs uppercase tracking-wider text-muted-foreground mb-3">Column mapping</div>
              <div className="grid sm:grid-cols-2 gap-3">
                {FIELDS.map((f) => (
                  <div key={f.key} className="space-y-1">
                    <Label className="text-xs">
                      {f.label}{f.required && <span className="text-destructive"> *</span>}
                    </Label>
                    <select
                      value={mapping[f.key]}
                      onChange={(e) => setMapping((m) => ({ ...m, [f.key]: e.target.value }))}
                      className="w-full bg-background border border-border/60 rounded-md px-2 py-1.5 text-sm"
                    >
                      <option value="">— not mapped —</option>
                      {headers.map((h) => <option key={h} value={h}>{h}</option>)}
                    </select>
                    {f.hint && <div className="text-[11px] text-muted-foreground">{f.hint}</div>}
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-lg border border-border/60 overflow-hidden">
              <div className="px-3 py-2 bg-secondary/20 flex items-center justify-between text-xs">
                <div className="font-medium">Preview · first 5 rows</div>
                <div className="flex items-center gap-3">
                  <span className="inline-flex items-center gap-1 text-emerald-400"><Check className="w-3 h-3" />{okRows.length} valid</span>
                  {badRows.length > 0 && (
                    <span className="inline-flex items-center gap-1 text-destructive"><AlertTriangle className="w-3 h-3" />{badRows.length} invalid</span>
                  )}
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-secondary/10 text-muted-foreground">
                    <tr>
                      <th className="text-left px-2 py-1.5">#</th>
                      <th className="text-left px-2 py-1.5">Award name</th>
                      <th className="text-left px-2 py-1.5">Issuing body</th>
                      <th className="text-left px-2 py-1.5">Category</th>
                      <th className="text-left px-2 py-1.5">Year</th>
                      <th className="text-left px-2 py-1.5">Result</th>
                      <th className="text-left px-2 py-1.5">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {validated.slice(0, 5).map((v) => {
                      if (v.ok) {
                        return (
                          <tr key={v.index} className="border-t border-border/40">
                            <td className="px-2 py-1.5 text-muted-foreground">{v.index + 1}</td>
                            <td className="px-2 py-1.5">{v.row.name}</td>
                            <td className="px-2 py-1.5">{v.row.issuing_body}</td>
                            <td className="px-2 py-1.5">{v.row.category}</td>
                            <td className="px-2 py-1.5">{v.row.year ?? ""}</td>
                            <td className="px-2 py-1.5">{v.row.result || <span className="text-muted-foreground">—</span>}</td>
                            <td className="px-2 py-1.5 text-emerald-400"><Check className="w-3 h-3 inline" /></td>
                          </tr>
                        );
                      }
                      const bad = v as Extract<ValidatedRow, { ok: false }>;
                      return (
                        <tr key={bad.index} className="border-t border-border/40 bg-destructive/5">
                          <td className="px-2 py-1.5 text-muted-foreground">{bad.index + 1}</td>
                          <td colSpan={5} className="px-2 py-1.5 text-destructive">{bad.error}</td>
                          <td className="px-2 py-1.5 text-destructive"><X className="w-3 h-3 inline" /></td>
                        </tr>
                      );
                    })}
                    {!mapping.award_name && (
                      <tr><td colSpan={7} className="px-3 py-4 text-center text-muted-foreground">Map the <b>Award name</b> column to see a preview.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="flex items-center gap-4 text-xs">
              <label className="inline-flex items-center gap-1.5 cursor-pointer">
                <input type="radio" checked={mode === "append"} onChange={() => setMode("append")} />
                Append to existing awards
              </label>
              <label className="inline-flex items-center gap-1.5 cursor-pointer">
                <input type="radio" checked={mode === "replace"} onChange={() => setMode("replace")} />
                Replace existing awards
              </label>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={busy}>Cancel</Button>
          <Button onClick={confirm} disabled={!ready || busy}>
            Import {okRows.length ? `${okRows.length} award${okRows.length === 1 ? "" : "s"}` : ""}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default AwardsImportDialog;
