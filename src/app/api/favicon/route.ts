import { getSettings, parseDataUrl } from "@/lib/settings";

// Serves the browser-tab icon (favicon) from the global branding logo uploaded
// at /admin/settings, so the same logo drives the header AND the tab icon — no
// separate asset to manage. Falls back to the static /favicon.ico when no logo
// is set. Referenced from the root layout's metadata.icons.
//
// force-dynamic so a freshly-uploaded logo shows up without a rebuild; the
// short Cache-Control keeps browsers from pinning a stale icon for too long.
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { logoDataUrl } = await getSettings();
  const parsed = parseDataUrl(logoDataUrl);
  if (!parsed) {
    // No custom logo — let the browser use the built-in app favicon.
    return Response.redirect(new URL("/favicon.ico", req.url), 302);
  }
  return new Response(parsed.buffer as BodyInit, {
    headers: {
      "Content-Type": `image/${parsed.extension}`,
      "Cache-Control": "public, max-age=300, must-revalidate",
    },
  });
}
