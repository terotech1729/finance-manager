import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Supabase is OPTIONAL. If the two NEXT_PUBLIC_ env vars aren't set, the app runs
 * in local-only mode (localStorage), exactly as before. When set, data syncs to a
 * private Supabase Postgres row gated by email magic-link auth + row-level security.
 */
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(url && anonKey);

let client: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient | null {
  if (!isSupabaseConfigured) return null;
  if (!client) {
    client = createClient(url as string, anonKey as string, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    });
  }
  return client;
}
