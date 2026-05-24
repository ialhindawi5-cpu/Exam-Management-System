import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/dal";
import { PageHeader } from "@/components/ui";
import { ExamCreateForm } from "./exam-create-form";

export default async function NewExamPage() {
  await requireRole("TEACHER");
  const subjects = await prisma.subject.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });
  return (
    <>
      <PageHeader title="Create exam" />
      <ExamCreateForm subjects={subjects} />
    </>
  );
}
