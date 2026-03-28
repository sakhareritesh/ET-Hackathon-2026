import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

function buildClient(): SupabaseClient {
  if (!supabaseUrl) {
    // Return a dummy client during build/SSR when env vars aren't available.
    // All calls will no-op gracefully; the real client works at runtime.
    return createClient("https://placeholder.supabase.co", "placeholder");
  }
  return createClient(supabaseUrl, supabaseAnonKey);
}

export const supabase = buildClient();
