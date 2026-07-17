import "server-only";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth/user";

/**
 * Standard context for server actions: an RLS-scoped Supabase client plus the
 * authenticated user id derived from the session (never from client input).
 */
export async function getActionContext() {
  const user = await requireUser();
  const supabase = await createClient();
  return { supabase, userId: user.id };
}

export type ActionResult = { ok: true } | { ok: false; error: string };
