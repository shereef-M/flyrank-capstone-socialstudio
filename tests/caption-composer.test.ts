import { describe, it, expect } from "vitest";
import type { Campaign } from "@prisma/client";
import { composeCaption } from "../src/lib/caption-composer";

function fakeCampaign(overrides: Partial<Campaign> = {}): Campaign {
  return {
    id: "test-campaign-id",
    blogPostId: "blog-123",
    title: "Why Idempotency Matters More Than You Think",
    body: "A retried request should never create a second record. This post walks through the idempotency-key pattern and why it's the heart of a reliable publishing system.",
    sourceImageUrl: "",
    status: "draft",
    scheduledFor: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe("composeCaption", () => {
  it("produces a different caption per platform from the same content", () => {
    const campaign = fakeCampaign();
    const instagram = composeCaption(campaign, "instagram");
    const x = composeCaption(campaign, "x");
    expect(instagram).not.toBe(x);
  });

  it("includes hashtags for instagram but not for x", () => {
    const campaign = fakeCampaign();
    const instagram = composeCaption(campaign, "instagram");
    const x = composeCaption(campaign, "x");
    expect(instagram).toMatch(/#\w+/);
    expect(x).not.toMatch(/#\w+/);
  });

  it("respects x's character limit", () => {
    const campaign = fakeCampaign();
    const x = composeCaption(campaign, "x");
    expect(x.length).toBeLessThanOrEqual(280);
  });
});