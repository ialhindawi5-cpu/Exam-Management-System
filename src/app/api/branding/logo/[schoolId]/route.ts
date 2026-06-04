import { prisma } from "@/lib/prisma";
import { parseDataUrl } from "@/lib/settings";

// Public endpoint that serves a school's logo as a real image, so Google Forms
// can fetch it (the logo is stored in the DB as a data URL, which Google's
// servers can't consume directly). No auth: logos are not sensitive — they're
// already shown in the public app shell — but we 404 cleanly if there's none.

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ schoolId: string }> },
) {
  const { schoolId } = await params;
  const school = await prisma.school.findUnique({
    where: { id: schoolId },
    select: { logoDataUrl: true },
  });
  if (!school?.logoDataUrl) {
    return new Response("Not found", { status: 404 });
  }
  const parsed = parseDataUrl(school.logoDataUrl);
  if (!parsed) {
    return new Response("Not found", { status: 404 });
  }
  return new Response(parsed.buffer as BodyInit, {
    headers: {
      "Content-Type": `image/${parsed.extension}`,
      "Cache-Control": "public, max-age=3600",
    },
  });
}
