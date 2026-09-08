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

- [ ] SocialPublisher interface, ≥2 implementations — pending (Phase 3)
- [ ] OAuth tokens encrypted at rest — pending (Phase 3)

## Reliability

- [ ] Idempotent publishing (duplicate/retry = one post) — pending (Phase 3)
- [ ] Rate limits respected (429 + Retry-After honored) — pending (Phase 3)
- [ ] Durable scheduling (crash-resume, no duplicates) — pending (Phase 4)

## Status & trust

- [ ] Signature-verified webhooks; forgeries rejected with 400 — pending (Phase 4)
- [ ] Status transitions only after verified webhook — pending (Phase 4)

## Tests & documentation

- [ ] Full test coverage (dimensions, duplicate-publish, forged webhook, rate limits) — pending (Phase 4)
- [ ] README + architecture diagram + setup instructions — pending (Phase 5)