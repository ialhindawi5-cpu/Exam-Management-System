import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/dal";
import { PageHeader, Card, CardBody, Button, Badge, EmptyState } from "@/components/ui";
import { verdict } from "@/lib/labels";

export default async function StudentDashboard() {
  const student = await requireRole("STUDENT");
  const needsGrade = !student.gradeLevel;

  const [published, submissions] = await Promise.all([
    // Only exams from the student's own school.
    student.schoolId
      ? prisma.exam.findMany({
          where: { status: "PUBLISHED", schoolId: student.schoolId },
          orderBy: { updatedAt: "desc" },
          include: {
            subject: { select: { name: true } },
            _count: { select: { examQuestions: true } },
          },
        })
      : Promise.resolve([]),
    prisma.submission.findMany({
      where: { studentId: student.id },
      include: { exam: { select: { id: true, title: true, totalMarks: true } } },
    }),
  ]);

  const takenIds = new Set(submissions.map((s) => s.examId));
  const available = published.filter((e) => !takenIds.has(e.id));

  return (
    <>
      <PageHeader
        title={`Hello, ${student.name}`}
        description={
          student.gradeLevel
            ? `${student.gradeLevel} · your exams and results.`
            : "Your exams and results."
        }
      />

      {!student.schoolId && (
        <Card className="mb-6 border-red-200 bg-red-50">
          <CardBody>
            <p className="text-sm text-red-800">
              You’re not assigned to a school yet, so no exams will appear. Please
              contact your administrator.
            </p>
          </CardBody>
        </Card>
      )}

      {needsGrade && (
        <Card className="mb-6 border-yellow-200 bg-yellow-50">
          <CardBody className="flex items-center justify-between gap-4">
            <p className="text-sm text-yellow-800">
              Set your grade/class so it appears on your results and reports.
            </p>
            <Link href="/student/profile">
              <Button variant="secondary">Set grade</Button>
            </Link>
          </CardBody>
        </Card>
      )}

      <h2 className="mb-3 text-lg font-semibold text-gray-900">Available exams</h2>
      {available.length === 0 ? (
        <EmptyState>No exams available right now.</EmptyState>
      ) : (
        <div className="mb-8 grid gap-3 sm:grid-cols-2">
          {available.map((e) => (
            <Card key={e.id}>
              <CardBody className="flex items-center justify-between">
                <div>
                  <div className="font-medium text-gray-900">{e.title}</div>
                  <div className="text-sm text-gray-500">
                    {e.subject?.name ? `${e.subject.name} · ` : ""}
                    {e._count.examQuestions} questions · /{e.totalMarks}
                    {e.durationMins ? ` · ${e.durationMins} min` : ""}
                  </div>
                </div>
                <Link href={`/student/exams/${e.id}`}>
                  <Button>Start</Button>
                </Link>
              </CardBody>
            </Card>
          ))}
        </div>
      )}

      <h2 className="mb-3 text-lg font-semibold text-gray-900">My results</h2>
      {submissions.length === 0 ? (
        <EmptyState>You haven’t taken any exams yet.</EmptyState>
      ) : (
        <div className="space-y-2">
          {submissions.map((s) => (
            <Link
              key={s.id}
              href={`/student/results/${s.id}`}
              className="flex items-center justify-between rounded-xl border border-gray-200 bg-white p-4 hover:bg-gray-50"
            >
              <span className="font-medium text-gray-900">{s.exam.title}</span>
              <div className="flex items-center gap-3">
                {s.status === "GRADED" && s.released ? (
                  <>
                    <span className="text-sm font-semibold text-gray-900">
                      {s.overrideScore ?? s.scaledScore ?? 0} / {s.exam.totalMarks}
                    </span>
                    <Badge color="green">
                      {verdict(
                        s.overrideScore ?? s.scaledScore ?? 0,
                        s.exam.totalMarks,
                      )}
                    </Badge>
                  </>
                ) : (
                  <Badge color="yellow">
                    {s.status === "GRADED" ? "Results pending" : "Awaiting grading"}
                  </Badge>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
