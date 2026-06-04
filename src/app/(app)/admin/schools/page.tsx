import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/dal";
import { PageHeader } from "@/components/ui";
import { SchoolsManager, type SchoolRow } from "./schools-manager";

export default async function AdminSchoolsPage() {
  await requireRole("ADMIN");

  const [schools, userGroups] = await Promise.all([
    prisma.school.findMany({
      orderBy: { name: "asc" },
      include: { _count: { select: { exams: true } } },
    }),
    prisma.user.groupBy({ by: ["schoolId", "role"], _count: { _all: true } }),
  ]);

  const countFor = (schoolId: string, role: "TEACHER") =>
    userGroups.find((g) => g.schoolId === schoolId && g.role === role)?._count
      ._all ?? 0;

  const rows: SchoolRow[] = schools.map((s) => ({
    id: s.id,
    name: s.name,
    logoDataUrl: s.logoDataUrl,
    themeColor: s.themeColor,
    teachers: countFor(s.id, "TEACHER"),
    exams: s._count.exams,
  }));

  return (
    <>
      <PageHeader
        title="Schools"
        description="Each school keeps its own teachers, exams, and branding."
      />
      <SchoolsManager schools={rows} />
    </>
  );
}
