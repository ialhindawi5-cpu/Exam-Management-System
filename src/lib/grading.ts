import "server-only";
import { prisma } from "@/lib/prisma";
import type { Question } from "@prisma/client";

// Auto-grade an objective question. Returns earned points, or null when the
// type needs human/AI grading (short answer / essay).
export function gradeObjective(
  question: Pick<Question, "type" | "correctAnswer">,
  response: string | null,
  maxPoints: number,
): number | null {
  if (question.type === "MCQ") {
    // response and correctAnswer are both the option index, as strings.
    return response != null && response === question.correctAnswer
      ? maxPoints
      : 0;
  }
  if (question.type === "TRUE_FALSE") {
    return response != null && response === question.correctAnswer
      ? maxPoints
      : 0;
  }
  return null; // SHORT_ANSWER / ESSAY
}

// Effective max points for each question within an exam (override or default).
export async function examMaxPoints(
  examId: string,
): Promise<Map<string, number>> {
  const eqs = await prisma.examQuestion.findMany({
    where: { examId },
    include: { question: { select: { points: true } } },
  });
  const map = new Map<string, number>();
  for (const eq of eqs) map.set(eq.questionId, eq.points ?? eq.question.points);
  return map;
}

// Recompute submission totals from its answers and persist them.
// scaledScore is the final mark on the exam's scale (e.g. out of 20).
export async function recomputeSubmission(submissionId: string): Promise<void> {
  const submission = await prisma.submission.findUnique({
    where: { id: submissionId },
    include: {
      exam: { select: { id: true, totalMarks: true } },
      answers: true,
    },
  });
  if (!submission) return;

  const maxMap = await examMaxPoints(submission.exam.id);
  const maxTotal = [...maxMap.values()].reduce((a, b) => a + b, 0);

  let auto = 0;
  let final = 0;
  let allGraded = true;

  for (const ans of submission.answers) {
    auto += ans.autoScore ?? 0;
    if (ans.finalScore != null) {
      final += ans.finalScore;
    } else if (ans.autoScore != null) {
      final += ans.autoScore;
    } else {
      allGraded = false;
    }
  }

  const scaled =
    maxTotal > 0 ? Number(((final / maxTotal) * submission.exam.totalMarks).toFixed(2)) : 0;

  await prisma.submission.update({
    where: { id: submissionId },
    data: {
      totalAutoScore: Number(auto.toFixed(2)),
      totalFinalScore: Number(final.toFixed(2)),
      scaledScore: scaled,
      status: allGraded ? "GRADED" : submission.status === "IN_PROGRESS" ? "SUBMITTED" : submission.status,
    },
  });
}
