"use client";

// =============================================================================
// Public Dashboard Page
// =============================================================================
// The main landing/dashboard page. Accessible to all users (including anonymous).
// Shows vocabulary stats and deck overviews.
// For authenticated users, shows personal FSRS deck state.
// =============================================================================

import { motion } from "framer-motion";
import {
  BookOpen,
  Brain,
  Layers,
  Play,
  Tag,
  TrendingUp,
  Zap,
} from "lucide-react";
import { usePowerSyncQuery } from "@/hooks/usePowerSyncQuery";
import { useAuth } from "@/hooks/useAuth";
import { AppShell } from "@/components/layout/AppShell";
import Link from "next/link";
import type { ReactNode } from "react";

// ---------------------------------------------------------------------------
// Stats Card Component
// ---------------------------------------------------------------------------

interface StatsCardProps {
  title: string;
  value: string | number;
  icon: ReactNode;
  description?: string;
  gradient: string;
  delay: number;
}

function StatsCard({
  title,
  value,
  icon,
  description,
  gradient,
  delay,
}: StatsCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.4, ease: "easeOut" }}
      className="card-hover rounded-2xl bg-[var(--color-surface-raised)] border border-[var(--color-border)] p-6 relative overflow-hidden"
    >
      {/* Background gradient glow */}
      <div
        className={`absolute top-0 right-0 w-32 h-32 ${gradient} opacity-10 blur-3xl rounded-full -translate-y-1/2 translate-x-1/2`}
      />

      <div className="relative">
        <div className="flex items-center justify-between mb-4">
          <div className="p-2.5 rounded-xl bg-[var(--color-surface-overlay)] border border-[var(--color-border-subtle)]">
            {icon}
          </div>
        </div>

        <div className="text-3xl font-bold text-white mb-1 tabular-nums">
          {value}
        </div>
        <div className="text-sm text-[var(--color-text-secondary)]">
          {title}
        </div>
        {description && (
          <div className="text-xs text-[var(--color-text-tertiary)] mt-1">
            {description}
          </div>
        )}
      </div>
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Deck Preview Card
// ---------------------------------------------------------------------------

interface DeckPreviewProps {
  title: string;
  description: string;
  dueCount: number;
  totalCount: number;
  icon: ReactNode;
  color: string;
  delay: number;
}

