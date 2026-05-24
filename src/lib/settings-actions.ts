"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/dal";

export type SettingsState = { error?: string; ok?: boolean } | undefined;

// Roughly 1 MB of base64 (data URLs are ~33% larger than the raw bytes).
const MAX_LOGO_CHARS = 1_400_000;

export async function updateSettings(
  _prev: SettingsState,
  formData: FormData,
): Promise<SettingsState> {
  await requireRole("ADMIN");

  const schoolName = String(formData.get("schoolName") ?? "").trim() || null;
  const logoDataUrl = (formData.get("logoDataUrl") as string) || null;

  if (logoDataUrl) {
    if (!/^data:image\/(png|jpe?g|gif);base64,/i.test(logoDataUrl)) {
      return { error: "Logo must be a PNG, JPG, or GIF image." };
    }
    if (logoDataUrl.length > MAX_LOGO_CHARS) {
      return { error: "Logo is too large (max ~1 MB). Please use a smaller image." };
    }
  }

  await prisma.appSetting.upsert({
    where: { id: "singleton" },
    update: { schoolName, logoDataUrl },
    create: { id: "singleton", schoolName, logoDataUrl },
  });

  // Refresh the whole app so the header/reports pick up the new branding.
  revalidatePath("/", "layout");
  return { ok: true };
}
