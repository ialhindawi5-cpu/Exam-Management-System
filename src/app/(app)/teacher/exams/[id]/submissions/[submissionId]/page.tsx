import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/dal";
import { aiEnabled } from "@/lib/ai";
import { IS_AUTO_GRADABLE, verdict } from "@/lib/labels";
import { PageHeader, Card, CardBody, Badge } from "@/components/ui";
import { GradingPanel, type GradeAnswer } from "./grading-panel";
import { ResultControls } from "./result-controls";

export default async function GradeSubmissionPage({
  params,
}: {
  params: Promise<{ id: string; submissionId: string }>;
}) {
  const teacher = await requireRole("TEACHER");
  const { id, submissionId } = await params;

  const submission = await prisma.submission.findUnique({
    where: { id: submissionId },
    include: {
      student: { select: { name: true, email: true, gradeLevel: true } },
      exam: {
        include: { examQuestions: { select: { questionId: true, points: true } } },
      },
      answers: {
        include: { question: true },
      },
    },
  });
  if (
    !submission ||
    submission.examId !== id ||
    submission.exam.createdById !== teacher.id
  ) {
    notFound();
  }

  const pointsMap = new Map(
    submission.exam.examQuestions.map((eq) => [eq.questionId, eq.points]),
  );
  // Preserve exam question order.
  const order = new Map(
    submission.exam.examQuestions.map((eq, i) => [eq.questionId, i]),
  );

  const answers: GradeAnswer[] = submission.answers
    .slice()
    .sort(
      (x, y) =>
        (order.get(x.questionId) ?? 0) - (order.get(y.questionId) ?? 0),
    )
    .map((a) => ({
      id: a.id,
      type: a.question.type,
      questionText: a.question.text,
      imageUrl: a.question.imageUrl,
      language: a.question.language,
      options: Array.isArray(a.question.options)
        ? (a.question.options as string[])
        : [],
      correctAnswer: a.question.correctAnswer,
      response: a.response,
      maxPoints: pointsMap.get(a.questionId) ?? a.question.points,
      autoScore: a.autoScore,
      finalScore: a.finalScore,
      feedback: a.feedback,
      aiGraded: a.aiGraded,
      isObjective: IS_AUTO_GRADABLE[a.question.type],
    }));

  const total = submission.exam.totalMarks;
  const isOverridden = submission.overrideScore != null;
  const score = submission.overrideScore ?? submission.scaledScore ?? 0;

  return (
    <>
      <PageHeader
        title={`Grading: ${submission.student.name}`}
        description={submission.student.email}
        action={
          <Link
            href={`/teacher/exams/${id}/submissions`}
            className="text-sm text-brand hover:underline"
          >
            ← All submissions
          </Link>
        }
      />

      <Card className="mb-6">
        <CardBody className="flex items-center justify-between">
          <div>
            <div className="text-3xl font-bold text-gray-900">
              {score} <span className="text-lg text-gray-400">/ {total}</span>
              {isOverridden && (
                <span className="ml-2 align-middle text-xs font-normal text-purple-600">
                  (manually set)
                </span>
              )}
            </div>
            <p className="text-sm text-gray-500">
              Raw: {submission.totalFinalScore ?? 0} points
            </p>
          </div>
          <Badge color={submission.status === "GRADED" ? "green" : "yellow"}>
            {submission.status === "GRADED"
              ? verdict(score, total)
              : "In progress"}
          </Badge>
        </CardBody>
      </Card>

      <ResultControls
        submissionId={submission.id}
        totalMarks={total}
        displayScore={score}
        isOverridden={isOverridden}
        gradeLevel={submission.student.gradeLevel}
        released={submission.released}
      />

      <GradingPanel
        submissionId={submission.id}
        answers={answers}
        status={submission.status}
        aiEnabled={aiEnabled()}
      />
    </>
  );
}
