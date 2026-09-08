import { describe, it, expect, afterAll } from "vitest";
import sharp from "sharp";
import fs from "node:fs/promises";
import path from "node:path";
import {
  createPlaceholderImage,
  generateImageVariants,
  PLATFORM_IMAGE_SPECS,
} from "../src/lib/image-pipeline";

const TEST_ID = "test-image-pipeline";
const UPLOADS_DIR = path.join(process.cwd(), "public", "uploads");
const sourcePath = path.join(UPLOADS_DIR, `${TEST_ID}-source.jpg`);

afterAll(async () => {
  await fs.rm(sourcePath, { force: true });
  await fs.rm(path.join(UPLOADS_DIR, `${TEST_ID}-instagram.jpg`), {
    force: true,
  });
  await fs.rm(path.join(UPLOADS_DIR, `${TEST_ID}-x.jpg`), { force: true });
});

describe("generateImageVariants", () => {
  it("produces correctly-sized variants for every platform", async () => {
    await createPlaceholderImage(sourcePath);
    const urls = await generateImageVariants(sourcePath, TEST_ID);

    for (const [platform, spec] of Object.entries(PLATFORM_IMAGE_SPECS)) {
      const filePath = path.join(
        UPLOADS_DIR,
        path.basename(urls[platform as keyof typeof urls]),
      );
      const metadata = await sharp(filePath).metadata();
      expect(metadata.width, `${platform} width`).toBe(spec.width);
      expect(metadata.height, `${platform} height`).toBe(spec.height);
    }
  });
});
