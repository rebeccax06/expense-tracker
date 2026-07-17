import { NextResponse, type NextRequest } from "next/server";
import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { importCommitSchema } from "@/lib/validation/schemas";
import { sanitizeFilename } from "@/lib/parsing";

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

  const payloadRaw = form.get("payload");
  if (typeof payloadRaw !== "string") {
    return NextResponse.json({ error: "Missing payload" }, { status: 400 });
  }

  let payloadJson: unknown;
  try {
    payloadJson = JSON.parse(payloadRaw);
  } catch {
    return NextResponse.json({ error: "Malformed payload" }, { status: 400 });
  }

  const parsed = importCommitSchema.safeParse(payloadJson);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid import data" },
      { status: 400 },
    );
  }
  const input = parsed.data;

  // Retain the original file in private Storage (per-user prefix).
  let storagePath: string | null = null;
  const file = form.get("file");
  if (file instanceof File && file.size > 0) {
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ error: "File exceeds the 10 MB limit" }, { status: 400 });
    }
    const path = `${user.id}/${randomUUID()}/${sanitizeFilename(file.name)}`;
    const { error: uploadError } = await supabase.storage
      .from("imports")
      .upload(path, file, { contentType: file.type || "text/csv", upsert: false });
    if (uploadError) {
      console.error("Storage upload failed", uploadError);
      // Non-fatal: continue committing without a retained file.
    } else {
      storagePath = path;
    }
  }

  const { data, error } = await supabase.rpc("commit_import", {
    p_account_id: input.account_id,
    p_format_id: input.format_id,
    p_filename: input.filename,
    p_file_hash: input.file_hash,
    p_storage_path: storagePath,
    p_rows: input.rows,
    p_skip_duplicates: input.skipDuplicates,
  });

  if (error) {
    console.error("commit_import failed", error);
    // Roll back the uploaded file so we don't leave orphans on failure.
    if (storagePath) await supabase.storage.from("imports").remove([storagePath]);
    return NextResponse.json({ error: "Import failed. No changes were saved." }, { status: 500 });
  }

  revalidatePath("/transactions");
  revalidatePath("/dashboard");
  revalidatePath("/imports");
  return NextResponse.json(data);
}
