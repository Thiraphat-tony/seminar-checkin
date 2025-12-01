// lib/supabaseServer.ts
import { createClient } from '@supabase/supabase-js';

export function createServerClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl) {
    throw new Error(
      'NEXT_PUBLIC_SUPABASE_URL is not set.\nSet NEXT_PUBLIC_SUPABASE_URL in your environment (for example in .env.local during local development, or as an Environment Variable in Vercel).' 
    );
  }

  const supabaseKey = serviceRoleKey || anonKey;

  if (!supabaseKey) {
    throw new Error(
      'SUPABASE_SERVICE_ROLE_KEY or NEXT_PUBLIC_SUPABASE_ANON_KEY is not set.\nSet one of these in your environment (for example in .env.local during local development, or as an Environment Variable in Vercel).' 
    );
  }

  return createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false },
  });
}
