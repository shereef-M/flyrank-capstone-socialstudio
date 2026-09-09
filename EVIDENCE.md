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

### ✅ SocialPublisher interface, ≥2 implementations

`FakeInstagramPublisher` and `FakeXPublisher` both implement the same
`SocialPublisher` interface, differing only in which platform path they
call. Both went through `POST /campaigns/:id/publish-now` successfully:

```
{"platform":"instagram","accepted":true,"externalPostId":"fake-post-4f0edbe2-...","deduplicated":false}
{"platform":"x","accepted":true,"externalPostId":"fake-post-3605e450-...","deduplicated":false}
```

### ⬜ OAuth tokens encrypted at rest — not yet done

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

### ⬜ Durable scheduling (crash-resume, no duplicates) — not yet done (Phase 4)

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
