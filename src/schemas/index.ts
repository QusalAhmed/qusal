// =============================================================================
// Zod Validation Schemas
// =============================================================================
// Runtime validation for all domain entities.
//
// Architecture:
//   - "Entity schemas" (e.g., tagSchema) validate complete database records.
//   - "Mutation schemas" (e.g., createTagSchema) validate untrusted user input.
//   - "Update schemas" (e.g., updateTagSchema) validate partial updates.
//   - Enum schemas mirror the TypeScript const arrays in types/index.ts.
//
// These schemas are the SINGLE SOURCE OF TRUTH for validation.
// TypeScript types provide compile-time safety; Zod provides runtime safety.
//
// NOTE: Uses Zod 4 API (z.uuid(), z.iso.datetime(), etc.)
// =============================================================================

import { z } from "zod";

// ---------------------------------------------------------------------------
// Enum Schemas
// ---------------------------------------------------------------------------

export const appRoleSchema = z.enum(["ADMIN", "CONTRIBUTOR"]);

export const quizModeSchema = z.enum([
  "WORD_TO_MEANING",
  "MEANING_TO_WORD",
  "MEANING_TO_SPELLING",
]);

export const cardStateSchema = z.enum([
  "New",
  "Learning",
  "Review",
  "Relearning",
]);

export const partOfSpeechSchema = z.enum([
  "noun",
  "verb",
  "adjective",
  "adverb",
  "preposition",
  "conjunction",
  "interjection",
  "pronoun",
  "determiner",
  "particle",
  "other",
]);

// ---------------------------------------------------------------------------
// Shared Validators (Zod 4 top-level format validators)
// ---------------------------------------------------------------------------

/** UUID v4 format validator */
const uuidSchema = z.uuid();

/** ISO 8601 datetime string */
const timestampSchema = z.iso.datetime({ offset: true });

/** Positive integer (for version, counts, etc.) */
const positiveIntSchema = z.number().int().positive();

/** Non-negative integer */
const nonNegativeIntSchema = z.number().int().nonnegative();

// ---------------------------------------------------------------------------
// Profile Schemas
// ---------------------------------------------------------------------------

export const profileSchema = z.object({
  id: uuidSchema,
  role: appRoleSchema,
  created_at: timestampSchema,
  updated_at: timestampSchema,
});

// ---------------------------------------------------------------------------
// Tag Schemas
// ---------------------------------------------------------------------------

export const tagSchema = z.object({
  id: uuidSchema,
  name: z.string().min(1).max(100),
  normalized_name: z.string().min(1).max(100),
  color: z.string().max(30).nullable(),
  created_at: timestampSchema,
  updated_at: timestampSchema,
  deleted_at: timestampSchema.nullable(),
  version: positiveIntSchema,
});

/** Validates user input when creating a tag. Server computes normalized_name. */
export const createTagSchema = z.object({
  name: z
    .string()
    .min(1, "Tag name is required")
    .max(100, "Tag name must be 100 characters or fewer")
    .trim(),
  color: z.string().max(30).nullable().optional(),
});

/** Validates user input when updating a tag. All fields optional. */
export const updateTagSchema = z.object({
  name: z
    .string()
    .min(1, "Tag name is required")
    .max(100, "Tag name must be 100 characters or fewer")
    .trim()
    .optional(),
  color: z.string().max(30).nullable().optional(),
});

// ---------------------------------------------------------------------------
// Word Schemas
// ---------------------------------------------------------------------------

export const wordSchema = z.object({
  id: uuidSchema,
  word: z.string().min(1).max(200),
  normalized_word: z.string().min(1).max(200),
  phonetics: z.string().max(200).nullable(),
  audio_url: z.url().nullable(),
  created_by: uuidSchema.nullable(),
  created_at: timestampSchema,
  updated_at: timestampSchema,
  deleted_at: timestampSchema.nullable(),
  version: positiveIntSchema,
});

