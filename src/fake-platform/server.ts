import "dotenv/config";
import express from "express";
import crypto from "node:crypto";

const app = express();
app.use(express.json());

const PORT = process.env.FAKE_PLATFORM_PORT
  ? Number(process.env.FAKE_PLATFORM_PORT)
  : 4000;
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || "dev-secret-change-me";
const CALLBACK_URL =
  process.env.FAKE_PLATFORM_CALLBACK_URL ||
  "http://localhost:3000/webhook/social-delivery";

// idempotencyKey -> the result we returned the first time we saw that key.
const publishedPosts = new Map<string, { postId: string; platform: string }>();

app.post("/oauth/token", (_req, res) => {
  res.json({
    access_token: `fake-token-${crypto.randomUUID()}`,
    token_type: "bearer",
    expires_in: 3600,
  });
});

app.post("/:platform/posts", (req, res) => {
  const { platform } = req.params;
  const idempotencyKey = req.header("Idempotency-Key");

  if (!idempotencyKey) {
    return res
      .status(400)
      .json({ error: "Idempotency-Key header is required" });
  }

  // Already seen this exact key — return the original result rather than
  // creating a second post. This is the fake platform's own half of the
  // idempotency guarantee (our app enforces the other half at the DB level).
  const existing = publishedPosts.get(idempotencyKey);
  if (existing) {
    return res.status(200).json({ ...existing, deduplicated: true });
  }

  // Deliberately triggerable rate limit, for the demo / acceptance probe.
  if (req.header("X-Simulate-429") === "true") {
    res.setHeader("Retry-After", "2");
    return res
      .status(429)
      .json({ error: "rate_limited", retryAfterSeconds: 2 });
  }

  const postId = `fake-post-${crypto.randomUUID()}`;
  const result = { postId, platform };
  publishedPosts.set(idempotencyKey, result);

  // Real platforms don't confirm synchronously — they accept the request,
  // then confirm later via webhook. We simulate that delay here.
  const socialPostEntryId = req.body.socialPostEntryId;
  setTimeout(() => sendSignedWebhook(socialPostEntryId, postId), 1500);

  res.status(202).json({ ...result, status: "accepted" });
});

async function sendSignedWebhook(socialPostEntryId: string, postId: string) {
  const payload = JSON.stringify({
    socialPostEntryId,
    externalPostId: postId,
    status: "published",
    deliveredAt: new Date().toISOString(),
  });
  const signature = crypto
    .createHmac("sha256", WEBHOOK_SECRET)
    .update(payload)
    .digest("hex");

  try {
    await fetch(CALLBACK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Signature": signature },
      body: payload,
    });
  } catch (err) {
    console.error("Fake platform: failed to deliver webhook", err);
  }
}

app.listen(PORT, () => {
  console.log(
    `Fake social platform server listening on http://localhost:${PORT}`,
  );
});
