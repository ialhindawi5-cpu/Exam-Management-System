import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/dal";
import {
  connectAccountFromCode,
  oauthRedirectUri,
  verifyState,
} from "@/lib/google";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Google redirects the teacher here after consent. We verify the signed state,
// exchange the code for tokens, store the connection, and send them back.
export async function GET(req: Request) {
  const url = new URL(req.url);

  // Helper to bounce back to a page with a status flag the UI can show.
  const back = (path: string, status: "connected" | "error") =>
    NextResponse.redirect(new URL(`${path}${path.includes("?") ? "&" : "?"}google=${status}`, req.url));

  const error = url.searchParams.get("error");
  const code = url.searchParams.get("code");
  const stateToken = url.searchParams.get("state");

  if (error || !code || !stateToken) {
    return back("/teacher/exams", "error");
  }

  const state = await verifyState(stateToken);
  if (!state) {
    return back("/teacher/exams", "error");
  }

  // The signed-in user must match the one that started the flow.
  const user = await getCurrentUser();
  if (!user || user.id !== state.userId) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  try {
    await connectAccountFromCode({
      userId: user.id,
      code,
      redirectUri: oauthRedirectUri(url.origin),
    });
  } catch (e) {
    console.error("Google connect failed:", e);
    return back(state.returnTo, "error");
  }

  return back(state.returnTo, "connected");
}
