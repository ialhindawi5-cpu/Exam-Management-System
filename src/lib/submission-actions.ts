"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/dal";
import { gradeObjective, recomputeSubmission } from "@/lib/grading";

export async function submitExam(examId: string, formData: FormData) {
  const student = await requireRole("STUDENT");

  const exam = await prisma.exam.findUnique({
    where: { id: examId },
    include: {
      examQuestions: { include: { question: true }, orderBy: { order: "asc" } },
    },
  });
  if (!exam || exam.status !== "PUBLISHED" || exam.schoolId !== student.schoolId) {
    redirect("/student");
  }

  // One attempt per student.
  const existing = await prisma.submission.findUnique({
    where: { examId_studentId: { examId, studentId: student.id } },
  });
  if (existing) {
    redirect(`/student/results/${existing.id}`);
  }

  const submission = await prisma.submission.create({
    data: {
      examId,
      studentId: student.id,
      status: "SUBMITTED",
      submittedAt: new Date(),
      answers: {
        create: exam.examQuestions.map((eq) => {
          const max = eq.points ?? eq.question.points;
          const response =
            (formData.get(`q_${eq.questionId}`) as string | null) ?? null;
          const autoScore = gradeObjective(eq.question, response, max);
          return {
            questionId: eq.questionId,
            response,
            autoScore,
            // Objective questions are final immediately; open answers await grading.
            finalScore: autoScore,
          };
        }),
      },
    },
  });

  await recomputeSubmission(submission.id);
  revalidatePath("/student");
  redirect(`/student/results/${submission.id}`);
}
