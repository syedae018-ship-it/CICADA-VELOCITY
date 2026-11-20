// Browser Supabase client (publishable/anon key only: Row Level Security limits every read to the
// signed-in user's tenant). Never put the service-role key in the dashboard.
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { TenantId } from "@/types";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const supabase: SupabaseClient | null = url && key ? createClient(url, key) : null;

export interface SignedInUser {
  email: string;
  tenantId: TenantId | null;
  accessToken: string;
}

/** Current Supabase session (if any) and the tenant this user belongs to (read through RLS). */
export async function currentUser(): Promise<SignedInUser | null> {
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  const session = data.session;
  if (!session) return null;
  const { data: rows } = await supabase.from("tenant_members").select("tenant_id").limit(1);
  return {
    email: session.user.email ?? "user",
    tenantId: (rows?.[0]?.tenant_id as TenantId | undefined) ?? null,
    accessToken: session.access_token,
  };
}

export async function signOut() {
  if (supabase) await supabase.auth.signOut();
}
