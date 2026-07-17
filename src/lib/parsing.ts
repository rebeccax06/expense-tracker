/**
 * Parse a currency-ish string into a number. Handles $, thousands separators,
 * leading +, and accounting-style parentheses for negatives. Returns null when
 * the value can't be interpreted as a finite number.
 */
export function parseAmount(raw: string | number | null | undefined): number | null {
  if (raw === null || raw === undefined) return null;
  if (typeof raw === "number") return Number.isFinite(raw) ? raw : null;

  let s = raw.trim();
  if (s === "") return null;

  let negative = false;
  if (/^\(.*\)$/.test(s)) {
    negative = true;
    s = s.slice(1, -1);
  }
  s = s.replace(/[$,\s]/g, "");
  if (s.startsWith("+")) s = s.slice(1);
  if (s.startsWith("-")) {
    negative = !negative;
    s = s.slice(1);
  }
  if (s === "" || !/^\d*\.?\d+$/.test(s)) return null;

  const n = Number(s);
  if (!Number.isFinite(n)) return null;
  return negative ? -n : n;
}

function toIso(year: number, month: number, day: number): string | null {
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const mm = String(month).padStart(2, "0");
  const dd = String(day).padStart(2, "0");
  // Validate via Date round-trip (rejects e.g. 02/31).
  const d = new Date(`${year}-${mm}-${dd}T00:00:00Z`);
  if (
    d.getUTCFullYear() !== year ||
    d.getUTCMonth() + 1 !== month ||
    d.getUTCDate() !== day
  ) {
    return null;
  }
  return `${year}-${mm}-${dd}`;
}

/**
 * Parse a date string into ISO yyyy-mm-dd. Supports the common bank export
 * shapes: yyyy-mm-dd, mm/dd/yyyy, m/d/yy. `format` is an optional hint
 * ("MM/DD/YYYY" | "DD/MM/YYYY" | "YYYY-MM-DD"); when absent we assume US
 * month-first ordering for slash dates. Returns null on failure.
 */
export function parseDate(
  raw: string | null | undefined,
  format?: string,
): string | null {
  if (!raw) return null;
  const s = raw.trim();
  if (s === "") return null;

  // ISO first.
  const iso = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (iso) return toIso(+iso[1], +iso[2], +iso[3]);

  const slash = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);
  if (slash) {
    let year = +slash[3];
    if (year < 100) year += year >= 70 ? 1900 : 2000;
    const a = +slash[1];
    const b = +slash[2];
    const dayFirst = format?.toUpperCase().startsWith("DD");
    const month = dayFirst ? b : a;
    const day = dayFirst ? a : b;
    return toIso(year, month, day);
  }

  return null;
}

/**
 * Sanitize an uploaded filename: strip any path components and restrict to a
 * safe character set to prevent path traversal in storage keys.
 */
export function sanitizeFilename(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? "upload";
  const cleaned = base.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 128);
  return cleaned === "" ? "upload" : cleaned;
}

const CSV_INJECTION_PREFIXES = ["=", "+", "-", "@", "\t", "\r"];

/**
 * Neutralize CSV/spreadsheet formula injection when EXPORTING user data.
 * Prefixes risky leading characters with a single quote.
 */
export function sanitizeForCsvExport(value: string): string {
  if (value.length > 0 && CSV_INJECTION_PREFIXES.includes(value[0])) {
    return `'${value}`;
  }
  return value;
}
