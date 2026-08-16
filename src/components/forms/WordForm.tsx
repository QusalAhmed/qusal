"use client";

// =============================================================================
// Word Form Component
// =============================================================================
// Complete form for creating a new word with:
//   - Word text, phonetics, audio URL
//   - Dynamic definitions (useFieldArray)
//   - Tag selection with create-on-fly
//   - Duplicate detection (debounced)
//   - Local PowerSync transaction on submit
//   - Optimistic UI with success/error feedback
//
// Uses React Hook Form + Zod resolver for validation.
// =============================================================================

import { useCallback, useState, useEffect, useRef } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  TextInput,
  Button,
  Group,
  Alert,
  Stack,
  Text,
  Divider,
  Loader,
} from "@mantine/core";
import {
  Plus,
  Save,
  BookOpen,
  AlertCircle,
  CheckCircle2,
  Wifi,
  WifiOff,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

import { DefinitionFields } from "./DefinitionFields";
import { TagInput, type TagOption } from "./TagInput";
import { partOfSpeechSchema } from "@/schemas";
import { usePowerSyncProvider } from "@/lib/powersync/PowerSyncProvider";
import { useAuth } from "@/hooks/useAuth";
import {
  createVocabularyService,
  DuplicateWordError,
} from "@/features/vocabulary/vocabulary-service";
import { createTagService } from "@/features/vocabulary/tag-service";

import type { WordFormValues } from "./DefinitionFields";

// ---------------------------------------------------------------------------
// Form Validation Schema
// ---------------------------------------------------------------------------

const wordFormSchema = z.object({
  word: z
    .string()
    .min(1, "Word is required")
    .max(200, "Word must be 200 characters or fewer")
    .trim(),
  phonetics: z.string().max(200).optional().default(""),
  audio_url: z
    .string()
    .url("Must be a valid URL")
    .or(z.literal(""))
    .optional()
    .default(""),
  definitions: z
    .array(
      z.object({
        meaning: z
          .string()
          .min(1, "Meaning is required")
          .max(2000, "Meaning must be 2000 characters or fewer")
          .trim(),
        part_of_speech: partOfSpeechSchema,
        tiptap_note: z.unknown().nullable().default(null),
        requested_ai_example_count: z
          .number()
          .int()
          .min(0)
          .max(10)
          .default(0),
      })
    )
    .min(1, "At least one definition is required"),
  tag_ids: z.array(z.string()),
});

type WordFormSchemaType = z.infer<typeof wordFormSchema>;

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface WordFormProps {
  /** Called after successful submission */
  onSuccess?: (wordId: string) => void;
  /** Called on cancel */
  onCancel?: () => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function WordForm({ onSuccess, onCancel }: WordFormProps) {
  const { db } = usePowerSyncProvider();
  const { user } = useAuth();

  const [submitState, setSubmitState] = useState<
    "idle" | "submitting" | "success" | "error"
  >("idle");
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [duplicateWarning, setDuplicateWarning] = useState<{
    id: string;
    word: string;
  } | null>(null);
  const [createdWordId, setCreatedWordId] = useState<string | null>(null);

  // Debounce ref for duplicate check
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const form = useForm<WordFormSchemaType>({
    resolver: zodResolver(wordFormSchema) as any,
    defaultValues: {
      word: "",
      phonetics: "",
      audio_url: "",
      definitions: [
        {
          meaning: "",
          part_of_speech: "noun",
          tiptap_note: null,
          requested_ai_example_count: 0,
        },
      ],
      tag_ids: [],
    },
    mode: "onBlur",
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "definitions",
  });

  // -------------------------------------------------------------------------
  // Duplicate Detection (debounced)
  // -------------------------------------------------------------------------

  const wordValue = form.watch("word");

  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    if (!wordValue?.trim()) {
      setDuplicateWarning(null);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      try {
        const vocabService = createVocabularyService(db);
        const existing = await vocabService.checkDuplicateWord(wordValue);
        setDuplicateWarning(existing);
      } catch {
        // Silently ignore duplicate check errors
      }
    }, 300);

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [wordValue, db]);

  // -------------------------------------------------------------------------
  // Tag Creation Handler
  // -------------------------------------------------------------------------

  const handleCreateTag = useCallback(
    async (name: string): Promise<TagOption> => {
      const tagService = createTagService(db);
      const tag = await tagService.getOrCreateTag(name);
      return { id: tag.id, name: tag.name, color: tag.color };
    },
    [db]
  );

  // -------------------------------------------------------------------------
  // Form Submission
  // -------------------------------------------------------------------------

  const handleSubmit = useCallback(
    async (data: WordFormSchemaType) => {
      if (!user) {
        setSubmitError("You must be signed in to add words.");
        setSubmitState("error");
        return;
      }

      setSubmitState("submitting");
      setSubmitError(null);

      try {
        const vocabService = createVocabularyService(db);

        const result = await vocabService.createWordWithDefinitions(
          {
            word: data.word,
            phonetics: data.phonetics || null,
            audio_url: data.audio_url || null,
            definitions: data.definitions.map((def) => ({
              meaning: def.meaning,
              part_of_speech: def.part_of_speech as import("@/types").PartOfSpeech,
              tiptap_note: def.tiptap_note,
              requested_ai_example_count: def.requested_ai_example_count,
            })),
            tag_ids: data.tag_ids,
          },
          user.id
        );

        setCreatedWordId(result.wordId);
        setSubmitState("success");

        // Reset form after brief delay to show success
        setTimeout(() => {
          form.reset();
          setSubmitState("idle");
          setDuplicateWarning(null);
          onSuccess?.(result.wordId);
        }, 1500);
      } catch (error) {
        if (error instanceof DuplicateWordError) {
          setSubmitError(error.message);
          setDuplicateWarning({
            id: error.existingId,
            word: error.existingWord,
          });
        } else {
          setSubmitError(
            error instanceof Error
              ? error.message
              : "Failed to create word. Please try again."
          );
        }
        setSubmitState("error");
      }
    },
    [user, db, form, onSuccess]
  );

  // -------------------------------------------------------------------------
  // Add Definition
  // -------------------------------------------------------------------------

  const handleAddDefinition = useCallback(() => {
    append({
      meaning: "",
      part_of_speech: "noun",
      tiptap_note: null,
      requested_ai_example_count: 0,
    });
  }, [append]);

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  const isConnected =
    typeof window !== "undefined" && navigator.onLine;

  return (
    <form onSubmit={form.handleSubmit(handleSubmit as any)} noValidate>
      <Stack gap="md">
        {/* Success Alert */}
        <AnimatePresence>
          {submitState === "success" && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
            >
              <Alert
                icon={<CheckCircle2 size={16} />}
                color="green"
                variant="light"
              >
                Word added successfully! It will sync when you&apos;re back
                online.
              </Alert>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Error Alert */}
        <AnimatePresence>
          {submitState === "error" && submitError && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
            >
              <Alert
                icon={<AlertCircle size={16} />}
                color="red"
                variant="light"
                withCloseButton
                onClose={() => {
                  setSubmitState("idle");
                  setSubmitError(null);
                }}
              >
                {submitError}
              </Alert>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Connection Status */}
        <div className="flex items-center gap-1.5 text-xs">
          {isConnected ? (
            <>
              <Wifi size={12} className="text-emerald-400" />
              <span className="text-[var(--mantine-color-dimmed)]">
                Online — changes sync automatically
              </span>
            </>
          ) : (
            <>
              <WifiOff size={12} className="text-amber-400" />
              <span className="text-amber-400">
                Offline — changes will sync when reconnected
              </span>
            </>
          )}
        </div>

        {/* Word Input */}
        <TextInput
          label="Word"
          placeholder="Enter the vocabulary word…"
          required
          size="md"
          leftSection={<BookOpen size={16} />}
          error={form.formState.errors.word?.message}
          {...form.register("word")}
        />

        {/* Duplicate Warning */}
        <AnimatePresence>
          {duplicateWarning && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
            >
              <Alert
                icon={<AlertCircle size={16} />}
                color="yellow"
                variant="light"
              >
                <Text size="sm">
                  A word with this spelling already exists:{" "}
                  <strong>{duplicateWarning.word}</strong>
                </Text>
              </Alert>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Phonetics & Audio URL */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <TextInput
            label="Phonetics"
            placeholder="/æbˈsten.ʃən/"
            error={form.formState.errors.phonetics?.message}
            {...form.register("phonetics")}
          />
          <TextInput
            label="Audio URL"
            placeholder="https://…"
            error={form.formState.errors.audio_url?.message}
            {...form.register("audio_url")}
          />
        </div>

        {/* Tags */}
        <TagInput
          value={form.watch("tag_ids")}
          onChange={(ids) => form.setValue("tag_ids", ids)}
          onCreateTag={handleCreateTag}
        />

        {/* Definitions Section */}
        <Divider
          label={
            <Group gap="xs">
              <BookOpen size={14} />
              <Text size="sm" fw={600}>
                Definitions
              </Text>
            </Group>
          }
          labelPosition="left"
        />

        {form.formState.errors.definitions?.root?.message && (
          <Text size="sm" c="red">
            {form.formState.errors.definitions.root.message}
          </Text>
        )}

        {/* Definition Field Arrays */}
        <Stack gap="sm">
          {fields.map((field, index) => (
            <motion.div
              key={field.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.2 }}
            >
              <DefinitionFields
                index={index}
                form={form as any}
                onRemove={() => remove(index)}
                canRemove={fields.length > 1}
                errors={form.formState.errors.definitions?.[index] as any}
              />
            </motion.div>
          ))}
        </Stack>

        {/* Add Definition Button */}
        <Button
          variant="subtle"
          leftSection={<Plus size={14} />}
          onClick={handleAddDefinition}
          size="sm"
          fullWidth
        >
          Add another definition
        </Button>

        {/* Submit / Cancel */}
        <Divider />

        <Group justify="flex-end" gap="sm">
          {onCancel && (
            <Button
              variant="subtle"
              color="gray"
              onClick={onCancel}
              disabled={submitState === "submitting"}
            >
              Cancel
            </Button>
          )}
          <Button
            type="submit"
            leftSection={
              submitState === "submitting" ? (
                <Loader size={14} color="white" />
              ) : (
                <Save size={14} />
              )
            }
            loading={submitState === "submitting"}
            disabled={submitState === "submitting" || submitState === "success"}
            variant="gradient"
            gradient={{ from: "indigo", to: "violet" }}
          >
            {submitState === "submitting"
              ? "Saving…"
              : submitState === "success"
              ? "Saved!"
              : "Save Word"}
          </Button>
        </Group>
      </Stack>
    </form>
  );
}
