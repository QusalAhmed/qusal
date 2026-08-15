"use client";

// =============================================================================
// PowerSync React Provider
// =============================================================================
// Wraps the application with the PowerSync React context.
// Manages the connection lifecycle:
//   - Creates database ONLY on the client (after mount)
//   - Connects when user authenticates
//   - Disconnects when user signs out
//   - Handles reconnection on token refresh
//   - Provides sync status to the UI
// =============================================================================

import {
  ReactNode,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import type { PowerSyncDatabase } from "@powersync/web";
import type { User, Session, AuthChangeEvent } from "@supabase/supabase-js";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

// ---------------------------------------------------------------------------
// Sync Status Context
// ---------------------------------------------------------------------------

interface SyncStatus {
  connected: boolean;
  lastSyncedAt: Date | null;
  uploading: boolean;
  downloading: boolean;
  hasSynced: boolean;
}

interface PowerSyncProviderContextValue {
  db: PowerSyncDatabase;
  syncStatus: SyncStatus;
  user: User | null;
  isInitialized: boolean;
}

const PowerSyncProviderContext =
  createContext<PowerSyncProviderContextValue | null>(null);

// ---------------------------------------------------------------------------
// Provider Component
// ---------------------------------------------------------------------------

interface PowerSyncProviderProps {
  children: ReactNode;
}

export function PowerSyncProvider({
  children,
}: PowerSyncProviderProps): ReactNode {
  const dbRef = useRef<PowerSyncDatabase | null>(null);
  const connectorRef = useRef<import("@/lib/powersync/connector").SupabasePowerSyncConnector | null>(null);

  const [user, setUser] = useState<User | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [isDbReady, setIsDbReady] = useState(false);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>({
    connected: false,
    lastSyncedAt: null,
    uploading: false,
    downloading: false,
    hasSynced: false,
  });

  // ---------------------------------------------------------------------------
  // Database Initialization (client-only, runs once after mount)
  // ---------------------------------------------------------------------------

  useEffect(() => {
    let cancelled = false;

    async function initDatabase() {
      // Dynamic imports to avoid loading WASM modules during SSR
      const { getPowerSyncDatabase } = await import("@/lib/powersync/database");
      const { SupabasePowerSyncConnector } = await import("@/lib/powersync/connector");

      if (cancelled) return;

      const db = getPowerSyncDatabase();
      const connector = new SupabasePowerSyncConnector();

      dbRef.current = db;
      connectorRef.current = connector;
      setIsDbReady(true);
    }

    initDatabase();

    return () => {
      cancelled = true;
    };
  }, []);

  /**
   * Connects the PowerSync database to the sync service.
   * Called when a user authenticates.
   */
  const connectPowerSync = useCallback(async () => {
    const db = dbRef.current;
    const connector = connectorRef.current;

    if (!db || !connector) return;

    try {
      await db.connect(connector);
    } catch (error) {
      console.error("[PowerSync] Failed to connect:", error);
    }
  }, []);

  /**
   * Disconnects from the sync service.
   * Called when the user signs out.
   */
  const disconnectPowerSync = useCallback(async () => {
    const db = dbRef.current;
    if (!db) return;

    try {
      await db.disconnect();
    } catch (error) {
      console.error("[PowerSync] Failed to disconnect:", error);
    }
  }, []);

  // ---------------------------------------------------------------------------
  // Auth State Listener — waits for DB to be ready
  // ---------------------------------------------------------------------------

  useEffect(() => {
    if (!isDbReady) return;

    const supabase = getSupabaseBrowserClient();

    // Check initial session
    supabase.auth
      .getSession()
      .then(({ data }: { data: { session: Session | null } }) => {
        const currentUser = data.session?.user ?? null;
        setUser(currentUser);
        setIsInitialized(true);

        if (currentUser) {
          connectPowerSync();
        }
      });

    // Listen for auth state changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(
      async (event: AuthChangeEvent, session: Session | null) => {
        const currentUser = session?.user ?? null;
        setUser(currentUser);

        if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED") {
          await connectPowerSync();
        } else if (event === "SIGNED_OUT") {
          await disconnectPowerSync();
        }
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, [isDbReady, connectPowerSync, disconnectPowerSync]);

  // ---------------------------------------------------------------------------
  // Sync Status Listener — waits for DB to be ready
  // ---------------------------------------------------------------------------

  useEffect(() => {
    if (!isDbReady || !dbRef.current) return;

    const db = dbRef.current;

    const statusListener = db.registerListener({
      statusChanged: (status) => {
        setSyncStatus({
          connected: status.connected,
          lastSyncedAt: status.lastSyncedAt
            ? new Date(status.lastSyncedAt)
            : null,
          uploading: status.dataFlowStatus?.uploading ?? false,
          downloading: status.dataFlowStatus?.downloading ?? false,
          hasSynced: status.hasSynced ?? false,
        });
      },
    });

    return () => {
      statusListener?.();
    };
  }, [isDbReady]);

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  // Don't render children until the database is ready
  // This prevents hooks that need the db from crashing
  if (!isDbReady || !dbRef.current) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 animate-pulse" />
          <p className="text-sm text-[var(--color-text-tertiary)]">Loading...</p>
        </div>
      </div>
    );
  }

  const contextValue: PowerSyncProviderContextValue = {
    db: dbRef.current,
    syncStatus,
    user,
    isInitialized,
  };

  return (
    <PowerSyncProviderContext.Provider value={contextValue}>
      {children}
    </PowerSyncProviderContext.Provider>
  );
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * Hook to access the PowerSync provider context.
 * Returns the database instance, sync status, user, and initialization state.
 */
export function usePowerSyncProvider(): PowerSyncProviderContextValue {
  const context = useContext(PowerSyncProviderContext);
  if (!context) {
    throw new Error(
      "usePowerSyncProvider must be used within a <PowerSyncProvider>"
    );
  }
  return context;
}
