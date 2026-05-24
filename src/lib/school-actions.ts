"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/dal";

export type SchoolState = { error?: string; ok?: boolean } | undefined;

const MAX_LOGO_CHARS = 1_400_000;

function validateLogo(logoDataUrl: string | null): string | null {
  if (!logoDataUrl) return null;
  if (!/^data:image\/(png|jpe?g|gif|webp);base64,/i.test(logoDataUrl)) {
    return "Logo must be a PNG, JPG, GIF, or WebP image.";
  }
  if (logoDataUrl.length > MAX_LOGO_CHARS) {
    return "Logo is too large (max ~1 MB).";
  }
  return null;
}

// Accept only #rrggbb; otherwise fall back to null (use default theme).
function cleanColor(value: FormDataEntryValue | null): string | null {
  const v = String(value ?? "").trim();
  return /^#[0-9a-fA-F]{6}$/.test(v) ? v.toLowerCase() : null;
}

export async function createSchool(
  _prev: SchoolState,
  formData: FormData,
): Promise<SchoolState> {
  await requireRole("ADMIN");
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { error: "School name is required." };

  const logoDataUrl = (formData.get("logoDataUrl") as string) || null;
  const logoErr = validateLogo(logoDataUrl);
  if (logoErr) return { error: logoErr };

  const exists = await prisma.school.findUnique({ where: { name } });
  if (exists) return { error: "A school with this name already exists." };

  await prisma.school.create({
    data: { name, logoDataUrl, themeColor: cleanColor(formData.get("themeColor")) },
  });
  revalidatePath("/admin/schools");
  return { ok: true };
}

export async function updateSchool(
  schoolId: string,
  _prev: SchoolState,
  formData: FormData,
): Promise<SchoolState> {
  await requireRole("ADMIN");
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { error: "School name is required." };

  const logoDataUrl = (formData.get("logoDataUrl") as string) || null;
  const logoErr = validateLogo(logoDataUrl);
  if (logoErr) return { error: logoErr };

  const clash = await prisma.school.findFirst({
    where: { name, NOT: { id: schoolId } },
  });
  if (clash) return { error: "Another school already uses this name." };

  await prisma.school.update({
    where: { id: schoolId },
    data: { name, logoDataUrl, themeColor: cleanColor(formData.get("themeColor")) },
  });
  revalidatePath("/admin/schools");
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function deleteSchool(schoolId: string) {
  await requireRole("ADMIN");
  const [users, exams] = await Promise.all([
    prisma.user.count({ where: { schoolId } }),
    prisma.exam.count({ where: { schoolId } }),
  ]);
  if (users > 0 || exams > 0) {
    return {
      error: `Reassign or remove this school's ${users} user(s) and ${exams} exam(s) before deleting it.`,
    };
  }
  await prisma.school.delete({ where: { id: schoolId } });
  revalidatePath("/admin/schools");
  return { ok: true };
}

export async function setUserSchool(userId: string, schoolId: string | null) {
  await requireRole("ADMIN");
  await prisma.user.update({
    where: { id: userId },
    data: { schoolId: schoolId || null },
  });
  revalidatePath("/admin/users");
  return { ok: true };
}
