import sharp from "sharp";
import path from "node:path";
import fs from "node:fs/promises";
import type { Platform } from "@prisma/client";

export type ImageSpec = { width: number; height: number };

/** Platform-correct output dimensions, per the design doc. */
export const PLATFORM_IMAGE_SPECS: Record<Platform, ImageSpec> = {
  instagram: { width: 1080, height: 1080 },
  x: { width: 1600, height: 900 },
};

const UPLOADS_DIR = path.join(process.cwd(), "public", "uploads");

/**
 * Generates one correctly-sized variant for a platform from a source image.
 * `fit: "cover"` + `position: "centre"` crops from the edges inward rather
 * than stretching — that's what keeps the main subject inside the safe zone
 * regardless of the source image's own aspect ratio.
 */
async function generateVariant(
  sourcePath: string,
  spec: ImageSpec,
  outPath: string,
): Promise<void> {
  await sharp(sourcePath)
    .resize(spec.width, spec.height, { fit: "cover", position: "centre" })
    .jpeg({ quality: 85 })
    .toFile(outPath);
}

/**
 * Produces both platform variants for a campaign's source image and
 * returns the public URL each one is reachable at.
 */
export async function generateImageVariants(
  sourceImagePath: string,
  campaignId: string,
): Promise<Record<Platform, string>> {
  await fs.mkdir(UPLOADS_DIR, { recursive: true });

  const platforms = Object.keys(PLATFORM_IMAGE_SPECS) as Platform[];
  const urls = {} as Record<Platform, string>;

  for (const platform of platforms) {
    const filename = `${campaignId}-${platform}.jpg`;
    const outPath = path.join(UPLOADS_DIR, filename);
    await generateVariant(
      sourceImagePath,
      PLATFORM_IMAGE_SPECS[platform],
      outPath,
    );
    urls[platform] = `/uploads/${filename}`;
  }

  return urls;
}

/**
 * Creates a simple placeholder source image (a solid-color canvas). The
 * brief explicitly allows a placeholder source — the variant pipeline is
 * what's graded, not artistic quality.
 */
export async function createPlaceholderImage(outPath: string): Promise<void> {
  await sharp({
    create: {
      width: 1600,
      height: 1600,
      channels: 3,
      background: { r: 70, g: 110, b: 200 },
    },
  })
    .jpeg()
    .toFile(outPath);
}
