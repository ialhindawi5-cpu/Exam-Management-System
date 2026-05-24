"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/dal";
import type { Difficulty, ExamStatus, Prisma } from "@prisma/client";

export type ExamFormState = { error?: string } | undefined;

// Ensure the exam exists and belongs to the current teacher.
async function ownedExam(examId: string, teacherId: string) {
  const exam = await prisma.exam.findUnique({ where: { id: examId } });
  if (!exam || exam.createdById !== teacherId) return null;
  return exam;
}

export async function createExam(
  _prev: ExamFormState,
  formData: FormData,
): Promise<ExamFormState> {
  const teacher = await requireRole("TEACHER");
  const title = String(formData.get("title") ?? "").trim();
  if (!title) return { error: "Exam title is required." };

  const totalMarks = Number(formData.get("totalMarks") ?? 20) || 20;
  const durationRaw = formData.get("durationMins");
  const durationMins = durationRaw ? Number(durationRaw) : null;

  const exam = await prisma.exam.create({
    data: {
      title,
      description: String(formData.get("description") ?? "").trim() || null,
      subjectId: (formData.get("subjectId") as string) || null,
      language: (formData.get("language") as string) || "en",
      totalMarks,
      durationMins: durationMins && durationMins > 0 ? durationMins : null,
      createdById: teacher.id,
      // Exam belongs to the teacher's school.
      schoolId: teacher.schoolId,
    },
  });

  redirect(`/teacher/exams/${exam.id}`);
}

export async function updateExamMeta(
  examId: string,
  _prev: ExamFormState,
  formData: FormData,
): Promise<ExamFormState> {
  const teacher = await requireRole("TEACHER");
  const exam = await ownedExam(examId, teacher.id);
  if (!exam) return { error: "Exam not found." };

  const title = String(formData.get("title") ?? "").trim();
  if (!title) return { error: "Exam title is required." };
  const totalMarks = Number(formData.get("totalMarks") ?? 20) || 20;
  const durationRaw = formData.get("durationMins");
  const durationMins = durationRaw ? Number(durationRaw) : null;

  await prisma.exam.update({
    where: { id: examId },
    data: {
      title,
      description: String(formData.get("description") ?? "").trim() || null,
      subjectId: (formData.get("subjectId") as string) || null,
      language: (formData.get("language") as string) || "en",
      totalMarks,
      durationMins: durationMins && durationMins > 0 ? durationMins : null,
      revealAnswers: formData.get("revealAnswers") === "on",
    },
  });
  revalidatePath(`/teacher/exams/${examId}`);
  return { error: undefined };
}

export async function addQuestion(examId: string, questionId: string) {
  const teacher = await requireRole("TEACHER");
  const exam = await ownedExam(examId, teacher.id);
  if (!exam) return { error: "Exam not found." };

  const last = await prisma.examQuestion.findFirst({
    where: { examId },
    orderBy: { order: "desc" },
  });
  await prisma.examQuestion.upsert({
    where: { examId_questionId: { examId, questionId } },
    update: {},
    create: { examId, questionId, order: (last?.order ?? 0) + 1 },
  });
  revalidatePath(`/teacher/exams/${examId}`);
  return { ok: true };
}

export async function removeQuestion(examId: string, questionId: string) {
  const teacher = await requireRole("TEACHER");
  const exam = await ownedExam(examId, teacher.id);
  if (!exam) return { error: "Exam not found." };
  await prisma.examQuestion.deleteMany({ where: { examId, questionId } });
  revalidatePath(`/teacher/exams/${examId}`);
  return { ok: true };
}

// Auto-select questions from the teacher's bank to hit a difficulty mix.
export async function autoFillByDifficulty(
  examId: string,
  counts: { EASY: number; MEDIUM: number; HARD: number },
  filters: { subjectId?: string | null },
): Promise<{ added: number } | { error: string }> {
  const teacher = await requireRole("TEACHER");
  const exam = await ownedExam(examId, teacher.id);
  if (!exam) return { error: "Exam not found." };

  const already = await prisma.examQuestion.findMany({
    where: { examId },
    select: { questionId: true },
  });
  const excludeIds = already.map((a) => a.questionId);

  let order =
    (
      await prisma.examQuestion.findFirst({
        where: { examId },
        orderBy: { order: "desc" },
      })
    )?.order ?? 0;

  const toCreate: Prisma.ExamQuestionCreateManyInput[] = [];

  for (const difficulty of ["EASY", "MEDIUM", "HARD"] as Difficulty[]) {
    const n = counts[difficulty];
    if (!n || n <= 0) continue;

    const where: Prisma.QuestionWhereInput = {
      createdById: teacher.id,
      difficulty,
      id: { notIn: excludeIds },
    };
    if (filters.subjectId) where.subjectId = filters.subjectId;

    const pool = await prisma.question.findMany({
      where,
      select: { id: true },
    });
    // Shuffle and take n.
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    for (const q of pool.slice(0, n)) {
      order += 1;
      toCreate.push({ examId, questionId: q.id, order });
      excludeIds.push(q.id);
    }
  }

  if (toCreate.length === 0) {
    return { error: "No matching questions found in your bank for that mix." };
  }

  await prisma.examQuestion.createMany({ data: toCreate });
  await prisma.exam.update({
    where: { id: examId },
    data: { difficultyConfig: counts as Prisma.InputJsonValue },
  });
  revalidatePath(`/teacher/exams/${examId}`);
  return { added: toCreate.length };
}

export async function setExamStatus(examId: string, status: ExamStatus) {
  const teacher = await requireRole("TEACHER");
  const exam = await ownedExam(examId, teacher.id);
  if (!exam) return { error: "Exam not found." };

  if (status === "PUBLISHED") {
    const count = await prisma.examQuestion.count({ where: { examId } });
    if (count === 0) {
      return { error: "Add at least one question before publishing." };
    }
  }
  await prisma.exam.update({ where: { id: examId }, data: { status } });
  revalidatePath(`/teacher/exams/${examId}`);
  revalidatePath("/teacher/exams");
  return { ok: true };
}

export async function deleteExam(examId: string) {
  const teacher = await requireRole("TEACHER");
  const exam = await ownedExam(examId, teacher.id);
  if (!exam) return { error: "Exam not found." };
  await prisma.exam.delete({ where: { id: examId } }); // cascades to questions/submissions
  revalidatePath("/teacher/exams");
  redirect("/teacher/exams");
}
