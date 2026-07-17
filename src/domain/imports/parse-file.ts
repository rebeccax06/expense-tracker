import Papa from "papaparse";
import * as XLSX from "xlsx";

export const MAX_ROWS = 10000;

export interface ParsedFile {
  headers: string[];
  rows: Record<string, string>[];
}

export class FileParseError extends Error {}

function coerceRow(
  headers: string[],
  values: unknown[],
): Record<string, string> {
  const row: Record<string, string> = {};
  headers.forEach((h, i) => {
    const v = values[i];
    row[h] = v === null || v === undefined ? "" : String(v);
  });
  return row;
}

function parseCsv(text: string): ParsedFile {
  const result = Papa.parse<string[]>(text, {
    skipEmptyLines: "greedy",
  });
  if (result.errors.length > 0) {
    const first = result.errors[0];
    throw new FileParseError(`CSV parse error: ${first.message} (row ${first.row})`);
  }
  const data = result.data as string[][];
  if (data.length === 0) throw new FileParseError("File is empty");

  const headers = data[0].map((h) => (h ?? "").trim());
  const rows = data.slice(1).map((values) => coerceRow(headers, values));
  return { headers, rows };
}

function parseXlsx(buffer: ArrayBuffer): ParsedFile {
  // Read-only parse. We never evaluate formulas (cellFormula: false) which
  // protects against spreadsheet formula execution from untrusted files.
  const wb = XLSX.read(buffer, { type: "array", cellFormula: false, cellHTML: false });
  const sheetName = wb.SheetNames[0];
  if (!sheetName) throw new FileParseError("Workbook has no sheets");
  const sheet = wb.Sheets[sheetName];
  const matrix = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    blankrows: false,
    defval: "",
    raw: false,
  });
  if (matrix.length === 0) throw new FileParseError("Sheet is empty");

  const headers = (matrix[0] as unknown[]).map((h) => String(h ?? "").trim());
  const rows = matrix
    .slice(1)
    .map((values) => coerceRow(headers, values as unknown[]));
  return { headers, rows };
}

/**
 * Parse a CSV or XLSX file buffer into headers + string rows. Validates that
 * the file isn't empty, headers exist, and row count is within limits.
 */
export function parseSpreadsheet(
  buffer: ArrayBuffer,
  filename: string,
): ParsedFile {
  const lower = filename.toLowerCase();
  let parsed: ParsedFile;

  if (lower.endsWith(".csv") || lower.endsWith(".txt")) {
    parsed = parseCsv(new TextDecoder().decode(buffer));
  } else if (lower.endsWith(".xlsx") || lower.endsWith(".xls")) {
    parsed = parseXlsx(buffer);
  } else {
    throw new FileParseError("Unsupported file type. Upload a .csv or .xlsx file.");
  }

  const headers = parsed.headers.filter((h) => h !== "");
  if (headers.length === 0) throw new FileParseError("No column headers found");
  if (parsed.rows.length === 0) throw new FileParseError("No data rows found");
  if (parsed.rows.length > MAX_ROWS) {
    throw new FileParseError(
      `File has ${parsed.rows.length} rows, exceeding the ${MAX_ROWS}-row limit.`,
    );
  }

  return { headers: parsed.headers, rows: parsed.rows };
}
