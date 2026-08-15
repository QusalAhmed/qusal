"use client";

// =============================================================================
// Words List Page (Public Read-Only)
// =============================================================================
// Displays all words from the local PowerSync database.
// Accessible to all users, including anonymous visitors.
// Search/filter capabilities with virtualized list.
// =============================================================================

import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { TextInput, Badge } from "@mantine/core";
import { BookOpen, Search, Volume2 } from "lucide-react";
import { usePowerSyncQuery } from "@/hooks/usePowerSyncQuery";
import { AppShell } from "@/components/layout/AppShell";

interface WordRow {
  id: string;
  word: string;
  phonetics: string | null;
  definition_count: number;
  tag_names: string | null;
}

export default function WordsPage() {
  const [searchQuery, setSearchQuery] = useState("");

  // Query words with definition count and tags
  const { data: words } = usePowerSyncQuery<WordRow>(
    `SELECT
       w.id,
       w.word,
       w.phonetics,
       (SELECT COUNT(*) FROM definitions d WHERE d.word_id = w.id AND d.deleted_at IS NULL) as definition_count,
       (SELECT GROUP_CONCAT(t.name, ', ')
        FROM word_tags wt
        JOIN tags t ON t.id = wt.tag_id AND t.deleted_at IS NULL
        WHERE wt.word_id = w.id) as tag_names
     FROM words w
     WHERE w.deleted_at IS NULL
     ORDER BY w.word COLLATE NOCASE ASC`
  );

  // Client-side search filter
  const filteredWords = useMemo(() => {
    if (!Array.isArray(words)) return [];
    if (!searchQuery.trim()) return words;

    const query = searchQuery.toLowerCase().trim();
    return words.filter(
      (w) =>
        w.word.toLowerCase().includes(query) ||
        (w.tag_names && w.tag_names.toLowerCase().includes(query))
    );
  }, [words, searchQuery]);

  return (
    <AppShell>
      <div className="space-y-6">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
        >
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-white">
              Words
            </h1>
            <p className="text-sm text-[var(--color-text-secondary)] mt-1">
              {filteredWords.length} word{filteredWords.length !== 1 ? "s" : ""}{" "}
              in the knowledge base
            </p>
          </div>
        </motion.div>

        {/* Search */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.4 }}
        >
          <TextInput
            placeholder="Search words or tags..."
            leftSection={<Search size={16} />}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.currentTarget.value)}
            size="md"
            styles={{
              input: {
                backgroundColor: "var(--color-surface-raised)",
                borderColor: "var(--color-border)",
                color: "var(--color-text-primary)",
              },
            }}
          />
        </motion.div>

        {/* Word List */}
        <div className="space-y-2">
          <AnimatePresence mode="popLayout">
            {filteredWords.map((word, index) => (
              <motion.div
                key={word.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.98 }}
                transition={{ delay: Math.min(index * 0.03, 0.3), duration: 0.3 }}
                className="card-hover rounded-xl bg-[var(--color-surface-raised)] border border-[var(--color-border)] p-4 cursor-pointer"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="p-2 rounded-lg bg-[var(--color-surface-overlay)] border border-[var(--color-border-subtle)] shrink-0">
                      <BookOpen
                        size={16}
                        className="text-indigo-400"
                      />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-base font-semibold text-white truncate">
                          {word.word}
                        </span>
                        {word.phonetics && (
                          <span className="text-xs text-[var(--color-text-tertiary)] font-mono hidden sm:inline">
                            {word.phonetics}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs text-[var(--color-text-tertiary)]">
                          {word.definition_count} definition
                          {word.definition_count !== 1 ? "s" : ""}
                        </span>
                        {word.tag_names && (
                          <div className="flex items-center gap-1 overflow-hidden">
                            {word.tag_names
                              .split(", ")
                              .slice(0, 3)
                              .map((tag) => (
                                <Badge
                                  key={tag}
                                  size="xs"
                                  variant="outline"
                                  color="indigo"
                                  className="shrink-0"
                                >
                                  {tag}
                                </Badge>
                              ))}
                            {word.tag_names.split(", ").length > 3 && (
                              <span className="text-xs text-[var(--color-text-tertiary)]">
                                +{word.tag_names.split(", ").length - 3}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {word.phonetics && (
                    <button
                      className="p-2 rounded-lg text-[var(--color-text-tertiary)] hover:text-white hover:bg-[var(--color-surface-overlay)] transition-colors shrink-0"
                      title="Play pronunciation"
                    >
                      <Volume2 size={16} />
                    </button>
                  )}
                </div>
              </motion.div>
            ))}
          </AnimatePresence>

          {/* Empty State */}
          {filteredWords.length === 0 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-center py-16"
            >
              <div className="w-16 h-16 rounded-2xl bg-[var(--color-surface-overlay)] flex items-center justify-center mx-auto mb-4 border border-[var(--color-border)]">
                <Search
                  size={24}
                  className="text-[var(--color-text-tertiary)]"
                />
              </div>
              <h3 className="text-base font-semibold text-white mb-1">
                {searchQuery ? "No matches found" : "No words yet"}
              </h3>
              <p className="text-sm text-[var(--color-text-tertiary)]">
                {searchQuery
                  ? "Try adjusting your search query"
                  : "Words will appear here once they're added to the knowledge base"}
              </p>
            </motion.div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
