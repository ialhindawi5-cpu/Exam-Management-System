"use server";

import { z } from "zod";
import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { createSession, deleteSession, getSession } from "@/lib/session";
import { dashboardPathFor } from "@/lib/dal";
import { rateLimit, clearRateLimit, clientIp } from "@/lib/rate-limit";
import {
  notifyAdminsOfPendingUser,
  notifyUserRegistrationReceived,
} from "@/lib/email";

export type AuthState = { error?: string } | undefined;

// Work factor for bcrypt. 12 is the current sensible default (10 was the old
// minimum); existing 10-round hashes still verify, so this needs no migration.
const BCRYPT_ROUNDS = 12;

const RegisterSchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters."),
  email: z.string().trim().toLowerCase().pipe(z.email("Enter a valid email.")),
  password: z.string().min(8, "Password must be at least 8 characters."),
  schoolId: z.string().trim().min(1, "Please select your school."),
});

export async function register(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const parsed = RegisterSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
    schoolId: formData.get("schoolId") ?? undefined,
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const { name, email, password, schoolId } = parsed.data;

  // Throttle signups per IP to curb automated account-creation spam.
  const ip = await clientIp();
  if (!(await rateLimit(`register:${ip}`, 5, 60 * 60 * 1000)).allowed) {
    return { error: "Too many sign-up attempts. Please try again later." };
  }

  // Ensure the chosen school exists.
  const school = await prisma.school.findUnique({ where: { id: schoolId } });
  if (!school) return { error: "Please select a valid school." };

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return { error: "An account with this email already exists." };
  }

  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
  // Self-registration is always for teachers; admins/school admins are assigned.
  await prisma.user.create({
    data: {
      name,
      email,
      passwordHash,
      role: "TEACHER",
      accessStatus: "PENDING",
      schoolId: schoolId || null,
    },
  });

  // Notify admins that someone is awaiting approval, and acknowledge to the new
  // user that their account is pending review. Best-effort: never let an email
  // failure break sign-up. (Must be before redirect(), which throws.)
  try {
    await notifyAdminsOfPendingUser({ name, email, schoolName: school.name });
    await notifyUserRegistrationReceived({ name, email });
  } catch (e) {
    console.error("Registration notification emails failed:", e);
  }

  // New users are PENDING until an admin approves them.
  redirect("/pending");
}

const LoginSchema = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email("Enter a valid email.")),
  password: z.string().min(1, "Password is required."),
});

export async function login(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const parsed = LoginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const { email, password } = parsed.data;

  // Throttle failed logins to slow brute force / credential stuffing. Limit per
  // IP (a broad spray) and per email (a targeted account) — both must pass.
  const ip = await clientIp();
  const ipKey = `login:ip:${ip}`;
  const emailKey = `login:email:${email}`;
  const ipLimit = await rateLimit(ipKey, 20, 15 * 60 * 1000);
  const emailLimit = await rateLimit(emailKey, 10, 15 * 60 * 1000);
  if (!ipLimit.allowed || !emailLimit.allowed) {
    return { error: "Too many attempts. Please wait a few minutes and try again." };
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    return { error: "Invalid email or password." };
  }

  // Correct credentials — clear the per-account counter so prior fumbles don't
  // linger against this user.
  await clearRateLimit(emailKey);

  await createSession({ userId: user.id, role: user.role });

  if (user.accessStatus === "SUSPENDED") redirect("/suspended");
  if (user.accessStatus === "PENDING") redirect("/pending");
  redirect(dashboardPathFor(user.role));
}

export async function logout(): Promise<void> {
  await deleteSession();
  redirect("/login");
}

// Re-issue the cookie with current role (used after an admin changes a role).
export async function refreshSessionRole(): Promise<void> {
  const session = await getSession();
  if (!session) return;
  const user = await prisma.user.findUnique({ where: { id: session.userId } });
  if (user) await createSession({ userId: user.id, role: user.role });
}
