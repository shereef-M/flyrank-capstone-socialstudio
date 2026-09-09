import { describe, it, expect, vi, beforeEach } from "vitest";
import { FakeInstagramPublisher } from "../src/adapters/social-publisher";

vi.mock("../src/lib/platform-tokens", () => ({
  getAccessToken: vi.fn().mockResolvedValue("mock-token-123"),
}));

function fakeResponse(
  status: number,
  body: unknown,
  headers: Record<string, string> = {},
) {
  return {
    status,
    ok: status >= 200 && status < 300,
    headers: { get: (key: string) => headers[key] ?? null },
    json: async () => body,
    text: async () => JSON.stringify(body),
  } as unknown as Response;
}

const baseParams = {
  socialPostEntryId: "entry-1",
  caption: "test caption",
  imageUrl: "/uploads/test.jpg",
  idempotencyKey: "idem-key-1",
};

describe("FakeInstagramPublisher retry/backoff", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("succeeds immediately when the first response is OK", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(fakeResponse(202, { postId: "post-1" }));
    vi.stubGlobal("fetch", fetchMock);

    const publisher = new FakeInstagramPublisher();
    const result = await publisher.publish(baseParams);

    expect(result).toEqual({ externalPostId: "post-1", deduplicated: false });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("sends the Idempotency-Key and Authorization headers correctly", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(fakeResponse(202, { postId: "post-1" }));
    vi.stubGlobal("fetch", fetchMock);

    const publisher = new FakeInstagramPublisher();
    await publisher.publish(baseParams);

    const [, options] = fetchMock.mock.calls[0];
    expect(options.headers["Idempotency-Key"]).toBe("idem-key-1");
    expect(options.headers["Authorization"]).toBe("Bearer mock-token-123");
  });

  it("waits out a 429 and succeeds on retry", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        fakeResponse(429, { error: "rate_limited" }, { "Retry-After": "0" }),
      )
      .mockResolvedValueOnce(fakeResponse(202, { postId: "post-2" }));
    vi.stubGlobal("fetch", fetchMock);

    const publisher = new FakeInstagramPublisher();
    const result = await publisher.publish(baseParams);

    expect(result).toEqual({ externalPostId: "post-2", deduplicated: false });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("gives up after exceeding the retry limit", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        fakeResponse(429, { error: "rate_limited" }, { "Retry-After": "0" }),
      );
    vi.stubGlobal("fetch", fetchMock);

    const publisher = new FakeInstagramPublisher();
    await expect(publisher.publish(baseParams)).rejects.toThrow(/rate-limited/);
  });

  it("returns deduplicated:true when the platform reports a duplicate", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        fakeResponse(200, { postId: "post-1", deduplicated: true }),
      );
    vi.stubGlobal("fetch", fetchMock);

    const publisher = new FakeInstagramPublisher();
    const result = await publisher.publish(baseParams);

    expect(result.deduplicated).toBe(true);
  });
});
