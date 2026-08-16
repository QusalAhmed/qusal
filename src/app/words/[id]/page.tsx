"use client";

// =============================================================================
// Word Detail Page
// =============================================================================
// Displays a single word with all its definitions, examples, and tags.
// Authenticated users can edit the word, add/remove definitions, and manage tags.
// =============================================================================

import { useParams, useRouter } from "next/navigation";
import { useState, useCallback, useEffect } from "react";
import {
  Container,
  Title,
  Text,
  Breadcrumbs,
  Anchor,
  Badge,
  Group,
  ActionIcon,
  Tooltip,
  Skeleton,
  Button,
  Divider,
  Stack,
  Alert,
} from "@mantine/core";
import {
  ChevronRight,
  BookOpen,
  Edit3,
  Trash2,
  Plus,
  Volume2,
  ArrowLeft,
  AlertCircle,
  CheckCircle2,
  Sparkles,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";

import { AppShell } from "@/components/layout/AppShell";
import { TiptapViewer } from "@/components/forms/TiptapEditor";
import { useAuth } from "@/hooks/useAuth";
import { usePowerSyncProvider } from "@/lib/powersync/PowerSyncProvider";
import {
  createVocabularyService,
} from "@/features/vocabulary/vocabulary-service";
import { usePowerSyncQuery } from "@/hooks/usePowerSyncQuery";

import type { JSONContent } from "@tiptap/react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface WordDetails {
  id: string;
  word: string;
  normalized_word: string;
  phonetics: string | null;
  audio_url: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  version: number;
  definitions: DefinitionDetails[];
  tags: TagInfo[];
}

interface DefinitionDetails {
  id: string;
  meaning: string;
  part_of_speech: string;
  tiptap_note: JSONContent | null;
  requested_ai_example_count: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  version: number;
  examples: ExampleInfo[];
}

interface ExampleInfo {
  id: string;
  sentence: string;
  is_ai_generated: boolean;
  created_at: string;
}

interface TagInfo {
  id: string;
  name: string;
  color: string | null;
}

// ---------------------------------------------------------------------------
// Tag Color Helper
// ---------------------------------------------------------------------------

const DEFAULT_TAG_COLORS = [
  "#7c3aed", "#2563eb", "#059669", "#d97706", "#dc2626",
  "#7c2d12", "#4f46e5", "#0891b2", "#65a30d", "#c026d3",
];

function getDefaultColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return DEFAULT_TAG_COLORS[Math.abs(hash) % DEFAULT_TAG_COLORS.length];
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function WordDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const { db } = usePowerSyncProvider();
  const wordId = params.id as string;

  const [wordDetails, setWordDetails] = useState<WordDetails | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [deleteState, setDeleteState] = useState<"idle" | "confirming" | "deleting">("idle");
  const [actionFeedback, setActionFeedback] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  // Watch for changes to the word via reactive query
  const { data: wordRow } = usePowerSyncQuery<{
    id: string;
    updated_at: string;
  }>(
    `SELECT id, updated_at FROM words WHERE id = ? AND deleted_at IS NULL`,
    [wordId]
  );

  // Load full word details whenever the word data changes
  useEffect(() => {
    let cancelled = false;

    async function loadDetails() {
      if (!wordId) return;

      try {
        setIsLoading(true);
        const vocabService = createVocabularyService(db);
        const details = await vocabService.getWordWithDetails(wordId);

        if (!cancelled) {
          setWordDetails(details as WordDetails | null);
          setIsLoading(false);
        }
      } catch (error) {
        console.error("Failed to load word details:", error);
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    loadDetails();

    return () => {
      cancelled = true;
    };
  }, [wordId, db, wordRow]);

  // -------------------------------------------------------------------------
  // Delete Word
  // -------------------------------------------------------------------------

  const handleDeleteWord = useCallback(async () => {
    if (deleteState !== "confirming") {
      setDeleteState("confirming");
      return;
    }

    setDeleteState("deleting");
    try {
      const vocabService = createVocabularyService(db);
      await vocabService.softDeleteWord(wordId);
      setActionFeedback({ type: "success", message: "Word deleted successfully" });
      setTimeout(() => router.push("/words"), 1000);
    } catch (error) {
      setActionFeedback({
        type: "error",
        message: error instanceof Error ? error.message : "Failed to delete word",
      });
      setDeleteState("idle");
    }
  }, [deleteState, db, wordId, router]);

  // -------------------------------------------------------------------------
  // Delete Definition
  // -------------------------------------------------------------------------

  const handleDeleteDefinition = useCallback(
    async (definitionId: string) => {
      try {
        const vocabService = createVocabularyService(db);
        await vocabService.softDeleteDefinition(definitionId);
        setActionFeedback({ type: "success", message: "Definition removed" });
        // Reload details
        const details = await vocabService.getWordWithDetails(wordId);
        setWordDetails(details as WordDetails | null);
      } catch (error) {
        setActionFeedback({
          type: "error",
          message: error instanceof Error ? error.message : "Failed to remove definition",
        });
      }
    },
    [db, wordId]
  );

  // -------------------------------------------------------------------------
  // Render: Loading
  // -------------------------------------------------------------------------

  if (isLoading) {
    return (
      <AppShell>
        <Container size="md" py="xl">
          <Skeleton height={20} width={200} mb="lg" />
          <Skeleton height={40} width={300} mb="sm" />
          <Skeleton height={16} width={150} mb="xl" />
          <Skeleton height={120} mb="md" />
          <Skeleton height={120} mb="md" />
        </Container>
      </AppShell>
    );
  }

  // -------------------------------------------------------------------------
  // Render: Not Found
  // -------------------------------------------------------------------------

  if (!wordDetails) {
    return (
      <AppShell>
        <Container size="md" py="xl">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center py-20"
          >
            <div className="w-16 h-16 rounded-2xl bg-red-500/10 flex items-center justify-center mx-auto mb-4">
              <BookOpen size={28} className="text-red-400" />
            </div>
            <Title order={3} mb="xs">
              Word not found
            </Title>
            <Text c="dimmed" size="sm" mb="lg">
              This word may have been deleted or doesn&apos;t exist.
            </Text>
            <Button
              component={Link}
              href="/words"
              variant="subtle"
              leftSection={<ArrowLeft size={14} />}
            >
              Back to Words
            </Button>
          </motion.div>
        </Container>
      </AppShell>
    );
  }

  // -------------------------------------------------------------------------
  // Render: Word Detail
  // -------------------------------------------------------------------------

  return (
    <AppShell>
      <Container size="md" py="xl">
        {/* Feedback Alert */}
        <AnimatePresence>
          {actionFeedback && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
            >
              <Alert
                icon={
                  actionFeedback.type === "success" ? (
                    <CheckCircle2 size={16} />
                  ) : (
                    <AlertCircle size={16} />
                  )
                }
                color={actionFeedback.type === "success" ? "green" : "red"}
                variant="light"
                mb="md"
                withCloseButton
                onClose={() => setActionFeedback(null)}
              >
                {actionFeedback.message}
              </Alert>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Breadcrumbs */}
        <Breadcrumbs
          separator={<ChevronRight size={14} />}
          mb="lg"
          styles={{
            separator: { color: "var(--color-text-tertiary)" },
          }}
        >
          <Anchor component={Link} href="/" size="sm" c="dimmed">
            Dashboard
          </Anchor>
          <Anchor component={Link} href="/words" size="sm" c="dimmed">
            Words
          </Anchor>
          <Text size="sm" c="white" lineClamp={1}>
            {wordDetails.word}
          </Text>
        </Breadcrumbs>

        {/* Word Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          <div className="flex items-start justify-between mb-6">
            <div>
              <Group gap="md" align="baseline" mb={4}>
                <Title order={1} className="gradient-text">
                  {wordDetails.word}
                </Title>
                {wordDetails.audio_url && (
                  <Tooltip label="Play pronunciation" withArrow>
                    <ActionIcon
                      variant="subtle"
                      color="violet"
                      onClick={() => {
                        if (wordDetails.audio_url) {
                          const audio = new Audio(wordDetails.audio_url);
                          audio.play().catch(console.error);
                        }
                      }}
                    >
                      <Volume2 size={18} />
                    </ActionIcon>
                  </Tooltip>
                )}
              </Group>

              {wordDetails.phonetics && (
                <Text size="lg" c="dimmed" mb="xs" ff="monospace">
                  {wordDetails.phonetics}
                </Text>
              )}

              {/* Tags */}
              {wordDetails.tags.length > 0 && (
                <Group gap="xs" mt="sm">
                  {wordDetails.tags.map((tag) => (
                    <Badge
                      key={tag.id}
                      variant="filled"
                      size="sm"
                      style={{
                        backgroundColor:
                          tag.color || getDefaultColor(tag.name),
                      }}
                    >
                      {tag.name}
                    </Badge>
                  ))}
                </Group>
              )}
            </div>

            {/* Actions */}
            {user && (
              <Group gap="xs">
                <Tooltip label="Edit word" withArrow>
                  <ActionIcon
                    variant="subtle"
                    color="violet"
                    component={Link}
                    href={`/words/${wordId}/edit`}
                  >
                    <Edit3 size={16} />
                  </ActionIcon>
                </Tooltip>
                <Tooltip
                  label={
                    deleteState === "confirming"
                      ? "Click again to confirm"
                      : "Delete word"
                  }
                  withArrow
                >
                  <ActionIcon
                    variant="subtle"
                    color={deleteState === "confirming" ? "red" : "gray"}
                    onClick={handleDeleteWord}
                    loading={deleteState === "deleting"}
                  >
                    <Trash2 size={16} />
                  </ActionIcon>
                </Tooltip>
              </Group>
            )}
          </div>
        </motion.div>

        <Divider mb="lg" />

        {/* Definitions */}
        <Stack gap="lg">
          {wordDetails.definitions.map((def, index) => (
            <motion.div
              key={def.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: index * 0.05 }}
            >
              <div className="glass-card rounded-xl p-5">
                {/* Definition Header */}
                <div className="flex items-start justify-between mb-3">
                  <Group gap="sm">
                    <Badge
                      variant="light"
                      color="violet"
                      size="sm"
                    >
                      {def.part_of_speech}
                    </Badge>
                    <Text size="xs" c="dimmed">
                      Definition {index + 1}
                    </Text>
                  </Group>

                  {user && wordDetails.definitions.length > 1 && (
                    <Tooltip label="Remove definition" withArrow>
                      <ActionIcon
                        variant="subtle"
                        color="red"
                        size="sm"
                        onClick={() => handleDeleteDefinition(def.id)}
                      >
                        <Trash2 size={14} />
                      </ActionIcon>
                    </Tooltip>
                  )}
                </div>

                {/* Meaning */}
                <Text size="md" fw={500} mb="sm">
                  {def.meaning}
                </Text>

                {/* Tiptap Notes */}
                {def.tiptap_note && (
                  <div className="mt-3 pl-3 border-l-2 border-violet-500/30">
                    <Text size="xs" c="dimmed" mb="xs" fw={600}>
                      Notes
                    </Text>
                    <TiptapViewer content={def.tiptap_note} />
                  </div>
                )}

                {/* Examples */}
                {def.examples.length > 0 && (
                  <div className="mt-4">
                    <Text size="xs" c="dimmed" mb="xs" fw={600}>
                      Examples
                    </Text>
                    <Stack gap="xs">
                      {def.examples.map((example) => (
                        <div
                          key={example.id}
                          className="flex items-start gap-2 pl-3 border-l-2 border-emerald-500/30"
                        >
                          <Text size="sm" className="italic">
                            &ldquo;{example.sentence}&rdquo;
                          </Text>
                          {example.is_ai_generated && (
                            <Tooltip label="AI-generated" withArrow>
                              <Sparkles
                                size={12}
                                className="text-amber-400 shrink-0 mt-1"
                              />
                            </Tooltip>
                          )}
                        </div>
                      ))}
                    </Stack>
                  </div>
                )}

                {/* AI Example Request Info */}
                {def.requested_ai_example_count > 0 &&
                  def.examples.filter((e) => e.is_ai_generated).length <
                    def.requested_ai_example_count && (
                    <div className="mt-3 flex items-center gap-1.5 text-xs text-amber-400/70">
                      <Sparkles size={12} />
                      <span>
                        {def.requested_ai_example_count -
                          def.examples.filter((e) => e.is_ai_generated)
                            .length}{" "}
                        AI example(s) pending generation
                      </span>
                    </div>
                  )}
              </div>
            </motion.div>
          ))}
        </Stack>

        {/* Add Definition Button */}
        {user && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
          >
            <Button
              variant="subtle"
              leftSection={<Plus size={14} />}
              mt="lg"
              fullWidth
              component={Link}
              href={`/words/${wordId}/edit`}
            >
              Add another definition
            </Button>
          </motion.div>
        )}

        {/* Meta Info */}
        <Divider mt="xl" mb="md" />
        <Group justify="space-between">
          <Text size="xs" c="dimmed">
            Added{" "}
            {new Date(wordDetails.created_at).toLocaleDateString("en-US", {
              year: "numeric",
              month: "long",
              day: "numeric",
            })}
          </Text>
          <Text size="xs" c="dimmed">
            Version {wordDetails.version}
          </Text>
        </Group>
      </Container>
    </AppShell>
  );
}
