// =============================================================================
// Vocabulary Service
// =============================================================================
// Handles all Word and Definition CRUD operations through PowerSync local
// SQLite. All writes happen locally and sync to Supabase via the upload queue.
//
// Key operations:
//   - createWordWithDefinitions: Transactional insert of word + definitions +
//     tags + flashcards in a single local SQLite transaction
//   - updateWord: Update word fields
//   - softDeleteWord: Mark word as deleted
//   - updateDefinition: Update definition fields
//   - softDeleteDefinition: Mark definition as deleted
//   - checkDuplicate: Check if a normalized word already exists
// =============================================================================

import type { PartOfSpeech, QuizMode } from "@/types";

// Minimal interface for the PowerSync database methods we use.
// Avoids importing from @powersync/web which causes type conflicts with @powersync/common.
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

/**
 * Input for creating a word with its definitions, tags, and auto-generated
 * flashcards — all in a single local SQLite transaction.
 */
export interface CreateWordInput {
  word: string;
  phonetics?: string | null;
  audio_url?: string | null;
  definitions: CreateDefinitionInput[];
  tag_ids: string[];
}

export interface CreateDefinitionInput {
  meaning: string;
  part_of_speech: PartOfSpeech;
  tiptap_note?: unknown | null;
  requested_ai_example_count: number;
}

export interface UpdateWordInput {
  word?: string;
  phonetics?: string | null;
  audio_url?: string | null;
}

export interface UpdateDefinitionInput {
  meaning?: string;
  part_of_speech?: PartOfSpeech;
  tiptap_note?: unknown | null;
  requested_ai_example_count?: number;
}

/** Result of a create operation */
export interface CreateWordResult {
  wordId: string;
  definitionIds: string[];
  flashcardIds: string[];
}

// ---------------------------------------------------------------------------
// Utility: Generate UUID v4
// ---------------------------------------------------------------------------

function generateUUID(): string {
  return crypto.randomUUID();
}

/**
 * Normalize a word for duplicate detection.
 * Trims whitespace and lowercases.
 */
function normalizeWord(word: string): string {
  return word.trim().toLowerCase();
}

// ---------------------------------------------------------------------------
// Vocabulary Service Factory
// ---------------------------------------------------------------------------

/**
 * Creates a vocabulary service bound to a PowerSync database instance.
 * All operations write to local SQLite and sync via PowerSync.
 */
