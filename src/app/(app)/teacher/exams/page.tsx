import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/dal";
import { PageHeader, Button, Badge, EmptyState } from "@/components/ui";
import type { ExamStatus } from "@prisma/client";

const statusColor: Record<ExamStatus, "yellow" | "green" | "gray"> = {
  DRAFT: "yellow",
  PUBLISHED: "green",
  CLOSED: "gray",
};

export default async function ExamsPage() {
  const teacher = await requireRole("TEACHER");
  const exams = await prisma.exam.findMany({
    where: { createdById: teacher.id },
    orderBy: { updatedAt: "desc" },
    include: {
      subject: { select: { name: true } },
      _count: { select: { examQuestions: true, submissions: true } },
    },
  });

  return (
    <>
      <PageHeader
        title="Exams"
        description="Create, build, publish, grade, and export."
        action={
          <Link href="/teacher/exams/new">
            <Button>+ Create exam</Button>
          </Link>
        }
      />

      {exams.length === 0 ? (
        <EmptyState>No exams yet. Create your first one.</EmptyState>
      ) : (
        <div className="space-y-3">
          {exams.map((e) => (
            <Link
              key={e.id}
              href={`/teacher/exams/${e.id}`}
              className="flex items-center justify-between rounded-xl border border-gray-200 bg-white p-4 hover:bg-gray-50"
            >
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-medium text-gray-900">{e.title}</span>
                  <Badge color={statusColor[e.status]}>{e.status}</Badge>
                </div>
                <p className="mt-0.5 text-sm text-gray-500">
                  {e.subject?.name ? `${e.subject.name} · ` : ""}
                  {e._count.examQuestions} questions · {e._count.submissions}{" "}
                  submissions · /{e.totalMarks}
                </p>
              </div>
              <span className="text-gray-400">→</span>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
