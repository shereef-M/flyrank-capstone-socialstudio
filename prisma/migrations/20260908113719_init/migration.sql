-- CreateEnum
CREATE TYPE "CampaignStatus" AS ENUM ('draft', 'scheduled', 'publishing', 'published', 'failed');

-- CreateEnum
CREATE TYPE "PostStatus" AS ENUM ('queued', 'publishing', 'published', 'failed');

-- CreateEnum
CREATE TYPE "Platform" AS ENUM ('instagram', 'x');

-- CreateTable
CREATE TABLE "Campaign" (
    "id" TEXT NOT NULL,
    "blogPostId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "sourceImageUrl" TEXT NOT NULL,
    "status" "CampaignStatus" NOT NULL DEFAULT 'draft',
    "scheduledFor" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Campaign_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SocialPostEntry" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "platform" "Platform" NOT NULL,
    "imageVariantUrl" TEXT,
    "caption" TEXT,
    "idempotencyKey" TEXT NOT NULL,
    "status" "PostStatus" NOT NULL DEFAULT 'queued',
    "externalPostId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SocialPostEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlatformToken" (
    "id" TEXT NOT NULL,
    "platform" "Platform" NOT NULL,
    "encryptedAccessToken" TEXT NOT NULL,
    "iv" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlatformToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WebhookEvent" (
    "id" TEXT NOT NULL,
    "socialPostEntryId" TEXT NOT NULL,
    "signatureValid" BOOLEAN NOT NULL,
    "rawPayload" TEXT NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WebhookEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Campaign_status_idx" ON "Campaign"("status");

-- CreateIndex
CREATE INDEX "Campaign_scheduledFor_idx" ON "Campaign"("scheduledFor");

-- CreateIndex
CREATE UNIQUE INDEX "SocialPostEntry_idempotencyKey_key" ON "SocialPostEntry"("idempotencyKey");

-- CreateIndex
CREATE INDEX "SocialPostEntry_status_idx" ON "SocialPostEntry"("status");

-- CreateIndex
CREATE UNIQUE INDEX "SocialPostEntry_campaignId_platform_key" ON "SocialPostEntry"("campaignId", "platform");

-- CreateIndex
CREATE UNIQUE INDEX "PlatformToken_platform_key" ON "PlatformToken"("platform");

-- CreateIndex
CREATE INDEX "WebhookEvent_socialPostEntryId_idx" ON "WebhookEvent"("socialPostEntryId");

-- AddForeignKey
ALTER TABLE "SocialPostEntry" ADD CONSTRAINT "SocialPostEntry_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WebhookEvent" ADD CONSTRAINT "WebhookEvent_socialPostEntryId_fkey" FOREIGN KEY ("socialPostEntryId") REFERENCES "SocialPostEntry"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