/** Validates user input when creating a word. Server computes normalized_word. */
export const createWordSchema = z.object({
  word: z
    .string()
    .min(1, "Word is required")
    .max(200, "Word must be 200 characters or fewer")
    .trim(),
  phonetics: z.string().max(200).nullable().optional(),
  audio_url: z.url("Must be a valid URL").nullable().optional(),
});

/** Validates user input when updating a word. All fields optional. */
export const updateWordSchema = z.object({
  word: z
    .string()
    .min(1, "Word is required")
    .max(200, "Word must be 200 characters or fewer")
    .trim()
    .optional(),
  phonetics: z.string().max(200).nullable().optional(),
  audio_url: z.url("Must be a valid URL").nullable().optional(),
});

// ---------------------------------------------------------------------------
// Word Tag Schema
// ---------------------------------------------------------------------------

export const wordTagSchema = z.object({
  word_id: uuidSchema,
  tag_id: uuidSchema,
});

// ---------------------------------------------------------------------------
// Definition Schemas
// ---------------------------------------------------------------------------

export const definitionSchema = z.object({
  id: uuidSchema,
  word_id: uuidSchema,
  meaning: z.string().min(1),
  part_of_speech: partOfSpeechSchema,
  tiptap_note: z.unknown().nullable(),
  requested_ai_example_count: nonNegativeIntSchema,
  created_by: uuidSchema.nullable(),
  created_at: timestampSchema,
  updated_at: timestampSchema,
  deleted_at: timestampSchema.nullable(),
  version: positiveIntSchema,
});

/**
 * Validates user input when creating a definition.
 * word_id is provided separately (from the parent word context).
 */
export const createDefinitionSchema = z.object({
  meaning: z
    .string()
    .min(1, "Definition meaning is required")
    .max(2000, "Meaning must be 2000 characters or fewer")
    .trim(),
  part_of_speech: partOfSpeechSchema,
  tiptap_note: z.unknown().nullable().optional(),
  requested_ai_example_count: z
    .number()
    .int()
    .min(0, "Count must be 0 or more")
    .max(10, "Maximum 10 AI examples per definition")
    .default(0),
});

/** Validates user input when updating a definition. */
export const updateDefinitionSchema = z.object({
  meaning: z
    .string()
    .min(1, "Definition meaning is required")
    .max(2000, "Meaning must be 2000 characters or fewer")
    .trim()
    .optional(),
  part_of_speech: partOfSpeechSchema.optional(),
  tiptap_note: z.unknown().nullable().optional(),
  requested_ai_example_count: z
    .number()
    .int()
    .min(0)
    .max(10)
    .optional(),
});

// ---------------------------------------------------------------------------
// Example Schemas
// ---------------------------------------------------------------------------

export const exampleSchema = z.object({
  id: uuidSchema,
  definition_id: uuidSchema,
  sentence: z.string().min(1),
  is_ai_generated: z.boolean(),
  created_at: timestampSchema,
  updated_at: timestampSchema,
  deleted_at: timestampSchema.nullable(),
  version: positiveIntSchema,
});

/** Validates user input when creating an example sentence. */
export const createExampleSchema = z.object({
  sentence: z
    .string()
    .min(1, "Example sentence is required")
    .max(1000, "Sentence must be 1000 characters or fewer")
    .trim(),
  is_ai_generated: z.boolean().default(false),
});

/** Validates AI-generated example sentences from the AI pipeline. */
export const aiExampleResponseSchema = z.array(z.string().min(1).max(1000));

/**
 * Creates a validator for the AI response that enforces an exact count.
 * Used in Phase 4 to validate LLM output matches requested_ai_example_count.
 */
export function createAiExampleResponseValidator(
  count: number
): z.ZodType<string[]> {
  return z.array(z.string().min(1).max(1000)).length(count);
}

// ---------------------------------------------------------------------------
// Flashcard Schemas
// ---------------------------------------------------------------------------

export const flashcardSchema = z.object({
  id: uuidSchema,
  definition_id: uuidSchema,
  quiz_mode: quizModeSchema,
  is_active: z.boolean(),
  created_at: timestampSchema,
  updated_at: timestampSchema,
  deleted_at: timestampSchema.nullable(),
  version: positiveIntSchema,
});

