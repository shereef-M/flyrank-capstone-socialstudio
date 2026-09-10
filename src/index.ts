import "dotenv/config";
import express from "express";
import path from "node:path";
import { prisma } from "./lib/prisma";
import { campaignsRouter } from "./routes/campaigns";
import { webhookRouter } from "./routes/webhook";
import { metricsRouter } from "./routes/metrics";

const app = express();

// Mounted BEFORE express.json() — this route needs the raw, unparsed
// request body to verify the HMAC signature. If express.json() ran first,
// it would consume the body stream, and re-serializing the parsed JSON
// could produce different bytes than what was actually signed.
app.use(webhookRouter);

app.use(express.json());

// Serves generated image variants at /uploads/<file>.jpg
app.use(
  "/uploads",
  express.static(path.join(process.cwd(), "public", "uploads")),
);

app.get("/health", async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ status: "ok", database: "connected" });
  } catch (err) {
    res.status(500).json({
      status: "error",
      database: "disconnected",
      message: err instanceof Error ? err.message : "unknown error",
    });
  }
});

app.use(campaignsRouter);
app.use(metricsRouter);

const port = process.env.PORT ? Number(process.env.PORT) : 3000;
app.listen(port, () => {
  console.log(`Server listening on http://localhost:${port}`);
});
