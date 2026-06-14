import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Per-request Content-Security-Policy with a fresh nonce. This is the strongest
// available defense against cross-site scripting (XSS): only scripts carrying
// this request's unguessable nonce (and scripts those load, via 'strict-dynamic')
// may run — an injected <script> can't, because it can't know the nonce.
//
// Next.js reads the nonce from the request's CSP header during SSR and stamps it
// onto its own framework + page scripts automatically, so server-rendered pages
// keep working. (Note: pages must be dynamically rendered for the nonce to apply
// — statically prerendered pages have no request-time nonce.)
//
// Notes on the directives:
// - script-src is locked down with the nonce; this is the part that stops XSS.
// - style-src allows 'unsafe-inline' deliberately: React and PayloadCMS emit
//   inline style attributes, and style injection is far lower risk than script
//   injection. Tightening this would break the UI and the CMS for little gain.
// - img-src allows data:/blob: because logos and question images are handled as
//   data URLs in the editor before they're persisted.
// - frame-ancestors 'none' is a stronger, CSP-native version of X-Frame-Options.
// (Proxy is the renamed `middleware` convention in this Next.js version.)
export function proxy(request: NextRequest) {
  const isDev = process.env.NODE_ENV === "development";
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");

  const csp = [
    `default-src 'self'`,
    // React uses eval() in dev for better stack traces; never in production.
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ""}`,
    `style-src 'self' 'unsafe-inline'`,
    `img-src 'self' blob: data: https:`,
    `font-src 'self' data:`,
    `connect-src 'self'`,
    `worker-src 'self' blob:`,
    `manifest-src 'self'`,
    `object-src 'none'`,
    `base-uri 'self'`,
    `form-action 'self'`,
    `frame-ancestors 'none'`,
    // Only force-upgrade subresources in production; on http://localhost this
    // would try to upgrade dev requests to https and break local development.
    ...(isDev ? [] : ["upgrade-insecure-requests"]),
  ].join("; ");

  // Pass the CSP (with nonce) on the request so Next can stamp the nonce onto
  // its scripts during render, and also set it on the response for the browser.
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", csp);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("Content-Security-Policy", csp);
  return response;
}

export const config = {
  matcher: [
    // Run on every page request EXCEPT API routes, Next's static assets, image
    // optimizer output, and the favicon — none of which render HTML that needs a
    // nonce. Also skip link prefetches, which shouldn't carry the CSP header.
    {
      source: "/((?!api|_next/static|_next/image|favicon.ico).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
