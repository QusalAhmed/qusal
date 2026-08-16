"use client";

// =============================================================================
// Edit Word Page
// =============================================================================
// Pre-fills the Word Form with existing data for editing.
// Supports editing word fields, modifying definitions, and managing tags.
// =============================================================================

import { useParams, useRouter } from "next/navigation";
import { useState, useCallback, useEffect } from "react";
import {
  Container,
  Title,
  Text,
  Breadcrumbs,
  Anchor,
  Skeleton,
  Button,
  Alert,
  Stack,
  TextInput,
  Divider,
  Group,
  Select,
  NumberInput,
  Loader,
  ActionIcon,
  Tooltip,
} from "@mantine/core";
import {
  ChevronRight,
  BookOpen,
  ArrowLeft,
  Save,
  Plus,
  Trash2,
  AlertCircle,
  CheckCircle2,
  Sparkles,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { useForm, useFieldArray, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

import { AppShell } from "@/components/layout/AppShell";
import { TagInput, type TagOption } from "@/components/forms/TagInput";
import { TiptapEditor } from "@/components/forms/TiptapEditor";
import { useAuth } from "@/hooks/useAuth";
import { usePowerSyncProvider } from "@/lib/powersync/PowerSyncProvider";
import {
  createVocabularyService,
} from "@/features/vocabulary/vocabulary-service";
import { createTagService } from "@/features/vocabulary/tag-service";
import { PARTS_OF_SPEECH } from "@/types";
import { partOfSpeechSchema } from "@/schemas";

import type { PartOfSpeech } from "@/types";
import type { JSONContent } from "@tiptap/react";

// ---------------------------------------------------------------------------
// Form Schema
// ---------------------------------------------------------------------------

const editWordSchema = z.object({
  word: z.string().min(1, "Word is required").max(200).trim(),
  phonetics: z.string().max(200).optional().default(""),
  audio_url: z.string().url("Must be a valid URL").or(z.literal("")).optional().default(""),
  tag_ids: z.array(z.string()),
});

type EditWordValues = z.infer<typeof editWordSchema>;

const editDefSchema = z.object({
  meaning: z.string().min(1, "Meaning is required").max(2000).trim(),
  part_of_speech: partOfSpeechSchema,
  tiptap_note: z.unknown().nullable().default(null),
  requested_ai_example_count: z.number().int().min(0).max(10).default(0),
});

type EditDefValues = z.infer<typeof editDefSchema>;

const addDefSchema = z.object({
  definitions: z.array(editDefSchema).min(1),
});

type AddDefValues = z.infer<typeof addDefSchema>;

// ---------------------------------------------------------------------------
// POS options
// ---------------------------------------------------------------------------

const POS_OPTIONS = PARTS_OF_SPEECH.map((pos) => ({
  value: pos,
  label: pos.charAt(0).toUpperCase() + pos.slice(1),
}));

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function EditWordPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const { db } = usePowerSyncProvider();
  const wordId = params.id as string;

  const [isLoading, setIsLoading] = useState(true);
  const [wordData, setWordData] = useState<{
    word: string;
    phonetics: string | null;
    audio_url: string | null;
    tags: { id: string; name: string; color: string | null }[];
    definitions: {
      id: string;
      meaning: string;
      part_of_speech: string;
      tiptap_note: JSONContent | null;
      requested_ai_example_count: number;
    }[];
  } | null>(null);

  const [savingWord, setSavingWord] = useState(false);
  const [savingDef, setSavingDef] = useState<string | null>(null);
  const [showAddDef, setShowAddDef] = useState(false);
  const [feedback, setFeedback] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  // Word form
  const wordForm = useForm<EditWordValues>({
    resolver: zodResolver(editWordSchema) as any,
    defaultValues: { word: "", phonetics: "", audio_url: "", tag_ids: [] },
  });

  // New definitions form
  const addDefForm = useForm<AddDefValues>({
    resolver: zodResolver(addDefSchema) as any,
    defaultValues: {
      definitions: [
        { meaning: "", part_of_speech: "noun", tiptap_note: null, requested_ai_example_count: 0 },
      ],
    },
  });

  const { fields: newDefFields, append: appendNewDef, remove: removeNewDef } = useFieldArray({
    control: addDefForm.control,
    name: "definitions",
  });

  // Load word data
  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const vocabService = createVocabularyService(db);
        const details = await vocabService.getWordWithDetails(wordId);
        if (cancelled || !details) {
          setIsLoading(false);
          return;
        }
        setWordData({
          word: details.word,
          phonetics: details.phonetics,
          audio_url: details.audio_url,
          tags: details.tags,
          definitions: details.definitions.map((d) => ({
            id: d.id,
            meaning: d.meaning,
            part_of_speech: d.part_of_speech,
            tiptap_note: d.tiptap_note,
            requested_ai_example_count: d.requested_ai_example_count,
          })),
        });
        wordForm.reset({
          word: details.word,
          phonetics: details.phonetics ?? "",
          audio_url: details.audio_url ?? "",
          tag_ids: details.tags.map((t) => t.id),
        });
        setIsLoading(false);
      } catch {
        setIsLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [wordId, db]);

  // Save word fields
  const handleSaveWord = useCallback(
    async (data: EditWordValues) => {
      setSavingWord(true);
      try {
        const vocabService = createVocabularyService(db);
        await vocabService.updateWord(wordId, {
          word: data.word,
          phonetics: data.phonetics || null,
          audio_url: data.audio_url || null,
        });
        await vocabService.setWordTags(wordId, data.tag_ids);
        setFeedback({ type: "success", message: "Word updated" });
      } catch (error) {
        setFeedback({
          type: "error",
          message: error instanceof Error ? error.message : "Failed to save",
        });
      } finally {
        setSavingWord(false);
      }
    },
    [db, wordId]
  );

  // Save single existing definition inline
  const handleSaveDefinition = useCallback(
    async (defId: string, values: EditDefValues) => {
      setSavingDef(defId);
      try {
        const vocabService = createVocabularyService(db);
        await vocabService.updateDefinition(defId, {
          meaning: values.meaning,
          part_of_speech: values.part_of_speech as PartOfSpeech,
          tiptap_note: values.tiptap_note,
          requested_ai_example_count: values.requested_ai_example_count,
        });
        setFeedback({ type: "success", message: "Definition updated" });
      } catch (error) {
        setFeedback({
          type: "error",
          message: error instanceof Error ? error.message : "Failed to save definition",
        });
      } finally {
        setSavingDef(null);
      }
    },
    [db]
  );

  // Delete definition
  const handleDeleteDef = useCallback(
    async (defId: string) => {
      try {
        const vocabService = createVocabularyService(db);
        await vocabService.softDeleteDefinition(defId);
        setWordData((prev) =>
          prev
            ? {
                ...prev,
                definitions: prev.definitions.filter((d) => d.id !== defId),
              }
            : null
        );
        setFeedback({ type: "success", message: "Definition removed" });
      } catch (error) {
        setFeedback({
          type: "error",
          message: error instanceof Error ? error.message : "Failed to delete",
        });
      }
    },
    [db]
  );

  // Add new definitions
  const handleAddDefinitions = useCallback(
    async (data: AddDefValues) => {
      if (!user) return;
      setSavingDef("new");
      try {
        const vocabService = createVocabularyService(db);
        const newDefs: Array<{
          id: string;
          meaning: string;
          part_of_speech: string;
          tiptap_note: JSONContent | null;
          requested_ai_example_count: number;
        }> = [];
        for (const def of data.definitions) {
          const result = await vocabService.addDefinition(
            wordId,
            {
              meaning: def.meaning,
              part_of_speech: def.part_of_speech as PartOfSpeech,
              tiptap_note: def.tiptap_note,
              requested_ai_example_count: def.requested_ai_example_count,
            },
            user.id
          );
          newDefs.push({
            id: result.definitionId,
            meaning: def.meaning,
            part_of_speech: def.part_of_speech,
            tiptap_note: def.tiptap_note as JSONContent | null,
            requested_ai_example_count: def.requested_ai_example_count,
          });
        }
        setWordData((prev) =>
          prev ? { ...prev, definitions: [...prev.definitions, ...newDefs] } : null
        );
        addDefForm.reset({
          definitions: [
            { meaning: "", part_of_speech: "noun", tiptap_note: null, requested_ai_example_count: 0 },
          ],
        });
        setShowAddDef(false);
        setFeedback({ type: "success", message: `${data.definitions.length} definition(s) added` });
      } catch (error) {
        setFeedback({
          type: "error",
          message: error instanceof Error ? error.message : "Failed to add definitions",
        });
      } finally {
        setSavingDef(null);
      }
    },
    [db, wordId, user, addDefForm]
  );

  // Tag creation
  const handleCreateTag = useCallback(
    async (name: string): Promise<TagOption> => {
      const tagService = createTagService(db);
      const tag = await tagService.getOrCreateTag(name);
      return { id: tag.id, name: tag.name, color: tag.color };
    },
    [db]
  );

  if (!user) {
    return (
      <AppShell>
        <Container size="md" py="xl">
          <Text c="dimmed">Sign in to edit words.</Text>
        </Container>
      </AppShell>
    );
  }

  if (isLoading) {
    return (
      <AppShell>
        <Container size="md" py="xl">
          <Skeleton height={20} width={200} mb="lg" />
          <Skeleton height={40} mb="md" />
          <Skeleton height={120} mb="md" />
        </Container>
      </AppShell>
    );
  }

  if (!wordData) {
    return (
      <AppShell>
        <Container size="md" py="xl">
          <Text c="dimmed">Word not found.</Text>
          <Button component={Link} href="/words" variant="subtle" mt="md" leftSection={<ArrowLeft size={14} />}>
            Back to Words
          </Button>
        </Container>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <Container size="md" py="xl">
        {/* Feedback */}
        <AnimatePresence>
          {feedback && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
            >
              <Alert
                icon={feedback.type === "success" ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
                color={feedback.type === "success" ? "green" : "red"}
                variant="light"
                mb="md"
                withCloseButton
                onClose={() => setFeedback(null)}
              >
                {feedback.message}
              </Alert>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Breadcrumbs */}
        <Breadcrumbs separator={<ChevronRight size={14} />} mb="lg">
          <Anchor component={Link} href="/" size="sm" c="dimmed">Dashboard</Anchor>
          <Anchor component={Link} href="/words" size="sm" c="dimmed">Words</Anchor>
          <Anchor component={Link} href={`/words/${wordId}`} size="sm" c="dimmed">
            {wordData.word}
          </Anchor>
          <Text size="sm" c="white">Edit</Text>
        </Breadcrumbs>

        <Title order={2} mb="xl">Edit Word</Title>

        {/* Word Fields */}
        <form onSubmit={wordForm.handleSubmit(handleSaveWord)} noValidate>
          <div className="glass-card rounded-xl p-5 mb-6">
            <Text size="sm" fw={600} mb="md">Word Details</Text>
            <Stack gap="sm">
              <TextInput
                label="Word"
                required
                leftSection={<BookOpen size={14} />}
                error={wordForm.formState.errors.word?.message}
                {...wordForm.register("word")}
              />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <TextInput
                  label="Phonetics"
                  placeholder="/…/"
                  {...wordForm.register("phonetics")}
                />
                <TextInput
                  label="Audio URL"
                  placeholder="https://…"
                  error={wordForm.formState.errors.audio_url?.message}
                  {...wordForm.register("audio_url")}
                />
              </div>
              <TagInput
                value={wordForm.watch("tag_ids")}
                onChange={(ids) => wordForm.setValue("tag_ids", ids)}
                onCreateTag={handleCreateTag}
              />
              <Group justify="flex-end">
                <Button
                  type="submit"
                  size="sm"
                  leftSection={savingWord ? <Loader size={14} color="white" /> : <Save size={14} />}
                  loading={savingWord}
                  variant="gradient"
                  gradient={{ from: "indigo", to: "violet" }}
                >
                  Save Changes
                </Button>
              </Group>
            </Stack>
          </div>
        </form>

        {/* Existing Definitions */}
        <Divider
          label={<Group gap="xs"><BookOpen size={14} /><Text size="sm" fw={600}>Definitions</Text></Group>}
          labelPosition="left"
          mb="md"
        />

        <Stack gap="md" mb="md">
          {wordData.definitions.map((def) => (
            <EditableDefinition
              key={def.id}
              definition={def}
              onSave={(values) => handleSaveDefinition(def.id, values)}
              onDelete={() => handleDeleteDef(def.id)}
              isSaving={savingDef === def.id}
              canDelete={wordData.definitions.length > 1}
            />
          ))}
        </Stack>

        {/* Add New Definitions */}
        {!showAddDef ? (
          <Button
            variant="subtle"
            leftSection={<Plus size={14} />}
            onClick={() => setShowAddDef(true)}
            fullWidth
          >
            Add new definition
          </Button>
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <div className="glass-card rounded-xl p-5">
              <Text size="sm" fw={600} mb="md">New Definitions</Text>
              <form onSubmit={addDefForm.handleSubmit(handleAddDefinitions)} noValidate>
                <Stack gap="sm">
                  {newDefFields.map((field, index) => (
                    <div key={field.id} className="rounded-lg border border-[var(--glass-border)] p-3 space-y-3">
                      <div className="flex items-center justify-between">
                        <Text size="xs" fw={600}>New Definition {index + 1}</Text>
                        {newDefFields.length > 1 && (
                          <ActionIcon variant="subtle" color="red" size="xs" onClick={() => removeNewDef(index)}>
                            <Trash2 size={12} />
                          </ActionIcon>
                        )}
                      </div>
                      <TextInput
                        label="Meaning"
                        required
                        error={addDefForm.formState.errors.definitions?.[index]?.meaning?.message}
                        {...addDefForm.register(`definitions.${index}.meaning`)}
                      />
                      <div className="grid grid-cols-2 gap-3">
                        <Controller
                          control={addDefForm.control}
                          name={`definitions.${index}.part_of_speech`}
                          render={({ field: f }) => (
                            <Select label="Part of Speech" data={POS_OPTIONS} value={f.value} onChange={(v) => f.onChange(v ?? "noun")} required />
                          )}
                        />
                        <Controller
                          control={addDefForm.control}
                          name={`definitions.${index}.requested_ai_example_count`}
                          render={({ field: f }) => (
                            <NumberInput label="AI Examples" min={0} max={10} value={f.value} onChange={(v) => f.onChange(typeof v === "number" ? v : 0)} leftSection={<Sparkles size={14} />} />
                          )}
                        />
                      </div>
                      <Controller
                        control={addDefForm.control}
                        name={`definitions.${index}.tiptap_note`}
                        render={({ field: f }) => (
                          <TiptapEditor content={f.value as JSONContent | null} onChange={f.onChange} placeholder="Notes…" />
                        )}
                      />
                    </div>
                  ))}
                  <Button variant="subtle" size="xs" leftSection={<Plus size={12} />} onClick={() => appendNewDef({ meaning: "", part_of_speech: "noun", tiptap_note: null, requested_ai_example_count: 0 })}>
                    Add another
                  </Button>
                  <Group justify="flex-end" gap="sm">
                    <Button variant="subtle" color="gray" onClick={() => setShowAddDef(false)}>Cancel</Button>
                    <Button type="submit" loading={savingDef === "new"} variant="gradient" gradient={{ from: "indigo", to: "violet" }} leftSection={<Save size={14} />}>
                      Save Definitions
                    </Button>
                  </Group>
                </Stack>
              </form>
            </div>
          </motion.div>
        )}
      </Container>
    </AppShell>
  );
}

// ---------------------------------------------------------------------------
// Editable Definition Sub-component
// ---------------------------------------------------------------------------

interface EditableDefinitionProps {
  definition: {
    id: string;
    meaning: string;
    part_of_speech: string;
    tiptap_note: JSONContent | null;
    requested_ai_example_count: number;
  };
  onSave: (values: EditDefValues) => Promise<void>;
  onDelete: () => void;
  isSaving: boolean;
  canDelete: boolean;
}

function EditableDefinition({ definition, onSave, onDelete, isSaving, canDelete }: EditableDefinitionProps) {
  const form = useForm<EditDefValues>({
    resolver: zodResolver(editDefSchema) as any,
    defaultValues: {
      meaning: definition.meaning,
      part_of_speech: definition.part_of_speech as PartOfSpeech,
      tiptap_note: definition.tiptap_note,
      requested_ai_example_count: definition.requested_ai_example_count,
    },
  });

  const [showNotes, setShowNotes] = useState(Boolean(definition.tiptap_note));

  return (
    <div className="glass-card rounded-xl p-5">
      <form onSubmit={form.handleSubmit(onSave as any)} noValidate>
        <Stack gap="sm">
          <TextInput
            label="Meaning"
            required
            error={form.formState.errors.meaning?.message}
            {...form.register("meaning")}
          />
          <div className="grid grid-cols-2 gap-3">
            <Controller
              control={form.control}
              name="part_of_speech"
              render={({ field }) => (
                <Select label="Part of Speech" data={POS_OPTIONS} value={field.value} onChange={(v) => field.onChange(v ?? "noun")} required leftSection={<BookOpen size={14} />} />
              )}
            />
            <Controller
              control={form.control}
              name="requested_ai_example_count"
              render={({ field }) => (
                <NumberInput label="AI Examples" min={0} max={10} value={field.value} onChange={(v) => field.onChange(typeof v === "number" ? v : 0)} leftSection={<Sparkles size={14} />} />
              )}
            />
          </div>
          <button type="button" onClick={() => setShowNotes((v) => !v)} className="text-xs text-[var(--mantine-color-dimmed)] hover:text-white transition-colors text-left">
            {showNotes ? "▾ Hide notes" : "▸ Show/edit notes"}
          </button>
          {showNotes && (
            <Controller
              control={form.control}
              name="tiptap_note"
              render={({ field }) => (
                <TiptapEditor content={field.value as JSONContent | null} onChange={field.onChange} />
              )}
            />
          )}
          <Group justify="flex-end" gap="xs">
            {canDelete && (
              <Button variant="subtle" color="red" size="xs" leftSection={<Trash2 size={12} />} onClick={onDelete}>
                Delete
              </Button>
            )}
            <Button type="submit" size="xs" loading={isSaving} variant="gradient" gradient={{ from: "indigo", to: "violet" }} leftSection={<Save size={12} />}>
              Save
            </Button>
          </Group>
        </Stack>
      </form>
    </div>
  );
}
