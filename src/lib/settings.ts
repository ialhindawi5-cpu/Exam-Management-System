import "server-only";
import { cache } from "react";
import { prisma } from "@/lib/prisma";

export type AppSettings = {
  schoolName: string | null;
  logoDataUrl: string | null;
  themeColor: string | null;
};

const SINGLETON_ID = "singleton";

// Cached per request. Returns the global (fallback) branding.
export const getSettings = cache(async (): Promise<AppSettings> => {
  const s = await prisma.appSetting.findUnique({ where: { id: SINGLETON_ID } });
  return {
    schoolName: s?.schoolName ?? null,
    logoDataUrl: s?.logoDataUrl ?? null,
    themeColor: null,
  };
});

// Branding for a specific school, or null when no school is given/found.
export const getSchoolBranding = cache(
  async (schoolId: string | null): Promise<AppSettings | null> => {
    if (!schoolId) return null;
    const s = await prisma.school.findUnique({
      where: { id: schoolId },
      select: { name: true, logoDataUrl: true, themeColor: true },
    });
    return s
      ? { schoolName: s.name, logoDataUrl: s.logoDataUrl, themeColor: s.themeColor }
      : null;
  },
);

// Resolve branding for a user: their school's branding, falling back to the
// global default per-field. This matters for the logo: a school can have a name
// (always set) but no logo, in which case we still want the global logo uploaded
// at /admin/settings to show in the header rather than nothing.
export async function getBrandingForSchool(
  schoolId: string | null,
): Promise<AppSettings> {
  const global = await getSettings();
  const school = await getSchoolBranding(schoolId);
  if (!school) return global;
  return {
    schoolName: school.schoolName ?? global.schoolName,
    logoDataUrl: school.logoDataUrl ?? global.logoDataUrl,
    themeColor: school.themeColor ?? global.themeColor,
  };
}

// Parse a data URL into the parts ExcelJS / docx need. Returns null if invalid.
export function parseDataUrl(
  dataUrl: string | null,
): { base64: string; extension: "png" | "jpeg" | "gif"; buffer: Buffer } | null {
  if (!dataUrl) return null;
  const m = /^data:image\/(png|jpe?g|gif);base64,(.+)$/i.exec(dataUrl);
  if (!m) return null;
  const ext = m[1].toLowerCase() === "jpg" ? "jpeg" : (m[1].toLowerCase() as "png" | "jpeg" | "gif");
  const base64 = m[2];
  return { base64, extension: ext, buffer: Buffer.from(base64, "base64") };
}
