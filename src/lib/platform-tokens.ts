import { prisma } from "./prisma";
import { encrypt, decrypt } from "./crypto";
import type { Platform } from "@prisma/client";

const FAKE_PLATFORM_BASE_URL =
  process.env.FAKE_PLATFORM_BASE_URL || "http://localhost:4000";

async function fetchNewToken(): Promise<string> {
  const res = await fetch(`${FAKE_PLATFORM_BASE_URL}/oauth/token`, {
    method: "POST",
  });
  if (!res.ok) {
    throw new Error(`Failed to fetch OAuth token: ${res.status}`);
  }
  const data = (await res.json()) as { access_token: string };
  return data.access_token;
}

export async function getAccessToken(platform: Platform): Promise<string> {
  const existing = await prisma.platformToken.findUnique({
    where: { platform },
  });
  if (existing) {
    return decrypt(existing.encryptedAccessToken, existing.iv);
  }

  const token = await fetchNewToken();
  const { ciphertext, iv } = encrypt(token);
  await prisma.platformToken.upsert({
    where: { platform },
    create: { platform, encryptedAccessToken: ciphertext, iv },
    update: { encryptedAccessToken: ciphertext, iv },
  });
  return token;
}
