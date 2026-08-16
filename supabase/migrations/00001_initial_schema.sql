-- =============================================================================
-- Phase 1: Initial Database Schema
-- =============================================================================
-- This migration creates the complete database schema for the vocabulary PWA.
--
-- CONFLICT RESOLUTION STRATEGY:
--   1. Every mutable entity has a `version` column (integer, starts at 1).
--   2. Updates use optimistic concurrency: UPDATE ... WHERE version = expected.
--      If the version does not match, the update fails and the client re-fetches.
--   3. UUIDs are used for all primary keys, providing stable identity across
--      offline clients — two clients creating the same logical entity offline
--      will produce distinct UUIDs that sync independently.
--   4. UNIQUE constraints (normalized_word, normalized_name, definition+quiz_mode)
--      cause duplicate inserts to fail at the database level. The upload handler
--      uses ON CONFLICT to handle these idempotently.
--   5. Soft deletes via `deleted_at` propagate through PowerSync sync streams.
--      Tombstones are preserved until all clients have received the deletion.
--   6. User-specific data (user_flashcard_states, review_logs) is keyed by
--      user_id and can never conflict with another user's data.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Extensions
-- ---------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ---------------------------------------------------------------------------
-- 2. Custom Enum Types
-- ---------------------------------------------------------------------------
CREATE TYPE public.app_role AS ENUM ('ADMIN', 'CONTRIBUTOR');

CREATE TYPE public.quiz_mode AS ENUM (
  'WORD_TO_MEANING',
  'MEANING_TO_WORD',
  'MEANING_TO_SPELLING'
);

CREATE TYPE public.card_state AS ENUM (
  'New',
  'Learning',
  'Review',
  'Relearning'
);

CREATE TYPE public.part_of_speech AS ENUM (
  'noun',
  'verb',
  'adjective',
  'adverb',
  'preposition',
  'conjunction',
  'interjection',
  'pronoun',
  'determiner',
  'particle',
  'other'
);

-- ---------------------------------------------------------------------------
-- 3. Tables
-- ---------------------------------------------------------------------------

