import { listAccounts, listFormats } from "@/server/queries/lookups";
import { listImportBatches } from "@/server/queries/imports";
import { ImportsClient } from "@/features/imports/imports-client";

export default async function ImportsPage() {
  const [accounts, formats, batches] = await Promise.all([
    listAccounts(false),
    listFormats(),
    listImportBatches(),
  ]);
  return <ImportsClient accounts={accounts} formats={formats} batches={batches} />;
}
