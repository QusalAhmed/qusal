// =============================================================================
// Environment Variable Validation
// =============================================================================
// Validates and exports typed environment variables.
// Fails fast at import time if required variables are missing.
//
// Usage:
//   import { publicEnv } from "@/lib/env";
//   const url = publicEnv.NEXT_PUBLIC_SUPABASE_URL;
//
// Architecture:
//   - publicEnv: Safe for browser bundles (NEXT_PUBLIC_* only)
//   - serverEnv: Server-only secrets (never imported in client components)
//
// NOTE: Uses Zod 4 API (z.url() instead of z.string().url())
// =============================================================================

import { z } from "zod";

// ---------------------------------------------------------------------------
// Public Environment (browser-safe)
// ---------------------------------------------------------------------------

const publicEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.url("NEXT_PUBLIC_SUPABASE_URL must be a valid URL"),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z
    .string()
    .min(1, "NEXT_PUBLIC_SUPABASE_ANON_KEY is required"),
  NEXT_PUBLIC_POWERSYNC_URL: z.url("NEXT_PUBLIC_POWERSYNC_URL must be a valid URL"),
});

/**
 * Validated public environment variables.
 * Safe to use in both server and client code.
 */
export const publicEnv = publicEnvSchema.parse({
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  NEXT_PUBLIC_POWERSYNC_URL: process.env.NEXT_PUBLIC_POWERSYNC_URL,
});

// ---------------------------------------------------------------------------
// Server-Only Environment
// ---------------------------------------------------------------------------

const serverEnvSchema = z.object({
  SUPABASE_SERVICE_ROLE_KEY: z
    .string()
    .min(1, "SUPABASE_SERVICE_ROLE_KEY is required"),
});

/**
 * Validated server-only environment variables.
 * MUST NOT be imported in client components or files that end up in the browser bundle.
 *
 * Lazily validated: only throws when a property is accessed.
 * This prevents build-time errors when client code tree-shakes this module.
 */
function getServerEnv(): z.infer<typeof serverEnvSchema> {
  if (typeof window !== "undefined") {
    throw new Error(
      "Server environment variables must not be accessed in client code. " +
        "This file should only be imported in Server Components, Server Actions, or API routes."
    );
  }

  return serverEnvSchema.parse({
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
  });
}

/**
 * Access server-only environment variables.
 * Throws if accessed from client code or if variables are missing.
 * Uses a Proxy to lazily validate on first property access.
 */
export const serverEnv = new Proxy({} as z.infer<typeof serverEnvSchema>, {
  get(_target, prop: string) {
    const env = getServerEnv();
    return env[prop as keyof typeof env];
  },
});
