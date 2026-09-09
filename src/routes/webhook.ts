import { Router } from "express";
import express from "express";
import crypto from "node:crypto";
import { prisma } from "../lib/prisma";
import { rollupCampaignStatus } from "../lib/campaign-status";

export const webhookRouter = Router();

const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || "dev-secret-change-me";

function isValidSignature(
  rawBody: Buffer,
  signatureHeader: string | undefined,
): boolean {
  if (!signatureHeader) return false;
  const expected = crypto
    .createHmac("sha256", WEBHOOK_SECRET)
    .update(rawBody)
    .digest("hex");

  const expectedBuf = Buffer.from(expected);
  const givenBuf = Buffer.from(signatureHeader);
  // timingSafeEqual throws on mismatched lengths, so guard first.
  if (expectedBuf.length !== givenBuf.length) return false;
  return crypto.timingSafeEqual(expectedBuf, givenBuf);
}

webhookRouter.post(
  "/webhook/social-delivery",
  // express.raw(), not express.json(), because we need to verify the
  // signature against the *exact bytes* that were signed — re-serializing
  // already-parsed JSON can differ (key order, whitespace) and silently
  // break verification.
  express.raw({ type: "application/json" }),
  async (req, res) => {
    const rawBody = req.body as Buffer;
    const signature = req.header("X-Signature");
    const signatureValid = isValidSignature(rawBody, signature);

    let payload: { socialPostEntryId?: string; externalPostId?: string };
    try {
      payload = JSON.parse(rawBody.toString("utf-8"));
    } catch {
      return res.status(400).json({ error: "invalid JSON body" });
    }

    // Log every webhook attempt, valid or not — this audit trail is what
    // proves a forged webhook was actually rejected, not just assumed to be.
    if (payload.socialPostEntryId) {
      await prisma.webhookEvent.create({
        data: {
          socialPostEntryId: payload.socialPostEntryId,
          signatureValid,
          rawPayload: rawBody.toString("utf-8"),
        },
      });
    }

    if (!signatureValid) {
      return res.status(400).json({ error: "invalid signature" });
    }

    // Status only ever changes because of a *verified* webhook — never
    // because the initial publish call was accepted.
    if (payload.socialPostEntryId) {
      const updatedPost = await prisma.socialPostEntry.update({
        where: { id: payload.socialPostEntryId },
        data: { status: "published", externalPostId: payload.externalPostId },
      });
      await rollupCampaignStatus(updatedPost.campaignId);
    }
    res.status(200).json({ received: true });
  },
);