function DeckPreview({
  title,
  description,
  dueCount,
  totalCount,
  icon,
  color,
  delay,
}: DeckPreviewProps) {
  const progress = totalCount > 0 ? ((totalCount - dueCount) / totalCount) * 100 : 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.4, ease: "easeOut" }}
      className="card-hover rounded-2xl bg-[var(--color-surface-raised)] border border-[var(--color-border)] p-6"
    >
      <div className="flex items-start gap-4">
        <div
          className={`p-3 rounded-xl ${color} bg-opacity-10 border border-[var(--color-border-subtle)]`}
        >
          {icon}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-base font-semibold text-white mb-1">{title}</h3>
          <p className="text-xs text-[var(--color-text-tertiary)] mb-3">
            {description}
          </p>

          {/* Progress bar */}
          <div className="h-1.5 bg-[var(--color-surface-overlay)] rounded-full overflow-hidden mb-2">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              transition={{ delay: delay + 0.3, duration: 0.6, ease: "easeOut" }}
              className={`h-full rounded-full bg-gradient-to-r ${
                color.includes("indigo")
                  ? "from-indigo-500 to-violet-500"
                  : color.includes("emerald")
                    ? "from-emerald-500 to-teal-500"
                    : "from-amber-500 to-orange-500"
              }`}
            />
          </div>

          <div className="flex items-center justify-between text-xs">
            <span className="text-[var(--color-text-tertiary)]">
              {totalCount > 0
                ? `${totalCount - dueCount} / ${totalCount} reviewed`
                : "No cards yet"}
            </span>
            {dueCount > 0 && (
              <span className="text-amber-400 font-medium">
                {dueCount} due
              </span>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Dashboard Page
// ---------------------------------------------------------------------------

export default function DashboardPage() {
  const { user } = useAuth();

  // Query word count from local PowerSync DB
  const { data: wordCountResult } = usePowerSyncQuery<{ count: number }>(
    "SELECT COUNT(*) as count FROM words WHERE deleted_at IS NULL"
  );
  const wordCount = wordCountResult[0]?.count ?? 0;

  // Query definition count
  const { data: defCountResult } = usePowerSyncQuery<{ count: number }>(
    "SELECT COUNT(*) as count FROM definitions WHERE deleted_at IS NULL"
  );
  const definitionCount = defCountResult[0]?.count ?? 0;

  // Query tag count
  const { data: tagCountResult } = usePowerSyncQuery<{ count: number }>(
    "SELECT COUNT(*) as count FROM tags WHERE deleted_at IS NULL"
  );
  const tagCount = tagCountResult[0]?.count ?? 0;

  // Query flashcard count
  const { data: flashcardCountResult } = usePowerSyncQuery<{ count: number }>(
    "SELECT COUNT(*) as count FROM flashcards WHERE deleted_at IS NULL AND is_active = 1"
  );
  const flashcardCount = flashcardCountResult[0]?.count ?? 0;

  // Query due cards per deck (authenticated users only)
  const { data: dueWordToMeaning } = usePowerSyncQuery<{ count: number }>(
    user
      ? `SELECT COUNT(*) as count FROM user_flashcard_states ufs
         JOIN flashcards f ON ufs.flashcard_id = f.id
         WHERE ufs.user_id = ? AND ufs.due_date <= datetime('now') AND f.quiz_mode = 'WORD_TO_MEANING' AND f.deleted_at IS NULL`
      : "SELECT 0 as count",
    user ? [user.id] : []
  );

  const { data: dueMeaningToWord } = usePowerSyncQuery<{ count: number }>(
    user
      ? `SELECT COUNT(*) as count FROM user_flashcard_states ufs
         JOIN flashcards f ON ufs.flashcard_id = f.id
         WHERE ufs.user_id = ? AND ufs.due_date <= datetime('now') AND f.quiz_mode = 'MEANING_TO_WORD' AND f.deleted_at IS NULL`
      : "SELECT 0 as count",
    user ? [user.id] : []
  );

  const { data: dueMeaningToSpelling } = usePowerSyncQuery<{ count: number }>(
    user
      ? `SELECT COUNT(*) as count FROM user_flashcard_states ufs
         JOIN flashcards f ON ufs.flashcard_id = f.id
         WHERE ufs.user_id = ? AND ufs.due_date <= datetime('now') AND f.quiz_mode = 'MEANING_TO_SPELLING' AND f.deleted_at IS NULL`
      : "SELECT 0 as count",
    user ? [user.id] : []
  );

  return (
    <AppShell>
      <div className="space-y-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <h1 className="text-3xl sm:text-4xl font-bold text-white mb-2">
            {user ? "Your Dashboard" : "Vocabulary Explorer"}
          </h1>
          <p className="text-[var(--color-text-secondary)]">
            {user
              ? "Track your learning progress across all vocabulary decks"
              : "Browse the collaborative vocabulary knowledge base"}
          </p>
        </motion.div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatsCard
            title="Words"
            value={wordCount}
            icon={<BookOpen size={20} className="text-indigo-400" />}
            gradient="bg-indigo-500"
            delay={0.1}
          />
          <StatsCard
            title="Definitions"
            value={definitionCount}
            icon={<Layers size={20} className="text-violet-400" />}
            gradient="bg-violet-500"
            delay={0.15}
          />
          <StatsCard
            title="Tags"
            value={tagCount}
            icon={<Tag size={20} className="text-emerald-400" />}
            gradient="bg-emerald-500"
            delay={0.2}
          />
          <StatsCard
            title="Active Flashcards"
            value={flashcardCount}
            icon={<Zap size={20} className="text-amber-400" />}
            gradient="bg-amber-500"
            delay={0.25}
          />
        </div>

        {/* Due for Review CTA */}
        {user && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.4 }}
          >
            <div className="rounded-2xl bg-gradient-to-r from-indigo-500/10 to-violet-500/10 border border-indigo-500/20 p-6">
              <div className="flex items-center justify-between flex-wrap gap-4">
                <div className="flex items-center gap-4">
                  <div className="p-3 rounded-xl bg-indigo-500/20">
                    <Brain size={24} className="text-indigo-400" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-white">
                      Ready to Review
                    </h3>
                    <p className="text-sm text-[var(--color-text-secondary)]">
                      {flashcardCount > 0
                        ? `${flashcardCount} flashcards in your collection`
                        : "Add words to start building flashcards"}
                    </p>
                  </div>
                </div>
                {flashcardCount > 0 && (
                  <Link
                    href="/review"
                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium bg-gradient-to-r from-indigo-500 to-violet-600 text-white hover:from-indigo-400 hover:to-violet-500 shadow-lg shadow-indigo-500/20 hover:shadow-indigo-500/40 transition-all"
                  >
                    <Play size={16} />
                    Start Review
                  </Link>
                )}
              </div>
            </div>
          </motion.div>
        )}

        {/* Decks Section */}
        {user && (
          <div>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3 }}
              className="flex items-center gap-2 mb-4"
            >
              <Brain size={20} className="text-indigo-400" />
              <h2 className="text-xl font-semibold text-white">
                Learning Decks
              </h2>
            </motion.div>

            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <DeckPreview
                title="Word → Meaning"
                description="See the word, recall its meaning"
                dueCount={dueWordToMeaning?.[0]?.count ?? 0}
                totalCount={flashcardCount}
                icon={<BookOpen size={20} className="text-indigo-400" />}
                color="bg-indigo-500/10"
                delay={0.35}
              />
              <DeckPreview
                title="Meaning → Word"
                description="See the meaning, recall the word"
                dueCount={dueMeaningToWord?.[0]?.count ?? 0}
                totalCount={flashcardCount}
                icon={<TrendingUp size={20} className="text-emerald-400" />}
                color="bg-emerald-500/10"
                delay={0.4}
              />
              <DeckPreview
                title="Meaning → Spelling"
                description="See the meaning, type the correct spelling"
                dueCount={dueMeaningToSpelling?.[0]?.count ?? 0}
                totalCount={flashcardCount}
                icon={<Zap size={20} className="text-amber-400" />}
                color="bg-amber-500/10"
                delay={0.45}
              />
            </div>
          </div>
        )}

        {/* Empty State for Anonymous */}
        {!user && wordCount === 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="text-center py-16"
          >
            <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-indigo-500/20 to-violet-500/20 flex items-center justify-center mx-auto mb-6 border border-[var(--color-border)]">
              <BookOpen
                size={32}
                className="text-[var(--color-text-tertiary)]"
              />
            </div>
            <h3 className="text-lg font-semibold text-white mb-2">
              No words yet
            </h3>
            <p className="text-sm text-[var(--color-text-tertiary)] max-w-sm mx-auto">
              This vocabulary knowledge base is empty. Sign in to start adding
              words and definitions.
            </p>
          </motion.div>
        )}
      </div>
    </AppShell>
  );
}
