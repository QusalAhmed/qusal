// =============================================================================
// AI Example Generation API Route
// =============================================================================
// POST /api/ai/examples
//
// Accepts: { word, meaning, partOfSpeech, count }
// Returns: { sentences: string[], provider: string }
//
// Authentication: Requires a valid Supabase JWT.
// The AI API keys stay server-side — the client only sends word metadata.
// =============================================================================

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";
import { publicEnv, serverEnv } from "@/lib/env";
import { generateExamples } from "@/lib/ai/generate-examples";

// ---------------------------------------------------------------------------
// Request Validation
// ---------------------------------------------------------------------------

const requestSchema = z.object({
  word: z.string().min(1).max(200),
  meaning: z.string().min(1).max(2000),
  partOfSpeech: z.string().min(1).max(50),
  count: z.number().int().min(1).max(10).default(3),
});

// ---------------------------------------------------------------------------
// Route Handler
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  try {
    // 1. Authenticate — extract JWT from Authorization header
    const authHeader = request.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json(
        { error: "Missing or invalid Authorization header" },
        { status: 401 }
      );
    }

    const token = authHeader.slice(7);

    // Verify the JWT via Supabase
    const supabase = createClient(
      publicEnv.NEXT_PUBLIC_SUPABASE_URL,
      serverEnv.SUPABASE_SERVICE_ROLE_KEY
    );

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return NextResponse.json(
        { error: "Authentication failed" },
        { status: 401 }
      );
    }

    // 2. Parse and validate request body
    const body = await request.json();
    const parseResult = requestSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        {
          error: "Invalid request body",
          details: parseResult.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    // 3. Generate examples via AI
    const result = await generateExamples(parseResult.data);

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    console.error("[AI Examples] Generation failed:", error);

    const message =
      error instanceof Error
        ? error.message
        : "An unexpected error occurred during example generation";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
