import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/dal";
import { PageHeader } from "@/components/ui";
import { SubjectsManager, type SubjectRow } from "./subjects-manager";

export default async function AdminSubjectsPage() {
  await requireRole("ADMIN");

  const subjects = await prisma.subject.findMany({
    orderBy: { name: "asc" },
    include: { _count: { select: { questions: true } } },
  });

  const rows: SubjectRow[] = subjects.map((s) => ({
    id: s.id,
    name: s.name,
    nameAr: s.nameAr,
    nameFr: s.nameFr,
    questionCount: s._count.questions,
  }));

  return (
    <>
      <PageHeader
        title="Subjects"
        description="Official MEHE subjects with English, Arabic, and French names."
      />
      <SubjectsManager subjects={rows} />
    </>
  );
}
