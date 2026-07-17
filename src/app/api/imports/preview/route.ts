import { NextResponse, type NextRequest } from "next/server";
import { createHash } from "node:crypto";
import { createClient } from "@/lib/supabase/server";
import { parseSpreadsheet, FileParseError, MAX_ROWS } from "@/domain/imports/parse-file";
import { resolveAdapter, detectFormat, type FormatLike } from "@/domain/imports/registry";
import { buildPreview } from "@/domain/imports/build-preview";
import { fetchExistingFingerprints } from "@/server/queries/transactions";
import { sanitizeFilename } from "@/lib/parsing";
import type { ImportContext } from "@/domain/imports/adapter";
import type { FieldMapping } from "@/domain/imports/generic-mapping";
import type { ReimbursementBehavior } from "@/lib/supabase/database.types";

const MAX_BYTES = 10 * 1024 * 1024;

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
  }

  const file = form.get("file");
  const accountId = String(form.get("account_id") ?? "");
  const requestedFormatId = (form.get("format_id") as string) || null;

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }
  if (file.size === 0) {
    return NextResponse.json({ error: "File is empty" }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "File exceeds the 10 MB limit" }, { status: 400 });
  }
  if (!accountId) {
    return NextResponse.json({ error: "Select an account" }, { status: 400 });
  }

  const buffer = await file.arrayBuffer();

  let parsed;
  try {
    parsed = parseSpreadsheet(buffer, file.name);
  } catch (err) {
    if (err instanceof FileParseError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    console.error("Unexpected parse error", err);
    return NextResponse.json({ error: "Could not read the file" }, { status: 400 });
  }

  const { data: account, error: accErr } = await supabase
    .from("accounts")
    .select("*")
    .eq("id", accountId)
    .single();
  if (accErr || !account) {
    return NextResponse.json({ error: "Account not found" }, { status: 400 });
  }

  const { data: formats } = await supabase
    .from("import_formats")
    .select("*")
    .eq("is_archived", false);
  const { data: allMappings } = await supabase
    .from("import_format_mappings")
    .select("*");

  const mappingsByFormat = new Map<string, FieldMapping[]>();
  for (const m of allMappings ?? []) {
    const list = mappingsByFormat.get(m.format_id) ?? [];
    list.push({ source_column: m.source_column, target_field: m.target_field });
    mappingsByFormat.set(m.format_id, list);
  }

  const formatLikes: Array<FormatLike & { mappings?: FieldMapping[] }> = (formats ?? []).map(
    (f) => ({
      id: f.id,
      name: f.name,
      strategy: f.strategy,
      header_signature: f.header_signature,
      mappings: mappingsByFormat.get(f.id),
    }),
  );

  const chosenId =
    requestedFormatId ??
    account.import_format_id ??
    detectFormat(parsed.headers, formatLikes);

  if (!chosenId) {
    return NextResponse.json({
      needsFormat: true,
      headers: parsed.headers,
      formats: formatLikes.map((f) => ({ id: f.id, name: f.name })),
      rowCount: parsed.rows.length,
    });
  }

  const format = (formats ?? []).find((f) => f.id === chosenId);
  if (!format) {
    return NextResponse.json({ error: "Import format not found" }, { status: 400 });
  }

  const adapter = resolveAdapter(
    { id: format.id, name: format.name, strategy: format.strategy, header_signature: format.header_signature },
    mappingsByFormat.get(format.id) ?? [],
  );

  if (!adapter.detect(parsed.headers)) {
    return NextResponse.json({
      warning: `Headers don't match "${format.name}". Continuing may produce errors.`,
      formatMismatch: true,
      headers: parsed.headers,
      expectedHeaders: adapter.requiredHeaders,
    });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("reimbursement_behavior")
    .eq("id", user.id)
    .single();

  const ctx: ImportContext = {
    accountId: account.id,
    accountType: account.account_type,
    purchaseSign: account.purchase_sign,
    config: format.config,
    reimbursementBehavior:
      (profile?.reimbursement_behavior as ReimbursementBehavior) ?? "income",
  };

  const existing = await fetchExistingFingerprints();
  const preview = buildPreview({
    file: parsed,
    adapter,
    ctx,
    existingFingerprints: existing,
  });

  const fileHash = createHash("sha256").update(Buffer.from(buffer)).digest("hex");
  const { data: dupBatch } = await supabase
    .from("import_batches")
    .select("id,filename,created_at")
    .eq("file_hash", fileHash)
    .eq("status", "committed")
    .limit(1)
    .maybeSingle();

  return NextResponse.json({
    formatId: format.id,
    formatName: format.name,
    accountName: account.name,
    headers: parsed.headers,
    summary: preview.summary,
    rows: preview.rows,
    fileHash,
    filename: sanitizeFilename(file.name),
    duplicateFile: dupBatch
      ? { filename: dupBatch.filename, importedAt: dupBatch.created_at }
      : null,
    maxRows: MAX_ROWS,
  });
}
