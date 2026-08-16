// =============================================================================
// Tag Service
// =============================================================================
// Handles Tag CRUD operations through PowerSync local SQLite.
// Tags are global, shared entities with normalized names for duplicate detection.
//
// Key features:
//   - Create tags with automatic normalization
//   - Duplicate detection via normalized_name
//   - Soft-delete with version increment
//   - Color management
// =============================================================================

// Minimal interface for the PowerSync database methods we use.
interface PowerSyncDB {
  execute(sql: string, params?: unknown[]): Promise<{ rowsAffected?: number }>;
  getOptional<T>(sql: string, params?: unknown[]): Promise<T | undefined>;
  getAll<T>(sql: string, params?: unknown[]): Promise<T[]>;
  writeTransaction<T>(callback: (tx: PowerSyncTx) => Promise<T>): Promise<T>;
}

interface PowerSyncTx {
  execute(sql: string, params?: unknown[]): Promise<{ rowsAffected?: number }>;
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CreateTagInput {
  name: string;
  color?: string | null;
}

export interface UpdateTagInput {
  name?: string;
  color?: string | null;
}

export interface TagRecord {
  id: string;
  name: string;
  normalized_name: string;
  color: string | null;
  created_at: string;
  updated_at: string;
  version: number;
}

// ---------------------------------------------------------------------------
// Utility
// ---------------------------------------------------------------------------

/** Normalize a tag name for duplicate detection. */
function normalizeTagName(name: string): string {
  return name.trim().toLowerCase();
}

// ---------------------------------------------------------------------------
// Tag Service Factory
// ---------------------------------------------------------------------------

export function createTagService(db: PowerSyncDB) {
  /**
   * Checks if a tag with the same normalized name already exists.
   */
  async function checkDuplicateTag(
    name: string
  ): Promise<TagRecord | null> {
    const normalized = normalizeTagName(name);
    const result = await db.getOptional<TagRecord>(
      `SELECT id, name, normalized_name, color, created_at, updated_at, version
       FROM tags WHERE normalized_name = ? AND deleted_at IS NULL`,
      [normalized]
    );
    return result ?? null;
  }

  /**
   * Creates a new tag. Returns existing tag if a duplicate is found.
   */
  async function createTag(
    input: CreateTagInput
  ): Promise<{ tag: TagRecord; isDuplicate: boolean }> {
    const existing = await checkDuplicateTag(input.name);
    if (existing) {
      return { tag: existing, isDuplicate: true };
    }

    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const normalized = normalizeTagName(input.name);

    await db.execute(
      `INSERT INTO tags (id, name, normalized_name, color, created_at, updated_at, version)
       VALUES (?, ?, ?, ?, ?, ?, 1)`,
      [id, input.name.trim(), normalized, input.color ?? null, now, now]
    );

    const tag: TagRecord = {
      id,
      name: input.name.trim(),
      normalized_name: normalized,
      color: input.color ?? null,
      created_at: now,
      updated_at: now,
      version: 1,
    };

    return { tag, isDuplicate: false };
  }

  /**
   * Creates a tag if it doesn't exist, or returns the existing one.
   * Convenience method for "create-on-fly" tag input.
   */
  async function getOrCreateTag(name: string, color?: string | null): Promise<TagRecord> {
    const { tag } = await createTag({ name, color });
    return tag;
  }

  /**
   * Updates an existing tag's fields.
   */
  async function updateTag(
    tagId: string,
    updates: UpdateTagInput
  ): Promise<void> {
    const fields: string[] = [];
    const values: unknown[] = [];

    if (updates.name !== undefined) {
      fields.push("name = ?", "normalized_name = ?");
      values.push(updates.name.trim(), normalizeTagName(updates.name));
    }
    if (updates.color !== undefined) {
      fields.push("color = ?");
      values.push(updates.color);
    }

    if (fields.length === 0) return;

    fields.push("updated_at = ?", "version = version + 1");
    values.push(new Date().toISOString(), tagId);

    await db.execute(
      `UPDATE tags SET ${fields.join(", ")} WHERE id = ? AND deleted_at IS NULL`,
      values
    );
  }

  /**
   * Soft-deletes a tag. Also removes word-tag associations.
   */
  async function softDeleteTag(tagId: string): Promise<void> {
    const now = new Date().toISOString();

    await db.writeTransaction(async (tx) => {
      // Remove word-tag associations (hard delete — junction table)
      await tx.execute(`DELETE FROM word_tags WHERE tag_id = ?`, [tagId]);

      // Soft-delete the tag
      await tx.execute(
        `UPDATE tags SET deleted_at = ?, updated_at = ?, version = version + 1
         WHERE id = ? AND deleted_at IS NULL`,
        [now, now, tagId]
      );
    });
  }

  /**
   * Get all active tags, sorted alphabetically.
   */
  async function getAllTags(): Promise<TagRecord[]> {
    return db.getAll<TagRecord>(
      `SELECT id, name, normalized_name, color, created_at, updated_at, version
       FROM tags WHERE deleted_at IS NULL
       ORDER BY name ASC`
    );
  }

  return {
    checkDuplicateTag,
    createTag,
    getOrCreateTag,
    updateTag,
    softDeleteTag,
    getAllTags,
  };
}
