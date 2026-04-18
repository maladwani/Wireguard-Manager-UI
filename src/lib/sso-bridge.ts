// Copyright (c) 2026 Mohammed Aladwani
// Licensed under the MIT License

// Edge-safe bridge token helpers - only uses `jose` (no Node.js crypto, no Prisma).
// Imported by auth.ts (which runs in Edge via middleware).

import { SignJWT, jwtVerify } from "jose";

function getSecret(): Uint8Array {
  return new TextEncoder().encode(
    process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET || "fallback-secret"
  );
}

export async function issueBridgeToken(userId: string): Promise<string> {
  return new SignJWT({ sub: userId })
    .setProtectedHeader({ alg: "HS256" })
    .setAudience("sso-bridge")
    .setIssuedAt()
    .setExpirationTime("30s")
    .sign(getSecret());
}

export async function verifyBridgeToken(token: string): Promise<string> {
  const { payload } = await jwtVerify(token, getSecret(), {
    audience: "sso-bridge",
  });
  if (!payload.sub) throw new Error("Bridge token has no sub claim");
  return payload.sub;
}
