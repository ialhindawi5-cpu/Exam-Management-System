import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/dal";
import { PageHeader } from "@/components/ui";
import { UsersTable, type AdminUserRow } from "./users-table";

export default async function AdminUsersPage() {
  const admin = await requireRole("ADMIN");

  const [users, schools] = await Promise.all([
    prisma.user.findMany({
      orderBy: [{ accessStatus: "asc" }, { createdAt: "desc" }],
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        accessStatus: true,
        schoolId: true,
        createdAt: true,
      },
    }),
    prisma.school.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  const rows: AdminUserRow[] = users.map((u) => ({
    ...u,
    createdAt: u.createdAt.toISOString(),
  }));

  return (
    <>
      <PageHeader
        title="Users"
        description="Approve access, assign schools, set roles, and reset passwords."
      />
      <UsersTable users={rows} currentUserId={admin.id} schools={schools} />
    </>
  );
}
