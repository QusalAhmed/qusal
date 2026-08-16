"use client";

// =============================================================================
// Definition Fields Component
// =============================================================================
// Renders the form fields for a single definition within the Word form.
// Supports: meaning, part of speech, Tiptap notes, AI example count.
//
// Used as a repeated section in a useFieldArray — each definition gets one.
// =============================================================================

import {
  TextInput,
  Select,
  NumberInput,
  Tooltip,
  ActionIcon,
  Collapse,
  Group,
  Text,
} from "@mantine/core";
import { Trash2, ChevronDown, ChevronUp, BookOpen, Sparkles } from "lucide-react";
import { useState, useCallback } from "react";
import { Controller, type UseFormReturn, type FieldErrors } from "react-hook-form";
import { TiptapEditor } from "./TiptapEditor";
import { PARTS_OF_SPEECH } from "@/types";
import type { JSONContent } from "@tiptap/react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DefinitionFormValues {
  meaning: string;
  part_of_speech: "noun" | "verb" | "adjective" | "adverb" | "preposition" | "conjunction" | "interjection" | "pronoun" | "determiner" | "particle" | "other";
  tiptap_note: JSONContent | null;
  requested_ai_example_count: number;
}

export interface WordFormValues {
  word: string;
  phonetics: string;
  audio_url: string;
  definitions: DefinitionFormValues[];
  tag_ids: string[];
}

interface DefinitionFieldsProps {
  /** The index of this definition in the field array */
  index: number;
  /** React Hook Form instance */
  form: UseFormReturn<WordFormValues>;
  /** Called when this definition should be removed */
  onRemove: () => void;
  /** Whether removal is allowed (at least 1 definition required) */
  canRemove: boolean;
  /** Nested field errors for this definition */
  errors?: FieldErrors<DefinitionFormValues>;
}

// ---------------------------------------------------------------------------
// Part of Speech Options
// ---------------------------------------------------------------------------

const POS_OPTIONS = PARTS_OF_SPEECH.map((pos) => ({
  value: pos,
  label: pos.charAt(0).toUpperCase() + pos.slice(1),
}));

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function DefinitionFields({
  index,
  form,
  onRemove,
  canRemove,
  errors,
}: DefinitionFieldsProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [showNotes, setShowNotes] = useState(false);

  const toggleExpand = useCallback(() => {
    setIsExpanded((v) => !v);
  }, []);

  const toggleNotes = useCallback(() => {
    setShowNotes((v) => !v);
  }, []);

  const { register } = form;

  return (
    <div className="rounded-lg border border-[var(--glass-border)] overflow-hidden">
      {/* Header */}
      <div
        className="flex items-center justify-between px-3 py-2 cursor-pointer"
        style={{ background: "var(--glass-bg)" }}
        onClick={toggleExpand}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            toggleExpand();
          }
        }}
      >
        <Group gap="xs">
          {isExpanded ? (
            <ChevronUp size={14} />
          ) : (
            <ChevronDown size={14} />
          )}
          <Text size="sm" fw={600}>
            Definition {index + 1}
          </Text>
          {!isExpanded && form.watch(`definitions.${index}.meaning`) && (
            <Text size="xs" c="dimmed" lineClamp={1} maw={300}>
              — {form.watch(`definitions.${index}.meaning`)}
            </Text>
          )}
        </Group>

        {canRemove && (
          <Tooltip label="Remove definition" withArrow>
            <ActionIcon
              variant="subtle"
              color="red"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                onRemove();
              }}
              aria-label="Remove definition"
            >
              <Trash2 size={14} />
            </ActionIcon>
          </Tooltip>
        )}
      </div>

      {/* Body */}
      <Collapse expanded={isExpanded}>
        <div className="p-3 space-y-3">
          {/* Meaning */}
          <TextInput
            label="Meaning"
            placeholder="Enter the definition meaning…"
            required
            error={errors?.meaning?.message}
            {...register(`definitions.${index}.meaning`)}
          />

          {/* Part of Speech + AI Example Count row */}
          <div className="grid grid-cols-2 gap-3">
            <Controller
              control={form.control}
              name={`definitions.${index}.part_of_speech`}
              render={({ field }) => (
                <Select
                  label="Part of Speech"
                  placeholder="Select…"
                  required
                  data={POS_OPTIONS}
                  value={field.value}
                  onChange={(val) => field.onChange(val ?? "noun")}
                  error={errors?.part_of_speech?.message}
                  leftSection={<BookOpen size={14} />}
                />
              )}
            />

            <Controller
              control={form.control}
              name={`definitions.${index}.requested_ai_example_count`}
              render={({ field }) => (
                <NumberInput
                  label="AI Examples"
                  placeholder="0"
                  min={0}
                  max={10}
                  value={field.value}
                  onChange={(val) => field.onChange(typeof val === "number" ? val : 0)}
                  error={errors?.requested_ai_example_count?.message}
                  leftSection={<Sparkles size={14} />}
                />
              )}
            />
          </div>

          {/* Tiptap Notes Toggle + Editor */}
          <div>
            <button
              type="button"
              onClick={toggleNotes}
              className="flex items-center gap-1 text-xs text-[var(--mantine-color-dimmed)] hover:text-[var(--mantine-color-text)] transition-colors mb-2"
            >
              {showNotes ? (
                <ChevronUp size={12} />
              ) : (
                <ChevronDown size={12} />
              )}
              {showNotes ? "Hide notes" : "Add notes (rich text)"}
            </button>

            <Collapse expanded={showNotes}>
              <Controller
                control={form.control}
                name={`definitions.${index}.tiptap_note`}
                render={({ field }) => (
                  <TiptapEditor
                    content={field.value}
                    onChange={field.onChange}
                    placeholder="Add notes, mnemonics, etymology, usage tips…"
                  />
                )}
              />
            </Collapse>
          </div>
        </div>
      </Collapse>
    </div>
  );
}
