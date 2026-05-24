import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/dal";
import { PASS_MARK_RATIO, verdict } from "@/lib/labels";
import {
  PageHeader,
  Card,
  CardBody,
  Button,
  Badge,
  EmptyState,
} from "@/components/ui";
import { ReleaseControls } from "./release-controls";

export default async function SubmissionsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const teacher = await requireRole("TEACHER");
  const { id } = await params;

  const exam = await prisma.exam.findUnique({
    where: { id },
    include: {
      submissions: {
        include: {
          student: { select: { name: true, email: true, gradeLevel: true } },
        },
        orderBy: { submittedAt: "desc" },
      },
    },
  });
  if (!exam || exam.createdById !== teacher.id) notFound();

  const total = exam.totalMarks;
  const effective = (s: { overrideScore: number | null; scaledScore: number | null }) =>
    s.overrideScore ?? s.scaledScore ?? 0;
  const graded = exam.submissions.filter((s) => s.status === "GRADED");
  const avg =
    graded.length > 0
      ? graded.reduce((sum, s) => sum + effective(s), 0) / graded.length
      : 0;
  const passed = graded.filter((s) => effective(s) >= total * PASS_MARK_RATIO).length;
  const releasedCount = exam.submissions.filter((s) => s.released).length;

  return (
    <>
      <PageHeader
        title={`Submissions — ${exam.title}`}
        description={`${exam.submissions.length} total · ${releasedCount} released · graded out of ${total}`}
        action={
          <div className="flex gap-2">
            <Link href={`/teacher/exams/${id}/report/excel`} prefetch={false}>
              <Button variant="secondary">⬇ Excel</Button>
            </Link>
            <Link href={`/teacher/exams/${id}/report/word`} prefetch={false}>
              <Button variant="secondary">⬇ Word</Button>
            </Link>
          </div>
        }
      />

      <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-gray-200 bg-white p-3">
        <span className="text-sm text-gray-600">
          Release marks so students can see their results.
        </span>
        <ReleaseControls examId={id} />
      </div>

      <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Card>
          <CardBody>
            <div className="text-2xl font-bold text-gray-900">
              {exam.submissions.length}
            </div>
            <p className="text-sm text-gray-500">Submitted</p>
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <div className="text-2xl font-bold text-gray-900">{graded.length}</div>
            <p className="text-sm text-gray-500">Graded</p>
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <div className="text-2xl font-bold text-gray-900">
              {avg.toFixed(1)}
              <span className="text-sm text-gray-400"> / {total}</span>
            </div>
            <p className="text-sm text-gray-500">Class average</p>
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <div className="text-2xl font-bold text-gray-900">
              {graded.length ? Math.round((passed / graded.length) * 100) : 0}%
            </div>
            <p className="text-sm text-gray-500">Pass rate</p>
          </CardBody>
        </Card>
      </div>

      {exam.submissions.length === 0 ? (
        <EmptyState>No submissions yet.</EmptyState>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-4 py-3">Student</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Score</th>
                <th className="px-4 py-3">Verdict</th>
                <th className="px-4 py-3">Released</th>
                <th className="px-4 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {exam.submissions.map((s) => (
                <tr key={s.id}>
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-900">{s.student.name}</div>
                    <div className="text-xs text-gray-500">{s.student.email}</div>
                    {s.student.gradeLevel && (
                      <div className="text-xs text-gray-400">{s.student.gradeLevel}</div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <Badge color={s.status === "GRADED" ? "green" : "yellow"}>
                      {s.status}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 font-semibold text-gray-900">
                    {s.status === "GRADED"
                      ? `${s.overrideScore ?? s.scaledScore ?? 0} / ${total}`
                      : "—"}
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {s.status === "GRADED"
                      ? verdict(s.overrideScore ?? s.scaledScore ?? 0, total)
                      : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <Badge color={s.released ? "green" : "gray"}>
                      {s.released ? "Yes" : "No"}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link href={`/teacher/exams/${id}/submissions/${s.id}`}>
                      <Button variant="secondary">Grade</Button>
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