-- 3.1 Profiles
-- References auth.users(id). No soft delete — tied to auth lifecycle.
CREATE TABLE public.profiles (
  id         UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role       public.app_role NOT NULL DEFAULT 'CONTRIBUTOR',
  created_at TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.profiles IS 'Public user profiles linked to auth.users. Role determines application-level permissions.';

-- 3.2 Tags
CREATE TABLE public.tags (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name            TEXT        NOT NULL,
  normalized_name TEXT        NOT NULL,
  color           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at      TIMESTAMPTZ,
  version         INTEGER     NOT NULL DEFAULT 1,

  CONSTRAINT tags_normalized_name_unique UNIQUE (normalized_name)
);

COMMENT ON TABLE public.tags IS 'Global vocabulary tags. normalized_name is LOWER(TRIM(name)) for duplicate detection.';

-- 3.3 Words
CREATE TABLE public.words (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  word            TEXT        NOT NULL,
  normalized_word TEXT        NOT NULL,
  phonetics       TEXT,
  audio_url       TEXT,
  created_by      UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at      TIMESTAMPTZ,
  version         INTEGER     NOT NULL DEFAULT 1,

  CONSTRAINT words_normalized_word_unique UNIQUE (normalized_word)
);

COMMENT ON TABLE public.words IS 'Global vocabulary words. normalized_word is LOWER(TRIM(word)) for case-insensitive duplicate detection.';

-- 3.4 Word Tags (junction)
CREATE TABLE public.word_tags (
  word_id UUID NOT NULL REFERENCES public.words(id) ON DELETE CASCADE,
  tag_id  UUID NOT NULL REFERENCES public.tags(id)  ON DELETE CASCADE,

  PRIMARY KEY (word_id, tag_id)
);

COMMENT ON TABLE public.word_tags IS 'Many-to-many junction between words and tags.';

-- 3.5 Definitions
CREATE TABLE public.definitions (
  id                         UUID               PRIMARY KEY DEFAULT gen_random_uuid(),
  word_id                    UUID               NOT NULL REFERENCES public.words(id) ON DELETE CASCADE,
  meaning                    TEXT               NOT NULL,
  part_of_speech             public.part_of_speech NOT NULL,
  tiptap_note                JSONB,
  requested_ai_example_count INTEGER            NOT NULL DEFAULT 0,
  created_by                 UUID               REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at                 TIMESTAMPTZ        NOT NULL DEFAULT NOW(),
  updated_at                 TIMESTAMPTZ        NOT NULL DEFAULT NOW(),
  deleted_at                 TIMESTAMPTZ,
  version                    INTEGER            NOT NULL DEFAULT 1
);

COMMENT ON TABLE public.definitions IS 'Word definitions with optional rich-text notes and AI example configuration.';

-- 3.6 Examples
CREATE TABLE public.examples (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  definition_id   UUID        NOT NULL REFERENCES public.definitions(id) ON DELETE CASCADE,
  sentence        TEXT        NOT NULL,
  is_ai_generated BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at      TIMESTAMPTZ,
  version         INTEGER     NOT NULL DEFAULT 1
);

COMMENT ON TABLE public.examples IS 'Example sentences for definitions. May be human-authored or AI-generated.';

-- 3.7 Flashcards (global quiz definitions, NOT user progress)
CREATE TABLE public.flashcards (
  id            UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
  definition_id UUID            NOT NULL REFERENCES public.definitions(id) ON DELETE CASCADE,
  quiz_mode     public.quiz_mode NOT NULL,
  is_active     BOOLEAN         NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
  deleted_at    TIMESTAMPTZ,
  version       INTEGER         NOT NULL DEFAULT 1,

  CONSTRAINT flashcards_definition_quiz_unique UNIQUE (definition_id, quiz_mode)
);

COMMENT ON TABLE public.flashcards IS 'Global flashcard definitions. Each definition has one flashcard per quiz_mode. Does NOT contain user progress.';

-- 3.8 User Flashcard States (per-user FSRS state)
CREATE TABLE public.user_flashcard_states (
  user_id        UUID             NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  flashcard_id   UUID             NOT NULL REFERENCES public.flashcards(id) ON DELETE CASCADE,
  due_date       TIMESTAMPTZ      NOT NULL DEFAULT NOW(),
  stability      REAL             NOT NULL DEFAULT 0,
  difficulty     REAL             NOT NULL DEFAULT 0,
  elapsed_days   REAL             NOT NULL DEFAULT 0,
  scheduled_days REAL             NOT NULL DEFAULT 0,
  reps           INTEGER          NOT NULL DEFAULT 0,
  lapses         INTEGER          NOT NULL DEFAULT 0,
  state          public.card_state NOT NULL DEFAULT 'New',
  created_at     TIMESTAMPTZ      NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ      NOT NULL DEFAULT NOW(),
  version        INTEGER          NOT NULL DEFAULT 1,

  PRIMARY KEY (user_id, flashcard_id)
);

COMMENT ON TABLE public.user_flashcard_states IS 'Per-user FSRS scheduling state. Each user has at most one state per flashcard. Never shared between users.';

-- 3.9 Review Logs (per-user review history)
CREATE TABLE public.review_logs (
  id                   UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id              UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  flashcard_id         UUID        NOT NULL REFERENCES public.flashcards(id) ON DELETE CASCADE,
  rating               INTEGER     NOT NULL,
  state                public.card_state NOT NULL,
  review_time          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  previous_stability   REAL,
  new_stability        REAL,
  previous_difficulty  REAL,
  new_difficulty       REAL,
  review_duration_ms   INTEGER,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.review_logs IS 'Immutable per-user review history. Records every FSRS grading event for analytics and audit.';

-- ---------------------------------------------------------------------------
-- 4. Indexes
-- ---------------------------------------------------------------------------

-- Words
CREATE INDEX idx_words_deleted    ON public.words (deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX idx_words_created_by ON public.words (created_by);

-- Tags
CREATE INDEX idx_tags_deleted    ON public.tags (deleted_at) WHERE deleted_at IS NULL;

-- Word Tags (reverse lookup)
CREATE INDEX idx_word_tags_tag ON public.word_tags (tag_id);

-- Definitions
CREATE INDEX idx_definitions_word_id ON public.definitions (word_id);
CREATE INDEX idx_definitions_deleted ON public.definitions (deleted_at) WHERE deleted_at IS NULL;

-- Examples
CREATE INDEX idx_examples_definition_id ON public.examples (definition_id);
CREATE INDEX idx_examples_deleted       ON public.examples (deleted_at) WHERE deleted_at IS NULL;

-- Flashcards
CREATE INDEX idx_flashcards_definition_id ON public.flashcards (definition_id);
CREATE INDEX idx_flashcards_deleted       ON public.flashcards (deleted_at) WHERE deleted_at IS NULL;

-- User Flashcard States
CREATE INDEX idx_ufs_user_id  ON public.user_flashcard_states (user_id);
CREATE INDEX idx_ufs_due_date ON public.user_flashcard_states (user_id, due_date);

-- Review Logs
CREATE INDEX idx_review_logs_user      ON public.review_logs (user_id, flashcard_id);
CREATE INDEX idx_review_logs_timestamp ON public.review_logs (user_id, review_time);

-- ---------------------------------------------------------------------------
-- 5. Helper Functions
-- ---------------------------------------------------------------------------

-- Returns the role of the currently authenticated user.
-- Used by RLS policies to check admin/contributor status.
-- This function intentionally has no UUID argument so callers cannot use it
-- to probe another user's role.
CREATE OR REPLACE FUNCTION public.get_current_user_role()
RETURNS public.app_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT role
  FROM public.profiles
  WHERE id = (SELECT auth.uid());
$$;

-- This helper is used internally by authenticated RLS policies.
-- It is intentionally callable only by authenticated clients.
REVOKE EXECUTE ON FUNCTION public.get_current_user_role() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_current_user_role() FROM anon;
GRANT EXECUTE ON FUNCTION public.get_current_user_role() TO authenticated;

-- Trigger function: auto-create a profiles row when a new auth.users row is inserted.
-- Defaults to CONTRIBUTOR role. The first admin must be promoted manually.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, role, created_at, updated_at)
  VALUES (NEW.id, 'CONTRIBUTOR', NOW(), NOW())
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

-- Trigger function: auto-create flashcards for each quiz_mode when a definition is inserted.
-- This ensures every definition automatically has its 3 flashcard types.
-- Uses ON CONFLICT to be idempotent if re-triggered.
CREATE OR REPLACE FUNCTION public.auto_create_flashcards()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.flashcards (id, definition_id, quiz_mode, is_active, created_at, updated_at, version)
  VALUES
    (gen_random_uuid(), NEW.id, 'WORD_TO_MEANING',    TRUE, NOW(), NOW(), 1),
    (gen_random_uuid(), NEW.id, 'MEANING_TO_WORD',     TRUE, NOW(), NOW(), 1),
    (gen_random_uuid(), NEW.id, 'MEANING_TO_SPELLING', TRUE, NOW(), NOW(), 1)
  ON CONFLICT (definition_id, quiz_mode) DO NOTHING;
  RETURN NEW;
END;
$$;

-- ---------------------------------------------------------------------------
-- 6. Triggers
-- ---------------------------------------------------------------------------

-- Auto-create profile when a new auth user is created
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Auto-create flashcards when a definition is inserted
CREATE TRIGGER on_definition_created
  AFTER INSERT ON public.definitions
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_create_flashcards();

-- ---------------------------------------------------------------------------
-- 7. Row Level Security
-- ---------------------------------------------------------------------------

-- Enable RLS on all tables
ALTER TABLE public.profiles              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tags                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.words                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.word_tags             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.definitions           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.examples              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.flashcards            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_flashcard_states ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.review_logs           ENABLE ROW LEVEL SECURITY;

-- ---- PROFILES ----

-- Authenticated users can read their own profile
CREATE POLICY profiles_select_own
  ON public.profiles FOR SELECT
  TO authenticated
  USING (id = (SELECT auth.uid()));

-- Profiles are intentionally not directly updateable by normal clients.
-- Role changes are handled by secure server-side admin operations.

-- Admins can read all profiles (for user management)
CREATE POLICY profiles_select_admin
  ON public.profiles FOR SELECT
  TO authenticated
  USING ((SELECT public.get_current_user_role()) = 'ADMIN');

-- ---- TAGS ----

-- Anyone can read active tags
CREATE POLICY tags_select_anon
  ON public.tags FOR SELECT
  TO anon
  USING (deleted_at IS NULL);

CREATE POLICY tags_select_authenticated
  ON public.tags FOR SELECT
  TO authenticated
  USING (deleted_at IS NULL);

-- Authenticated users can create tags
CREATE POLICY tags_insert_authenticated
  ON public.tags FOR INSERT
  TO authenticated
  WITH CHECK (TRUE);

-- Authenticated users can update tags (including soft-delete via setting deleted_at)
CREATE POLICY tags_update_authenticated
  ON public.tags FOR UPDATE
  TO authenticated
  USING (TRUE)
  WITH CHECK (TRUE);

-- ---- WORDS ----

-- Anyone can read active words
CREATE POLICY words_select_anon
  ON public.words FOR SELECT
  TO anon
  USING (deleted_at IS NULL);

CREATE POLICY words_select_authenticated
  ON public.words FOR SELECT
  TO authenticated
  USING (deleted_at IS NULL);

-- Authenticated users can create words
CREATE POLICY words_insert_authenticated
  ON public.words FOR INSERT
  TO authenticated
  WITH CHECK (TRUE);

-- Authenticated users can update words
CREATE POLICY words_update_authenticated
  ON public.words FOR UPDATE
  TO authenticated
  USING (TRUE)
  WITH CHECK (TRUE);

-- ---- WORD TAGS ----

-- Anyone can read word tags
CREATE POLICY word_tags_select_anon
  ON public.word_tags FOR SELECT
  TO anon
  USING (TRUE);

CREATE POLICY word_tags_select_authenticated
  ON public.word_tags FOR SELECT
  TO authenticated
  USING (TRUE);

-- Authenticated users can create word-tag associations
CREATE POLICY word_tags_insert_authenticated
  ON public.word_tags FOR INSERT
  TO authenticated
  WITH CHECK (TRUE);

-- Authenticated users can delete word-tag associations
-- (This is a junction table — no soft delete needed)
CREATE POLICY word_tags_delete_authenticated
  ON public.word_tags FOR DELETE
  TO authenticated
  USING (TRUE);

-- ---- DEFINITIONS ----

-- Anyone can read active definitions
CREATE POLICY definitions_select_anon
  ON public.definitions FOR SELECT
  TO anon
  USING (deleted_at IS NULL);

CREATE POLICY definitions_select_authenticated
  ON public.definitions FOR SELECT
  TO authenticated
  USING (deleted_at IS NULL);

-- Authenticated users can create definitions
CREATE POLICY definitions_insert_authenticated
  ON public.definitions FOR INSERT
  TO authenticated
  WITH CHECK (TRUE);

-- Authenticated users can update definitions
CREATE POLICY definitions_update_authenticated
  ON public.definitions FOR UPDATE
  TO authenticated
  USING (TRUE)
  WITH CHECK (TRUE);

-- ---- EXAMPLES ----

-- Anyone can read active examples
CREATE POLICY examples_select_anon
  ON public.examples FOR SELECT
  TO anon
  USING (deleted_at IS NULL);

CREATE POLICY examples_select_authenticated
  ON public.examples FOR SELECT
  TO authenticated
  USING (deleted_at IS NULL);

-- Authenticated users can create examples
CREATE POLICY examples_insert_authenticated
  ON public.examples FOR INSERT
  TO authenticated
  WITH CHECK (TRUE);

-- Authenticated users can update examples
CREATE POLICY examples_update_authenticated
  ON public.examples FOR UPDATE
  TO authenticated
  USING (TRUE)
  WITH CHECK (TRUE);

-- ---- FLASHCARDS ----

-- Anyone can read active flashcards
CREATE POLICY flashcards_select_anon
  ON public.flashcards FOR SELECT
  TO anon
  USING (deleted_at IS NULL);

CREATE POLICY flashcards_select_authenticated
  ON public.flashcards FOR SELECT
  TO authenticated
  USING (deleted_at IS NULL);

-- Authenticated users can create flashcards
CREATE POLICY flashcards_insert_authenticated
  ON public.flashcards FOR INSERT
  TO authenticated
  WITH CHECK (TRUE);

-- Authenticated users can update flashcards
CREATE POLICY flashcards_update_authenticated
  ON public.flashcards FOR UPDATE
  TO authenticated
  USING (TRUE)
  WITH CHECK (TRUE);

-- ---- USER FLASHCARD STATES ----
-- Strictly user-scoped: each user can only access their own state

CREATE POLICY ufs_select_own
  ON public.user_flashcard_states FOR SELECT
  TO authenticated
  USING (user_id = (SELECT auth.uid()));

CREATE POLICY ufs_insert_own
  ON public.user_flashcard_states FOR INSERT
  TO authenticated
  WITH CHECK (user_id = (SELECT auth.uid()));

CREATE POLICY ufs_update_own
  ON public.user_flashcard_states FOR UPDATE
  TO authenticated
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));

