"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/dal";

export type ProfileState = { error?: string; ok?: boolean } | undefined;

export async function updateProfile(
  _prev: ProfileState,
  formData: FormData,
): Promise<ProfileState> {
  const user = await requireUser();

  const name = String(formData.get("name") ?? "").trim();
  if (name.length < 2) return { error: "Name must be at least 2 characters." };

  const gradeLevel = String(formData.get("gradeLevel") ?? "").trim() || null;

  await prisma.user.update({
    where: { id: user.id },
    data: {
      name,
      // Grade only applies to students.
      gradeLevel: user.role === "STUDENT" ? gradeLevel : undefined,
    },
  });

  revalidatePath("/student/profile");
  return { ok: true };
}
