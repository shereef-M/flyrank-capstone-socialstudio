# Build log

Honest log of where AI (Claude) helped, where it was wrong, and what got changed. Written as we go, not reconstructed at the end.

## Phase 1 — Design

AI drafted the initial DESIGN.md structure (data model, API surface, layer sketch) based on the brief's requirements. I reviewed it, asked for a full plain-English walkthrough of the problem before agreeing to anything, andapproved the content as accurate to what I understood.

## Phase 2 groundwork — Infrastructure

AI scaffolded the Express + TypeScript + Prisma project. Two real problems came up and got caught before they became real bugs:

- npm's dependency resolver kept crashing while installing Prisma. Turned out `npm`'s `latest` tag for Prisma currently points to an 8.0 release-candidate with a much more complex setup (mandatory driver adapters, new config file). AI caught this via a version check and pinned to the stable 6.19.3 release instead — the version every tutorial actually uses.
- Docker was already installed but only had the old standalone`docker-compose` (1.29.2), which crashed recreating containers with a `KeyError: 'ContainerConfig'` bug. I suggested doing it properly instead of working around it — we removed the old install and set up Docker's official repo with the modern `docker compose` plugin.

## Phase 2 — Content generation

AI built the caption composer and image variant pipeline. One real mistake: when handing me the `image-pipeline.ts` code to paste, AI retyped a variable name wrong — `sourcePath` instead of the actual parameter `sourceImagePath` — which the tested/verified version in its own sandbox had correct. It only surfaced when I ran the tests and got a `ReferenceError`. One-line fix once caught. Worth noting: the bug was in transcription, not in the logic itself — the original, actually-tested code was correct throughout.

Also verified independently: the brief was checked to confirm captionsare allowed to be template-composed rather than AI-generated ("AI optional, composition is what's graded") before building it that way.

## Phase 3 — Fake platform server, adapters, idempotent publishing

AI built the fake platform server (token endpoint, idempotency-aware publish endpoint, a deliberately-triggerable 429, a delayed signed webhook), the webhook receiver that verifies the HMAC signature against raw request bytes, and the SocialPublisher adapter interface with retry/backoff on rate limits.

Two real mistakes surfaced during testing, both caught by actually running the system rather than assuming the code was right:

- I pasted the `GET /campaigns/:id` route into the wrong place myself nested it inside the `POST /campaigns` handler instead of as its ownroute. AI caught it from the resulting behavior (it would havere-registered a route on every campaign creation) and gave me thecorrected placement.
- A real logic bug in AI's own code: `publish-now`, when re-run on an already-published campaign, reset each post's status to "publishing" before checking whether the platform recognized the request as a duplicate. Since a duplicate never triggers a new webhook, the status stayed stuck on "publishing" forever. This wasn't theoretical it showed up while generating evidence for EVIDENCE.md, when a live test produced exactly that stuck state. Fixed by checking the publisher's `deduplicated` flag and setting status to "published" immediately in that case, since no webhook is coming to correct it later.

Also worth noting: my own sandbox environment reset itself mid-session partway through building this phase (a known limitation, not something either of us caused) nothing on my actual project was affected, but it meant re-verifying the code from scratch on the AI's side before handing it to me.

Verification for this phase was almost entirely live, not just unit tests: the fake platform's token/idempotency/429 behavior, the retry adapter's actual wait time against a real forced rate limit, the full publish-now → webhook → status-published loop, a genuine duplicate publish returning the same post id, and a forged webhook signature being rejected with the real data left untouched.

## Phase 4 — Durable scheduling

AI extracted the publish logic into a shared `publishCampaign()` function (so the immediate `publish-now` endpoint and the new scheduled worker runidentical code, not two copies that could drift), then built the BullMQ queue, the `/schedule` endpoint, and a separate worker process.

Same mistake pattern as Phase 3, happened again: a file AI gave me to create (`src/lib/publish-campaign.ts`) never actually got typed/saved on my end, and the app crashed on startup with "Cannot find module" pointing straight at the missing file. Same fix both times check the fileactually exists before assuming it's just an editor error. Worth being more careful about this myself going forward, not just relying on AI to catch it after the fact.

Verification here was fully live, including the actual failure mode we care about: scheduled a campaign 15 seconds out, deliberately did NOT start the worker, confirmed via the API that the campaign sat at "scheduled" with posts still "queued" well past its scheduled time proving the job wasn't lost with nothing watching. Then started the worker for the first time and watched it immediately pick up and complete the overdue job, with no duplicate posts. That's the actual crash-resume guarantee, demonstrated end to end, not asserted.

## Phase 4 — OAuth token encryption at rest

AI built AES-256-GCM encrypt/decrypt helpers and wired the adapters to actually fetch a token from the fake platform's OAuth endpoint (which had existed since Phase 3 but was never called), encrypt it before storing, and decrypt it only in memory when making a request.

Same recurring mistake as Phases 3 and 4 a file (`platform-tokens.ts`) didn't get created on my end, caught the same way: `tsc --noEmit` pointed straight at the missing module. This is clearly a pattern in how I'm working through multi-file handoffs, not one-off slips worth slowing down and confirming each file actually saved before moving to the next one, rather than assuming.

Verification: an automated test suite (round-trip, no plaintext leakage, random IV, tamper detection all passing), plus direct inspection of the Postgres table itself via psql, confirming the stored value is opaque hex with no resemblance to the actual token string. Deliberately did not build any endpoint that decrypts a token on demand, even for demo convenience that would undermine the whole point of encrypting it.


## Phase 4 — Turning manual proofs into automated tests

AI extracted the webhook signature check into its own file (`webhook-signature.ts`) purely so it could be unit tested without needing Express or a database, and wrote tests mocking `fetch` and the token fetch to exercise the retry/backoff logic the same way.

One real bug caught by the tests themselves, not by inspection: the webhook-signature test failed on its very first run because
`webhook.ts`'s original signature check read `WEBHOOK_SECRET` from the environment once, at module load time, into a top-level constant. A test that changed the env var afterward had no effect on it. Fixed by reading the secret fresh inside the function on every call which is also just more correct in general, not only more testable.

Deliberately did not write an automated test for duplicate-publish (idempotency) it depends on real coordination between the database's unique constraint and the fake platform's in-memory store, and faking that convincingly would mean re-implementing both inside the test. Chose to rely on the live evidence already captured for that behavior instead of writing a test that would exercise a mock rather than the real thing.

## Post-submission — metrics endpoint and network-failure retry

Two improvements suggested after FlyRank's approval, both from identifying gaps rather than adding features for their own sake:

A `/metrics` endpoint was cheap to build because BullMQ already tracksjob completion/failure counts internally `getJobCounts()` exposes that for free, no new tracking needed. The only genuinely new piece was a small in-memory counter for adapter-level retries, which isn't captured anywhere else.

The more important fix: the retry logic only ever handled a 429 response. A network-level failure (the platform being completely unreachable, not just rate-limiting) would `fetch()`throw and fail immediately with zero retry inconsistent with a project whose whole point is handling failure modes gracefully. This was AI's own gap in the original Phase 3 implementation, caught not by testing but by directly asking "what happens if the dependency is just down?" before writing any code worth noting since most of the bugs caught so far were found by running tests, not by asking the right question upfront.