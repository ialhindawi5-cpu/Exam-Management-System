import { prisma } from "@/lib/prisma";

// Public endpoint that serves a question's image as a real image file, so Google
// Forms can fetch it (images are stored in the DB as data URLs, which Google's
// servers can't consume directly — see also /api/branding/logo). No auth: the
// image is embedded in the public exam form anyway; 404 cleanly if there's none.

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const question = await prisma.question.findUnique({
    where: { id },
    select: { imageUrl: true },
  });
  const dataUrl = question?.imageUrl;
  if (!dataUrl) return new Response("Not found", { status: 404 });

  const m = /^data:(image\/(?:png|jpe?g|gif|webp));base64,(.+)$/i.exec(dataUrl);
  if (!m) return new Response("Not found", { status: 404 });

  const contentType = m[1].toLowerCase();
  const bytes = new Uint8Array(Buffer.from(m[2], "base64"));
  return new Response(bytes, {
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "public, max-age=3600",
    },
  });
}
