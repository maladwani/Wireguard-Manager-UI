// Copyright (c) 2026 Mohammed Aladwani
// Licensed under the MIT License

import { db } from "@/lib/db";

const WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const MAX_ATTEMPTS = 5;

export interface LoginAttemptStatus {
  blocked: boolean;
  remainingAttempts: number;
  retryAfterMs: number;
}

export async function checkLoginAttempts(
  email: string,
  ip: string
): Promise<LoginAttemptStatus> {
  const windowStart = new Date(Date.now() - WINDOW_MS);

  const recentFailures = await db.loginAttempt.count({
    where: {
      OR: [{ email }, { ipAddress: ip }],
      success: false,
      createdAt: { gte: windowStart },
    },
  });

  if (recentFailures >= MAX_ATTEMPTS) {
    const oldestInWindow = await db.loginAttempt.findFirst({
      where: {
        OR: [{ email }, { ipAddress: ip }],
        success: false,
        createdAt: { gte: windowStart },
      },
      orderBy: { createdAt: "asc" },
    });

    const retryAfterMs = oldestInWindow
      ? WINDOW_MS - (Date.now() - oldestInWindow.createdAt.getTime())
      : WINDOW_MS;

    return {
      blocked: true,
      remainingAttempts: 0,
      retryAfterMs: Math.max(0, retryAfterMs),
    };
  }

  return {
    blocked: false,
    remainingAttempts: MAX_ATTEMPTS - recentFailures,
    retryAfterMs: 0,
  };
}

export async function recordLoginAttempt(
  email: string,
  ip: string,
  success: boolean
): Promise<void> {
  await db.loginAttempt.create({
    data: { email, ipAddress: ip, success },
  });

  // Prune old entries asynchronously (keep last 24h max)
  const pruneWindow = new Date(Date.now() - 24 * 60 * 60 * 1000);
  db.loginAttempt
    .deleteMany({ where: { createdAt: { lt: pruneWindow } } })
    .catch(() => {});
}
