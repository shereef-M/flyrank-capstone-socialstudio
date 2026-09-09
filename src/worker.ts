import "dotenv/config";
import { Worker, type Job } from "bullmq";
import { connection, PUBLISH_QUEUE_NAME } from "./queue/publish-queue";
import { publishCampaign } from "./lib/publish-campaign";

const worker = new Worker(
  PUBLISH_QUEUE_NAME,
  async (job: Job) => {
    const { campaignId } = job.data as { campaignId: string };
    console.log(`[worker] publishing campaign ${campaignId} (job ${job.id})`);
    const result = await publishCampaign(campaignId);
    console.log(`[worker] done with campaign ${campaignId}:`, result.results);
    return result;
  },
  { connection },
);

worker.on("completed", (job) => {
  console.log(`[worker] job ${job.id} completed`);
});

worker.on("failed", (job, err) => {
  console.error(`[worker] job ${job?.id} failed:`, err.message);
});

console.log("Publish worker started — waiting for scheduled campaigns...");
