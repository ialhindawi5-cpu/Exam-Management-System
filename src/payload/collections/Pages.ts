import type { CollectionConfig } from "payload";

// Standalone, fully editable content pages (e.g. privacy, terms, about).
// Rendered publicly at /page/<slug>. The marketing homepage has its own
// structured global (see globals/Homepage) since its layout is fixed.
export const Pages: CollectionConfig = {
  slug: "pages",
  admin: {
    group: "Content",
    useAsTitle: "title",
    defaultColumns: ["title", "slug", "updatedAt"],
    description: "Standalone content pages, served at /page/<slug>.",
  },
  access: { read: () => true },
  fields: [
    { name: "title", type: "text", required: true },
    {
      name: "slug",
      type: "text",
      required: true,
      unique: true,
      admin: { description: "URL path segment: the page is served at /page/<slug>." },
    },
    { name: "content", type: "richText" },
  ],
};
