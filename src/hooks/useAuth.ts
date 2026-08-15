"use client";

// =============================================================================
// Auth Hook
// =============================================================================
// Provides authentication actions (sign in, sign out) and user state.
// Uses the browser Supabase client.
// =============================================================================

import { useCallback, useEffect, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { usePowerSyncProvider } from "@/lib/powersync/PowerSyncProvider";
import type { AppRole } from "@/types";

interface AuthState {
  loading: boolean;
  error: string | null;
}

interface UseAuthReturn {
  user: ReturnType<typeof usePowerSyncProvider>["user"];
  isInitialized: boolean;
  loading: boolean;
  error: string | null;
  signIn: (email: string, password: string) => Promise<boolean>;
  signOut: () => Promise<void>;
}

/**
 * Hook for authentication actions and state.
 * Relies on PowerSyncProvider for user state (single source of truth).
 */
export function useAuth(): UseAuthReturn {
  const { user, isInitialized } = usePowerSyncProvider();
  const [state, setState] = useState<AuthState>({
    loading: false,
    error: null,
  });

  const signIn = useCallback(
    async (email: string, password: string): Promise<boolean> => {
      setState({ loading: true, error: null });

      try {
        const supabase = getSupabaseBrowserClient();
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (error) {
          setState({ loading: false, error: error.message });
          return false;
        }

        setState({ loading: false, error: null });
        return true;
      } catch {
        setState({ loading: false, error: "An unexpected error occurred" });
        return false;
      }
    },
    []
  );

  const signOut = useCallback(async () => {
    setState({ loading: true, error: null });

    try {
      const supabase = getSupabaseBrowserClient();
      await supabase.auth.signOut();
      setState({ loading: false, error: null });
    } catch {
      setState({ loading: false, error: "Failed to sign out" });
    }
  }, []);

  return {
    user,
    isInitialized,
    loading: state.loading,
    error: state.error,
    signIn,
    signOut,
  };
}

// ---------------------------------------------------------------------------
// User Role Hook
// ---------------------------------------------------------------------------

interface UseUserRoleReturn {
  role: AppRole | null;
  isAdmin: boolean;
  isContributor: boolean;
  loading: boolean;
}

/**
 * Hook to fetch the current user's role from the local PowerSync database.
 * Returns role, convenience booleans, and loading state.
 */
export function useUserRole(): UseUserRoleReturn {
  const { user, db } = usePowerSyncProvider();
  const [role, setRole] = useState<AppRole | null>(null);
  const [loading, setLoading] = useState(true);

  // Fetch role from local DB when user changes
  useEffect(() => {
    if (!user) {
      setRole(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    db.get<{ role: string }>(
      "SELECT role FROM profiles WHERE id = ?",
      [user.id]
    )
      .then((result) => {
        setRole(result.role as AppRole);
        setLoading(false);
      })
      .catch(() => {
        setRole(null);
        setLoading(false);
      });
  }, [user, db]);

  return {
    role,
    isAdmin: role === "ADMIN",
    isContributor: role === "CONTRIBUTOR",
    loading,
  };
}
