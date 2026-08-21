// =============================================================================
// AI Example Generation — Provider Factory
// =============================================================================
// Selects the active AI provider based on environment configuration and
// delegates example generation. Server-only — never imported in client code.
// =============================================================================

import { serverEnv } from "@/lib/env";
import { publicEnv } from "@/lib/env";
import type {
  AIProvider,
  AIProviderAdapter,
  GenerateExamplesInput,
  GenerateExamplesResult,
} from "./types";
import { createGemmaProvider } from "./providers/gemma";
import { createCloudflareProvider } from "./providers/cloudflare";

/**
 * Returns the appropriate AI provider adapter based on the active configuration.
 */
function getProvider(provider: AIProvider): AIProviderAdapter {
  switch (provider) {
    case "gemma":
      return createGemmaProvider(serverEnv.GOOGLE_AI_API_KEY);
    case "cloudflare":
      return createCloudflareProvider(
        serverEnv.CLOUDFLARE_ACCOUNT_ID,
        serverEnv.CLOUDFLARE_AI_API_TOKEN
      );
    default:
      throw new Error(`Unknown AI provider: ${provider}`);
  }
}

/**
 * Generate example sentences for a vocabulary definition.
 * Uses the provider configured in NEXT_PUBLIC_AI_PROVIDER.
 *
 * @param input - Word, meaning, part of speech, and count
 * @returns Generated sentences and the provider used
 */
export async function generateExamples(
  input: GenerateExamplesInput
): Promise<GenerateExamplesResult> {
  const providerName = publicEnv.NEXT_PUBLIC_AI_PROVIDER as AIProvider;
  const provider = getProvider(providerName);

  const sentences = await provider.generateExamples(input);

  // Clamp to requested count (LLMs sometimes generate more/fewer)
  const clamped = sentences.slice(0, input.count);

  return {
    sentences: clamped,
    provider: providerName,
  };
}
