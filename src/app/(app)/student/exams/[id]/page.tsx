import { redirect, notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/dal";
import { submitExam } from "@/lib/submission-actions";
import { Card, CardBody, PageHeader } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";

export default async function TakeExamPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const student = await requireRole("STUDENT");
  const { id } = await params;

  const exam = await prisma.exam.findUnique({
    where: { id },
    include: {
      examQuestions: {
        orderBy: { order: "asc" },
        include: { question: true },
      },
    },
  });
  if (!exam) notFound();
  if (exam.status !== "PUBLISHED") redirect("/student");
  // Students can only take exams from their own school.
  if (exam.schoolId !== student.schoolId) redirect("/student");

  // Already submitted? Go straight to the result.
  const existing = await prisma.submission.findUnique({
    where: { examId_studentId: { examId: id, studentId: student.id } },
    select: { id: true },
  });
  if (existing) redirect(`/student/results/${existing.id}`);

  const action = submitExam.bind(null, exam.id);
  const dir = exam.language === "ar" ? "rtl" : "ltr";

  return (
    <>
      <PageHeader
        title={exam.title}
        description={`${exam.examQuestions.length} questions · graded out of ${exam.totalMarks}${
          exam.durationMins ? ` · ${exam.durationMins} minutes` : ""
        }`}
      />
      {exam.description && (
        <p className="mb-4 text-sm text-gray-600">{exam.description}</p>
      )}

      <form action={action} className="space-y-4">
        {exam.examQuestions.map((eq, idx) => {
          const q = eq.question;
          const name = `q_${q.id}`;
          const points = eq.points ?? q.points;
          const options = Array.isArray(q.options) ? (q.options as string[]) : [];
          return (
            <Card key={q.id}>
              <CardBody>
                <div className="mb-3 flex items-start justify-between gap-3">
                  <p className="font-medium text-gray-900" dir={dir}>
                    <span className="text-gray-400">{idx + 1}. </span>
                    {q.text}
                    {q.required && (
                      <span className="text-red-500" title="Required">
                        {" *"}
                      </span>
                    )}
                  </p>
                  <span className="shrink-0 text-xs text-gray-400">{points} pt</span>
                </div>
                {q.imageUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={q.imageUrl}
                    alt={`Question ${idx + 1} image`}
                    className="mb-3 max-h-64 rounded-lg border border-gray-200"
                  />
                )}

                {q.type === "MCQ" && (
                  <div className="space-y-2" dir={dir}>
                    {options.map((opt, oi) => (
                      <label key={oi} className="flex items-center gap-2 text-sm text-gray-700">
                        <input
                          type="radio"
                          name={name}
                          value={oi}
                          required={q.required}
                          className="h-4 w-4"
                        />
                        {opt}
                      </label>
                    ))}
                  </div>
                )}

                {q.type === "TRUE_FALSE" && (
                  <div className="flex gap-4" dir={dir}>
                    <label className="flex items-center gap-2 text-sm text-gray-700">
                      <input
                        type="radio"
                        name={name}
                        value="true"
                        required={q.required}
                        className="h-4 w-4"
                      />
                      True
                    </label>
                    <label className="flex items-center gap-2 text-sm text-gray-700">
                      <input
                        type="radio"
                        name={name}
                        value="false"
                        required={q.required}
                        className="h-4 w-4"
                      />
                      False
                    </label>
                  </div>
                )}

                {q.type === "SHORT_ANSWER" && (
                  <input
                    name={name}
                    dir={dir}
                    required={q.required}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-blue-200"
                    placeholder="Your answer"
                  />
                )}

                {q.type === "ESSAY" && (
                  <textarea
                    name={name}
                    dir={dir}
                    rows={5}
                    required={q.required}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-blue-200"
                    placeholder="Write your answer"
                  />
                )}
              </CardBody>
            </Card>
          );
        })}

        <div className="flex justify-end">
          <SubmitButton
            pendingText="Submitting…"
            confirm="Submit your exam? You can't change your answers afterwards."
          >
            Submit exam
          </SubmitButton>
        </div>
      </form>
    </>
  );
}
