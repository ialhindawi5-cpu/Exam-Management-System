"use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/dal";
import { notifyUserDecision } from "@/lib/email";
import type { Role, AccessStatus } from "@prisma/client";

// Admin resets a user's password (no email needed — for "forgot password").
export async function setUserPassword(userId: string, newPassword: string) {
  await requireRole("ADMIN");
  if (!newPassword || newPassword.length < 8) {
    return { error: "Password must be at least 8 characters." };
  }
  const passwordHash = await bcrypt.hash(newPassword, 12);
  await prisma.user.update({ where: { id: userId }, data: { passwordHash } });
  return { ok: true };
}

// All actions here require an authenticated ADMIN.

export async function setAccessStatus(userId: string, status: AccessStatus) {
  const admin = await requireRole("ADMIN");
  // Guard: an admin cannot suspend their own account (avoid lockout).
  if (userId === admin.id && status !== "APPROVED") {
    return { error: "You cannot change your own access status." };
  }
  const updated = await prisma.user.update({
    where: { id: userId },
    data: { accessStatus: status },
    select: { name: true, email: true },
  });

  // Email the user the review outcome. Best-effort — never block the action.
  // (PENDING is the unreviewed state, so it sends no decision email.)
  if (status === "APPROVED" || status === "SUSPENDED") {
    try {
      await notifyUserDecision(updated, status === "APPROVED");
    } catch (e) {
      console.error("Decision notification email failed:", e);
    }
  }

  revalidatePath("/admin/users");
  return { ok: true };
}

export async function setUserRole(userId: string, role: Role) {
  const admin = await requireRole("ADMIN");
  if (userId === admin.id && role !== "ADMIN") {
    return { error: "You cannot remove your own admin role." };
  }
  await prisma.user.update({ where: { id: userId }, data: { role } });
  revalidatePath("/admin/users");
  return { ok: true };
}

export async function deleteUser(userId: string) {
  const admin = await requireRole("ADMIN");
  if (userId === admin.id) {
    return { error: "You cannot delete your own account." };
  }
  await prisma.user.delete({ where: { id: userId } });
  revalidatePath("/admin/users");
  return { ok: true };
}

export async function createSubject(formData: FormData) {
  await requireRole("ADMIN");
  const name = String(formData.get("name") ?? "").trim();
  const nameAr = String(formData.get("nameAr") ?? "").trim() || null;
  const nameFr = String(formData.get("nameFr") ?? "").trim() || null;
  if (!name) return { error: "Subject name is required." };

  const exists = await prisma.subject.findUnique({ where: { name } });
  if (exists) return { error: "A subject with this name already exists." };

  await prisma.subject.create({ data: { name, nameAr, nameFr } });
  revalidatePath("/admin/subjects");
  return { ok: true };
}

export async function deleteSubject(subjectId: string) {
  await requireRole("ADMIN");
  // Detach from questions/exams (they keep a null subject) then delete.
  await prisma.$transaction([
    prisma.question.updateMany({
      where: { subjectId },
      data: { subjectId: null },
    }),
    prisma.exam.updateMany({
      where: { subjectId },
      data: { subjectId: null },
    }),
    prisma.subject.delete({ where: { id: subjectId } }),
  ]);
  revalidatePath("/admin/subjects");
  return { ok: true };
}
