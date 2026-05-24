import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import type { Role, AccessStatus } from "@prisma/client";

export type CurrentUser = {
  id: string;
  name: string;
  email: string;
  role: Role;
  accessStatus: AccessStatus;
  language: string;
  gradeLevel: string | null;
  schoolId: string | null;
};

// Cached per request render so multiple calls hit the DB only once.
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const session = await getSession();
  if (!session?.userId) return null;

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      accessStatus: true,
      language: true,
      gradeLevel: true,
      schoolId: true,
    },
  });
  return user;
});

// Require an authenticated, APPROVED user. Redirects otherwise.
export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.accessStatus === "SUSPENDED") redirect("/suspended");
  if (user.accessStatus === "PENDING") redirect("/pending");
  return user;
}

// Require one of the given roles (and APPROVED access).
export async function requireRole(
  ...roles: Role[]
): Promise<CurrentUser> {
  const user = await requireUser();
  if (!roles.includes(user.role)) redirect("/forbidden");
  return user;
}

// Convenience: route a user to their home dashboard by role.
export function dashboardPathFor(role: Role): string {
  switch (role) {
    case "ADMIN":
      return "/admin";
    case "SCHOOL_ADMIN":
      return "/school";
    case "TEACHER":
      return "/teacher";
    case "STUDENT":
      return "/student";
  }
}
