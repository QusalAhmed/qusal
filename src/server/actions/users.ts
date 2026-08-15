"use server";

// =============================================================================
// Admin User Management Server Actions
// =============================================================================
// Server-side actions for creating and managing application users.
// Only ADMIN users can invoke these actions.
//
// Flow:
//   Admin UI → Server Action → verify admin role → Supabase Admin Auth API
// =============================================================================

import { z } from "zod";
import {
  getSupabaseServerClient,
  getSupabaseAdminClient,
} from "@/lib/supabase/server";
import { appRoleSchema } from "@/schemas";
import type { AppRole } from "@/types";

// ---------------------------------------------------------------------------
// Validation Schemas
// ---------------------------------------------------------------------------

const createUserSchema = z.object({
  email: z.string().email("Valid email is required"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  role: appRoleSchema,
});

const updateUserRoleSchema = z.object({
  userId: z.uuid(),
  role: appRoleSchema,
});

// ---------------------------------------------------------------------------
// Response Types
// ---------------------------------------------------------------------------

interface ActionSuccess<T = undefined> {
  success: true;
  data: T;
}

interface ActionError {
  success: false;
  error: string;
}

type ActionResult<T = undefined> = ActionSuccess<T> | ActionError;

// ---------------------------------------------------------------------------
// Admin Verification Helper
// ---------------------------------------------------------------------------

/**
 * Verifies the current user is authenticated and has ADMIN role.
 * Returns the user ID on success, or an error result.
 */
async function verifyAdmin(): Promise<
  | { authorized: true; userId: string }
  | { authorized: false; error: string }
> {
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { authorized: false, error: "Authentication required" };
  }

  // Check role from the profiles table
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profileError || !profile) {
    return { authorized: false, error: "Profile not found" };
  }

  if (profile.role !== "ADMIN") {
    return {
      authorized: false,
      error: "Insufficient permissions: ADMIN role required",
    };
  }

  return { authorized: true, userId: user.id };
}

// ---------------------------------------------------------------------------
// Server Actions
// ---------------------------------------------------------------------------

/**
 * Creates a new application user (admin-only).
 *
 * Flow:
 *   1. Verify requesting user is ADMIN
 *   2. Validate input
 *   3. Create auth user via Supabase Admin API (service role key)
 *   4. Update the auto-created profile with the specified role
 */
export async function createUser(
  input: unknown
): Promise<ActionResult<{ userId: string }>> {
  // 1. Verify admin
  const adminCheck = await verifyAdmin();
  if (!adminCheck.authorized) {
    return { success: false, error: adminCheck.error };
  }

  // 2. Validate input
  const parsed = createUserSchema.safeParse(input);
  if (!parsed.success) {
    const firstError = parsed.error.issues[0]?.message ?? "Invalid input";
    return { success: false, error: firstError };
  }

  const { email, password, role } = parsed.data;

  try {
    // 3. Create auth user using admin client (bypasses RLS)
    const adminClient = await getSupabaseAdminClient();

    const { data: authData, error: authError } =
      await adminClient.auth.admin.createUser({
        email,
        password,
        email_confirm: true, // Auto-confirm the email
      });

    if (authError) {
      return {
        success: false,
        error: `Failed to create user: ${authError.message}`,
      };
    }

    if (!authData.user) {
      return { success: false, error: "User creation returned no user data" };
    }

    // 4. Update the profile role (trigger auto-creates with CONTRIBUTOR)
    if (role !== "CONTRIBUTOR") {
      const { error: profileError } = await adminClient
        .from("profiles")
        .update({ role, updated_at: new Date().toISOString() })
        .eq("id", authData.user.id);

      if (profileError) {
        return {
          success: false,
          error: `User created but role assignment failed: ${profileError.message}`,
        };
      }
    }

    return { success: true, data: { userId: authData.user.id } };
  } catch {
    return { success: false, error: "An unexpected error occurred" };
  }
}

/**
 * Updates a user's role (admin-only).
 */
export async function updateUserRole(
  input: unknown
): Promise<ActionResult> {
  const adminCheck = await verifyAdmin();
  if (!adminCheck.authorized) {
    return { success: false, error: adminCheck.error };
  }

  const parsed = updateUserRoleSchema.safeParse(input);
  if (!parsed.success) {
    const firstError = parsed.error.issues[0]?.message ?? "Invalid input";
    return { success: false, error: firstError };
  }

  const { userId, role } = parsed.data;

  // Prevent admin from demoting themselves
  if (userId === adminCheck.userId && role !== "ADMIN") {
    return { success: false, error: "Cannot change your own admin role" };
  }

  try {
    const adminClient = await getSupabaseAdminClient();
    const { error } = await adminClient
      .from("profiles")
      .update({ role, updated_at: new Date().toISOString() })
      .eq("id", userId);

    if (error) {
      return {
        success: false,
        error: `Failed to update role: ${error.message}`,
      };
    }

    return { success: true, data: undefined };
  } catch {
    return { success: false, error: "An unexpected error occurred" };
  }
}

/**
 * Lists all users with their profiles (admin-only).
 * Returns data from auth.users joined with profiles.
 */
export async function listUsers(): Promise<
  ActionResult<
    Array<{
      id: string;
      email: string;
      role: AppRole;
      created_at: string;
      last_sign_in_at: string | null;
    }>
  >
> {
  const adminCheck = await verifyAdmin();
  if (!adminCheck.authorized) {
    return { success: false, error: adminCheck.error };
  }

  try {
    const adminClient = await getSupabaseAdminClient();

    // Fetch auth users
    const {
      data: { users },
      error: authError,
    } = await adminClient.auth.admin.listUsers();

    if (authError) {
      return {
        success: false,
        error: `Failed to list users: ${authError.message}`,
      };
    }

    // Fetch all profiles
    const { data: profiles, error: profileError } = await adminClient
      .from("profiles")
      .select("id, role");

    if (profileError) {
      return {
        success: false,
        error: `Failed to fetch profiles: ${profileError.message}`,
      };
    }

    const profileMap = new Map(
      (profiles ?? []).map((p: { id: string; role: AppRole }) => [p.id, p.role])
    );

    const result = users.map((u: { id: string; email?: string; created_at: string; last_sign_in_at?: string | null }) => ({
      id: u.id,
      email: u.email ?? "",
      role: profileMap.get(u.id) ?? ("CONTRIBUTOR" as AppRole),
      created_at: u.created_at,
      last_sign_in_at: u.last_sign_in_at ?? null,
    }));

    return { success: true, data: result };
  } catch {
    return { success: false, error: "An unexpected error occurred" };
  }
}
