# Design Doc — Multi-Platform Social Campaign Publisher

## 1. Problem

Turn one published blog post into a scheduled social campaign: the right image variant and caption per platform, published through a system that survives duplicate requests, rate limits, and crashed workers without ever double-posting or trusting an unverified status update.
Everything runs against FlyRank's provided fake social platform server, no real Instagram/X accounts are touched.

## 2. Non-goal

This system does not attempt to optimize captions for engagement or generate original marketing copy from scratch captions are composed from a fixed brand-voice + platform-rule template, not creatively written. Content quality is out of scope;reliability is the point.

## 3. Platforms (2, per the brief's "realistic scope" guidance)

Platform | Image size | Aspect ratio
Instagram | 1080×1080 | 1:1  
X | 1600×900 | 16:9 |

## 4. Data model

Campaign
id, blogPostId, title, body, sourceImageUrl
status: draft | scheduled | publishing | published | failed
scheduledFor (nullable)
createdAt, updatedAt

SocialPostEntry (one per campaign per platform)
id, campaignId, platform ("instagram" | "x")
imageVariantUrl, caption
idempotencyKey
status: queued | publishing | published | failed
externalPostId (nullable, set once the platform confirms)
createdAt, updatedAt

PlatformToken
id, platform, encryptedAccessToken, iv
createdAt

WebhookEvent (audit log of every delivery webhook received)
id, socialPostEntryId, signatureValid (bool), rawPayload, receivedAt

## 5. API Surface

POST /campaigns create a campaign (draft)
POST /campaigns/:id/schedule set scheduledFor, move to "scheduled"
GET /campaigns/:id view campaign + all SocialPostEntries
POST /campaigns/:id/publish-now bypass schedule, publish immediately (for demo/testing)
POST /webhook/social-delivery receives signed delivery events from the fake platform

## 6. Layer sketch

HTTP layer (routes/controllers)
↓
Service layer (campaign service, caption composer, image pipeline)
↓
SocialPublisher interface
├── FakeInstagramPublisher
└── FakeXPublisher
↓
Data layer (Postgres via an ORM, repository pattern)

The `SocialPublisher` interface is the core abstraction:

```ts
interface SocialPublisher {
  publish(
    post: SocialPostEntry,
    idempotencyKey: string,
  ): Promise<PublishResult>;
}
```

Nothing above this interface knows which platform it's talking to —
adding a third platform means adding one more class, not touching the
service layer.

## 7. Stack

- Node.js + Express + TypeScript
- PostgreSQL via Docker
- BullMQ + Redis (Docker) for the durable scheduler/worker
- `sharp` for image variants
- Node `crypto` (AES-GCM) for token encryption
