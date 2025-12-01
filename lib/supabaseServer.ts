// lib/supabaseServer.ts
import { createClient } from '@supabase/supabase-js';

export function createServerClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl) {
    console.warn(
      'NEXT_PUBLIC_SUPABASE_URL is not set. Set NEXT_PUBLIC_SUPABASE_URL in your environment (for example in .env.local during local development, or as an Environment Variable in Vercel).'
    );
  }

  const supabaseKey = serviceRoleKey || anonKey;

  if (!supabaseKey) {
    console.warn(
      'SUPABASE_SERVICE_ROLE_KEY or NEXT_PUBLIC_SUPABASE_ANON_KEY is not set. Set one of these in your environment (for example in .env.local during local development, or as an Environment Variable in Vercel).'
    );
  }

  // If env vars are missing, return a client anyway (with empty strings) so
  // the application does not crash during server-side module initialization.
  // Individual calls will fail gracefully and route handlers already check
  // for `error` from Supabase queries.
  const urlForClient = supabaseUrl || '';
  const keyForClient = supabaseKey || '';

  return createClient(urlForClient, keyForClient, {
    auth: { persistSession: false },
  });
}
