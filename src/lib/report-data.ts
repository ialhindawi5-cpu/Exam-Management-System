import "server-only";
import { prisma } from "@/lib/prisma";
import { PASS_MARK_RATIO, verdict } from "@/lib/labels";

export type ReportRow = {
  name: string;
  email: string;
  gradeLevel: string | null;
  status: string;
  rawScore: number | null;
  scaledScore: number | null;
  verdict: string;
};

export type ReportData = {
  exam: {
    id: string;
    title: string;
    subjectName: string | null;
    schoolName: string | null;
    schoolLogo: string | null;
    schoolTheme: string | null;
    totalMarks: number;
    durationMins: number | null;
    questionCount: number;
    createdAt: Date;
  };
  rows: ReportRow[];
  stats: {
    submitted: number;
    graded: number;
    average: number;
    passRate: number;
    highest: number;
    lowest: number;
  };
};

// Build the report for an exam, verifying it belongs to the teacher.
export async function buildReport(
  examId: string,
  teacherId: string,
): Promise<ReportData | null> {
  const exam = await prisma.exam.findUnique({
    where: { id: examId },
    include: {
      subject: { select: { name: true } },
      school: { select: { name: true, logoDataUrl: true, themeColor: true } },
      _count: { select: { examQuestions: true } },
      submissions: {
        include: {
          student: { select: { name: true, email: true, gradeLevel: true } },
        },
        orderBy: { student: { name: "asc" } },
      },
    },
  });
  if (!exam || exam.createdById !== teacherId) return null;

  const total = exam.totalMarks;
  // Effective mark = teacher override when present, else the computed score.
  const effective = (s: { overrideScore: number | null; scaledScore: number | null }) =>
    s.overrideScore ?? s.scaledScore ?? 0;

  const rows: ReportRow[] = exam.submissions.map((s) => ({
    name: s.student.name,
    email: s.student.email,
    gradeLevel: s.student.gradeLevel,
    status: s.status,
    rawScore: s.totalFinalScore,
    scaledScore: s.status === "GRADED" ? effective(s) : s.scaledScore,
    verdict: s.status === "GRADED" ? verdict(effective(s), total) : "Pending",
  }));

  const graded = exam.submissions.filter((s) => s.status === "GRADED");
  const scaled = graded.map((s) => effective(s));
  const average =
    scaled.length > 0 ? scaled.reduce((a, b) => a + b, 0) / scaled.length : 0;
  const passed = scaled.filter((v) => v >= total * PASS_MARK_RATIO).length;

  return {
    exam: {
      id: exam.id,
      title: exam.title,
      subjectName: exam.subject?.name ?? null,
      schoolName: exam.school?.name ?? null,
      schoolLogo: exam.school?.logoDataUrl ?? null,
      schoolTheme: exam.school?.themeColor ?? null,
      totalMarks: total,
      durationMins: exam.durationMins,
      questionCount: exam._count.examQuestions,
      createdAt: exam.createdAt,
    },
    rows,
    stats: {
      submitted: exam.submissions.length,
      graded: graded.length,
      average: Number(average.toFixed(2)),
      passRate: graded.length ? Math.round((passed / graded.length) * 100) : 0,
      highest: scaled.length ? Math.max(...scaled) : 0,
      lowest: scaled.length ? Math.min(...scaled) : 0,
    },
  };
}
