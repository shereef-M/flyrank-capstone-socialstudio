import { prisma } from "./prisma";

/**
 * If every post in this campaign is now "published", flips the campaign
 * itself to "published" too. Safe to call redundantly — it's a rollup
 * derived from post statuses, not an independent state change.
 */
export async function rollupCampaignStatus(campaignId: string): Promise<void> {
  const posts = await prisma.socialPostEntry.findMany({
    where: { campaignId },
  });
  const allPublished =
    posts.length > 0 && posts.every((p) => p.status === "published");
  if (allPublished) {
    await prisma.campaign.update({
      where: { id: campaignId },
      data: { status: "published" },
    });
  }
}
