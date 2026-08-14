// =============================================================================
// PowerSync Client-Side Schema (AppSchema)
// =============================================================================
// Defines the local SQLite schema that PowerSync uses on the client.
//
// Key rules:
//   - PowerSync only supports 3 column types: text, integer, real.
//   - UUIDs, timestamps, enums, and JSON are stored as `text`.
//   - Booleans are stored as `integer` (0 or 1).
//   - The `id` column is implicit — do NOT declare it.
//   - This schema is a "view" on top of PowerSync's schemaless sync protocol.
//     Updating it does not require SQL migrations.
//
// Tables here mirror the PostgreSQL tables from the Supabase migration.
// Column names must match exactly for sync to work correctly.
// =============================================================================

import { Schema, Table, column } from "@powersync/web";

/**
 * words table — global vocabulary entries.
 * normalized_word is used for client-side duplicate detection.
 */
const words = new Table({
  word: column.text,
  normalized_word: column.text,
  phonetics: column.text,
  audio_url: column.text,
  created_by: column.text,
  created_at: column.text,
  updated_at: column.text,
  deleted_at: column.text,
  version: column.integer,
});

/**
 * tags table — global vocabulary tags.
 * normalized_name is used for duplicate detection.
 */
const tags = new Table({
  name: column.text,
  normalized_name: column.text,
  color: column.text,
  created_at: column.text,
  updated_at: column.text,
  deleted_at: column.text,
  version: column.integer,
});

/**
 * word_tags junction table.
 * Note: PowerSync requires an `id` column (auto-generated).
 * For composite-PK tables synced via PowerSync, we store
 * word_id and tag_id as regular columns. The implicit `id`
 * is used internally by PowerSync for tracking.
 */
const word_tags = new Table({
  word_id: column.text,
  tag_id: column.text,
});

/**
 * definitions table — word definitions with optional Tiptap notes.
 * tiptap_note is stored as text (serialized JSON).
 */
const definitions = new Table({
  word_id: column.text,
  meaning: column.text,
  part_of_speech: column.text,
  tiptap_note: column.text,
  requested_ai_example_count: column.integer,
  created_by: column.text,
  created_at: column.text,
  updated_at: column.text,
  deleted_at: column.text,
  version: column.integer,
});

/**
 * examples table — example sentences for definitions.
 * is_ai_generated stored as integer (0 = false, 1 = true).
 */
const examples = new Table({
  definition_id: column.text,
  sentence: column.text,
  is_ai_generated: column.integer,
  created_at: column.text,
  updated_at: column.text,
  deleted_at: column.text,
  version: column.integer,
});

/**
 * flashcards table — global quiz definitions (NOT user progress).
 * One per (definition_id, quiz_mode) combination.
 * is_active stored as integer (0 = false, 1 = true).
 */
const flashcards = new Table({
  definition_id: column.text,
  quiz_mode: column.text,
  is_active: column.integer,
  created_at: column.text,
  updated_at: column.text,
  deleted_at: column.text,
  version: column.integer,
});

/**
 * user_flashcard_states table — per-user FSRS scheduling state.
 * User-scoped: synced only for the authenticated user.
 * stability and difficulty are real (floating point) for FSRS precision.
 */
const user_flashcard_states = new Table({
  user_id: column.text,
  flashcard_id: column.text,
  due_date: column.text,
  stability: column.real,
  difficulty: column.real,
  elapsed_days: column.real,
  scheduled_days: column.real,
  reps: column.integer,
  lapses: column.integer,
  state: column.text,
  created_at: column.text,
  updated_at: column.text,
  version: column.integer,
});

/**
 * review_logs table — per-user FSRS review history.
 * User-scoped: synced only for the authenticated user.
 * Append-only (no updates or deletes expected).
 */
const review_logs = new Table({
  user_id: column.text,
  flashcard_id: column.text,
  rating: column.integer,
  state: column.text,
  review_time: column.text,
  previous_stability: column.real,
  new_stability: column.real,
  previous_difficulty: column.real,
  new_difficulty: column.real,
  review_duration_ms: column.integer,
  created_at: column.text,
});

// ---------------------------------------------------------------------------
// Export the complete schema
// ---------------------------------------------------------------------------

export const AppSchema = new Schema({
  words,
  tags,
  word_tags,
  definitions,
  examples,
  flashcards,
  user_flashcard_states,
  review_logs,
});

/**
 * Type helper: extracts the database type from the schema.
 * Used by PowerSync hooks and queries for type-safe database access.
 */
export type AppDatabase = (typeof AppSchema)["types"];
