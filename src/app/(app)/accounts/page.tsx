import { listAccounts, listFormats } from "@/server/queries/lookups";
import { AccountsClient } from "@/features/accounts/accounts-client";

export default async function AccountsPage() {
  const [accounts, formats] = await Promise.all([listAccounts(), listFormats()]);
  return <AccountsClient accounts={accounts} formats={formats} />;
}
