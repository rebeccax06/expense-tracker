import { requireUser } from "@/lib/auth/user";
import { ensureDefaultFormats } from "@/server/services/ensure-defaults";
import { AppShell } from "@/components/app-shell";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireUser();
  await ensureDefaultFormats(user.id);

  return <AppShell email={user.email ?? "Account"}>{children}</AppShell>;
}
