// =============================================================================
// Supabase Browser Client
// =============================================================================
// Creates a Supabase client for use in Client Components.
// Uses the anon key (browser-safe, subject to RLS).
// =============================================================================

import { createBrowserClient } from "@supabase/ssr";

let client: ReturnType<typeof createBrowserClient> | null = null;

/**
 * Returns a singleton Supabase client for browser use.
 * Safe to call multiple times — reuses the same instance.
 */
export function getSupabaseBrowserClient(): ReturnType<typeof createBrowserClient> {
  if (client) return client;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY environment variables"
    );
  }

  client = createBrowserClient(supabaseUrl, supabaseAnonKey);
  return client;
}
