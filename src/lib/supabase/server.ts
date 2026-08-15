// =============================================================================
// Supabase Server Client
// =============================================================================
// Creates a Supabase client for use in Server Components, Server Actions,
// and Route Handlers. Uses cookie-based auth from the Next.js request context.
// =============================================================================

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * Creates a Supabase server client that reads/writes auth cookies.
 * Must be called in a Server Component, Server Action, or Route Handler context.
 *
 * Uses the anon key (subject to RLS) — NOT the service role key.
 */
export async function getSupabaseServerClient(): Promise<
  ReturnType<typeof createServerClient>
> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY environment variables"
    );
  }

  const cookieStore = await cookies();

  return createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // setAll may be called from a Server Component where cookies
          // are read-only. This is expected and safe to ignore —
          // the middleware will handle the refresh.
        }
      },
    },
  });
}

/**
 * Creates a Supabase admin client using the service role key.
 * BYPASSES RLS — use only for admin operations (user creation, etc.).
 * Must NEVER be exposed to client code.
 */
export async function getSupabaseAdminClient(): Promise<
  ReturnType<typeof createServerClient>
> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables"
    );
  }

  const cookieStore = await cookies();

  return createServerClient(supabaseUrl, serviceRoleKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Safe to ignore in read-only contexts
        }
      },
    },
  });
}
