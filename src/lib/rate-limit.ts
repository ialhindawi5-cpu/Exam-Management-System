import "server-only";
import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";

// Durable, cross-instance rate limiter for sensitive endpoints (login, signup).
// Backed by the Postgres `RateLimit` table, so it survives serverless cold
// starts and is shared across every running instance — unlike an in-memory
// counter, which resets per lambda. Uses a fixed window per key.

export type RateLimitResult = { allowed: boolean; retryAfterSec: number };

// Count one hit against `key`. Allows up to `limit` hits per `windowMs`.
// Fails open (allows) if the datastore errors — a limiter hiccup must never lock
// every user out, and if the DB is down login can't proceed anyway.
export async function rateLimit(
  key: string,
  limit: number,
  windowMs: number,
): Promise<RateLimitResult> {
  const now = new Date();
  try {
    // Occasionally prune expired rows so the table can't grow unbounded.
    if (Math.random() < 0.02) {
      await prisma.rateLimit
        .deleteMany({ where: { expiresAt: { lt: now } } })
        .catch(() => {});
    }

    const existing = await prisma.rateLimit.findUnique({ where: { key } });
    if (!existing || existing.expiresAt <= now) {
      // New or expired window — (re)start the count.
      const expiresAt = new Date(now.getTime() + windowMs);
      await prisma.rateLimit.upsert({
        where: { key },
        create: { key, count: 1, expiresAt },
        update: { count: 1, expiresAt },
      });
      return { allowed: true, retryAfterSec: 0 };
    }

    const updated = await prisma.rateLimit.update({
      where: { key },
      data: { count: { increment: 1 } },
    });
    if (updated.count > limit) {
      const retryAfterSec = Math.ceil(
        (existing.expiresAt.getTime() - now.getTime()) / 1000,
      );
      return { allowed: false, retryAfterSec };
    }
    return { allowed: true, retryAfterSec: 0 };
  } catch {
    return { allowed: true, retryAfterSec: 0 };
  }
}

// Reset a key's window — e.g. after a successful login, so a user who fat-fingered
// their password a few times isn't throttled once they get it right.
export async function clearRateLimit(key: string): Promise<void> {
  await prisma.rateLimit.deleteMany({ where: { key } }).catch(() => {});
}

// Best-effort client IP from proxy headers (Vercel sets x-forwarded-for).
export async function clientIp(): Promise<string> {
  const h = await headers();
  const fwd = h.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]!.trim();
  return h.get("x-real-ip") ?? "unknown";
}
