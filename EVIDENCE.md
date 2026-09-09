# Evidence

One pasted proof per Definition-of-Done checkbox (§6 of the brief).

## Content generation

### ✅ Platform image variants generated correctly (dimensions, aspect ratio, subject in safe zone; a test asserts the dimensions)

Test run:

\`\`\`
✓ tests/image-pipeline.test.ts (1 test) 101ms
✓ generateImageVariants > produces correctly-sized variants for every platform
\`\`\`

Live proof — POST /campaigns response, image URLs confirmed 1080×1080 (Instagram) and 1600×900 (X) by opening each file directly:

\`\`\`json
"imageVariantUrl": "/uploads/06f35158-7526-4528-9baf-4759e620b053-instagram.jpg"
"imageVariantUrl": "/uploads/06f35158-7526-4528-9baf-4759e620b053-x.jpg"
\`\`\`

### ✅ Captions are platform-aware, composed from shared + platform-specific fragments (no duplicated near-identical prompts)

Test run:

\`\`\`
✓ tests/caption-composer.test.ts (3 tests) 10ms
✓ produces a different caption per platform from the same content
✓ includes hashtags for instagram but not for x
✓ respects x's character limit
\`\`\`

Live proof — same campaign, two distinct captions from POST /campaigns:

\`\`\`
Instagram: "Why Idempotency Matters\n\nA retried request should never create a second record.\n\n#Idempotency #Matters\n\nFull story — link in bio. Read the full post: /blog/blog-1"

X: "Why Idempotency Matters\n\nA retried request should never create a second record.\n\nRead more: Read the full post: /blog/blog-1"
\`\`\`

## Adapter layer

### ✅ SocialPublisher interface, ≥2 implementations

`FakeInstagramPublisher` and `FakeXPublisher` both implement the same
`SocialPublisher` interface, differing only in which platform path they
call. Both went through `POST /campaigns/:id/publish-now` successfully:

```
{"platform":"instagram","accepted":true,"externalPostId":"fake-post-4f0edbe2-...","deduplicated":false}
{"platform":"x","accepted":true,"externalPostId":"fake-post-3605e450-...","deduplicated":false}
```

### ✅ OAuth tokens encrypted at rest

Automated round-trip test:

```
✓ tests/crypto.test.ts (4 tests) 9ms
  ✓ round-trips a token exactly
  ✓ never stores the plaintext token inside the ciphertext
  ✓ produces a different ciphertext each time (random IV)
  ✓ fails to decrypt with a tampered ciphertext
```

Live proof — queried the database directly (not through our own API, since a "decrypt token" endpoint should never exist even for demo purposes):

```
$ docker exec -it flyrank-capstone-socialstudio-postgres-1 psql -U socialstudio -d socialstudio \
  -c 'SELECT platform, "encryptedAccessToken", iv FROM "PlatformToken";'

 platform |                                    encryptedAccessToken                                     |    iv
----------+-----------------------------------------------------------------------------------------------+----------
 instagram| 20ae7e3e3c75fb6ffa57c59b78344fa74b109b5af1af04b50f5e07f77107e15d70bf5932455f552382abf96dd1d58d1d1be06c254840f1d58f69f13c9b592a | e5858dba474eafc1de21eec9
 x        | fe7c1f21837352fa91153a99f0da0c0619724d5d1a45b5fc681fb1ff331be2e09296de55ac3d31d159d2c1216916dd2699e0e7e6cdd3ab054cc1daf3f0cde2 | 48720a007e75feed547ae2b8
```

Both values are opaque random-looking hex — nothing resembling the actual `fake-token-...` string the platform issued. The adapter decrypts the token in memory only for the duration of each publish call, sends it as a real `Authorization: Bearer` header, and never logs or persists it in plaintext.

## Reliability

### ✅ Idempotent publishing (duplicate/retry = one post)

Same campaign, `publish-now` called twice. Second call returns identical
`externalPostId`s with `deduplicated: true` instead of creating new posts:

```
Call 1: "externalPostId":"fake-post-4f0edbe2-...","deduplicated":false
Call 2: "externalPostId":"fake-post-4f0edbe2-...","deduplicated":true   (same id, not a new post)
```

### ✅ Rate limits respected (429 + Retry-After honored)

Adapter-level test with a forced rate limit on the first attempt:

```
Starting publish with simulateRateLimit=true...
Result: { externalPostId: 'fake-post-99dbf2f6-...', deduplicated: false }
Elapsed: 2137ms (Retry-After was 2 seconds — it waited, then retried and succeeded)
```

### ✅ Durable scheduling (crash-resume, no duplicates)

Campaign scheduled 15 seconds out. Confirmed the job survived with **no worker running at all** while its scheduled time passed:

```
curl .../schedule -d '{"scheduledFor":"2026-09-09T10:52:54.000Z"}' → "status":"scheduled"

[15+ seconds pass, no worker started]

curl .../campaigns/6e518eb9-... → "status":"scheduled", posts still "status":"queued" (scheduledFor time has already passed — job sat durably in Redis, untouched, because nothing was watching yet)
```

Then the worker was started for the first time:

```
$ npm run worker Publish worker started — waiting for scheduled campaigns...
[worker] publishing campaign 6e518eb9-... (job 6e518eb9-...)
[worker] done with campaign 6e518eb9-...: [
  { platform: 'x', accepted: true, externalPostId: 'fake-post-a089efbd-...', deduplicated: false },
  { platform: 'instagram', accepted: true, externalPostId: 'fake-post-8ae8222e-...', deduplicated: false }
]
[worker] job 6e518eb9-... completed
```

It picked up and completed the overdue job immediately proving the schedule survives a worker not running at the scheduled time (the same as a crash or deploy would look), with no duplicate posts created.

## Status & trust

### ✅ Signature-verified webhooks; forgeries rejected with 400

Forged signature sent directly to the webhook endpoint:

```
> curl -i ... -H "X-Signature: 000...000" -d '{"socialPostEntryId":"...","externalPostId":"forged-post-id",...}'
< HTTP/1.1 400 Bad Request
< {"error":"invalid signature"}
```

Confirmed the real `externalPostId` was untouched afterward — the forged
`externalPostId` never got written.

### ✅ Status transitions only after verified webhook

`publish-now` never sets status to `"published"` itself — only the
signature-verified webhook handler does. This was actually caught failing
in an edge case during testing: a _duplicated_ publish left status stuck
on `"publishing"` forever, since no new webhook arrives for an already-
confirmed post. Fixed by having `publish-now` recognize a deduplicated
result and reflect `"published"` immediately in that specific case — see
BUILDLOG.md. Re-tested after the fix: duplicate publish now correctly
shows `"published"` right away.

## Tests & documentation

- [ ] Full test coverage (dimensions, duplicate-publish, forged webhook, rate limits) — pending (Phase 4)
- [ ] README + architecture diagram + setup instructions — pending (Phase 5)