export function createVocabularyService(db: PowerSyncDB) {
  // -------------------------------------------------------------------------
  // Duplicate Detection
  // -------------------------------------------------------------------------

  /**
   * Checks if a word with the same normalized form already exists.
   * Returns the existing word's ID if found, null otherwise.
   */
  async function checkDuplicateWord(
    word: string
  ): Promise<{ id: string; word: string } | null> {
    const normalized = normalizeWord(word);
    const result = await db.getOptional<{ id: string; word: string }>(
      `SELECT id, word FROM words
       WHERE normalized_word = ? AND deleted_at IS NULL`,
      [normalized]
    );
    return result ?? null;
  }

  // -------------------------------------------------------------------------
  // Create Word (Transactional)
  // -------------------------------------------------------------------------

  /**
   * Creates a word with all its definitions, tags, and auto-generated
   * flashcards in a single local SQLite transaction.
   *
   * For each definition, 3 flashcards are created (one per quiz_mode).
   * This mirrors the server-side trigger behavior but runs locally first.
   *
   * @param input - The word data with definitions and tag IDs
   * @param userId - The authenticated user's ID (for created_by)
   * @returns IDs of all created records
   * @throws if a duplicate word is detected
   */
  async function createWordWithDefinitions(
    input: CreateWordInput,
    userId: string
  ): Promise<CreateWordResult> {
    const normalized = normalizeWord(input.word);

    // Pre-check for duplicates before starting transaction
    const existing = await checkDuplicateWord(input.word);
    if (existing) {
      throw new DuplicateWordError(input.word, existing.id, existing.word);
    }

    const wordId = generateUUID();
    const now = new Date().toISOString();

    const definitionIds: string[] = [];
    const flashcardIds: string[] = [];

    await db.writeTransaction(async (tx) => {
      // 1. Insert the word
      await tx.execute(
        `INSERT INTO words (id, word, normalized_word, phonetics, audio_url, created_by, created_at, updated_at, version)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)`,
        [
          wordId,
          input.word.trim(),
          normalized,
          input.phonetics ?? null,
          input.audio_url ?? null,
          userId,
          now,
          now,
        ]
      );

      // 2. Insert word-tag associations
      for (const tagId of input.tag_ids) {
        await tx.execute(
          `INSERT INTO word_tags (word_id, tag_id) VALUES (?, ?)`,
          [wordId, tagId]
        );
      }

      // 3. Insert definitions and their flashcards
      const quizModes: QuizMode[] = [
        "WORD_TO_MEANING",
        "MEANING_TO_WORD",
        "MEANING_TO_SPELLING",
      ];

      for (const def of input.definitions) {
        const defId = generateUUID();
        definitionIds.push(defId);

        await tx.execute(
          `INSERT INTO definitions (id, word_id, meaning, part_of_speech, tiptap_note, requested_ai_example_count, created_by, created_at, updated_at, version)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
          [
            defId,
            wordId,
            def.meaning.trim(),
            def.part_of_speech,
            def.tiptap_note ? JSON.stringify(def.tiptap_note) : null,
            def.requested_ai_example_count,
            userId,
            now,
            now,
          ]
        );

        // 4. Create 3 flashcards per definition (one per quiz mode)
        for (const mode of quizModes) {
          const flashcardId = generateUUID();
          flashcardIds.push(flashcardId);

          await tx.execute(
            `INSERT INTO flashcards (id, definition_id, quiz_mode, is_active, created_at, updated_at, version)
             VALUES (?, ?, ?, 1, ?, ?, 1)`,
            [flashcardId, defId, mode, now, now]
          );
        }
      }
    });

    return { wordId, definitionIds, flashcardIds };
  }

  // -------------------------------------------------------------------------
  // Update Word
  // -------------------------------------------------------------------------

  /**
   * Updates an existing word's fields. Only provided fields are updated.
   * Increments version for conflict detection.
   */
  async function updateWord(
    wordId: string,
    updates: UpdateWordInput
  ): Promise<void> {
    const fields: string[] = [];
    const values: unknown[] = [];

    if (updates.word !== undefined) {
      fields.push("word = ?", "normalized_word = ?");
      values.push(updates.word.trim(), normalizeWord(updates.word));
    }
    if (updates.phonetics !== undefined) {
      fields.push("phonetics = ?");
      values.push(updates.phonetics);
    }
    if (updates.audio_url !== undefined) {
      fields.push("audio_url = ?");
      values.push(updates.audio_url);
    }

    if (fields.length === 0) return;

    fields.push("updated_at = ?", "version = version + 1");
    values.push(new Date().toISOString(), wordId);

    await db.execute(
      `UPDATE words SET ${fields.join(", ")} WHERE id = ? AND deleted_at IS NULL`,
      values
    );
  }

  // -------------------------------------------------------------------------
  // Soft Delete Word
  // -------------------------------------------------------------------------

  /**
   * Soft-deletes a word by setting deleted_at.
   * Also soft-deletes all child definitions and their flashcards.
   */
  async function softDeleteWord(wordId: string): Promise<void> {
    const now = new Date().toISOString();

    await db.writeTransaction(async (tx) => {
      // Soft-delete flashcards for all definitions of this word
      await tx.execute(
        `UPDATE flashcards SET deleted_at = ?, updated_at = ?, version = version + 1
         WHERE definition_id IN (
           SELECT id FROM definitions WHERE word_id = ? AND deleted_at IS NULL
         ) AND deleted_at IS NULL`,
        [now, now, wordId]
      );

      // Soft-delete all definitions
      await tx.execute(
        `UPDATE definitions SET deleted_at = ?, updated_at = ?, version = version + 1
         WHERE word_id = ? AND deleted_at IS NULL`,
        [now, now, wordId]
      );

      // Remove word-tag associations (hard delete — junction table)
      await tx.execute(`DELETE FROM word_tags WHERE word_id = ?`, [wordId]);

      // Soft-delete the word
      await tx.execute(
        `UPDATE words SET deleted_at = ?, updated_at = ?, version = version + 1
         WHERE id = ? AND deleted_at IS NULL`,
        [now, now, wordId]
      );
    });
  }

  // -------------------------------------------------------------------------
  // Add Definition to Existing Word
  // -------------------------------------------------------------------------

  /**
   * Adds a new definition to an existing word with auto-generated flashcards.
   */
  async function addDefinition(
    wordId: string,
    def: CreateDefinitionInput,
    userId: string
  ): Promise<{ definitionId: string; flashcardIds: string[] }> {
    const defId = generateUUID();
    const now = new Date().toISOString();
    const flashcardIds: string[] = [];

    const quizModes: QuizMode[] = [
      "WORD_TO_MEANING",
      "MEANING_TO_WORD",
      "MEANING_TO_SPELLING",
    ];

    await db.writeTransaction(async (tx) => {
      await tx.execute(
        `INSERT INTO definitions (id, word_id, meaning, part_of_speech, tiptap_note, requested_ai_example_count, created_by, created_at, updated_at, version)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
        [
          defId,
          wordId,
          def.meaning.trim(),
          def.part_of_speech,
          def.tiptap_note ? JSON.stringify(def.tiptap_note) : null,
          def.requested_ai_example_count,
          userId,
          now,
          now,
        ]
      );

      for (const mode of quizModes) {
        const flashcardId = generateUUID();
        flashcardIds.push(flashcardId);

        await tx.execute(
          `INSERT INTO flashcards (id, definition_id, quiz_mode, is_active, created_at, updated_at, version)
           VALUES (?, ?, ?, 1, ?, ?, 1)`,
          [flashcardId, defId, mode, now, now]
        );
      }
    });

    return { definitionId: defId, flashcardIds };
  }

  // -------------------------------------------------------------------------
  // Update Definition
  // -------------------------------------------------------------------------

  async function updateDefinition(
    definitionId: string,
    updates: UpdateDefinitionInput
  ): Promise<void> {
    const fields: string[] = [];
    const values: unknown[] = [];

    if (updates.meaning !== undefined) {
      fields.push("meaning = ?");
      values.push(updates.meaning.trim());
    }
    if (updates.part_of_speech !== undefined) {
      fields.push("part_of_speech = ?");
      values.push(updates.part_of_speech);
    }
    if (updates.tiptap_note !== undefined) {
      fields.push("tiptap_note = ?");
      values.push(
        updates.tiptap_note ? JSON.stringify(updates.tiptap_note) : null
      );
    }
    if (updates.requested_ai_example_count !== undefined) {
      fields.push("requested_ai_example_count = ?");
      values.push(updates.requested_ai_example_count);
    }

    if (fields.length === 0) return;

    fields.push("updated_at = ?", "version = version + 1");
    values.push(new Date().toISOString(), definitionId);

    await db.execute(
      `UPDATE definitions SET ${fields.join(", ")} WHERE id = ? AND deleted_at IS NULL`,
      values
    );
  }

  // -------------------------------------------------------------------------
  // Soft Delete Definition
  // -------------------------------------------------------------------------

  async function softDeleteDefinition(definitionId: string): Promise<void> {
    const now = new Date().toISOString();

    await db.writeTransaction(async (tx) => {
      // Soft-delete flashcards for this definition
      await tx.execute(
        `UPDATE flashcards SET deleted_at = ?, updated_at = ?, version = version + 1
         WHERE definition_id = ? AND deleted_at IS NULL`,
        [now, now, definitionId]
      );

      // Soft-delete the definition
      await tx.execute(
        `UPDATE definitions SET deleted_at = ?, updated_at = ?, version = version + 1
         WHERE id = ? AND deleted_at IS NULL`,
        [now, now, definitionId]
      );
    });
  }

  // -------------------------------------------------------------------------
  // Tag Management for Words
  // -------------------------------------------------------------------------

  /** Adds a tag to a word. Idempotent — ignores if already associated. */
  async function addTagToWord(wordId: string, tagId: string): Promise<void> {
    await db.execute(
      `INSERT OR IGNORE INTO word_tags (word_id, tag_id) VALUES (?, ?)`,
      [wordId, tagId]
    );
  }

  /** Removes a tag from a word. */
  async function removeTagFromWord(
    wordId: string,
    tagId: string
  ): Promise<void> {
    await db.execute(
      `DELETE FROM word_tags WHERE word_id = ? AND tag_id = ?`,
      [wordId, tagId]
    );
  }

  /** Replaces all tags for a word. */
  async function setWordTags(
    wordId: string,
    tagIds: string[]
  ): Promise<void> {
    await db.writeTransaction(async (tx) => {
      await tx.execute(`DELETE FROM word_tags WHERE word_id = ?`, [wordId]);
      for (const tagId of tagIds) {
        await tx.execute(
          `INSERT INTO word_tags (word_id, tag_id) VALUES (?, ?)`,
          [wordId, tagId]
        );
      }
    });
  }

  // -------------------------------------------------------------------------
  // Read Operations (local SQLite queries)
  // -------------------------------------------------------------------------

  /** Get a single word with all its definitions, examples, and tags. */
  async function getWordWithDetails(wordId: string) {
    const word = await db.getOptional<{
      id: string;
      word: string;
      normalized_word: string;
      phonetics: string | null;
      audio_url: string | null;
      created_by: string | null;
      created_at: string;
      updated_at: string;
      version: number;
    }>(
      `SELECT id, word, normalized_word, phonetics, audio_url, created_by, created_at, updated_at, version
       FROM words WHERE id = ? AND deleted_at IS NULL`,
      [wordId]
    );

    if (!word) return null;

    const definitions = await db.getAll<{
      id: string;
      meaning: string;
      part_of_speech: string;
      tiptap_note: string | null;
      requested_ai_example_count: number;
      created_by: string | null;
      created_at: string;
      updated_at: string;
      version: number;
    }>(
      `SELECT id, meaning, part_of_speech, tiptap_note, requested_ai_example_count, created_by, created_at, updated_at, version
       FROM definitions WHERE word_id = ? AND deleted_at IS NULL
       ORDER BY created_at ASC`,
      [wordId]
    );

    const tags = await db.getAll<{
      id: string;
      name: string;
      color: string | null;
    }>(
      `SELECT t.id, t.name, t.color
       FROM tags t
       JOIN word_tags wt ON wt.tag_id = t.id
       WHERE wt.word_id = ? AND t.deleted_at IS NULL`,
      [wordId]
    );

    // Get examples for each definition
    const definitionsWithExamples = await Promise.all(
      definitions.map(async (def) => {
        const examples = await db.getAll<{
          id: string;
          sentence: string;
          is_ai_generated: number;
          created_at: string;
        }>(
          `SELECT id, sentence, is_ai_generated, created_at
           FROM examples WHERE definition_id = ? AND deleted_at IS NULL
           ORDER BY created_at ASC`,
          [def.id]
        );

        return {
          ...def,
          tiptap_note: def.tiptap_note
            ? JSON.parse(def.tiptap_note)
            : null,
          examples: examples.map((e) => ({
            ...e,
            is_ai_generated: Boolean(e.is_ai_generated),
          })),
        };
      })
    );

    return {
      ...word,
      definitions: definitionsWithExamples,
      tags,
    };
  }

  return {
    checkDuplicateWord,
    createWordWithDefinitions,
    updateWord,
    softDeleteWord,
    addDefinition,
    updateDefinition,
    softDeleteDefinition,
    addTagToWord,
    removeTagFromWord,
    setWordTags,
    getWordWithDetails,
  };
}

// ---------------------------------------------------------------------------
// Custom Errors
// ---------------------------------------------------------------------------

export class DuplicateWordError extends Error {
  constructor(
    public readonly attemptedWord: string,
    public readonly existingId: string,
    public readonly existingWord: string
  ) {
    super(
      `A word with the same spelling already exists: "${existingWord}"`
    );
    this.name = "DuplicateWordError";
  }
}
