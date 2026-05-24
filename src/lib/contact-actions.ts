"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/dal";

export type ContactState = { error?: string; ok?: boolean } | undefined;

const ContactSchema = z.object({
  name: z.string().trim().min(2, "Please enter your name."),
  email: z.string().trim().pipe(z.email("Enter a valid email.")),
  subject: z.string().trim().max(150).optional(),
  message: z.string().trim().min(10, "Message must be at least 10 characters."),
});

// Public — no auth required.
export async function sendContactMessage(
  _prev: ContactState,
  formData: FormData,
): Promise<ContactState> {
  const parsed = ContactSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    subject: formData.get("subject") ?? undefined,
    message: formData.get("message"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }
  await prisma.contactMessage.create({
    data: {
      name: parsed.data.name,
      email: parsed.data.email,
      subject: parsed.data.subject || null,
      message: parsed.data.message,
    },
  });
  return { ok: true };
}

// Admin-only management.
export async function markMessageRead(id: string, read: boolean) {
  await requireRole("ADMIN");
  await prisma.contactMessage.update({ where: { id }, data: { read } });
  revalidatePath("/admin/messages");
  return { ok: true };
}

export async function deleteMessage(id: string) {
  await requireRole("ADMIN");
  await prisma.contactMessage.delete({ where: { id } });
  revalidatePath("/admin/messages");
  return { ok: true };
}
