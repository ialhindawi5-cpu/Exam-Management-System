import { publishDueExams } from "@/lib/exam-actions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Triggered by Vercel Cron (see vercel.json). Vercel attaches
// `Authorization: Bearer $CRON_SECRET` automatically when CRON_SECRET is set in
// the project's environment variables; publishDueExams verifies it.
export async function GET(req: Request) {
  const auth = req.headers.get("authorization") ?? "";
  const secret = auth.startsWith("Bearer ") ? auth.slice(7) : "";

  const result = await publishDueExams(secret);
  const status = "error" in result ? 401 : 200;
  return new Response(JSON.stringify(result), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });
}
