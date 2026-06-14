import "server-only";
import { SignJWT, jwtVerify } from "jose";
import { prisma } from "@/lib/prisma";
import { encryptSecret, decryptSecret } from "@/lib/crypto";
import type { GoogleAccount } from "@prisma/client";

// ── Per-teacher Google OAuth 2.0 ────────────────────────────────────────────
// A teacher connects their own Google account once. We store their access +
// refresh tokens and mint fresh access tokens as needed, so we can create
// Google Forms in (and owned by) their account. Env is read lazily so importing
// this module never throws during `next build`.

const AUTH_ENDPOINT = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";

// Scopes: identify the account (email) + create/edit Forms (incl. quiz settings
// and per-question grading) + read the responses students submit so the teacher
// can review answers in-app + grant "anyone with the link" reader access to a
// published form so students can open it (drive.file, scoped to forms this app
// creates). forms.body owns the forms in the teacher's Drive;
// forms.responses.readonly grants read access to their submissions.
export const GOOGLE_SCOPES = [
  "openid",
  "email",
  "https://www.googleapis.com/auth/forms.body",
  "https://www.googleapis.com/auth/forms.responses.readonly",
  "https://www.googleapis.com/auth/drive.file",
];

// Scope substrings used to detect whether a connected account granted a given
// capability (older connections predate newer scopes and must reconnect).
export const DRIVE_FILE_SCOPE = "drive.file";

export function googleConfigured(): boolean {
  return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}

function clientCredentials(): { clientId: string; clientSecret: string } {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error(
      "Google is not configured. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET.",
    );
  }
  return { clientId, clientSecret };
}

// Where Google sends the user back. Pinned by env in production, otherwise
// derived from the current request origin (handy for localhost dev). The exact
// value must be registered as an "Authorized redirect URI" in Google Cloud.
export function oauthRedirectUri(origin: string): string {
  return process.env.GOOGLE_REDIRECT_URI || `${origin}/api/google/callback`;
}

// ── Signed OAuth state (CSRF + where to return) ─────────────────────────────
function stateKey(): Uint8Array {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error("AUTH_SECRET is not set.");
  return new TextEncoder().encode(secret);
}

export type OAuthState = { userId: string; returnTo: string };

export async function signState(state: OAuthState): Promise<string> {
  return new SignJWT({ ...state })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("10m")
    .sign(stateKey());
}

export async function verifyState(token: string): Promise<OAuthState | null> {
  try {
    const { payload } = await jwtVerify(token, stateKey(), {
      algorithms: ["HS256"],
    });
    const userId = typeof payload.userId === "string" ? payload.userId : "";
    let returnTo = typeof payload.returnTo === "string" ? payload.returnTo : "/teacher";
    // Only allow relative, in-app paths (no open redirect).
    if (!returnTo.startsWith("/") || returnTo.startsWith("//")) returnTo = "/teacher";
    if (!userId) return null;
    return { userId, returnTo };
  } catch {
    return null;
  }
}

export async function buildConsentUrl(opts: {
  redirectUri: string;
  state: string;
}): Promise<string> {
  const { clientId } = clientCredentials();
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: opts.redirectUri,
    response_type: "code",
    scope: GOOGLE_SCOPES.join(" "),
    // offline + consent so Google returns a refresh token we can reuse.
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "true",
    state: opts.state,
  });
  return `${AUTH_ENDPOINT}?${params.toString()}`;
}

type TokenResponse = {
  access_token: string;
  expires_in: number;
  refresh_token?: string;
  scope?: string;
  id_token?: string;
};

async function tokenRequest(body: Record<string, string>): Promise<TokenResponse> {
  const res = await fetch(TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(body).toString(),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Google token request failed (${res.status}): ${text}`);
  }
  return (await res.json()) as TokenResponse;
}

// Decode the email out of an id_token without verifying the signature — it
// comes straight from Google over TLS and is only used for display.
function emailFromIdToken(idToken: string | undefined): string | null {
  if (!idToken) return null;
  try {
    const payload = idToken.split(".")[1];
    const json = Buffer.from(payload, "base64url").toString("utf8");
    const data = JSON.parse(json) as { email?: string };
    return data.email ?? null;
  } catch {
    return null;
  }
}

// Exchange the authorization code, then persist the connection for the user.
export async function connectAccountFromCode(opts: {
  userId: string;
  code: string;
  redirectUri: string;
}): Promise<void> {
  const { clientId, clientSecret } = clientCredentials();
  const tok = await tokenRequest({
    code: opts.code,
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: opts.redirectUri,
    grant_type: "authorization_code",
  });
  if (!tok.refresh_token) {
    // Without offline access we can't refresh later. Force re-consent upstream.
    throw new Error(
      "Google did not return a refresh token. Disconnect the app from your Google account and try connecting again.",
    );
  }
  const expiresAt = new Date(Date.now() + tok.expires_in * 1000);
  const googleEmail = emailFromIdToken(tok.id_token);
  // Encrypt the OAuth tokens at rest — a DB leak otherwise hands an attacker
  // long-lived access to the teacher's Google Drive/Forms.
  const accessToken = encryptSecret(tok.access_token);
  const refreshToken = encryptSecret(tok.refresh_token);

  await prisma.googleAccount.upsert({
    where: { userId: opts.userId },
    update: {
      accessToken,
      refreshToken,
      expiresAt,
      scope: tok.scope ?? null,
      googleEmail,
    },
    create: {
      userId: opts.userId,
      accessToken,
      refreshToken,
      expiresAt,
      scope: tok.scope ?? null,
      googleEmail,
    },
  });
}

export async function getGoogleAccount(
  userId: string,
): Promise<GoogleAccount | null> {
  return prisma.googleAccount.findUnique({ where: { userId } });
}

export async function disconnectGoogle(userId: string): Promise<void> {
  await prisma.googleAccount.deleteMany({ where: { userId } });
}

// Return a currently-valid access token for the user, refreshing (and saving)
// it when the stored one is expired or about to expire. Throws if the user has
// not connected a Google account.
export async function getValidAccessToken(userId: string): Promise<string> {
  const account = await prisma.googleAccount.findUnique({ where: { userId } });
  if (!account) {
    throw new Error("No Google account connected.");
  }
  // 60s safety margin.
  if (account.expiresAt.getTime() - 60_000 > Date.now()) {
    return decryptSecret(account.accessToken);
  }

  const { clientId, clientSecret } = clientCredentials();
  const tok = await tokenRequest({
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: decryptSecret(account.refreshToken),
    grant_type: "refresh_token",
  });
  const expiresAt = new Date(Date.now() + tok.expires_in * 1000);
  await prisma.googleAccount.update({
    where: { userId },
    data: { accessToken: encryptSecret(tok.access_token), expiresAt },
  });
  return tok.access_token;
}
