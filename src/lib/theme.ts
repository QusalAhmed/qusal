"use client";

// =============================================================================
// Mantine Theme Configuration
// =============================================================================
// Dark-first theme with premium aesthetics.
// Uses Inter font for UI and Geist Mono for code.
// =============================================================================

import { createTheme, MantineColorsTuple } from "@mantine/core";

/**
 * Custom primary color — a rich indigo-violet palette.
 * Tuned for dark mode first, with accessible contrast ratios.
 */
const primaryColor: MantineColorsTuple = [
  "#eef2ff", // 0 - lightest
  "#e0e7ff", // 1
  "#c7d2fe", // 2
  "#a5b4fc", // 3
  "#818cf8", // 4
  "#6366f1", // 5 - primary
  "#4f46e5", // 6
  "#4338ca", // 7
  "#3730a3", // 8
  "#312e81", // 9 - darkest
];

/**
 * Accent color — a warm amber for CTAs and highlights.
 */
const accentColor: MantineColorsTuple = [
  "#fffbeb",
  "#fef3c7",
  "#fde68a",
  "#fcd34d",
  "#fbbf24",
  "#f59e0b",
  "#d97706",
  "#b45309",
  "#92400e",
  "#78350f",
];

export const theme = createTheme({
  primaryColor: "indigo",
  colors: {
    indigo: primaryColor,
    amber: accentColor,
  },

  fontFamily:
    "'Inter', var(--font-geist-sans), -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
  fontFamilyMonospace:
    "var(--font-geist-mono), 'JetBrains Mono', 'Fira Code', monospace",

  headings: {
    fontFamily:
      "'Inter', var(--font-geist-sans), -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    fontWeight: "700",
  },

  defaultRadius: "md",

  components: {
    Button: {
      defaultProps: {
        radius: "md",
      },
    },
    TextInput: {
      defaultProps: {
        radius: "md",
      },
    },
    PasswordInput: {
      defaultProps: {
        radius: "md",
      },
    },
    Select: {
      defaultProps: {
        radius: "md",
      },
    },
    Card: {
      defaultProps: {
        radius: "lg",
        shadow: "sm",
      },
    },
    Modal: {
      defaultProps: {
        radius: "lg",
        centered: true,
      },
    },
    Paper: {
      defaultProps: {
        radius: "lg",
      },
    },
  },
});
