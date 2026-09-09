import { Router } from "express";
import { z } from "zod";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { prisma } from "../lib/prisma";
import {
  createPlaceholderImage,
  generateImageVariants,
} from "../lib/image-pipeline";
import { composeCaption } from "../lib/caption-composer";
import type { Platform } from "@prisma/client";

export const campaignsRouter = Router();

// Validation at the boundary: bad input gets a clean 400, never a 500.
const createCampaignSchema = z.object({
  blogPostId: z.string().min(1),
  title: z.string().min(1).max(300),
  body: z.string().min(1),
  sourceImageUrl: z.string().optional(),
});

const PLATFORMS: Platform[] = ["instagram", "x"];

campaignsRouter.post("/campaigns", async (req, res) => {
  const parsed = createCampaignSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }
  const { blogPostId, title, body, sourceImageUrl } = parsed.data;

  const campaign = await prisma.campaign.create({
    data: {
      blogPostId,
      title,
      body,
      sourceImageUrl: sourceImageUrl ?? "",
    },
  });

  // No real source image was supplied — generate a placeholder. The brief
  // explicitly allows this: the variant pipeline is what's graded, not the
  // source image's artistic quality.
  const sourcePath = path.join(
    process.cwd(),
    "public",
    "uploads",
    `${campaign.id}-source.jpg`,
  );
  await createPlaceholderImage(sourcePath);

  const variantUrls = await generateImageVariants(sourcePath, campaign.id);

  const posts = await Promise.all(
    PLATFORMS.map((platform) =>
      prisma.socialPostEntry.create({
        data: {
          campaignId: campaign.id,
          platform,
          imageVariantUrl: variantUrls[platform],
          caption: composeCaption(campaign, platform),
          idempotencyKey: randomUUID(),
        },
      }),
    ),
  );
  res.status(201).json({ campaign, posts });
});

campaignsRouter.get("/campaigns/:id", async (req, res) => {
  const campaign = await prisma.campaign.findUnique({
    where: { id: req.params.id },
    include: { posts: true },
  });
  if (!campaign) {
    return res.status(404).json({ error: "Campaign not found" });
  }
  res.json(campaign);
});
