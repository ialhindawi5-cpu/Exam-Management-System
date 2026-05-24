import type { GlobalConfig } from "payload";
import { prisma } from "../../lib/prisma";

// Editable global branding (logo + site name). It is stored in Payload AND
// synced to the Prisma `AppSetting` singleton on save, so the rest of the app
// (in-app header, public site, Excel/Word report headers) — which reads
// AppSetting via getSettings() — picks it up without coupling every page to
// Payload. The logo is a data URL, so it needs no file storage on Vercel and
// keeps working in the report generators.
export const Branding: GlobalConfig = {
  slug: "branding",
  label: "Branding & Logo",
  admin: {
    group: "Content",
    description:
      "Logo and name shown across the public site, the in-app header, and report headers.",
  },
  access: { read: () => true },
  hooks: {
    afterChange: [
      async ({ doc }) => {
        try {
          await prisma.appSetting.upsert({
            where: { id: "singleton" },
            update: {
              schoolName: doc?.siteName || null,
              logoDataUrl: doc?.logo || null,
            },
            create: {
              id: "singleton",
              schoolName: doc?.siteName || null,
              logoDataUrl: doc?.logo || null,
            },
          });
        } catch (err) {
          console.error("Branding → AppSetting sync failed:", err);
        }
        return doc;
      },
    ],
  },
  fields: [
    {
      name: "siteName",
      type: "text",
      admin: {
        description: "Shown next to the logo and on reports. Leave blank for the default name.",
      },
    },
    {
      name: "logo",
      type: "text", // a data URL (works on Vercel + in reports)
      label: "Logo",
      admin: {
        components: { Field: "/payload/components/LogoField#LogoField" },
      },
    },
  ],
};