-- ---- REVIEW LOGS ----
-- User-scoped, append-only (no UPDATE/DELETE)

CREATE POLICY review_logs_select_own
  ON public.review_logs FOR SELECT
  TO authenticated
  USING (user_id = (SELECT auth.uid()));

CREATE POLICY review_logs_insert_own
  ON public.review_logs FOR INSERT
  TO authenticated
  WITH CHECK (user_id = (SELECT auth.uid()));

-- ---------------------------------------------------------------------------
-- 7a. Data API Grants
-- ---------------------------------------------------------------------------
-- Explicit grants keep table/function reachability independent of Supabase
-- project-level default privilege settings. RLS still controls row access.

GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;

GRANT SELECT ON TABLE
  public.tags,
  public.words,
  public.word_tags,
  public.definitions,
  public.examples,
  public.flashcards
TO anon;

GRANT SELECT ON TABLE
  public.profiles,
  public.tags,
  public.words,
  public.word_tags,
  public.definitions,
  public.examples,
  public.flashcards,
  public.user_flashcard_states,
  public.review_logs
TO authenticated;

GRANT INSERT, UPDATE ON TABLE
  public.tags,
  public.words,
  public.word_tags,
  public.definitions,
  public.examples,
  public.flashcards,
  public.user_flashcard_states
