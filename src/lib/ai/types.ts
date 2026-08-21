// =============================================================================
// AI Layer Types
// =============================================================================
// Shared types for the AI example generation system.
// =============================================================================

/**
 * Supported AI providers for example generation.
 */
export type AIProvider = "gemma" | "cloudflare";

/**
 * Input for generating example sentences.
 */
export interface GenerateExamplesInput {
  /** The vocabulary word */
  word: string;
  /** The definition meaning */
  meaning: string;
  /** Part of speech (e.g., "noun", "verb") */
  partOfSpeech: string;
  /** Number of examples to generate (1-10) */
  count: number;
}

/**
 * Result from AI example generation.
 */
export interface GenerateExamplesResult {
  /** Array of generated example sentences */
  sentences: string[];
  /** Which provider was used */
  provider: AIProvider;
}

/**
 * Interface that all AI providers must implement.
 */
export interface AIProviderAdapter {
  /**
   * Generate example sentences for a vocabulary word/definition.
   */
  generateExamples(input: GenerateExamplesInput): Promise<string[]>;
}
