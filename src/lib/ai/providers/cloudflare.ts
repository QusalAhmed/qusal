// =============================================================================
// Cloudflare Workers AI Provider
// =============================================================================
// Uses the Cloudflare Workers AI REST API to generate vocabulary example
// sentences using Llama-family models.
//
// Requires: CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_AI_API_TOKEN.
// No additional npm dependencies — uses native fetch.
// =============================================================================

import type { AIProviderAdapter, GenerateExamplesInput } from "../types";
import { getSystemPrompt, getUserPrompt, parseAIResponse } from "../prompt";

const MODEL = "@cf/meta/llama-3.1-8b-instruct";

/**
 * Cloudflare Workers AI response shape.
 */
interface CloudflareAIResponse {
  success: boolean;
  errors: Array<{ message: string }>;
  result: {
    response: string;
  };
}

/**
 * Creates a Cloudflare Workers AI provider instance.
 */
export function createCloudflareProvider(
  accountId: string,
  apiToken: string
): AIProviderAdapter {
  if (!accountId || !apiToken) {
    throw new Error(
      "CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_AI_API_TOKEN are required for the Cloudflare provider. " +
        "Get credentials at: https://dash.cloudflare.com → AI → Workers AI"
    );
  }

  const baseUrl = `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/${MODEL}`;

  return {
    async generateExamples(input: GenerateExamplesInput): Promise<string[]> {
      const response = await fetch(baseUrl, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messages: [
            { role: "system", content: getSystemPrompt() },
            { role: "user", content: getUserPrompt(input) },
          ],
          temperature: 0.8,
          max_tokens: 1024,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `Cloudflare AI request failed (${response.status}): ${errorText}`
        );
      }

      const data = (await response.json()) as CloudflareAIResponse;

      if (!data.success) {
        const errorMsg =
          data.errors?.map((e) => e.message).join(", ") ||
          "Unknown Cloudflare AI error";
        throw new Error(`Cloudflare AI error: ${errorMsg}`);
      }

      const text = data.result?.response;
      if (!text) {
        throw new Error("Cloudflare AI returned an empty response");
      }

      return parseAIResponse(text);
    },
  };
}
