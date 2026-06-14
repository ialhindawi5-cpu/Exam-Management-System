import type { NextConfig } from "next";
import { withPayload } from "@payloadcms/next/withPayload";

// Security response headers applied to every route. We deliberately omit a full
// Content-Security-Policy here: the embedded PayloadCMS admin (/cms) relies on
// inline/eval scripts, so a strict CSP would need careful per-route nonces and
// could break the CMS. The headers below are the high-value, zero-risk set.
const securityHeaders = [
  // Force HTTPS for two years, including subdomains (safe on Vercel — all prod
  // traffic is already HTTPS). Harmless on localhost (browsers ignore it there).
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  // Disallow being framed by other origins (clickjacking). SAMEORIGIN keeps any
  // in-app framing working.
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  // Don't let browsers MIME-sniff responses into a different content type.
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Don't leak full URLs (which can carry ids) to third-party sites.
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Drop powerful features the app never uses.
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), browsing-topics=()",
  },
  // Isolate the browsing context from cross-origin popups it opens.
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
];

const nextConfig: NextConfig = {
  // Prisma's generated client + the AI SDK should stay external to the
  // server bundle (Payload's Postgres/sharp deps are handled by withPayload).
  serverExternalPackages: ["@prisma/client", ".prisma/client", "exceljs"],
  experimental: {
    // PDF uploads for AI question import exceed the 1MB server-action default.
    serverActions: { bodySizeLimit: "15mb" },
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default withPayload(nextConfig);
