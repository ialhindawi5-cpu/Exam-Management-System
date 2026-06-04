import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/dal";
import { Card, CardBody, PageHeader, Button, Badge } from "@/components/ui";

export default async function TeacherDashboard() {
  const teacher = await requireRole("TEACHER");

  const [questionCount, exams] = await Promise.all([
    prisma.question.count({ where: { createdById: teacher.id } }),
    prisma.exam.findMany({
      where: { createdById: teacher.id },
      orderBy: { updatedAt: "desc" },
      take: 5,
      include: { _count: { select: { examQuestions: true } } },
    }),
  ]);

  return (
    <>
      <PageHeader
        title={`Welcome, ${teacher.name}`}
        description="Build your question bank, create exams, grade, and export reports."
      />

      <div className="mb-8 grid gap-4 sm:grid-cols-3">
        <Card>
          <CardBody>
            <span className="text-3xl font-bold text-gray-900">{questionCount}</span>
            <p className="mt-1 text-sm text-gray-500">Questions in your bank</p>
            <Link href="/teacher/questions" className="mt-3 inline-block">
              <Button variant="secondary">Open bank</Button>
            </Link>
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <span className="text-3xl font-bold text-gray-900">{exams.length}</span>
            <p className="mt-1 text-sm text-gray-500">Recent exams</p>
            <Link href="/teacher/exams" className="mt-3 inline-block">
              <Button variant="secondary">All exams</Button>
            </Link>
          </CardBody>
        </Card>
        <Card className="bg-blue-50">
          <CardBody>
            <p className="text-sm font-medium text-gray-800">Start something new</p>
            <div className="mt-3 flex flex-col gap-2">
              <Link href="/teacher/exams/new">
                <Button className="w-full">+ Create exam</Button>
              </Link>
              <Link href="/teacher/questions/generate">
                <Button variant="secondary" className="w-full">
                  ✨ Generate questions
                </Button>
              </Link>
            </div>
          </CardBody>
        </Card>
      </div>

      <h2 className="mb-3 text-lg font-semibold text-gray-900">Recent exams</h2>
      {exams.length === 0 ? (
        <p className="text-sm text-gray-500">No exams yet.</p>
      ) : (
        <div className="space-y-2">
          {exams.map((e) => (
            <Link
              key={e.id}
              href={`/teacher/exams/${e.id}`}
              className="flex items-center justify-between rounded-xl border border-gray-200 bg-white p-4 hover:bg-gray-50"
            >
              <div>
                <span className="font-medium text-gray-900">{e.title}</span>
                <span className="ml-2 text-sm text-gray-500">
                  {e._count.examQuestions} questions
                </span>
              </div>
              <Badge
                color={
                  e.status === "PUBLISHED"
                    ? "green"
                    : e.status === "CLOSED"
                      ? "gray"
                      : "yellow"
                }
              >
                {e.status}
              </Badge>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
