import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/dal";
import {
  googleConfigured,
  buildConsentUrl,
  oauthRedirectUri,
  signState,
} from "@/lib/google";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Kick off the per-teacher Google OAuth consent flow. `?returnTo=` is where we
// send the teacher back after they connect (defaults to their exams list).
export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user || user.accessStatus !== "APPROVED" || user.role !== "TEACHER") {
    return NextResponse.redirect(new URL("/login", req.url));
  }
  if (!googleConfigured()) {
    return new NextResponse(
      "Google is not configured. Ask your administrator to set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET.",
      { status: 503 },
    );
  }

  const url = new URL(req.url);
  const returnToParam = url.searchParams.get("returnTo") || "/teacher/exams";
  const returnTo =
    returnToParam.startsWith("/") && !returnToParam.startsWith("//")
      ? returnToParam
      : "/teacher/exams";

  const redirectUri = oauthRedirectUri(url.origin);
  const state = await signState({ userId: user.id, returnTo });
  const consentUrl = await buildConsentUrl({ redirectUri, state });

  return NextResponse.redirect(consentUrl);
}
