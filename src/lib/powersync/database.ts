// =============================================================================
// PowerSync Database Initialization
// =============================================================================
// Creates and manages the singleton PowerSync database instance.
// Used by the React provider to supply the database to the component tree.
//
// IMPORTANT: This module must ONLY be imported in client-side code.
// PowerSync requires browser APIs (IndexedDB, WASM) that don't exist in SSR.
// =============================================================================

import { PowerSyncDatabase } from "@powersync/web";
import { AppSchema } from "@/db/AppSchema";

let powerSyncInstance: PowerSyncDatabase | null = null;

/**
 * Returns the singleton PowerSync database instance.
 * Creates it on first call with the app schema and SQLite configuration.
 *
 * The database is initialized but NOT connected — call db.connect(connector)
 * separately after the user authenticates.
 *
 * @throws if called during SSR (typeof window === "undefined")
 */
export function getPowerSyncDatabase(): PowerSyncDatabase {
  if (typeof window === "undefined") {
    throw new Error(
      "PowerSync database cannot be created during server-side rendering. " +
        "Ensure this is only called in client components."
    );
  }

  if (powerSyncInstance) return powerSyncInstance;

  powerSyncInstance = new PowerSyncDatabase({
    database: {
      dbFilename: "qusal-vocabulary.sqlite",
    },
    schema: AppSchema,
  });

  return powerSyncInstance;
}
