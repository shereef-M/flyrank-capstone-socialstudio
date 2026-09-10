/**
 * Combined entrypoint — used ONLY for the free-tier deployment.
 *
 * Render's free tier allows exactly one Web Service and nothing else
 * (no free Background Worker, no free Private Service) — so the main
 * app, the fake platform server, and the BullMQ worker all run in this
 * one process instead of three separate ones.
 *
 * Nothing about the individual files changes: each one still binds its
 * own port / starts its own listener exactly as it does locally. The
 * fake platform's port (4000 by default) is never exposed publicly —
 * Render only forwards traffic to the one port index.ts binds to (PORT).
 * Everything still talks to everything else over plain localhost, inside
 * this one container, the same way it does in local dev.
 *
 * Local development is unaffected — keep using the three separate
 * `npm run dev` / `npm run fake-platform` / `npm run worker` scripts.
 */
import "./fake-platform/server";
import "./worker";
import "./index";
