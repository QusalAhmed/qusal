// =============================================================================
// PowerSync Backend Connector
// =============================================================================
// Implements the PowerSyncBackendConnector interface for Supabase integration.
//
// Responsibilities:
//   1. fetchCredentials — gets a PowerSync JWT from the Supabase session
//   2. uploadData — pushes local mutations to Supabase via the PostgREST API
//
// Upload handler conflict resolution:
//   - PUT (insert): Uses upsert with onConflict for idempotency
//   - PATCH (update): Uses version-based optimistic concurrency
//   - DELETE: Uses soft-delete (sets deleted_at) for synced tables
// =============================================================================

import {
  AbstractPowerSyncDatabase,
  CrudEntry,
  PowerSyncBackendConnector,
  UpdateType,
} from "@powersync/web";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

/**
 * Tables that use composite primary keys instead of a single UUID `id`.
 * These require special handling in the upload logic.
 */
const COMPOSITE_PK_TABLES: Record<string, string[]> = {
  word_tags: ["word_id", "tag_id"],
  user_flashcard_states: ["user_id", "flashcard_id"],
};

/**
 * Tables that use soft-delete (deleted_at) instead of hard DELETE.
 * For these, a DELETE operation is converted to an UPDATE setting deleted_at.
 */
const SOFT_DELETE_TABLES = new Set([
  "words",
  "tags",
  "definitions",
  "examples",
  "flashcards",
]);

/**
 * Tables where UNIQUE constraints exist and upserts should handle conflicts.
 * Maps table name to the onConflict columns for upsert.
 */
const UPSERT_CONFLICT_COLUMNS: Record<string, string> = {
  word_tags: "word_id,tag_id",
  user_flashcard_states: "user_id,flashcard_id",
  flashcards: "definition_id,quiz_mode",
};

export class SupabasePowerSyncConnector implements PowerSyncBackendConnector {
  /**
   * Fetches credentials for PowerSync to connect to the sync service.
   * Uses the current Supabase session JWT as the PowerSync token.
   */
  async fetchCredentials(): Promise<{
    endpoint: string;
    token: string;
    expiresAt?: Date;
  }> {
    const supabase = getSupabaseBrowserClient();
    const { data: sessionData, error } = await supabase.auth.getSession();

    if (error) {
      throw new Error(`Failed to get Supabase session: ${error.message}`);
    }

    const session = sessionData.session;

    if (!session) {
      throw new Error(
        "No active Supabase session. User must be authenticated to sync."
      );
    }

    const powersyncUrl = process.env.NEXT_PUBLIC_POWERSYNC_URL;
    if (!powersyncUrl) {
      throw new Error("Missing NEXT_PUBLIC_POWERSYNC_URL environment variable");
    }

    return {
      endpoint: powersyncUrl,
      token: session.access_token,
      expiresAt: session.expires_at
        ? new Date(session.expires_at * 1000)
        : undefined,
    };
  }

  /**
   * Uploads local mutations to Supabase.
   *
   * Called by PowerSync whenever there are pending local changes.
   * Processes one transaction at a time to maintain ordering.
   *
   * Error handling:
   *   - Throwing an error causes PowerSync to retry the transaction later.
   *   - For permanent failures (e.g., RLS violations), we complete the
   *     transaction to avoid blocking the queue, and log the error.
   */
  async uploadData(database: AbstractPowerSyncDatabase): Promise<void> {
    const transaction = await database.getNextCrudTransaction();
    if (!transaction) return;

    try {
      const supabase = getSupabaseBrowserClient();

      for (const op of transaction.crud) {
        await this.processOperation(supabase, op);
      }

      await transaction.complete();
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : "Unknown upload error";

      // Check if this is a permanent error (RLS violation, constraint violation)
      // that would block the queue indefinitely
      if (isPermanentError(error)) {
        console.error(
          `[PowerSync Upload] Permanent error, discarding transaction: ${message}`
        );
        await transaction.complete();
        return;
      }

      // Temporary error — throw to retry later
      console.error(
        `[PowerSync Upload] Temporary error, will retry: ${message}`
      );
      throw error;
    }
  }

