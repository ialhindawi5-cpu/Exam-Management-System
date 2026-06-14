"use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/dal";
import type { AccessStatus } from "@prisma/client";

// Actions for a SCHOOL_ADMIN: a restricted admin scoped to a single school.
// They may edit their own school's branding and manage (only) the teachers that
// belong to their school. Every action re-checks the caller's role and that the
// target belongs to their school.

export type SchoolAdminState = { error?: string; ok?: boolean } | undefined;

const MAX_LOGO_CHARS = 1_400_000;

function validateLogo(logoDataUrl: string | null): string | null {
  if (!logoDataUrl) return null;
  if (!/^data:image\/(png|jpe?g|gif|webp);base64,/i.test(logoDataUrl)) {
    return "Logo must be a PNG, JPG, GIF, or WebP image.";
  }
  if (logoDataUrl.length > MAX_LOGO_CHARS) return "Logo is too large (max ~1 MB).";
  return null;
}

function cleanColor(value: FormDataEntryValue | null): string | null {
  const v = String(value ?? "").trim();
  return /^#[0-9a-fA-F]{6}$/.test(v) ? v.toLowerCase() : null;
}

// The signed-in school admin — guaranteed to have a school assigned.
async function requireSchoolAdmin() {
  const user = await requireRole("SCHOOL_ADMIN");
  if (!user.schoolId) {
    throw new Error("No school is assigned to your account.");
  }
  return user as typeof user & { schoolId: string };
}

// A target user is manageable only if it is in the admin's school and is a
// teacher (a school admin can never touch admins / other schools).
async function isManageable(adminSchoolId: string, userId: string) {
  const target = await prisma.user.findUnique({
    where: { id: userId },
    select: { schoolId: true, role: true },
  });
  return Boolean(
    target && target.schoolId === adminSchoolId && target.role === "TEACHER",
  );
}

export async function updateMySchool(
  _prev: SchoolAdminState,
  formData: FormData,
): Promise<SchoolAdminState> {
  const admin = await requireSchoolAdmin();
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { error: "School name is required." };

  const logoDataUrl = (formData.get("logoDataUrl") as string) || null;
  const logoErr = validateLogo(logoDataUrl);
  if (logoErr) return { error: logoErr };

  const clash = await prisma.school.findFirst({
    where: { name, NOT: { id: admin.schoolId } },
  });
  if (clash) return { error: "Another school already uses this name." };

  await prisma.school.update({
    where: { id: admin.schoolId },
    data: { name, logoDataUrl, themeColor: cleanColor(formData.get("themeColor")) },
  });
  revalidatePath("/school");
  revalidatePath("/", "layout"); // refresh header branding everywhere
  return { ok: true };
}

export async function setMySchoolUserAccess(userId: string, status: AccessStatus) {
  const admin = await requireSchoolAdmin();
  if (!(await isManageable(admin.schoolId, userId))) {
    return { error: "You can only manage users in your own school." };
  }
  await prisma.user.update({ where: { id: userId }, data: { accessStatus: status } });
  revalidatePath("/school/users");
  return { ok: true };
}

export async function setMySchoolUserPassword(userId: string, newPassword: string) {
  const admin = await requireSchoolAdmin();
  if (!newPassword || newPassword.length < 8) {
    return { error: "Password must be at least 8 characters." };
  }
  if (!(await isManageable(admin.schoolId, userId))) {
    return { error: "You can only manage users in your own school." };
  }
  const passwordHash = await bcrypt.hash(newPassword, 12);
  await prisma.user.update({ where: { id: userId }, data: { passwordHash } });
  return { ok: true };
}
