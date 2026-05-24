import "server-only";
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import type { Role } from "@prisma/client";

// Stateless session: a signed JWT stored in an httpOnly cookie.
// Payload holds only the minimum needed for authorization checks.
export type SessionPayload = {
  userId: string;
  role: Role;
};

const COOKIE_NAME = "session";
const SEVEN_DAYS = 7 * 24 * 60 * 60 * 1000;

const secret = process.env.AUTH_SECRET;
if (!secret) {
  // Fail loud at boot rather than silently signing with an empty key.
  throw new Error("AUTH_SECRET is not set. Add it to your .env file.");
}
const encodedKey = new TextEncoder().encode(secret);

export async function encrypt(payload: SessionPayload): Promise<string> {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(encodedKey);
}

export async function decrypt(
  token: string | undefined,
): Promise<SessionPayload | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, encodedKey, {
      algorithms: ["HS256"],
    });
    return payload as SessionPayload;
  } catch {
    return null;
  }
}

export async function createSession(payload: SessionPayload): Promise<void> {
  const expires = new Date(Date.now() + SEVEN_DAYS);
  const token = await encrypt(payload);
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    expires,
    sameSite: "lax",
    path: "/",
  });
}

export async function getSession(): Promise<SessionPayload | null> {
  const cookieStore = await cookies();
  return decrypt(cookieStore.get(COOKIE_NAME)?.value);
}

export async function deleteSession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}
