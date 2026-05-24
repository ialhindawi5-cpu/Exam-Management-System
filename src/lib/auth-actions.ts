"use server";

import { z } from "zod";
import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { createSession, deleteSession, getSession } from "@/lib/session";
import { dashboardPathFor } from "@/lib/dal";

export type AuthState = { error?: string } | undefined;

const RegisterSchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters."),
  email: z.string().trim().toLowerCase().pipe(z.email("Enter a valid email.")),
  password: z.string().min(8, "Password must be at least 8 characters."),
  role: z.enum(["TEACHER", "STUDENT"]),
  gradeLevel: z.string().trim().optional(),
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
    role: formData.get("role"),
    gradeLevel: formData.get("gradeLevel") ?? undefined,
    schoolId: formData.get("schoolId") ?? undefined,
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const { name, email, password, role, gradeLevel, schoolId } = parsed.data;

  // Ensure the chosen school exists.
  const school = await prisma.school.findUnique({ where: { id: schoolId } });
  if (!school) return { error: "Please select a valid school." };

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return { error: "An account with this email already exists." };
  }

  const passwordHash = await bcrypt.hash(password, 10);
  await prisma.user.create({
    data: {
      name,
      email,
      passwordHash,
      role,
      accessStatus: "PENDING",
      // Grade only applies to students.
      gradeLevel: role === "STUDENT" ? gradeLevel || null : null,
      schoolId: schoolId || null,
    },
  });

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
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    return { error: "Invalid email or password." };
  }

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
