import { publishDueExams, closeDueExams } from "@/lib/exam-actions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Triggered by Vercel Cron (see vercel.json) and/or an external every-minute
// cron. Vercel attaches `Authorization: Bearer $CRON_SECRET` automatically when
// CRON_SECRET is set; the actions verify it. Publishes first, then closes, so a
// publish and close due in the same tick are applied in the right order.
export async function GET(req: Request) {
  const auth = req.headers.get("authorization") ?? "";
  const secret = auth.startsWith("Bearer ") ? auth.slice(7) : "";

  const publish = await publishDueExams(secret);
  if ("error" in publish) {
    return new Response(JSON.stringify(publish), {
      status: 401,
      headers: { "content-type": "application/json", "cache-control": "no-store" },
    });
  }
  const close = await closeDueExams(secret);

  return new Response(
    JSON.stringify({ ...publish, ...("error" in close ? {} : close) }),
    {
      status: 200,
      headers: { "content-type": "application/json", "cache-control": "no-store" },
    },
  );
}
