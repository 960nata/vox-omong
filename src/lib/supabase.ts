import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/** Klien Supabase di sisi server. Hanya anon key (dibatasi RLS); service key sengaja tidak didukung. */
let client: SupabaseClient | null = null;

export function supabaseReady() {
  return !!(process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY);
}

export function getSupabase(): SupabaseClient {
  if (!supabaseReady()) throw new Error("Supabase belum disetel. Isi SUPABASE_URL dan SUPABASE_ANON_KEY di .env.local.");
  if (!client) client = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_ANON_KEY!, { auth: { persistSession: false, autoRefreshToken: false } });
  return client;
}

export const TABLE_RE = /^[a-z_][a-z0-9_]{0,62}$/;
