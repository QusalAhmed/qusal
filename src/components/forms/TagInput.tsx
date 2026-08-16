"use client";

// =============================================================================
// Tag Input Component
// =============================================================================
// A combobox-based tag selector that allows:
//   - Searching existing tags
//   - Selecting multiple tags
//   - Creating new tags on-the-fly by typing and pressing Enter
//   - Removing selected tags
//
// Uses local PowerSync data for the tag list, with optimistic create-on-fly.
// =============================================================================

import { useState, useCallback } from "react";
import {
  Combobox,
  Pill,
  PillsInput,
  Group,
  Text,
  useCombobox,
  ScrollArea,
  Badge,
} from "@mantine/core";
import { Plus, Tag as TagIcon } from "lucide-react";
import { usePowerSyncQuery } from "@/hooks/usePowerSyncQuery";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TagOption {
  id: string;
  name: string;
  color: string | null;
}

interface TagInputProps {
  /** Currently selected tag IDs */
  value: string[];
  /** Called when selection changes */
  onChange: (tagIds: string[]) => void;
  /** Called when a new tag needs to be created */
  onCreateTag: (name: string) => Promise<TagOption>;
  /** Whether the input is disabled */
  disabled?: boolean;
  /** Placeholder text */
  placeholder?: string;
}

// ---------------------------------------------------------------------------
// Tag Color Map (default palette for tags without custom colors)
// ---------------------------------------------------------------------------

const DEFAULT_TAG_COLORS = [
  "#7c3aed", // violet
  "#2563eb", // blue
  "#059669", // emerald
  "#d97706", // amber
  "#dc2626", // red
  "#7c2d12", // brown
  "#4f46e5", // indigo
  "#0891b2", // cyan
  "#65a30d", // lime
  "#c026d3", // fuchsia
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

export function TagInput({
  value,
  onChange,
  onCreateTag,
  disabled = false,
  placeholder = "Search or create tags…",
}: TagInputProps) {
  const combobox = useCombobox({
    onDropdownClose: () => combobox.resetSelectedOption(),
    onDropdownOpen: () => combobox.updateSelectedOptionIndex("active"),
  });

  const [search, setSearch] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  // Query all active tags from local SQLite
  const { data: allTags } = usePowerSyncQuery<{
    id: string;
    name: string;
    color: string | null;
  }>(`SELECT id, name, color FROM tags WHERE deleted_at IS NULL ORDER BY name ASC`);

  const tags: TagOption[] = Array.isArray(allTags) ? allTags : [];

  // Selected tags (resolve IDs to full tag objects)
  const selectedTags = tags.filter((t) => value.includes(t.id));

  // Filter tags by search term, excluding already selected ones
  const filteredTags = tags.filter(
    (tag) =>
      !value.includes(tag.id) &&
      tag.name.toLowerCase().includes(search.trim().toLowerCase())
  );

  // Check if search matches any existing tag exactly
  const exactMatch = tags.some(
    (tag) => tag.name.toLowerCase() === search.trim().toLowerCase()
  );

  const handleSelect = useCallback(
    (tagId: string) => {
      if (tagId === "__create__") {
        // Create new tag
        handleCreateTag();
        return;
      }
      if (!value.includes(tagId)) {
        onChange([...value, tagId]);
      }
      setSearch("");
      combobox.closeDropdown();
    },
    [value, onChange, combobox, search]
  );

  const handleRemove = useCallback(
    (tagId: string) => {
      onChange(value.filter((id) => id !== tagId));
    },
    [value, onChange]
  );

  const handleCreateTag = useCallback(async () => {
    const trimmed = search.trim();
    if (!trimmed || isCreating) return;

    setIsCreating(true);
    try {
      const newTag = await onCreateTag(trimmed);
      onChange([...value, newTag.id]);
      setSearch("");
      combobox.closeDropdown();
    } catch (error) {
      console.error("Failed to create tag:", error);
    } finally {
      setIsCreating(false);
    }
  }, [search, isCreating, onCreateTag, value, onChange, combobox]);

  // Render selected tags as pills
  const pills = selectedTags.map((tag) => (
    <Pill
      key={tag.id}
      withRemoveButton={!disabled}
      onRemove={() => handleRemove(tag.id)}
      size="sm"
      styles={{
        root: {
          backgroundColor: tag.color || getDefaultColor(tag.name),
          color: "#fff",
        },
      }}
    >
      {tag.name}
    </Pill>
  ));

  // Render dropdown options
  const options = filteredTags.map((tag) => (
    <Combobox.Option value={tag.id} key={tag.id}>
      <Group gap="xs">
        <Badge
          size="xs"
          variant="filled"
          color={tag.color || getDefaultColor(tag.name)}
          circle
        >
          {" "}
        </Badge>
        <Text size="sm">{tag.name}</Text>
      </Group>
    </Combobox.Option>
  ));

  return (
    <Combobox
      store={combobox}
      onOptionSubmit={handleSelect}
      withinPortal={true}
    >
      <Combobox.DropdownTarget>
        <PillsInput
          pointer
          onClick={() => combobox.openDropdown()}
          disabled={disabled}
          leftSection={<TagIcon size={14} />}
          label="Tags"
        >
          <Pill.Group>
            {pills}

            <Combobox.EventsTarget>
              <PillsInput.Field
                value={search}
                placeholder={
                  value.length === 0 ? placeholder : ""
                }
                onChange={(event) => {
                  combobox.updateSelectedOptionIndex();
                  setSearch(event.currentTarget.value);
                  combobox.openDropdown();
                }}
                onFocus={() => combobox.openDropdown()}
                onBlur={() => combobox.closeDropdown()}
                onKeyDown={(event) => {
                  if (
                    event.key === "Backspace" &&
                    search === "" &&
                    value.length > 0
                  ) {
                    handleRemove(value[value.length - 1]);
                  }
                  if (
                    event.key === "Enter" &&
                    search.trim() &&
                    !exactMatch
                  ) {
                    event.preventDefault();
                    handleCreateTag();
                  }
                }}
              />
            </Combobox.EventsTarget>
          </Pill.Group>
        </PillsInput>
      </Combobox.DropdownTarget>

      <Combobox.Dropdown>
        <Combobox.Options>
          <ScrollArea.Autosize type="scroll" mah={200}>
            {options}

            {/* Create-new option */}
            {search.trim() && !exactMatch && (
              <Combobox.Option value="__create__" disabled={isCreating}>
                <Group gap="xs">
                  <Plus size={14} />
                  <Text size="sm">
                    Create &quot;{search.trim()}&quot;
                  </Text>
                </Group>
              </Combobox.Option>
            )}

            {/* Empty state */}
            {options.length === 0 && !search.trim() && (
              <Combobox.Empty>
                <Text size="sm" c="dimmed">
                  No tags yet. Type to create one.
                </Text>
              </Combobox.Empty>
            )}

            {options.length === 0 && search.trim() && exactMatch && (
              <Combobox.Empty>
                <Text size="sm" c="dimmed">
                  Tag already selected
                </Text>
              </Combobox.Empty>
            )}
          </ScrollArea.Autosize>
        </Combobox.Options>
      </Combobox.Dropdown>
    </Combobox>
  );
}
