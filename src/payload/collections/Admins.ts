import type { CollectionConfig } from "payload";

// CMS administrators — the people who can sign in to the Payload admin panel.
// This is separate from the exam app's Prisma `User` table (teachers/students
// keep their existing JWT login); only admins authenticate through Payload.
export const Admins: CollectionConfig = {
  slug: "admins",
  auth: true,
  admin: {
    useAsTitle: "email",
    group: "System",
    description: "Accounts that can sign in to this admin panel.",
  },
  fields: [
    { name: "name", type: "text" },
  ],
};
