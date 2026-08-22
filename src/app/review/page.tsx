"use client";

// =============================================================================
// Review Session Page
// =============================================================================
// Full spaced repetition review session with:
//   - Session start screen with due card counts
//   - Flashcard display with 3D flip animation
//   - FSRS grading buttons (Again/Hard/Good/Easy)
//   - Progress tracking
//   - Session complete summary
//   - Keyboard shortcuts (1-4 for ratings, Space to reveal)
// =============================================================================

import { useState, useCallback, useEffect, useRef } from "react";
import {
  Container,
  Title,
  Text,
  Button,
  Group,
  Badge,
  Stack,
  Progress,
  Alert,
} from "@mantine/core";
import {
  Brain,
  Play,
  RotateCcw,
  ArrowLeft,
  CheckCircle2,
  Sparkles,
  Clock,
  BookOpen,
  AlertCircle,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";

import { AppShell } from "@/components/layout/AppShell";
import { ReviewCard } from "@/components/review/ReviewCard";
import { RatingButtons } from "@/components/review/RatingButtons";
import { useAuth } from "@/hooks/useAuth";
import { usePowerSyncProvider } from "@/lib/powersync/PowerSyncProvider";
import {
  createReviewService,
  type DueCard,
  type ReviewStats,
} from "@/features/review/fsrs-service";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type SessionPhase = "loading" | "start" | "review" | "complete";

// ---------------------------------------------------------------------------
// Page Component
// ---------------------------------------------------------------------------

export default function ReviewPage() {
  const { user, isInitialized } = useAuth();
  const { db } = usePowerSyncProvider();

  const [phase, setPhase] = useState<SessionPhase>("loading");
  const [stats, setStats] = useState<ReviewStats | null>(null);
  const [dueCards, setDueCards] = useState<DueCard[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isRevealed, setIsRevealed] = useState(false);
  const [isGrading, setIsGrading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reviewedCount, setReviewedCount] = useState(0);
  const [sessionStartTime] = useState(() => Date.now());

  // Spelling mode state
  const [spellingAnswer, setSpellingAnswer] = useState("");
  const [spellingResult, setSpellingResult] = useState<"correct" | "incorrect" | null>(null);

  const reviewServiceRef = useRef(createReviewService(db));

  // Keep service in sync with db
  useEffect(() => {
    reviewServiceRef.current = createReviewService(db);
  }, [db]);

  // -------------------------------------------------------------------------
  // Load stats on mount
  // -------------------------------------------------------------------------

  useEffect(() => {
    if (!isInitialized || !user) return;

    async function loadStats() {
      try {
        const reviewStats = await reviewServiceRef.current.getReviewStats(user!.id);
        setStats(reviewStats);
        setPhase("start");
      } catch (err) {
        console.error("Failed to load review stats:", err);
        setError("Failed to load review data");
        setPhase("start");
      }
    }

    loadStats();
  }, [isInitialized, user]);

  // -------------------------------------------------------------------------
  // Start session
  // -------------------------------------------------------------------------

  const startSession = useCallback(async () => {
    if (!user) return;

    try {
      setError(null);
      const cards = await reviewServiceRef.current.getDueCards(user.id);
      setDueCards(cards);
      setCurrentIndex(0);
      setReviewedCount(0);
      setIsRevealed(false);
      setSpellingAnswer("");
      setSpellingResult(null);

      if (cards.length === 0) {
        setPhase("complete");
      } else {
        setPhase("review");
      }
    } catch (err) {
      console.error("Failed to start review session:", err);
      setError("Failed to load due cards");
    }
  }, [user]);

  // -------------------------------------------------------------------------
  // Reveal answer
  // -------------------------------------------------------------------------

  const revealAnswer = useCallback(() => {
    if (isRevealed) return;
    setIsRevealed(true);
  }, [isRevealed]);

  // -------------------------------------------------------------------------
  // Handle spelling submit
  // -------------------------------------------------------------------------

  const handleSpellingSubmit = useCallback(() => {
    const current = dueCards[currentIndex];
    if (!current || spellingResult) return;

    const normalizedAnswer = spellingAnswer.trim().toLowerCase();
    const normalizedWord = current.word.trim().toLowerCase();

    if (normalizedAnswer === normalizedWord) {
      setSpellingResult("correct");
    } else {
      setSpellingResult("incorrect");
    }
    setIsRevealed(true);
  }, [dueCards, currentIndex, spellingAnswer, spellingResult]);

  // -------------------------------------------------------------------------
  // Grade card
  // -------------------------------------------------------------------------

  const handleRate = useCallback(
    async (rating: number) => {
      if (!user || isGrading) return;

      const current = dueCards[currentIndex];
      if (!current) return;

      setIsGrading(true);
      setError(null);

      try {
        await reviewServiceRef.current.gradeCard(user.id, current.flashcard_id, rating);
        setReviewedCount((prev) => prev + 1);

        // Move to next card
        const nextIndex = currentIndex + 1;
        if (nextIndex >= dueCards.length) {
          // Reload to check if there are new due cards (from learning steps)
          const remaining = await reviewServiceRef.current.getDueCards(user.id);
          if (remaining.length > 0) {
            setDueCards(remaining);
            setCurrentIndex(0);
          } else {
            setPhase("complete");
            // Reload stats for complete screen
            const newStats = await reviewServiceRef.current.getReviewStats(user.id);
            setStats(newStats);
          }
        } else {
          setCurrentIndex(nextIndex);
        }

        // Reset for next card
        setIsRevealed(false);
        setSpellingAnswer("");
        setSpellingResult(null);
      } catch (err) {
        console.error("Failed to grade card:", err);
        setError("Failed to save review. Please try again.");
      } finally {
        setIsGrading(false);
      }
    },
    [user, isGrading, dueCards, currentIndex]
  );

  // -------------------------------------------------------------------------
  // Keyboard shortcuts
  // -------------------------------------------------------------------------

  useEffect(() => {
    if (phase !== "review") return;

    function handleKeyPress(e: KeyboardEvent) {
      // Don't capture in input fields
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      )
        return;

      if (e.key === " " && !isRevealed) {
        e.preventDefault();
        revealAnswer();
      } else if (isRevealed && ["1", "2", "3", "4"].includes(e.key)) {
        handleRate(parseInt(e.key, 10));
      }
    }

    window.addEventListener("keydown", handleKeyPress);
    return () => window.removeEventListener("keydown", handleKeyPress);
  }, [phase, isRevealed, revealAnswer, handleRate]);

  // -------------------------------------------------------------------------
  // Current card + intervals
  // -------------------------------------------------------------------------

  const currentCard = dueCards[currentIndex] ?? null;
  const intervals = currentCard
    ? reviewServiceRef.current.previewIntervals(currentCard)
    : {};

  const progressPercent =
    dueCards.length > 0 ? (currentIndex / dueCards.length) * 100 : 0;

  // -------------------------------------------------------------------------
  // Auth gate
  // -------------------------------------------------------------------------

  if (!isInitialized) {
    return (
      <AppShell>
        <Container size="sm" py="xl">
          <div className="flex items-center justify-center py-20">
            <div className="animate-pulse text-[var(--color-text-secondary)]">
              Loading...
            </div>
          </div>
        </Container>
      </AppShell>
    );
  }

  if (!user) {
    return (
      <AppShell>
        <Container size="sm" py="xl">
          <div className="text-center py-20">
            <Brain size={48} className="mx-auto mb-4 text-[var(--color-text-tertiary)]" />
            <Title order={2} mb="sm">
              Sign In Required
            </Title>
            <Text c="dimmed" mb="lg">
              You need to be signed in to review flashcards.
            </Text>
            <Button
              component={Link}
              href="/auth/login"
              variant="gradient"
              gradient={{ from: "indigo", to: "violet" }}
            >
              Sign In
            </Button>
          </div>
        </Container>
      </AppShell>
    );
  }

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  return (
    <AppShell>
      <Container size="sm" py="xl">
        {/* Error Alert */}
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
            >
              <Alert
                icon={<AlertCircle size={16} />}
                color="red"
                variant="light"
                withCloseButton
                onClose={() => setError(null)}
                mb="lg"
              >
                {error}
              </Alert>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Phase: Start Screen */}
        {phase === "start" && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center py-10"
          >
            <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center mx-auto mb-6 shadow-2xl shadow-indigo-500/30">
              <Brain size={36} className="text-white" />
            </div>

            <Title order={1} mb="xs" className="gradient-text">
              Review Session
            </Title>
            <Text c="dimmed" mb="xl">
              Strengthen your memory with spaced repetition
            </Text>

            {stats && stats.totalDueCount > 0 ? (
              <>
                {/* Stats Cards */}
                <Group justify="center" gap="md" mb="xl">
                  <div className="glass-card rounded-xl p-4 min-w-[100px]">
                    <Text size="2xl" fw={700} className="text-blue-400">
                      {stats.newCount}
                    </Text>
                    <Text size="xs" c="dimmed">
                      New
                    </Text>
                  </div>
                  <div className="glass-card rounded-xl p-4 min-w-[100px]">
                    <Text size="2xl" fw={700} className="text-orange-400">
                      {stats.learningCount}
                    </Text>
                    <Text size="xs" c="dimmed">
                      Learning
                    </Text>
                  </div>
                  <div className="glass-card rounded-xl p-4 min-w-[100px]">
                    <Text size="2xl" fw={700} className="text-green-400">
                      {stats.reviewCount}
                    </Text>
                    <Text size="xs" c="dimmed">
                      Review
                    </Text>
                  </div>
                </Group>

                <Button
                  size="lg"
                  variant="gradient"
                  gradient={{ from: "indigo", to: "violet" }}
                  leftSection={<Play size={18} />}
                  onClick={startSession}
                  className="shadow-xl shadow-indigo-500/20"
                >
                  Start Review ({stats.totalDueCount} cards)
                </Button>

                {stats.reviewedTodayCount > 0 && (
                  <Text size="xs" c="dimmed" mt="md">
                    <CheckCircle2
                      size={12}
                      className="inline mr-1 text-green-400"
                    />
                    {stats.reviewedTodayCount} reviewed today
                  </Text>
                )}
              </>
            ) : (
              <div className="glass-card rounded-xl p-8 max-w-sm mx-auto">
                <CheckCircle2
                  size={32}
                  className="mx-auto mb-3 text-green-400"
                />
                <Text fw={600} mb="xs">
                  All caught up!
                </Text>
                <Text size="sm" c="dimmed">
                  No cards are due for review right now. Come back later!
                </Text>
                <Button
                  component={Link}
                  href="/"
                  variant="light"
                  mt="lg"
                  leftSection={<ArrowLeft size={16} />}
                >
                  Back to Dashboard
                </Button>
              </div>
            )}
          </motion.div>
        )}

        {/* Phase: Review */}
        {phase === "review" && currentCard && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            {/* Progress */}
            <div className="mb-6">
              <Group justify="space-between" mb="xs">
                <Text size="xs" c="dimmed">
                  Card {currentIndex + 1} of {dueCards.length}
                </Text>
                <Text size="xs" c="dimmed">
                  {reviewedCount} reviewed
                </Text>
              </Group>
              <Progress
                value={progressPercent}
                size="sm"
                color="violet"
                animated
                styles={{
                  root: {
                    backgroundColor: "var(--color-surface-overlay)",
                  },
                }}
              />
            </div>

            {/* Flashcard */}
            <div className="mb-8">
              <ReviewCard
                key={currentCard.flashcard_id + "-" + currentIndex}
                card={currentCard}
                onReveal={revealAnswer}
                isRevealed={isRevealed}
                spellingAnswer={spellingAnswer}
                onSpellingChange={setSpellingAnswer}
                onSpellingSubmit={handleSpellingSubmit}
                spellingResult={spellingResult}
              />
            </div>

            {/* Rating Buttons (shown after reveal) */}
            <AnimatePresence>
              {isRevealed && (
                <RatingButtons
                  intervals={intervals}
                  onRate={handleRate}
                  disabled={isGrading}
                />
              )}
            </AnimatePresence>
          </motion.div>
        )}

        {/* Phase: Complete */}
        {phase === "complete" && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-center py-10"
          >
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", stiffness: 300, damping: 20, delay: 0.2 }}
              className="w-20 h-20 rounded-full bg-gradient-to-br from-green-400 to-emerald-600 flex items-center justify-center mx-auto mb-6 shadow-2xl shadow-green-500/30"
            >
              <Sparkles size={36} className="text-white" />
            </motion.div>

            <Title order={1} mb="xs" className="gradient-text">
              Session Complete!
            </Title>
            <Text c="dimmed" mb="xl">
              Great job! You&apos;ve finished your review session.
            </Text>

            {/* Session Summary */}
            <div className="glass-card rounded-xl p-6 max-w-sm mx-auto mb-8">
              <Stack gap="md">
                <Group justify="space-between">
                  <Text size="sm" c="dimmed">
                    Cards Reviewed
                  </Text>
                  <Text size="sm" fw={600}>
                    {reviewedCount}
                  </Text>
                </Group>
                <Group justify="space-between">
                  <Text size="sm" c="dimmed">
                    Session Duration
                  </Text>
                  <Text size="sm" fw={600}>
                    {formatDuration(Date.now() - sessionStartTime)}
                  </Text>
                </Group>
                {stats && (
                  <Group justify="space-between">
                    <Text size="sm" c="dimmed">
                      Total Today
                    </Text>
                    <Text size="sm" fw={600}>
                      {stats.reviewedTodayCount}
                    </Text>
                  </Group>
                )}
              </Stack>
            </div>

            <Group justify="center" gap="md">
              <Button
                variant="light"
                leftSection={<ArrowLeft size={16} />}
                component={Link}
                href="/"
              >
                Dashboard
              </Button>
              <Button
                variant="gradient"
                gradient={{ from: "indigo", to: "violet" }}
                leftSection={<RotateCcw size={16} />}
                onClick={() => {
                  setPhase("loading");
                  reviewServiceRef.current.getReviewStats(user!.id).then((s) => {
                    setStats(s);
                    setPhase("start");
                  });
                }}
              >
                Review Again
              </Button>
            </Group>
          </motion.div>
        )}

        {/* Loading phase */}
        {phase === "loading" && (
          <div className="flex items-center justify-center py-20">
            <div className="animate-pulse text-[var(--color-text-secondary)]">
              Loading review data...
            </div>
          </div>
        )}
      </Container>
    </AppShell>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;

  if (minutes === 0) return `${remainingSeconds}s`;
  return `${minutes}m ${remainingSeconds}s`;
}
