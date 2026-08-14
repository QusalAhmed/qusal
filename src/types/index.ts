// =============================================================================
// Domain Types
// =============================================================================
// TypeScript interfaces mirroring the PostgreSQL schema.
// These provide compile-time safety. Runtime validation uses Zod (see schemas/).
//
// Convention:
//   - Enum-like values use `as const` arrays with derived union types.
//   - Interfaces match database column names exactly (snake_case).
//   - Optional fields (nullable in DB) use `| null`.
// =============================================================================

// ---------------------------------------------------------------------------
// Enums (as const for runtime access + type safety)
// ---------------------------------------------------------------------------

export const APP_ROLES = ["ADMIN", "CONTRIBUTOR"] as const;
export type AppRole = (typeof APP_ROLES)[number];

export const QUIZ_MODES = [
  "WORD_TO_MEANING",
  "MEANING_TO_WORD",
  "MEANING_TO_SPELLING",
] as const;
export type QuizMode = (typeof QUIZ_MODES)[number];

export const CARD_STATES = ["New", "Learning", "Review", "Relearning"] as const;
export type CardState = (typeof CARD_STATES)[number];

export const PARTS_OF_SPEECH = [
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
] as const;
export type PartOfSpeech = (typeof PARTS_OF_SPEECH)[number];

// ---------------------------------------------------------------------------
// Entity Interfaces
// ---------------------------------------------------------------------------

export interface Profile {
  id: string;
  role: AppRole;
  created_at: string;
  updated_at: string;
}

export interface Tag {
  id: string;
  name: string;
  normalized_name: string;
  color: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  version: number;
}

export interface Word {
  id: string;
  word: string;
  normalized_word: string;
  phonetics: string | null;
  audio_url: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  version: number;
}

export interface WordTag {
  word_id: string;
  tag_id: string;
}

export interface Definition {
  id: string;
  word_id: string;
  meaning: string;
  part_of_speech: PartOfSpeech;
  tiptap_note: unknown | null;
  requested_ai_example_count: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  version: number;
}

export interface Example {
  id: string;
  definition_id: string;
  sentence: string;
  is_ai_generated: boolean;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  version: number;
}

export interface Flashcard {
  id: string;
  definition_id: string;
  quiz_mode: QuizMode;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  version: number;
}

export interface UserFlashcardState {
  user_id: string;
  flashcard_id: string;
  due_date: string;
  stability: number;
  difficulty: number;
  elapsed_days: number;
  scheduled_days: number;
  reps: number;
  lapses: number;
  state: CardState;
  created_at: string;
  updated_at: string;
  version: number;
}

export interface ReviewLog {
  id: string;
  user_id: string;
  flashcard_id: string;
  rating: number;
  state: CardState;
  review_time: string;
  previous_stability: number | null;
  new_stability: number | null;
  previous_difficulty: number | null;
  new_difficulty: number | null;
  review_duration_ms: number | null;
  created_at: string;
}
