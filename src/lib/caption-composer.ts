import type { Campaign, Platform } from "@prisma/client";
import { BRAND_VOICE, PLATFORM_RULES } from "./social-prompts.config";

/** Trims text to a max length without cutting a word in half. */
function truncateAtWord(text: string, max: number): string {
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  const lastSpace = cut.lastIndexOf(" ");
  return (lastSpace > 0 ? cut.slice(0, lastSpace) : cut).trimEnd() + "…";
}

/** A handful of hashtags derived from the title's significant words. */
function hashtagsFromTitle(title: string): string {
  const words = title
    .split(/\s+/)
    .map((w) => w.replace(/[^a-zA-Z0-9]/g, ""))
    .filter((w) => w.length > 3)
    .slice(0, 3);
  return words.map((w) => `#${w}`).join(" ");
}

export function composeCaption(campaign: Campaign, platform: Platform): string {
  const rules = PLATFORM_RULES[platform];
  const link = `Read the full post: /blog/${campaign.blogPostId}`;

  const bodySummary = truncateAtWord(campaign.body.trim(), 160);

  const parts = [campaign.title, bodySummary];
  if (rules.useHashtags) {
    const tags = hashtagsFromTitle(campaign.title);
    if (tags) parts.push(tags);
  }
  parts.push(`${rules.cta} ${link}`.trim());

  const full = parts.filter(Boolean).join("\n\n");
  return truncateAtWord(full, rules.maxLength);
}

/** Exposed for tests/debugging — not used by the composer itself. */
export { BRAND_VOICE };