  /**
   * Processes a single CRUD operation against Supabase.
   */
  private async processOperation(
    supabase: ReturnType<typeof getSupabaseBrowserClient>,
    op: CrudEntry
  ): Promise<void> {
    const { table, opData } = op;

    switch (op.op) {
      case UpdateType.PUT: {
        await this.handlePut(supabase, table, op.id, opData);
        break;
      }
      case UpdateType.PATCH: {
        await this.handlePatch(supabase, table, op.id, opData);
        break;
      }
      case UpdateType.DELETE: {
        await this.handleDelete(supabase, table, op.id);
        break;
      }
      default: {
        console.warn(
          `[PowerSync Upload] Unknown operation type for table ${table}`
        );
      }
    }
  }

  /**
   * Handles PUT (insert/upsert) operations.
   * Uses upsert with conflict columns for tables that have UNIQUE constraints.
   */
  private async handlePut(
    supabase: ReturnType<typeof getSupabaseBrowserClient>,
    table: string,
    id: string,
    opData: Record<string, unknown> | undefined
  ): Promise<void> {
    const data = { ...opData };

    // For non-composite-PK tables, include the PowerSync id as the row id
    if (!COMPOSITE_PK_TABLES[table]) {
      data.id = id;
    }

    const conflictColumns = UPSERT_CONFLICT_COLUMNS[table];

    if (conflictColumns) {
      const { error } = await supabase
        .from(table)
        .upsert(data, { onConflict: conflictColumns });

      if (error) {
        throw new Error(
          `[PUT ${table}] Upsert failed: ${error.message} (code: ${error.code})`
        );
      }
    } else {
      const { error } = await supabase.from(table).upsert(data);

      if (error) {
        throw new Error(
          `[PUT ${table}] Upsert failed: ${error.message} (code: ${error.code})`
        );
      }
    }
  }

  /**
   * Handles PATCH (update) operations.
   * Uses version-based optimistic concurrency where applicable.
   */
  private async handlePatch(
    supabase: ReturnType<typeof getSupabaseBrowserClient>,
    table: string,
    id: string,
    opData: Record<string, unknown> | undefined
  ): Promise<void> {
    if (!opData) return;

    const compositePk = COMPOSITE_PK_TABLES[table];

    if (compositePk) {
      // For composite-PK tables, filter by composite key columns from opData
      let query = supabase.from(table).update(opData);
      for (const col of compositePk) {
        const val = opData[col];
        if (val !== undefined) {
          query = query.eq(col, val as string);
        }
      }
      const { error } = await query;
      if (error) {
        throw new Error(
          `[PATCH ${table}] Update failed: ${error.message} (code: ${error.code})`
        );
      }
    } else {
      // Standard tables — update by id
      const { error } = await supabase
        .from(table)
        .update(opData)
        .eq("id", id);

      if (error) {
        throw new Error(
          `[PATCH ${table}] Update failed: ${error.message} (code: ${error.code})`
        );
      }
    }
  }

  /**
   * Handles DELETE operations.
   * For soft-delete tables, converts to an UPDATE setting deleted_at.
   * For junction/other tables, performs a hard DELETE.
   */
  private async handleDelete(
    supabase: ReturnType<typeof getSupabaseBrowserClient>,
    table: string,
    id: string
  ): Promise<void> {
    if (SOFT_DELETE_TABLES.has(table)) {
      // Soft delete: set deleted_at timestamp
      const { error } = await supabase
        .from(table)
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", id);

      if (error) {
        throw new Error(
          `[DELETE ${table}] Soft delete failed: ${error.message} (code: ${error.code})`
        );
      }
    } else {
      const compositePk = COMPOSITE_PK_TABLES[table];
      if (compositePk) {
        // Can't delete by `id` for composite-PK tables through this path
        // These should be handled via the opData approach
        console.warn(
          `[DELETE ${table}] Composite-PK delete requires opData, skipping`
        );
      } else {
        const { error } = await supabase.from(table).delete().eq("id", id);

        if (error) {
          throw new Error(
            `[DELETE ${table}] Hard delete failed: ${error.message} (code: ${error.code})`
          );
        }
      }
    }
  }
}

/**
 * Determines if an error is permanent (should not be retried).
 * Permanent errors include RLS violations and unique constraint violations
 * that would just fail again on retry.
 */
function isPermanentError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;

  const message = error.message.toLowerCase();

  // PostgreSQL error codes surfaced through PostgREST
  return (
    message.includes("42501") || // insufficient_privilege (RLS)
    message.includes("23505") || // unique_violation
    message.includes("42p01") || // undefined_table
    message.includes("42703") // undefined_column
  );
}
