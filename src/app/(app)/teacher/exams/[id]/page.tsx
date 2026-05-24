import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/dal";
import { Card, CardBody, Button, Badge } from "@/components/ui";
import { ExamStatusActions } from "./exam-status-actions";
import { ExamMetaForm } from "./exam-meta-form";
import {
  ExamQuestionsManager,
  type QuestionLite,
} from "./exam-questions-manager";
import type { ExamStatus } from "@prisma/client";

const statusColor: Record<ExamStatus, "yellow" | "green" | "gray"> = {
  DRAFT: "yellow",
  PUBLISHED: "green",
  CLOSED: "gray",
};

export default async function ExamBuilderPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const teacher = await requireRole("TEACHER");
  const { id } = await params;

  const exam = await prisma.exam.findUnique({
    where: { id },
    include: {
      examQuestions: {
        orderBy: { order: "asc" },
        include: { question: { include: { subject: { select: { name: true } } } } },
      },
      _count: { select: { submissions: true } },
    },
  });
  if (!exam || exam.createdById !== teacher.id) notFound();

  const currentIds = exam.examQuestions.map((eq) => eq.questionId);

  const [subjects, bank] = await Promise.all([
    prisma.subject.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.question.findMany({
      where: { createdById: teacher.id, id: { notIn: currentIds } },
      orderBy: { createdAt: "desc" },
      include: { subject: { select: { name: true } } },
    }),
  ]);

  const current: QuestionLite[] = exam.examQuestions.map((eq) => ({
    id: eq.question.id,
    type: eq.question.type,
    text: eq.question.text,
    difficulty: eq.question.difficulty,
    points: eq.points ?? eq.question.points,
    language: eq.question.language,
    subjectName: eq.question.subject?.name,
  }));

  const available: QuestionLite[] = bank.map((q) => ({
    id: q.id,
    type: q.type,
    text: q.text,
    difficulty: q.difficulty,
    points: q.points,
    language: q.language,
    subjectName: q.subject?.name,
  }));

  return (
    <>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold text-gray-900">{exam.title}</h1>
            <Badge color={statusColor[exam.status]}>{exam.status}</Badge>
          </div>
          <p className="mt-1 text-sm text-gray-500">
            Graded out of {exam.totalMarks}
            {exam.durationMins ? ` · ${exam.durationMins} min` : ""} ·{" "}
            {exam._count.submissions} submissions
          </p>
        </div>
        <ExamStatusActions examId={exam.id} status={exam.status} />
      </div>

      <div className="mb-6 flex flex-wrap gap-2">
        <Link href={`/teacher/exams/${exam.id}/submissions`}>
          <Button variant="secondary">View submissions ({exam._count.submissions})</Button>
        </Link>
        <Link href={`/teacher/exams/${exam.id}/report/excel`} prefetch={false}>
          <Button variant="secondary">⬇ Excel report</Button>
        </Link>
        <Link href={`/teacher/exams/${exam.id}/report/word`} prefetch={false}>
          <Button variant="secondary">⬇ Word report</Button>
        </Link>
      </div>

      <div className="mb-6">
        <ExamMetaForm
          exam={{
            id: exam.id,
            title: exam.title,
            description: exam.description,
            subjectId: exam.subjectId,
            language: exam.language,
            totalMarks: exam.totalMarks,
            durationMins: exam.durationMins,
            revealAnswers: exam.revealAnswers,
          }}
          subjects={subjects}
        />
      </div>

      {exam.examQuestions.length === 0 && (
        <Card className="mb-4 border-blue-200 bg-blue-50">
          <CardBody className="text-sm text-blue-800">
            Tip: you can generate fresh questions in the{" "}
            <Link href="/teacher/questions/generate" className="font-medium underline">
              AI generator
            </Link>{" "}
            first, then add them here.
          </CardBody>
        </Card>
      )}

      <ExamQuestionsManager
        examId={exam.id}
        current={current}
        available={available}
        subjects={subjects}
      />
    </>
  );
}
