import { Router } from "express";
import express from "express";
import { prisma } from "../lib/prisma";
import { rollupCampaignStatus } from "../lib/campaign-status";
import { isValidSignature } from "../lib/webhook-signature";

export const webhookRouter = Router();

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
