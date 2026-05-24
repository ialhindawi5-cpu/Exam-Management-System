import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/dal";
import { PageHeader, EmptyState } from "@/components/ui";
import { SchoolUsersTable, type SchoolUserRow } from "./school-users-table";

export default async function SchoolUsersPage() {
  const admin = await requireRole("SCHOOL_ADMIN");

  if (!admin.schoolId) {
    return (
      <>
        <PageHeader title="School users" />
        <EmptyState>No school is assigned to your account yet.</EmptyState>
      </>
    );
  }

  const users = await prisma.user.findMany({
    where: { schoolId: admin.schoolId, role: { in: ["TEACHER", "STUDENT"] } },
    orderBy: [{ accessStatus: "asc" }, { createdAt: "desc" }],
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      accessStatus: true,
      gradeLevel: true,
      createdAt: true,
    },
  });

  const rows: SchoolUserRow[] = users.map((u) => ({
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role as "TEACHER" | "STUDENT",
    accessStatus: u.accessStatus,
    gradeLevel: u.gradeLevel,
    createdAt: u.createdAt.toISOString(),
  }));

  return (
    <>
      <PageHeader
        title="School users"
        description="Approve access and manage the teachers and students in your school."
      />
      <SchoolUsersTable users={rows} />
    </>
  );
}
