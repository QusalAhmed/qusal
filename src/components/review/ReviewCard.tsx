"use client";

// =============================================================================
// Review Card Component
// =============================================================================
// Renders a flashcard with 3D flip animation.
// Supports all three quiz modes:
//   - WORD_TO_MEANING: Shows word → user recalls meaning
//   - MEANING_TO_WORD: Shows meaning → user recalls word
//   - MEANING_TO_SPELLING: Shows meaning → user types the word
// =============================================================================

import { useState, useCallback, useRef, useEffect } from "react";
import { Text, Badge, TextInput, Group } from "@mantine/core";
import { motion } from "framer-motion";
import { Volume2, Eye, Keyboard, BookOpen, Lightbulb } from "lucide-react";
import type { DueCard } from "@/features/review/fsrs-service";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ReviewCardProps {
  card: DueCard;
  onReveal: () => void;
  isRevealed: boolean;
  /** For spelling mode: the user's typed answer */
  spellingAnswer?: string;
  onSpellingChange?: (value: string) => void;
  onSpellingSubmit?: () => void;
  spellingResult?: "correct" | "incorrect" | null;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ReviewCard({
  card,
  onReveal,
  isRevealed,
  spellingAnswer = "",
  onSpellingChange,
  onSpellingSubmit,
  spellingResult,
}: ReviewCardProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const isSpellingMode = card.quiz_mode === "MEANING_TO_SPELLING";

  // Focus spelling input when card appears
  useEffect(() => {
    if (isSpellingMode && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isSpellingMode, card.flashcard_id]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && isSpellingMode && onSpellingSubmit) {
        onSpellingSubmit();
      } else if (e.key === " " && !isSpellingMode && !isRevealed) {
        e.preventDefault();
        onReveal();
      }
    },
    [isSpellingMode, isRevealed, onReveal, onSpellingSubmit]
  );

  return (
    <div className="w-full max-w-lg mx-auto perspective-1000" onKeyDown={handleKeyDown}>
      <motion.div
        className="relative w-full"
        style={{ minHeight: 320 }}
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3 }}
      >
        {/* Card Container */}
        <div
          className={`
            relative w-full min-h-[320px] rounded-2xl
            transition-transform duration-500 transform-style-3d
            ${isRevealed ? "rotate-y-180" : ""}
          `}
          style={{
            transformStyle: "preserve-3d",
            transform: isRevealed ? "rotateY(180deg)" : "rotateY(0deg)",
            transition: "transform 0.6s cubic-bezier(0.4, 0, 0.2, 1)",
          }}
        >
          {/* Front Face */}
          <div
            className="absolute inset-0 backface-hidden rounded-2xl glass-card p-8 flex flex-col items-center justify-center cursor-pointer"
            style={{ backfaceVisibility: "hidden" }}
            onClick={!isSpellingMode ? onReveal : undefined}
          >
            {/* Quiz Mode Badge */}
            <Badge
              variant="light"
              color={getQuizModeColor(card.quiz_mode)}
              size="sm"
              mb="lg"
              leftSection={getQuizModeIcon(card.quiz_mode)}
            >
              {getQuizModeLabel(card.quiz_mode)}
            </Badge>

            {/* Prompt */}
            {card.quiz_mode === "WORD_TO_MEANING" ? (
              <>
                <Text
                  size="xl"
                  fw={700}
                  className="gradient-text text-center mb-2"
                  style={{ fontSize: "2rem" }}
                >
                  {card.word}
                </Text>
                {card.phonetics && (
                  <Text size="sm" c="dimmed" className="italic">
                    {card.phonetics}
                  </Text>
                )}
                <Text size="xs" c="dimmed" mt="lg">
                  What does this word mean?
                </Text>
              </>
            ) : (
              <>
                <Text
                  size="lg"
                  fw={500}
                  className="text-center text-[var(--color-text-primary)]"
                  style={{ lineHeight: 1.6 }}
                >
                  {card.meaning}
                </Text>
                <Badge variant="light" color="gray" size="xs" mt="md">
                  {card.part_of_speech}
                </Badge>

                {isSpellingMode ? (
                  <div className="mt-6 w-full max-w-xs">
                    <TextInput
                      ref={inputRef}
                      placeholder="Type the word..."
                      value={spellingAnswer}
                      onChange={(e) => onSpellingChange?.(e.currentTarget.value)}
                      size="lg"
                      autoComplete="off"
                      autoCorrect="off"
                      spellCheck={false}
                      error={
                        spellingResult === "incorrect"
                          ? `The correct answer is: ${card.word}`
                          : undefined
                      }
                      styles={{
                        input: {
                          textAlign: "center",
                          fontSize: "1.25rem",
                          fontWeight: 600,
                          letterSpacing: "0.05em",
                          backgroundColor: spellingResult === "correct"
                            ? "rgba(34, 197, 94, 0.1)"
                            : spellingResult === "incorrect"
                              ? "rgba(239, 68, 68, 0.1)"
                              : undefined,
                          borderColor: spellingResult === "correct"
                            ? "rgb(34, 197, 94)"
                            : spellingResult === "incorrect"
                              ? "rgb(239, 68, 68)"
                              : undefined,
                        },
                      }}
                    />
                    <Text size="xs" c="dimmed" ta="center" mt="xs">
                      Press Enter to submit
                    </Text>
                  </div>
                ) : (
                  <Text size="xs" c="dimmed" mt="lg">
                    What word matches this meaning?
                  </Text>
                )}
              </>
            )}

            {/* Tap to reveal hint (non-spelling modes) */}
            {!isSpellingMode && (
              <motion.div
                className="absolute bottom-6 flex items-center gap-1.5 text-xs text-[var(--color-text-tertiary)]"
                animate={{ opacity: [0.4, 0.8, 0.4] }}
                transition={{ duration: 2, repeat: Infinity }}
              >
                <Eye size={12} />
                <span>Tap or press Space to reveal</span>
              </motion.div>
            )}

            {/* State badge */}
            {card.state && (
              <div className="absolute top-4 right-4">
                <Badge variant="dot" color={getStateBadgeColor(card.state)} size="xs">
                  {card.state}
                </Badge>
              </div>
            )}
          </div>

          {/* Back Face */}
          <div
            className="absolute inset-0 backface-hidden rounded-2xl glass-card p-8 flex flex-col items-center justify-center"
            style={{
              backfaceVisibility: "hidden",
              transform: "rotateY(180deg)",
            }}
          >
            <Badge
              variant="light"
              color="emerald"
              size="sm"
              mb="lg"
              leftSection={<Lightbulb size={12} />}
            >
              Answer
            </Badge>

            {card.quiz_mode === "WORD_TO_MEANING" ? (
              <>
                <Text
                  size="lg"
                  fw={500}
                  className="text-center text-[var(--color-text-primary)]"
                  style={{ lineHeight: 1.6 }}
                >
                  {card.meaning}
                </Text>
                <Badge variant="light" color="gray" size="xs" mt="md">
                  {card.part_of_speech}
                </Badge>
              </>
            ) : (
              <>
                <Text
                  size="xl"
                  fw={700}
                  className="gradient-text text-center"
                  style={{ fontSize: "2rem" }}
                >
                  {card.word}
                </Text>
                {card.phonetics && (
                  <Text size="sm" c="dimmed" className="italic mt-1">
                    {card.phonetics}
                  </Text>
                )}
              </>
            )}

            {/* Full context */}
            <div className="mt-6 pt-4 border-t border-[var(--color-border)] w-full max-w-sm">
              <Group gap="xs" justify="center">
                <Text size="xs" c="dimmed" fw={600}>
                  {card.word}
                </Text>
                <Text size="xs" c="dimmed">—</Text>
                <Text size="xs" c="dimmed" className="italic">
                  {card.meaning}
                </Text>
              </Group>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getQuizModeLabel(mode: string): string {
  switch (mode) {
    case "WORD_TO_MEANING":
      return "Word → Meaning";
    case "MEANING_TO_WORD":
      return "Meaning → Word";
    case "MEANING_TO_SPELLING":
      return "Spelling";
    default:
      return mode;
  }
}

function getQuizModeColor(mode: string): string {
  switch (mode) {
    case "WORD_TO_MEANING":
      return "indigo";
    case "MEANING_TO_WORD":
      return "violet";
    case "MEANING_TO_SPELLING":
      return "cyan";
    default:
      return "gray";
  }
}

function getQuizModeIcon(mode: string) {
  switch (mode) {
    case "WORD_TO_MEANING":
      return <BookOpen size={12} />;
    case "MEANING_TO_WORD":
      return <Lightbulb size={12} />;
    case "MEANING_TO_SPELLING":
      return <Keyboard size={12} />;
    default:
      return null;
  }
}

function getStateBadgeColor(state: string): string {
  switch (state) {
    case "New":
      return "blue";
    case "Learning":
      return "orange";
    case "Review":
      return "green";
    case "Relearning":
      return "red";
    default:
      return "gray";
  }
}
