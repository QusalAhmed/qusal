"use client";

// =============================================================================
// Generate Examples Button
// =============================================================================
// A button component that triggers AI example generation for a definition.
// Handles the full flow:
//   1. Calls POST /api/ai/examples with word context
//   2. Saves results to local PowerSync DB
//   3. Displays generated examples with AI badge
//   4. Shows loading/error states
// =============================================================================

import { useCallback, useState } from "react";
import { Button, Alert, Loader, Text, Group, Badge } from "@mantine/core";
import { Sparkles, AlertCircle, BookText, Bot } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { usePowerSyncProvider } from "@/lib/powersync/PowerSyncProvider";
import { createVocabularyService } from "@/features/vocabulary/vocabulary-service";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ExampleItem {
  id: string;
  sentence: string;
  is_ai_generated: number;
  created_at: string;
}

interface GenerateExamplesButtonProps {
  /** Definition ID to generate examples for */
  definitionId: string;
  /** The vocabulary word */
  word: string;
  /** The definition meaning */
  meaning: string;
  /** Part of speech */
  partOfSpeech: string;
  /** How many examples to generate */
  requestedCount: number;
  /** Existing examples to display */
  existingExamples?: ExampleItem[];
  /** Callback after successful generation */
  onExamplesGenerated?: (examples: ExampleItem[]) => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function GenerateExamplesButton({
  definitionId,
  word,
  meaning,
  partOfSpeech,
  requestedCount,
  existingExamples = [],
  onExamplesGenerated,
}: GenerateExamplesButtonProps) {
  const { db } = usePowerSyncProvider();

  const [state, setState] = useState<"idle" | "generating" | "success" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [examples, setExamples] = useState<ExampleItem[]>(existingExamples);

  const handleGenerate = useCallback(async () => {
    if (state === "generating") return;

    setState("generating");
    setError(null);

    try {
      // Get the current session token for auth
      const supabase = getSupabaseBrowserClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.access_token) {
        throw new Error("You must be signed in to generate examples");
      }

      // Call the server API route
      const count = requestedCount > 0 ? requestedCount : 3;
      const response = await fetch("/api/ai/examples", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          word,
          meaning,
          partOfSpeech,
          count,
        }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(
          errData.error || `Generation failed (${response.status})`
        );
      }

      const data = await response.json();
      const sentences: string[] = data.sentences;

      if (!sentences || sentences.length === 0) {
        throw new Error("No examples were generated");
      }

      // Save to local PowerSync DB
      const vocabService = createVocabularyService(db);
      const ids = await vocabService.saveGeneratedExamples(
        definitionId,
        sentences
      );

      // Build new example items
      const now = new Date().toISOString();
      const newExamples: ExampleItem[] = sentences.map((sentence, i) => ({
        id: ids[i],
        sentence,
        is_ai_generated: 1,
        created_at: now,
      }));

      const allExamples = [...examples, ...newExamples];
      setExamples(allExamples);
      setState("success");
      onExamplesGenerated?.(allExamples);

      // Reset success state after delay
      setTimeout(() => setState("idle"), 3000);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to generate examples"
      );
      setState("error");
    }
  }, [
    state,
    db,
    definitionId,
    word,
    meaning,
    partOfSpeech,
    requestedCount,
    examples,
    onExamplesGenerated,
  ]);

  return (
    <div className="space-y-3">
      {/* Existing + Generated Examples */}
      {examples.length > 0 && (
        <div className="space-y-2">
          <Group gap="xs">
            <BookText size={14} className="text-[var(--color-text-secondary)]" />
            <Text size="xs" c="dimmed" fw={500}>
              Examples
            </Text>
          </Group>
          <ul className="space-y-1.5 pl-4">
            <AnimatePresence>
              {examples.map((ex) => (
                <motion.li
                  key={ex.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  className="text-sm text-[var(--color-text-secondary)] list-disc"
                >
                  <span className="italic">&ldquo;{ex.sentence}&rdquo;</span>
                  {ex.is_ai_generated === 1 && (
                    <Badge
                      size="xs"
                      variant="light"
                      color="violet"
                      leftSection={<Bot size={10} />}
                      ml={6}
                      styles={{
                        root: {
                          textTransform: "none",
                        },
                      }}
                    >
                      AI
                    </Badge>
                  )}
                </motion.li>
              ))}
            </AnimatePresence>
          </ul>
        </div>
      )}

      {/* Error Alert */}
      <AnimatePresence>
        {state === "error" && error && (
          <motion.div
            initial={{ opacity: 0, y: -5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -5 }}
          >
            <Alert
              icon={<AlertCircle size={14} />}
              color="red"
              variant="light"
              withCloseButton
              onClose={() => {
                setState("idle");
                setError(null);
              }}
              styles={{
                root: { padding: "8px 12px" },
              }}
            >
              <Text size="xs">{error}</Text>
            </Alert>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Generate Button */}
      <Button
        variant="light"
        color="violet"
        size="xs"
        leftSection={
          state === "generating" ? (
            <Loader size={14} color="violet" />
          ) : (
            <Sparkles size={14} />
          )
        }
        onClick={handleGenerate}
        disabled={state === "generating"}
        styles={{
          root: {
            transition: "all 0.2s ease",
          },
        }}
      >
        {state === "generating"
          ? "Generating..."
          : state === "success"
            ? "Generated!"
            : examples.length > 0
              ? "Generate More"
              : "Generate Examples"}
      </Button>
    </div>
  );
}
