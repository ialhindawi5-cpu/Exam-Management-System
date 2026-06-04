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
    where: { schoolId: admin.schoolId, role: "TEACHER" },
    orderBy: [{ accessStatus: "asc" }, { createdAt: "desc" }],
    select: {
      id: true,
      name: true,
      email: true,
      accessStatus: true,
      createdAt: true,
    },
  });

  const rows: SchoolUserRow[] = users.map((u) => ({
    id: u.id,
    name: u.name,
    email: u.email,
    accessStatus: u.accessStatus,
    createdAt: u.createdAt.toISOString(),
  }));

  return (
    <>
      <PageHeader
        title="School users"
        description="Approve access and manage the teachers in your school."
      />
      <SchoolUsersTable users={rows} />
    </>
  );
}
