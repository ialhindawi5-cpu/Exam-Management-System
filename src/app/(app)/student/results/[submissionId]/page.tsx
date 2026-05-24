import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/dal";
import { PageHeader, Card, CardBody, Badge } from "@/components/ui";
import { QUESTION_TYPE_LABELS, verdict } from "@/lib/labels";

export default async function StudentResultPage({
  params,
}: {
  params: Promise<{ submissionId: string }>;
}) {
  const student = await requireRole("STUDENT");
  const { submissionId } = await params;

  const submission = await prisma.submission.findUnique({
    where: { id: submissionId },
    include: {
      exam: {
        include: {
          examQuestions: { select: { questionId: true, points: true } },
        },
      },
      answers: { include: { question: true } },
    },
  });
  if (!submission || submission.studentId !== student.id) notFound();

  const pointsMap = new Map(
    submission.exam.examQuestions.map((eq) => [eq.questionId, eq.points]),
  );
  const graded = submission.status === "GRADED";
  const released = submission.released;
  const visible = graded && released; // student may see scores
  const reveal = visible && submission.exam.revealAnswers;
  const total = submission.exam.totalMarks;
  const score = submission.overrideScore ?? submission.scaledScore ?? 0;

  return (
    <>
      <PageHeader title={submission.exam.title} description="Your result" />

      <Card className="mb-6">
        <CardBody className="flex items-center justify-between">
          {visible ? (
            <>
              <div>
                <div className="text-3xl font-bold text-gray-900">
                  {score} <span className="text-lg text-gray-400">/ {total}</span>
                </div>
                <p className="text-sm text-gray-500">Final mark</p>
              </div>
              <Badge color="green">{verdict(score, total)}</Badge>
            </>
          ) : (
            <p className="text-sm text-gray-600">
              {!graded
                ? "Your submission is awaiting grading by your teacher."
                : "Your teacher hasn’t released the results yet. Please check back later."}
            </p>
          )}
        </CardBody>
      </Card>

      {visible && (
      <div className="space-y-3">
        {submission.answers.map((ans, idx) => {
          const q = ans.question;
          const max = pointsMap.get(q.id) ?? q.points;
          const options = Array.isArray(q.options) ? (q.options as string[]) : [];
          const dir = q.language === "ar" ? "rtl" : "ltr";

          const studentText =
            q.type === "MCQ" && ans.response != null
              ? (options[Number(ans.response)] ?? "—")
              : q.type === "TRUE_FALSE"
                ? ans.response === "true"
                  ? "True"
                  : ans.response === "false"
                    ? "False"
                    : "—"
                : (ans.response ?? "—");

          const correctText =
            q.type === "MCQ" && q.correctAnswer != null
              ? options[Number(q.correctAnswer)]
              : q.type === "TRUE_FALSE"
                ? q.correctAnswer === "true"
                  ? "True"
                  : "False"
                : q.modelAnswer || null;

          return (
            <Card key={ans.id}>
              <CardBody>
                <div className="mb-2 flex items-start justify-between gap-3">
                  <p className="font-medium text-gray-900" dir={dir}>
                    <span className="text-gray-400">{idx + 1}. </span>
                    {q.text}
                  </p>
                  <span className="shrink-0 text-sm font-semibold text-gray-700">
                    {ans.finalScore ?? "—"} / {max}
                  </span>
                </div>
                {q.imageUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={q.imageUrl}
                    alt={`Question ${idx + 1} image`}
                    className="mb-2 max-h-56 rounded-lg border border-gray-200"
                  />
                )}
                <Badge color="blue">{QUESTION_TYPE_LABELS[q.type]}</Badge>
                <div className="mt-2 text-sm" dir={dir}>
                  <span className="text-gray-500">Your answer: </span>
                  <span className="text-gray-900">{studentText}</span>
                </div>
                {reveal && correctText && (
                  <div className="mt-1 text-sm" dir={dir}>
                    <span className="text-gray-500">Correct answer: </span>
                    <span className="text-green-700">{correctText}</span>
                  </div>
                )}
                {ans.feedback && (
                  <p className="mt-2 rounded-lg bg-gray-50 px-3 py-2 text-sm text-gray-600">
                    {ans.feedback}
                  </p>
                )}
              </CardBody>
            </Card>
          );
        })}
      </div>
      )}
    </>
  );
}
