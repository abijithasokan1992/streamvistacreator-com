/**
 * Minimal RFC4180-safe CSV parser (no dependency).
 *
 * Supports:
 *  - Quoted fields with embedded commas, quotes ("" escape), and newlines.
 *  - CRLF / LF line endings.
 *  - UTF-8 BOM at start of file.
 *  - Empty trailing lines are ignored.
 *
 * Not a streaming parser — inputs are small admin uploads pasted into the
 * preview UI. Returns raw string cells; downstream code coerces types.
 */

export interface CsvParseResult {
  headers: string[];
  rows: Array<Record<string, string>>;
  errors: string[];
}

export function parseCsv(input: string): CsvParseResult {
  const errors: string[] = [];
  if (input == null) return { headers: [], rows: [], errors: ["empty_input"] };
  // Strip UTF-8 BOM.
  let text = input.charCodeAt(0) === 0xfeff ? input.slice(1) : input;

  const cells: string[][] = [[]];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else { inQuotes = false; }
      } else {
        field += c;
      }
      continue;
    }
    if (c === '"') { inQuotes = true; continue; }
    if (c === ",") { cells[cells.length - 1].push(field); field = ""; continue; }
    if (c === "\n" || c === "\r") {
      cells[cells.length - 1].push(field);
      field = "";
      // Consume CRLF pair.
      if (c === "\r" && text[i + 1] === "\n") i++;
      cells.push([]);
      continue;
    }
    field += c;
  }
  // Flush last field.
  cells[cells.length - 1].push(field);

  if (inQuotes) errors.push("unterminated_quoted_field");

  // Drop trailing empty rows (a single empty field).
  while (cells.length && cells[cells.length - 1].length === 1 && cells[cells.length - 1][0] === "") {
    cells.pop();
  }

  if (!cells.length) return { headers: [], rows: [], errors: ["no_rows"] };
  const headers = cells[0].map((h) => h.trim());
  const rows: Array<Record<string, string>> = [];
  for (let r = 1; r < cells.length; r++) {
    const line = cells[r];
    if (line.length === 1 && line[0].trim() === "") continue;
    const obj: Record<string, string> = {};
    headers.forEach((h, idx) => { obj[h] = (line[idx] ?? "").trim(); });
    rows.push(obj);
  }
  return { headers, rows, errors };
}

/** Assert the CSV has the required headers (case-insensitive). */
export function requireHeaders(headers: string[], required: string[]): string[] {
  const set = new Set(headers.map((h) => h.toLowerCase().trim()));
  return required.filter((r) => !set.has(r.toLowerCase()));
}
