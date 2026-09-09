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
