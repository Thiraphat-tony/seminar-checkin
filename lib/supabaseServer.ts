import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let singletonClient: SupabaseClient | null = null;

export function createServerClient(): SupabaseClient {
  if (singletonClient) return singletonClient;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceRoleKey) {
    throw new Error("Supabase environment variables are not set");
  }

  singletonClient = createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  return singletonClient;
}
