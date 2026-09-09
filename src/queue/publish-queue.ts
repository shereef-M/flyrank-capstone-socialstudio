import { Queue } from "bullmq";
import IORedis from "ioredis";

// BullMQ requires this for its blocking connections — without it, ioredis's
// default retry behavior conflicts with how BullMQ manages retries itself.
export const connection = new IORedis(
  process.env.REDIS_URL || "redis://localhost:6379",
  { maxRetriesPerRequest: null },
);

export const PUBLISH_QUEUE_NAME = "publish-campaign";

export const publishQueue = new Queue(PUBLISH_QUEUE_NAME, { connection });
