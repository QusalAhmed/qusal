// =============================================================================
// Google Gemma AI Provider
// =============================================================================
// Uses Google AI Studio (Gemini API) with a Gemma model to generate
// vocabulary example sentences.
//
// Requires: GOOGLE_AI_API_KEY environment variable.
// SDK: @google/genai
// =============================================================================

import { GoogleGenAI } from "@google/genai";
import type { AIProviderAdapter, GenerateExamplesInput } from "../types";
import { getSystemPrompt, getUserPrompt, parseAIResponse } from "../prompt";

const MODEL_NAME = "gemini-3.6-flash";

/**
 * Creates a Gemma provider instance bound to the given API key.
 */
export function createGemmaProvider(apiKey: string): AIProviderAdapter {
  if (!apiKey) {
    throw new Error(
      "GOOGLE_AI_API_KEY is required for the Gemma provider. " +
        "Get one at: https://aistudio.google.com/apikey"
    );
  }

  const ai = new GoogleGenAI({ apiKey });

  return {
    async generateExamples(input: GenerateExamplesInput): Promise<string[]> {
      const response = await ai.models.generateContent({
        model: MODEL_NAME,
        contents: getUserPrompt(input),
        config: {
          systemInstruction: getSystemPrompt(),
          temperature: 0.8,
          topP: 0.9,
          maxOutputTokens: 1024,
          responseMimeType: "application/json",
        },
      });

      const text = response.text;
      if (!text) {
        throw new Error("Gemma returned an empty response");
      }

      return parseAIResponse(text);
    },
  };
}
