// =============================================================================
// AI Prompt Template
// =============================================================================
// Reusable prompt for generating vocabulary example sentences.
// Used by all AI providers to ensure consistent output format.
// =============================================================================

import type { GenerateExamplesInput } from "./types";

/**
 * Builds the system prompt for example sentence generation.
 */
export function getSystemPrompt(): string {
  return `You are an expert English language tutor. Your task is to generate clear, natural example sentences that demonstrate the specific meaning and usage of vocabulary words.

Rules:
- Each sentence must clearly demonstrate the given meaning and part of speech.
- Use diverse contexts (academic, everyday, professional, literary).
- Vary sentence structure and complexity (simple, compound, complex).
- Target an intermediate-to-advanced English learner.
- Keep sentences between 8 and 25 words.
- Do NOT include the definition in the sentence — demonstrate it through context.
- Do NOT number the sentences.

You MUST respond with valid JSON only. No markdown, no code fences, no explanation.`;
}

/**
 * Builds the user prompt for a specific word/definition.
 */
export function getUserPrompt(input: GenerateExamplesInput): string {
  return `Generate ${input.count} example sentence${input.count > 1 ? "s" : ""} for the word "${input.word}" used as a ${input.partOfSpeech}.

Meaning: "${input.meaning}"

Respond with this exact JSON format:
{"sentences": ["sentence 1", "sentence 2"]}`;
}

/**
 * Parses the AI response text into an array of sentences.
 * Handles common AI response quirks (markdown fences, extra text).
 */
export function parseAIResponse(responseText: string): string[] {
  // Strip markdown code fences if present
  let cleaned = responseText.trim();
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```(?:json)?\s*\n?/, "").replace(/\n?```\s*$/, "");
  }

  // Try to extract JSON from the response
  const jsonMatch = cleaned.match(/\{[\s\S]*"sentences"\s*:\s*\[[\s\S]*\]\s*\}/);
  if (jsonMatch) {
    cleaned = jsonMatch[0];
  }

  try {
    const parsed = JSON.parse(cleaned);
    if (Array.isArray(parsed.sentences)) {
      return parsed.sentences
        .filter((s: unknown): s is string => typeof s === "string" && s.trim().length > 0)
        .map((s: string) => s.trim());
    }
    // Fallback: if the response is a plain array
    if (Array.isArray(parsed)) {
      return parsed
        .filter((s: unknown): s is string => typeof s === "string" && s.trim().length > 0)
        .map((s: string) => s.trim());
    }
  } catch {
    // Last resort: try to split by newlines if JSON parsing fails
    const lines = cleaned
      .split("\n")
      .map((line) => line.replace(/^\d+\.\s*/, "").trim())
      .filter((line) => line.length > 10 && !line.startsWith("{") && !line.startsWith("["));
    if (lines.length > 0) {
      return lines;
    }
  }

  throw new Error("Failed to parse AI response into example sentences");
}
