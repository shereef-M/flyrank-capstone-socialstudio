import { prisma } from "./prisma";
import { rollupCampaignStatus } from "./campaign-status";
import { FakeInstagramPublisher, FakeXPublisher } from "../adapters/social-publisher";
import type { SocialPublisher } from "../adapters/social-publisher";
import type { Platform } from "@prisma/client";

const publishers: Record<Platform, SocialPublisher> = {
  instagram: new FakeInstagramPublisher(),
  x: new FakeXPublisher(),
};

export async function publishCampaign(
  campaignId: string,
  opts: { simulateRateLimit?: boolean } = {}
) {
  const campaign = await prisma.campaign.findUnique({
    where: { id: campaignId },
    include: { posts: true },
  });
  if (!campaign) {
    throw new Error(`Campaign ${campaignId} not found`);
  }

  await prisma.campaign.update({
    where: { id: campaign.id },
    data: { status: "publishing" },
  });

  const results = await Promise.all(
    campaign.posts.map(async (post) => {
      try {
        await prisma.socialPostEntry.update({
          where: { id: post.id },
          data: { status: "publishing" },
        });

        const publisher = publishers[post.platform];
        const result = await publisher.publish(
          {
            socialPostEntryId: post.id,
            caption: post.caption ?? "",
            imageUrl: post.imageVariantUrl ?? "",
            idempotencyKey: post.idempotencyKey,
          },
          opts
        );

        if (result.deduplicated) {
          await prisma.socialPostEntry.update({
            where: { id: post.id },
            data: { status: "published", externalPostId: result.externalPostId },
          });
        }

        return { platform: post.platform, accepted: true, ...result };
      } catch (err) {
        await prisma.socialPostEntry.update({
          where: { id: post.id },
          data: { status: "failed" },
        });
        return {
          platform: post.platform,
          accepted: false,
          error: err instanceof Error ? err.message : "unknown error",
        };
      }
    })
  );

  await rollupCampaignStatus(campaign.id);

  return { campaignId: campaign.id, results };
}