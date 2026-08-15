"use client";

// =============================================================================
// PowerSync Query Hook
// =============================================================================
// Custom hook wrapping PowerSync's watch/query capabilities.
// Uses the database from our PowerSyncProvider context instead of the
// @powersync/react context (which has Table type incompatibility issues).
// =============================================================================

import { useCallback, useEffect, useState } from "react";
import { usePowerSyncProvider } from "@/lib/powersync/PowerSyncProvider";

interface UseQueryResult<T> {
  data: T[];
  isLoading: boolean;
  error: Error | null;
  refresh: () => void;
}

/**
 * Reactive query hook for PowerSync local SQLite.
 * Re-executes the query whenever the underlying data changes.
 *
 * @param sql - SQL query string
 * @param params - Optional query parameters
 * @returns Reactive query result with data, loading, and error states
 */
export function usePowerSyncQuery<T>(
  sql: string,
  params: unknown[] = []
): UseQueryResult<T> {
  const { db } = usePowerSyncProvider();
  const [data, setData] = useState<T[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const refresh = useCallback(() => {
    setRefreshKey((k) => k + 1);
  }, []);

  useEffect(() => {
    let cancelled = false;

    const runQuery = async () => {
      try {
        setIsLoading(true);
        const result = await db.getAll<T>(sql, params);
        if (!cancelled) {
          setData(result);
          setError(null);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err : new Error("Query failed"));
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    runQuery();

    // Set up a watcher for reactive updates
    const abortController = new AbortController();

    const watchQuery = async () => {
      try {
        for await (const result of db.watch(sql, params, {
          signal: abortController.signal,
        })) {
          if (!cancelled) {
            setData(result as unknown as T[]);
            setError(null);
            setIsLoading(false);
          }
        }
      } catch (err) {
        // AbortError is expected when the component unmounts
        if (err instanceof Error && err.name === "AbortError") return;
        if (!cancelled) {
          setError(err instanceof Error ? err : new Error("Watch failed"));
        }
      }
    };

    watchQuery();

    return () => {
      cancelled = true;
      abortController.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [db, sql, JSON.stringify(params), refreshKey]);

  return { data, isLoading, error, refresh };
}
