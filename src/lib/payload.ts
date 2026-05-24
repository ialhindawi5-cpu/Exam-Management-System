import "server-only";
import { getPayload } from "payload";
import config from "@payload-config";

// A cached Payload instance, used by the public site / app to read editable
// content from the same process. getPayload memoizes, so repeat calls are cheap.
// Payload Cloud injects DATABASE_URI; locally Payload shares the exam Postgres.
export async function getPayloadClient() {
  return getPayload({ config });
}

export type FeatureItem = { icon?: string | null; title?: string | null; body?: string | null };
export type StepItem = { title?: string | null; body?: string | null };

export type HomepageContent = {
  heroBadge?: string | null;
  heroTitle?: string | null;
  heroSubtitle?: string | null;
  primaryCtaLabel?: string | null;
  secondaryCtaLabel?: string | null;
  featuresTitle?: string | null;
  featuresSubtitle?: string | null;
  features?: FeatureItem[] | null;
  stepsTitle?: string | null;
  stepsSubtitle?: string | null;
  steps?: StepItem[] | null;
  aboutTitle?: string | null;
  aboutBody?: string | null;
  contactTitle?: string | null;
  contactBlurb?: string | null;
  contactEmail?: string | null;
  contactPhone?: string | null;
};

// Reads the editable "homepage" global. Returns null (so the page falls back to
// built-in defaults) if Payload isn't initialized yet — the public site never
// breaks just because the CMS hasn't been set up.
export async function getHomepageContent(): Promise<HomepageContent | null> {
  try {
    const payload = await getPayloadClient();
    // payload-types aren't generated in this setup, so cast the options to the
    // local API's expected parameter type rather than relying on slug literals.
    const data = await payload.findGlobal(
      { slug: "homepage" } as Parameters<typeof payload.findGlobal>[0],
    );
    return data as unknown as HomepageContent;
  } catch {
    return null;
  }
}

export type ContentPage = { title: string; content?: unknown };

// Reads a standalone editable page by slug (served at /page/<slug>).
export async function getPageBySlug(slug: string): Promise<ContentPage | null> {
  try {
    const payload = await getPayloadClient();
    const res = await payload.find(
      {
        collection: "pages",
        where: { slug: { equals: slug } },
        limit: 1,
      } as Parameters<typeof payload.find>[0],
    );
    return (res.docs[0] as unknown as ContentPage) ?? null;
  } catch {
    return null;
  }
}
