import type { CollectionConfig } from "payload";

// Uploaded images used inside editable Pages content. Stored on the local disk
// in dev; on Payload Cloud, swap in the S3 storage plugin at deploy time.
export const Media: CollectionConfig = {
  slug: "media",
  access: { read: () => true },
  admin: { group: "Content" },
  upload: {
    mimeTypes: ["image/*"],
  },
  fields: [
    { name: "alt", type: "text" },
  ],
};
