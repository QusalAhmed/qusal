"use client";

// =============================================================================
// FSRS Review Service
// =============================================================================
// Manages spaced repetition scheduling using the ts-fsrs library.
// All operations run against the local PowerSync SQLite database.
//
// Architecture:
//   - Flashcards are auto-created by a Supabase trigger when definitions are inserted.
//   - user_flashcard_states stores per-user FSRS scheduling state.
//   - review_logs stores immutable review history.
//   - This service bridges the PowerSync local DB ↔ ts-fsrs algorithm.
// =============================================================================

import {
  fsrs,
  createEmptyCard,
  Grades,
  Rating,
  State,
  type Card,
  type Grade,
  type RecordLogItem,
} from "ts-fsrs";

// ---------------------------------------------------------------------------
// PowerSync DB Interface (same pattern as vocabulary-service)
// ---------------------------------------------------------------------------

interface PowerSyncDB {
  execute(sql: string, params?: unknown[]): Promise<{ rowsAffected?: number }>;
  getOptional<T>(sql: string, params?: unknown[]): Promise<T | null | undefined>;
  getAll<T>(sql: string, params?: unknown[]): Promise<T[]>;
  writeTransaction<T>(callback: (tx: PowerSyncTx) => Promise<T>): Promise<T>;
}

interface PowerSyncTx {
  execute(sql: string, params?: unknown[]): Promise<{ rowsAffected?: number }>;
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** A flashcard enriched with word/definition context for display. */
export interface DueCard {
  flashcard_id: string;
  definition_id: string;
  quiz_mode: string;
  word: string;
  meaning: string;
  part_of_speech: string;
  phonetics: string | null;
  // Current FSRS state (null for new cards)
  state: string | null;
  due_date: string | null;
  stability: number | null;
  difficulty: number | null;
  reps: number | null;
  lapses: number | null;
  elapsed_days: number | null;
  scheduled_days: number | null;
}

/** Review session statistics. */
export interface ReviewStats {
  newCount: number;
  learningCount: number;
  reviewCount: number;
  totalDueCount: number;
  reviewedTodayCount: number;
}

/** Result from grading a card. */
export interface GradeResult {
  nextDueDate: string;
  nextState: string;
  interval: number;
  stability: number;
  difficulty: number;
}

// ---------------------------------------------------------------------------
// FSRS Instance (singleton per service)
// ---------------------------------------------------------------------------

const f = fsrs({
  request_retention: 0.9,
  maximum_interval: 365,
  enable_fuzz: true,
  enable_short_term: true,
});

// ---------------------------------------------------------------------------
// Service Factory
// ---------------------------------------------------------------------------

export function createReviewService(db: PowerSyncDB) {
  // -------------------------------------------------------------------------
  // Get Due Cards
  // -------------------------------------------------------------------------

  /**
   * Fetch all flashcards that are due for review for a given user.
   * Includes:
   *   - Cards with user_flashcard_states.due_date <= now
   *   - Cards with NO user_flashcard_states row (new/unseen cards)
   */
  async function getDueCards(userId: string): Promise<DueCard[]> {
    const now = new Date().toISOString();

    const rows = await db.getAll<DueCard>(
      `SELECT
         f.id AS flashcard_id,
         f.definition_id,
         f.quiz_mode,
         w.word,
         d.meaning,
         d.part_of_speech,
         w.phonetics,
         ufs.state,
         ufs.due_date,
         ufs.stability,
         ufs.difficulty,
         ufs.reps,
         ufs.lapses,
         ufs.elapsed_days,
         ufs.scheduled_days
       FROM flashcards f
       INNER JOIN definitions d ON d.id = f.definition_id AND d.deleted_at IS NULL
       INNER JOIN words w ON w.id = d.word_id AND w.deleted_at IS NULL
       LEFT JOIN user_flashcard_states ufs
         ON ufs.flashcard_id = f.id AND ufs.user_id = ?
       WHERE f.deleted_at IS NULL
         AND f.is_active = 1
         AND (ufs.due_date IS NULL OR ufs.due_date <= ?)
       ORDER BY
         CASE WHEN ufs.state IS NULL THEN 0
              WHEN ufs.state = 'Learning' THEN 1
              WHEN ufs.state = 'Relearning' THEN 2
              ELSE 3
         END,
         ufs.due_date ASC`,
      [userId, now]
    );

    return rows;
  }

  // -------------------------------------------------------------------------
  // Grade a Card
  // -------------------------------------------------------------------------

  /**
   * Grade a flashcard using the FSRS algorithm and persist the result.
   *
   * @param userId - The authenticated user's ID
   * @param flashcardId - The flashcard being reviewed
   * @param rating - 1=Again, 2=Hard, 3=Good, 4=Easy
   * @param durationMs - Optional review duration in milliseconds
   */
  async function gradeCard(
    userId: string,
    flashcardId: string,
    rating: number,
    durationMs?: number
  ): Promise<GradeResult> {
    const now = new Date();
    const grade = rating as Grade;

    // Fetch existing state (if any)
    const existing = await db.getOptional<{
      due_date: string;
      stability: number;
      difficulty: number;
      elapsed_days: number;
      scheduled_days: number;
      reps: number;
      lapses: number;
      state: string;
    }>(
      `SELECT due_date, stability, difficulty, elapsed_days, scheduled_days, reps, lapses, state
       FROM user_flashcard_states
       WHERE user_id = ? AND flashcard_id = ?`,
      [userId, flashcardId]
    );

    // Build the ts-fsrs Card object
    let card: Card;
    if (existing) {
      card = {
        due: new Date(existing.due_date),
        stability: existing.stability,
        difficulty: existing.difficulty,
        elapsed_days: existing.elapsed_days,
        scheduled_days: existing.scheduled_days,
        reps: existing.reps,
        lapses: existing.lapses,
        state: stateStringToEnum(existing.state),
        last_review: undefined,
        learning_steps: 0,
      };
    } else {
      card = createEmptyCard(now);
    }

    // Run FSRS algorithm
    const result: RecordLogItem = f.next(card, now, grade);
    const newCard = result.card;
    const log = result.log;

    const nextDueDate = newCard.due.toISOString();
    const newState = stateEnumToString(newCard.state);
    const nowStr = now.toISOString();

    // Persist in a transaction
    await db.writeTransaction(async (tx: PowerSyncTx) => {
      // Upsert user_flashcard_states
      if (existing) {
        await tx.execute(
          `UPDATE user_flashcard_states
           SET due_date = ?, stability = ?, difficulty = ?,
               elapsed_days = ?, scheduled_days = ?,
               reps = ?, lapses = ?, state = ?,
               updated_at = ?, version = version + 1
           WHERE user_id = ? AND flashcard_id = ?`,
          [
            nextDueDate,
            newCard.stability,
            newCard.difficulty,
            newCard.elapsed_days,
            newCard.scheduled_days,
            newCard.reps,
            newCard.lapses,
            newState,
            nowStr,
            userId,
            flashcardId,
          ]
        );
      } else {
        const stateId = crypto.randomUUID();
        await tx.execute(
          `INSERT INTO user_flashcard_states
           (id, user_id, flashcard_id, due_date, stability, difficulty,
            elapsed_days, scheduled_days, reps, lapses, state,
            created_at, updated_at, version)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
          [
            stateId,
            userId,
            flashcardId,
            nextDueDate,
            newCard.stability,
            newCard.difficulty,
            newCard.elapsed_days,
            newCard.scheduled_days,
            newCard.reps,
            newCard.lapses,
            newState,
            nowStr,
            nowStr,
          ]
        );
      }

      // Insert review log
      const logId = crypto.randomUUID();
      await tx.execute(
        `INSERT INTO review_logs
         (id, user_id, flashcard_id, rating, state, review_time,
          previous_stability, new_stability,
          previous_difficulty, new_difficulty,
          review_duration_ms, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          logId,
          userId,
          flashcardId,
          rating,
          newState,
          nowStr,
          log.stability ?? null,
          newCard.stability,
          log.difficulty ?? null,
          newCard.difficulty,
          durationMs ?? null,
          nowStr,
        ]
      );
    });

    return {
      nextDueDate,
      nextState: newState,
      interval: newCard.scheduled_days,
      stability: newCard.stability,
      difficulty: newCard.difficulty,
    };
  }

  // -------------------------------------------------------------------------
  // Preview Intervals (for rating buttons)
  // -------------------------------------------------------------------------

  /**
   * Get preview intervals for all 4 rating options.
   * Used to show "< 10m", "1d", "3d", "7d" on the rating buttons.
   */
  function previewIntervals(dueCard: DueCard): Record<number, string> {
    const now = new Date();

    let card: Card;
    if (dueCard.state && dueCard.due_date) {
      card = {
        due: new Date(dueCard.due_date),
        stability: dueCard.stability ?? 0,
        difficulty: dueCard.difficulty ?? 0,
        elapsed_days: dueCard.elapsed_days ?? 0,
        scheduled_days: dueCard.scheduled_days ?? 0,
        reps: dueCard.reps ?? 0,
        lapses: dueCard.lapses ?? 0,
        state: stateStringToEnum(dueCard.state),
        last_review: undefined,
        learning_steps: 0,
      };
    } else {
      card = createEmptyCard(now);
    }

    const preview = f.repeat(card, now);
    const result: Record<number, string> = {};

    for (const grade of Grades) {
      const item = preview[grade];
      const nextDue = item.card.due;
      const diffMs = nextDue.getTime() - now.getTime();
      result[grade] = formatInterval(diffMs);
    }

    return result;
  }

  // -------------------------------------------------------------------------
  // Review Stats
  // -------------------------------------------------------------------------

  /**
   * Get review statistics for the dashboard.
   */
  async function getReviewStats(userId: string): Promise<ReviewStats> {
    const now = new Date().toISOString();
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayStartStr = todayStart.toISOString();

    // Count new cards (no state row)
    const newResult = await db.getOptional<{ count: number }>(
      `SELECT COUNT(*) as count
       FROM flashcards f
       LEFT JOIN user_flashcard_states ufs
         ON ufs.flashcard_id = f.id AND ufs.user_id = ?
       WHERE f.deleted_at IS NULL AND f.is_active = 1
         AND ufs.flashcard_id IS NULL`,
      [userId]
    );

    // Count learning cards
    const learningResult = await db.getOptional<{ count: number }>(
      `SELECT COUNT(*) as count
       FROM user_flashcard_states ufs
       INNER JOIN flashcards f ON f.id = ufs.flashcard_id AND f.deleted_at IS NULL
       WHERE ufs.user_id = ?
         AND ufs.state IN ('Learning', 'Relearning')
         AND ufs.due_date <= ?`,
      [userId, now]
    );

    // Count review cards
    const reviewResult = await db.getOptional<{ count: number }>(
      `SELECT COUNT(*) as count
       FROM user_flashcard_states ufs
       INNER JOIN flashcards f ON f.id = ufs.flashcard_id AND f.deleted_at IS NULL
       WHERE ufs.user_id = ?
         AND ufs.state = 'Review'
         AND ufs.due_date <= ?`,
      [userId, now]
    );

    // Count reviewed today
    const reviewedResult = await db.getOptional<{ count: number }>(
      `SELECT COUNT(*) as count
       FROM review_logs
       WHERE user_id = ? AND created_at >= ?`,
      [userId, todayStartStr]
    );

    const newCount = newResult?.count ?? 0;
    const learningCount = learningResult?.count ?? 0;
    const reviewCount = reviewResult?.count ?? 0;

    return {
      newCount,
      learningCount,
      reviewCount,
      totalDueCount: newCount + learningCount + reviewCount,
      reviewedTodayCount: reviewedResult?.count ?? 0,
    };
  }

  return {
    getDueCards,
    gradeCard,
    previewIntervals,
    getReviewStats,
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function stateStringToEnum(state: string): State {
  switch (state) {
    case "New":
      return State.New;
    case "Learning":
      return State.Learning;
    case "Review":
      return State.Review;
    case "Relearning":
      return State.Relearning;
    default:
      return State.New;
  }
}

function stateEnumToString(state: State): string {
  switch (state) {
    case State.New:
      return "New";
    case State.Learning:
      return "Learning";
    case State.Review:
      return "Review";
    case State.Relearning:
      return "Relearning";
    default:
      return "New";
  }
}

/** Format a duration in milliseconds to a human-readable interval. */
function formatInterval(ms: number): string {
  const minutes = Math.round(ms / 60000);
  if (minutes < 1) return "< 1m";
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days}d`;
  const months = Math.round(days / 30);
  return `${months}mo`;
}
