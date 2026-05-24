"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/dal";
import { PRICE_PER_SCHOOL, CURRENCY } from "@/lib/pricing";
import type { OrderStatus } from "@prisma/client";

export type OrderState = { error?: string; ok?: boolean } | undefined;

const OrderSchema = z.object({
  name: z.string().trim().min(2, "Please enter your name."),
  email: z.string().trim().pipe(z.email("Enter a valid email.")),
  schoolName: z.string().trim().optional(),
  schools: z.coerce.number().int().min(1, "At least one school.").max(100),
  reference: z.string().trim().max(120).optional(),
});

// Public — places an order and stores the Whish Money payment proof.
export async function placeOrder(
  _prev: OrderState,
  formData: FormData,
): Promise<OrderState> {
  const parsed = OrderSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    schoolName: formData.get("schoolName") ?? undefined,
    schools: formData.get("schools"),
    reference: formData.get("reference") ?? undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  // Payment proof is required.
  const proofUrl = (formData.get("proofUrl") as string) || "";
  if (!proofUrl) {
    return { error: "Please attach a screenshot of your Whish Money payment." };
  }
  if (!/^data:image\/(png|jpe?g|gif|webp);base64,/i.test(proofUrl)) {
    return { error: "Proof must be an image (PNG, JPG, GIF, or WebP)." };
  }
  if (proofUrl.length > 1_400_000) {
    return { error: "Proof image is too large (max ~1 MB)." };
  }

  const { name, email, schoolName, schools, reference } = parsed.data;
  const amount = schools * PRICE_PER_SCHOOL;

  await prisma.order.create({
    data: {
      name,
      email,
      schoolName: schoolName || null,
      schools,
      amount,
      currency: CURRENCY,
      reference: reference || null,
      proofUrl,
    },
  });
  revalidatePath("/admin/orders");
  return { ok: true };
}

export async function setOrderStatus(id: string, status: OrderStatus) {
  await requireRole("ADMIN");
  await prisma.order.update({ where: { id }, data: { status } });
  revalidatePath("/admin/orders");
  return { ok: true };
}

export async function deleteOrder(id: string) {
  await requireRole("ADMIN");
  await prisma.order.delete({ where: { id } });
  revalidatePath("/admin/orders");
  return { ok: true };
}