TO authenticated;

GRANT INSERT ON TABLE
  public.review_logs
TO authenticated;

GRANT DELETE ON TABLE
  public.word_tags
TO authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE
  public.profiles,
  public.tags,
  public.words,
  public.word_tags,
  public.definitions,
  public.examples,
  public.flashcards,
  public.user_flashcard_states,
  public.review_logs
TO service_role;

-- ---------------------------------------------------------------------------
-- 8. Admin Verification Query
-- ---------------------------------------------------------------------------
-- After promoting the first admin, run this to confirm:
--
--   SELECT id, role, created_at
--   FROM public.profiles
--   WHERE role = 'ADMIN';
--
-- Expected: At least one row with role = 'ADMIN'.
-- If no rows are returned, no admin has been configured yet.
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- 9. First Admin Bootstrap Instructions
-- ---------------------------------------------------------------------------
-- 1. Create the initial auth user via the Supabase Dashboard
--    (Authentication → Users → Create User).
--
-- 2. The trigger will auto-create a profiles row with role = 'CONTRIBUTOR'.
--
-- 3. Promote that user to ADMIN:
--
--    UPDATE public.profiles
--    SET role = 'ADMIN', updated_at = NOW()
--    WHERE id = '<INITIAL_USER_UUID>';
--
-- 4. Verify:
--
--    SELECT id, role, created_at
--    FROM public.profiles
--    WHERE role = 'ADMIN';
--
-- 5. All subsequent users must be created through the Admin UI (Phase 2).
--
-- DO NOT:
--   - Hard-code admin UUIDs, emails, or passwords in migrations
--   - Auto-promote based on email, signup order, or absence of admins
--   - Use client-side logic to determine admin status
-- ---------------------------------------------------------------------------
