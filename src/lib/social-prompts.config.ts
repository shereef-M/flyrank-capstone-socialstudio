import type { Platform } from "@prisma/client";

/** The one shared voice every platform caption starts from. */
export const BRAND_VOICE =
  "Friendly, direct, a little playful — never salesy. Explain the 'why', not just the 'what'.";

export type PlatformRules = {
  tone: string;
  maxLength: number;
  useHashtags: boolean;
  cta: string;
};

/**
 * Per-platform rules — each platform gets its own fragment, composed with
 * BRAND_VOICE at caption-build time rather than writing out a full separate
 * prompt per platform.
 */
export const PLATFORM_RULES: Record<Platform, PlatformRules> = {
  instagram: {
    tone: "Casual and visual, short sentences, a sparing emoji is welcome.",
    maxLength: 2200,
    useHashtags: true,
    cta: "Full story — link in bio.",
  },
  x: {
    tone: "Punchy and direct, no emoji, every word earns its place.",
    maxLength: 280,
    useHashtags: false,
    cta: "Read more:",
  },
};