// ---------------------------------------------------------------------------
// User Flashcard State Schemas
// ---------------------------------------------------------------------------

export const userFlashcardStateSchema = z.object({
  user_id: uuidSchema,
  flashcard_id: uuidSchema,
  due_date: timestampSchema,
  stability: z.number().nonnegative(),
  difficulty: z.number().nonnegative(),
  elapsed_days: z.number().nonnegative(),
  scheduled_days: z.number().nonnegative(),
  reps: nonNegativeIntSchema,
  lapses: nonNegativeIntSchema,
  state: cardStateSchema,
  created_at: timestampSchema,
  updated_at: timestampSchema,
  version: positiveIntSchema,
});

/**
 * Validates the grading input when a user rates a flashcard.
 * The FSRS rating values are: 1=Again, 2=Hard, 3=Good, 4=Easy
 */
export const gradeFlashcardSchema = z.object({
  flashcard_id: uuidSchema,
  rating: z.number().int().min(1).max(4),
  review_duration_ms: z.number().int().nonnegative().optional(),
});

// ---------------------------------------------------------------------------
// Review Log Schemas
// ---------------------------------------------------------------------------

export const reviewLogSchema = z.object({
  id: uuidSchema,
  user_id: uuidSchema,
  flashcard_id: uuidSchema,
  rating: z.number().int().min(1).max(4),
  state: cardStateSchema,
  review_time: timestampSchema,
  previous_stability: z.number().nullable(),
  new_stability: z.number().nullable(),
  previous_difficulty: z.number().nullable(),
  new_difficulty: z.number().nullable(),
  review_duration_ms: z.number().int().nonnegative().nullable(),
  created_at: timestampSchema,
});

// ---------------------------------------------------------------------------
// Environment Variable Schema
// ---------------------------------------------------------------------------

export const envSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.url("NEXT_PUBLIC_SUPABASE_URL must be a valid URL"),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1, "NEXT_PUBLIC_SUPABASE_ANON_KEY is required"),
  NEXT_PUBLIC_POWERSYNC_URL: z.url("NEXT_PUBLIC_POWERSYNC_URL must be a valid URL"),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1, "SUPABASE_SERVICE_ROLE_KEY is required").optional(),
});

/**
 * Public env schema — only variables safe for the browser.
 * Server-only secrets are excluded.
 */
export const publicEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.url("NEXT_PUBLIC_SUPABASE_URL must be a valid URL"),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1, "NEXT_PUBLIC_SUPABASE_ANON_KEY is required"),
  NEXT_PUBLIC_POWERSYNC_URL: z.url("NEXT_PUBLIC_POWERSYNC_URL must be a valid URL"),
});

// ---------------------------------------------------------------------------
// Normalization Utilities
// ---------------------------------------------------------------------------

/**
 * Normalizes a word for duplicate detection.
 * Used both client-side (for optimistic checks) and server-side.
 */
export function normalizeWord(word: string): string {
  return word.trim().toLowerCase();
}

/**
 * Normalizes a tag name for duplicate detection.
 */
export function normalizeTagName(name: string): string {
  return name.trim().toLowerCase();
}

// ---------------------------------------------------------------------------
// Type Exports (inferred from schemas)
// ---------------------------------------------------------------------------

export type CreateTagInput = z.infer<typeof createTagSchema>;
export type UpdateTagInput = z.infer<typeof updateTagSchema>;
export type CreateWordInput = z.infer<typeof createWordSchema>;
export type UpdateWordInput = z.infer<typeof updateWordSchema>;
export type CreateDefinitionInput = z.infer<typeof createDefinitionSchema>;
export type UpdateDefinitionInput = z.infer<typeof updateDefinitionSchema>;
export type CreateExampleInput = z.infer<typeof createExampleSchema>;
export type GradeFlashcardInput = z.infer<typeof gradeFlashcardSchema>;
export type WordTagInput = z.infer<typeof wordTagSchema>;
