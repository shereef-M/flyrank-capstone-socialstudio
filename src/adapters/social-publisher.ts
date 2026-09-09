import { setTimeout as sleep } from "node:timers/promises";

export type PublishParams = {
  socialPostEntryId: string;
  caption: string;
  imageUrl: string;
  idempotencyKey: string;
};

export type PublishResult = {
  externalPostId: string;
  deduplicated: boolean;
};

/**
 * The core abstraction: nothing above this interface knows which platform
 * it's talking to. Adding a third platform means adding one more class
 * that implements this, not touching the service/route layer.
 */
export interface SocialPublisher {
  publish(
    params: PublishParams,
    opts?: { simulateRateLimit?: boolean }
  ): Promise<PublishResult>;
}

const FAKE_PLATFORM_BASE_URL =
  process.env.FAKE_PLATFORM_BASE_URL || "http://localhost:4000";
const MAX_RETRIES = 3;

/**
 * Shared HTTP + retry logic for talking to the fake platform server.
 * Platform-specific subclasses below only differ by URL path segment —
 * that's the whole point of the adapter pattern.
 */
abstract class FakePlatformPublisherBase implements SocialPublisher {
  protected abstract platform: string;

  async publish(
    params: PublishParams,
    opts: { simulateRateLimit?: boolean } = {}
  ): Promise<PublishResult> {
    let attempt = 0;

    while (true) {
      attempt++;

      const res = await fetch(`${FAKE_PLATFORM_BASE_URL}/${this.platform}/posts`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": params.idempotencyKey,
          // Only force the simulated 429 on the first attempt — this lets a
          // demo show the full story: rate-limited once, backs off exactly
          // as long as told, then succeeds on retry.
          ...(opts.simulateRateLimit && attempt === 1
            ? { "X-Simulate-429": "true" }
            : {}),
        },
        body: JSON.stringify({
          socialPostEntryId: params.socialPostEntryId,
          caption: params.caption,
          imageUrl: params.imageUrl,
        }),
      });

      if (res.status === 429) {
        if (attempt > MAX_RETRIES) {
          throw new Error(`${this.platform}: still rate-limited after ${MAX_RETRIES} retries`);
        }
        const retryAfterSeconds = Number(res.headers.get("Retry-After") ?? "1");
        await sleep(retryAfterSeconds * 1000);
        continue;
      }

      if (!res.ok) {
        const body = await res.text();
        throw new Error(`${this.platform}: publish failed (${res.status}): ${body}`);
      }

      const data = (await res.json()) as { postId: string; deduplicated?: boolean };
      return { externalPostId: data.postId, deduplicated: Boolean(data.deduplicated) };
    }
  }
}

export class FakeInstagramPublisher extends FakePlatformPublisherBase {
  protected platform = "instagram";
}

export class FakeXPublisher extends FakePlatformPublisherBase {
  protected platform = "x";
}