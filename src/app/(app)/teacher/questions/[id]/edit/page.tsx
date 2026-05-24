import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/dal";
import { PageHeader } from "@/components/ui";
import { QuestionForm } from "../../question-form";

export default async function EditQuestionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const teacher = await requireRole("TEACHER");
  const { id } = await params;

  const q = await prisma.question.findUnique({ where: { id } });
  if (!q || q.createdById !== teacher.id) notFound();

  const subjects = await prisma.subject.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });

  const options = Array.isArray(q.options) ? (q.options as string[]) : [];
  const correctIndex =
    q.type === "MCQ" && q.correctAnswer ? Number(q.correctAnswer) : 0;

  return (
    <>
      <PageHeader title="Edit question" />
      <QuestionForm
        subjects={subjects}
        defaults={{
          id: q.id,
          type: q.type,
          difficulty: q.difficulty,
          subjectId: q.subjectId,
          language: q.language,
          text: q.text,
          imageUrl: q.imageUrl,
          points: q.points,
          required: q.required,
          options,
          correctIndex,
          tfAnswer: q.correctAnswer === "false" ? "false" : "true",
          modelAnswer: q.modelAnswer ?? "",
        }}
      />
    </>
  );
}
