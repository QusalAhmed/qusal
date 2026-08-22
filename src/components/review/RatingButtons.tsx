"use client";

// =============================================================================
// Rating Buttons Component
// =============================================================================
// Four FSRS grading buttons: Again, Hard, Good, Easy.
// Shows next interval preview text on each button.
// =============================================================================

import { Button, Group, Text, Stack } from "@mantine/core";
import { motion } from "framer-motion";
import { Rating } from "ts-fsrs";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface RatingButtonsProps {
  /** Preview intervals for each rating { 1: "< 10m", 2: "1d", ... } */
  intervals: Record<number, string>;
  /** Called when user selects a rating */
  onRate: (rating: number) => void;
  /** Disable buttons during processing */
  disabled?: boolean;
}

// ---------------------------------------------------------------------------
// Button Configs
// ---------------------------------------------------------------------------

const ratingConfigs = [
  {
    rating: Rating.Again,
    label: "Again",
    color: "red",
    shortcut: "1",
  },
  {
    rating: Rating.Hard,
    label: "Hard",
    color: "orange",
    shortcut: "2",
  },
  {
    rating: Rating.Good,
    label: "Good",
    color: "green",
    shortcut: "3",
  },
  {
    rating: Rating.Easy,
    label: "Easy",
    color: "blue",
    shortcut: "4",
  },
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function RatingButtons({
  intervals,
  onRate,
  disabled = false,
}: RatingButtonsProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: 0.1 }}
      className="w-full max-w-lg mx-auto"
    >
      <Text size="xs" c="dimmed" ta="center" mb="sm">
        How well did you remember?
      </Text>

      <Group gap="sm" justify="center" grow>
        {ratingConfigs.map((config) => (
          <Stack key={config.rating} gap={4} align="center">
            <Button
              variant="light"
              color={config.color}
              size="md"
              fullWidth
              onClick={() => onRate(config.rating)}
              disabled={disabled}
              styles={{
                root: {
                  transition: "all 0.2s ease",
                  minWidth: 80,
                },
              }}
            >
              {config.label}
            </Button>
            <Text size="xs" c="dimmed">
              {intervals[config.rating] || "—"}
            </Text>
            <Text size="xs" c="dimmed" className="opacity-50">
              [{config.shortcut}]
            </Text>
          </Stack>
        ))}
      </Group>
    </motion.div>
  );
}
