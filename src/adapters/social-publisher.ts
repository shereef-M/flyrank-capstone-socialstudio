import { setTimeout as sleep } from "node:timers/promises";
import { getAccessToken } from "../lib/platform-tokens";
import {
  recordRateLimitRetry,
  recordNetworkErrorRetry,
} from "../lib/retry-metrics";
import type { Platform } from "@prisma/client";

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
    opts?: { simulateRateLimit?: boolean },
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
  protected abstract platform: Platform;

  async publish(
    params: PublishParams,
    opts: { simulateRateLimit?: boolean } = {},
  ): Promise<PublishResult> {
    // Decrypted only for the lifetime of this call — never logged, never
    // written back to disk in plaintext. getAccessToken() handles fetching
    // + encrypting a new one the first time this platform is used.
    const token = await getAccessToken(this.platform);

    let attempt = 0;

    while (true) {
      attempt++;

      let res: Response;
      try {
        res = await fetch(`${FAKE_PLATFORM_BASE_URL}/${this.platform}/posts`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Idempotency-Key": params.idempotencyKey,
            Authorization: `Bearer ${token}`,
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
      } catch (err) {
        // The platform is unreachable entirely — connection refused, DNS
        // failure, timeout — not just rate-limiting us. Treated the same
        // as a 429: back off and retry, since this is often transient (a
        // deploy restart, a brief network blip), not a permanent failure.
        if (attempt > MAX_RETRIES) {
          const reason =
            err instanceof Error ? err.message : "unknown network error";
          throw new Error(
            `${this.platform}: still unreachable after ${MAX_RETRIES} retries (${reason})`,
          );
        }
        recordNetworkErrorRetry();
        // No Retry-After header exists for a connection failure — a short
        // exponential backoff stands in for it instead.
        await sleep(2 ** attempt * 100);
        continue;
      }

      if (res.status === 429) {
        if (attempt > MAX_RETRIES) {
          throw new Error(
            `${this.platform}: still rate-limited after ${MAX_RETRIES} retries`,
          );
        }
        recordRateLimitRetry();
        const retryAfterSeconds = Number(res.headers.get("Retry-After") ?? "1");
        await sleep(retryAfterSeconds * 1000);
        continue;
      }

      if (!res.ok) {
        const body = await res.text();
        throw new Error(
          `${this.platform}: publish failed (${res.status}): ${body}`,
        );
      }

      const data = (await res.json()) as {
        postId: string;
        deduplicated?: boolean;
      };
      return {
        externalPostId: data.postId,
        deduplicated: Boolean(data.deduplicated),
      };
    }
  }
}

export class FakeInstagramPublisher extends FakePlatformPublisherBase {
  protected platform: Platform = "instagram";
}

export class FakeXPublisher extends FakePlatformPublisherBase {
  protected platform: Platform = "x";
}
