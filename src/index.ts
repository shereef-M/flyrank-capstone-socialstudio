import "dotenv/config";
import express from "express";
import { prisma } from "./lib/prisma";

const app = express();
app.use(express.json());

app.get("/health", async (_req, res) => {
  try {
    // A trivial query — if the DB connection is broken, this throws.
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

const port = process.env.PORT ? Number(process.env.PORT) : 3000;
app.listen(port, () => {
  console.log(`Server listening on http://localhost:${port}`);
});
