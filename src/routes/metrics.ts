import { Router } from "express";
import { prisma } from "../lib/prisma";
import { publishQueue } from "../queue/publish-queue";
import { getRetryMetrics } from "../lib/retry-metrics";

export const metricsRouter = Router();

function countByStatus(items: { status: string }[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const item of items) {
    counts[item.status] = (counts[item.status] ?? 0) + 1;
  }
  return counts;
}

metricsRouter.get("/metrics", async (_req, res) => {
  const [campaigns, posts, queueCounts] = await Promise.all([
    prisma.campaign.findMany({}),
    prisma.socialPostEntry.findMany({}),
    publishQueue.getJobCounts(),
  ]);

  res.json({
    campaigns: countByStatus(campaigns),
    posts: countByStatus(posts),
    queue: queueCounts,
    adapterRetries: getRetryMetrics(),
  });
});
