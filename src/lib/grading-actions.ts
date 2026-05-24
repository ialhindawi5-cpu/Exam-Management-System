"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/dal";
import { examMaxPoints, recomputeSubmission } from "@/lib/grading";
import { gradeOpenAnswer } from "@/lib/ai";

// Confirm the submission belongs to an exam owned by the current teacher.
async function ownedSubmission(submissionId: string, teacherId: string) {
  const submission = await prisma.submission.findUnique({
    where: { id: submissionId },
    include: {
      exam: {
        select: { id: true, createdById: true, language: true, totalMarks: true },
      },
    },
  });
  if (!submission || submission.exam.createdById !== teacherId) return null;
  return submission;
}

// Teacher overrides the final mark (out of the exam total). Pass null to revert
// to the computed score.
export async function setFinalMark(
  submissionId: string,
  score: number | null,
): Promise<{ ok: true } | { error: string }> {
  const teacher = await requireRole("TEACHER");
  const submission = await ownedSubmission(submissionId, teacher.id);
  if (!submission) return { error: "Submission not found." };

  let override: number | null = null;
  if (score != null) {
    const n = Number(score);
    if (!Number.isFinite(n)) return { error: "Enter a valid number." };
    override = Math.max(0, Math.min(submission.exam.totalMarks, n));
  }
  await prisma.submission.update({
    where: { id: submissionId },
    data: { overrideScore: override },
  });
  revalidatePath(`/teacher/exams/${submission.exam.id}/submissions/${submissionId}`);
  return { ok: true };
}

// Teacher edits the grade/class level of the student who made this submission.
export async function setStudentGrade(
  submissionId: string,
  gradeLevel: string | null,
): Promise<{ ok: true } | { error: string }> {
  const teacher = await requireRole("TEACHER");
  const submission = await ownedSubmission(submissionId, teacher.id);
  if (!submission) return { error: "Submission not found." };

  await prisma.user.update({
    where: { id: submission.studentId },
    data: { gradeLevel: gradeLevel?.trim() || null },
  });
  revalidatePath(`/teacher/exams/${submission.exam.id}/submissions/${submissionId}`);
  revalidatePath(`/teacher/exams/${submission.exam.id}/submissions`);
  return { ok: true };
}

// Release (or hide) a single student's result.
export async function setSubmissionReleased(
  submissionId: string,
  released: boolean,
): Promise<{ ok: true } | { error: string }> {
  const teacher = await requireRole("TEACHER");
  const submission = await ownedSubmission(submissionId, teacher.id);
  if (!submission) return { error: "Submission not found." };

  await prisma.submission.update({
    where: { id: submissionId },
    data: { released },
  });
  revalidatePath(`/teacher/exams/${submission.exam.id}/submissions/${submissionId}`);
  revalidatePath(`/teacher/exams/${submission.exam.id}/submissions`);
  return { ok: true };
}

// Release (or hide) all results for an exam at once.
export async function releaseExamResults(
  examId: string,
  released: boolean,
): Promise<{ count: number } | { error: string }> {
  const teacher = await requireRole("TEACHER");
  const exam = await prisma.exam.findUnique({ where: { id: examId } });
  if (!exam || exam.createdById !== teacher.id) {
    return { error: "Exam not found." };
  }
  // When releasing, only release graded submissions.
  const where = released
    ? { examId, status: "GRADED" as const }
    : { examId };
  const res = await prisma.submission.updateMany({ where, data: { released } });
  revalidatePath(`/teacher/exams/${examId}/submissions`);
  return { count: res.count };
}

// Run AI grading on every open-ended answer in a submission.
export async function aiGradeSubmission(
  submissionId: string,
): Promise<{ graded: number } | { error: string }> {
  const teacher = await requireRole("TEACHER");
  const submission = await ownedSubmission(submissionId, teacher.id);
  if (!submission) return { error: "Submission not found." };

  const maxMap = await examMaxPoints(submission.exam.id);
  const answers = await prisma.answer.findMany({
    where: { submissionId },
    include: { question: true },
  });

  let graded = 0;
  try {
    for (const ans of answers) {
      if (ans.question.type !== "SHORT_ANSWER" && ans.question.type !== "ESSAY") {
        continue;
      }
      const max = maxMap.get(ans.questionId) ?? ans.question.points;
      const result = await gradeOpenAnswer({
        questionText: ans.question.text,
        modelAnswer: ans.question.modelAnswer,
        studentAnswer: ans.response ?? "",
        maxPoints: max,
        language: submission.exam.language,
      });
      await prisma.answer.update({
        where: { id: ans.id },
        data: {
          autoScore: result.score,
          // Only set finalScore from AI if the teacher hasn't graded it yet.
          finalScore: ans.finalScore ?? result.score,
          feedback: result.feedback,
          aiGraded: true,
        },
      });
      graded += 1;
    }
  } catch (e) {
    return {
      error: e instanceof Error ? e.message : "AI grading failed.",
    };
  }

  await recomputeSubmission(submissionId);
  revalidatePath(`/teacher/exams/${submission.exam.id}/submissions/${submissionId}`);
  return { graded };
}

// Teacher manually sets/overrides a single answer's score and feedback.
export async function setAnswerScore(
  answerId: string,
  finalScore: number,
  feedback: string | null,
): Promise<{ ok: true } | { error: string }> {
  const teacher = await requireRole("TEACHER");

  const answer = await prisma.answer.findUnique({
    where: { id: answerId },
    include: {
      submission: {
        include: { exam: { select: { id: true, createdById: true } } },
      },
      question: { select: { points: true } },
    },
  });
  if (!answer || answer.submission.exam.createdById !== teacher.id) {
    return { error: "Answer not found." };
  }

  const maxMap = await examMaxPoints(answer.submission.exam.id);
  const max = maxMap.get(answer.questionId) ?? answer.question.points;
  const clamped = Math.max(0, Math.min(max, Number(finalScore) || 0));

  await prisma.answer.update({
    where: { id: answerId },
    data: { finalScore: clamped, feedback: feedback?.trim() || null },
  });

  await recomputeSubmission(answer.submissionId);
  revalidatePath(
    `/teacher/exams/${answer.submission.exam.id}/submissions/${answer.submissionId}`,
  );
  return { ok: true };
}

// Mark grading complete — fill any ungraded answers with their auto score (or 0).
export async function finalizeSubmission(
  submissionId: string,
): Promise<{ ok: true } | { error: string }> {
  const teacher = await requireRole("TEACHER");
  const submission = await ownedSubmission(submissionId, teacher.id);
  if (!submission) return { error: "Submission not found." };

  const answers = await prisma.answer.findMany({ where: { submissionId } });
  await prisma.$transaction(
    answers
      .filter((a) => a.finalScore == null)
      .map((a) =>
        prisma.answer.update({
          where: { id: a.id },
          data: { finalScore: a.autoScore ?? 0 },
        }),
      ),
  );

  await recomputeSubmission(submissionId);
  await prisma.submission.update({
    where: { id: submissionId },
    data: { status: "GRADED", gradedAt: new Date() },
  });
  revalidatePath(`/teacher/exams/${submission.exam.id}/submissions/${submissionId}`);
  revalidatePath(`/teacher/exams/${submission.exam.id}/submissions`);
  return { ok: true };
}
