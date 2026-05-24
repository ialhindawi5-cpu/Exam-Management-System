import path from "path";
import { fileURLToPath } from "url";

import { buildConfig } from "payload";
import { postgresAdapter } from "@payloadcms/db-postgres";
import { lexicalEditor } from "@payloadcms/richtext-lexical";
import sharp from "sharp";

import { Admins } from "./payload/collections/Admins";
import { Media } from "./payload/collections/Media";
import { Pages } from "./payload/collections/Pages";
import { Homepage } from "./payload/globals/Homepage";
import { Branding } from "./payload/globals/Branding";

const dirname = path.dirname(fileURLToPath(import.meta.url));

export default buildConfig({
  admin: {
    user: Admins.slug,
    // Component string paths below are resolved relative to this dir (src).
    importMap: { baseDir: dirname },
    meta: { titleSuffix: " — Exam Admin" },
    components: {
      afterNavLinks: ["/payload/components/CmsNavLinks#CmsNavLinks"],
    },
  },
  // Payload mounts at /cms (the app keeps its own custom /admin dashboard) and
  // serves its REST/GraphQL API under /cms-api (the app already owns /api/*).
  routes: {
    admin: "/cms",
    api: "/cms-api",
    graphQL: "/cms-api/graphql",
  },
  // Payload owns editable site content only; the custom /admin dashboard keeps
  // managing users, schools, subjects, orders, contact messages, and branding.
  collections: [Admins, Media, Pages],
  globals: [Homepage, Branding],
  editor: lexicalEditor(),
  secret: process.env.PAYLOAD_SECRET || "",
  // Payload Cloud injects DATABASE_URI; locally we share the same Postgres as
  // Prisma via DATABASE_URL. Payload creates its own (lowercase) tables, which
  // never collide with Prisma's PascalCase tables.
  db: postgresAdapter({
    // Keep Payload's tables in their own Postgres schema so its dev-mode "push"
    // only ever sees the (initially empty) `payload` schema — never the Prisma
    // tables in `public`. Without this, Drizzle prompts to "rename" Prisma
    // tables (e.g. User) into Payload tables, which hangs the server and risks
    // data loss.
    schemaName: "payload",
    pool: {
      connectionString: process.env.DATABASE_URI || process.env.DATABASE_URL || "",
    },
  }),
  sharp,
  typescript: {
    outputFile: path.resolve(dirname, "payload-types.ts"),
  },
});
