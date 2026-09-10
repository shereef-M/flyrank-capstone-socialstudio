import { describe, it, expect, vi, beforeEach } from "vitest";
import { FakeInstagramPublisher } from "../src/adapters/social-publisher";
import { getRetryMetrics } from "../src/lib/retry-metrics";

vi.mock("../src/lib/platform-tokens", () => ({
  getAccessToken: vi.fn().mockResolvedValue("mock-token-123"),
}));

function fakeResponse(status: number, body: unknown) {
  return {
    status,
    ok: status >= 200 && status < 300,
    headers: { get: () => null },
    json: async () => body,
    text: async () => JSON.stringify(body),
  } as unknown as Response;
}

const baseParams = {
  socialPostEntryId: "entry-1",
  caption: "test caption",
  imageUrl: "/uploads/test.jpg",
  idempotencyKey: "idem-key-network-test",
};

describe("FakeInstagramPublisher network-failure handling", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("retries after the platform is unreachable, then succeeds", async () => {
    const before = getRetryMetrics().networkErrorRetries;

    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new Error("connect ECONNREFUSED 127.0.0.1:4000"))
      .mockResolvedValueOnce(fakeResponse(202, { postId: "post-recovered" }));
    vi.stubGlobal("fetch", fetchMock);

    const publisher = new FakeInstagramPublisher();
    const result = await publisher.publish(baseParams);

    expect(result).toEqual({
      externalPostId: "post-recovered",
      deduplicated: false,
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(getRetryMetrics().networkErrorRetries).toBe(before + 1);
  });

  it("gives up with a clear error after the platform stays unreachable", async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValue(new Error("connect ECONNREFUSED 127.0.0.1:4000"));
    vi.stubGlobal("fetch", fetchMock);

    const publisher = new FakeInstagramPublisher();
    await expect(publisher.publish(baseParams)).rejects.toThrow(/unreachable/);
  });

  it("does not retry forever — respects the same retry limit as rate limiting", async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValue(new Error("connect ECONNREFUSED 127.0.0.1:4000"));
    vi.stubGlobal("fetch", fetchMock);

    const publisher = new FakeInstagramPublisher();
    await expect(publisher.publish(baseParams)).rejects.toThrow();
    // MAX_RETRIES is 3, so attempts 1-4 happen (fails on the 4th).
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });
});
