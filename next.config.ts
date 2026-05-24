import type { NextConfig } from "next";
import { withPayload } from "@payloadcms/next/withPayload";

const nextConfig: NextConfig = {
  // Prisma's generated client + the AI SDK should stay external to the
  // server bundle (Payload's Postgres/sharp deps are handled by withPayload).
  serverExternalPackages: ["@prisma/client", ".prisma/client"],
};

export default withPayload(nextConfig);
