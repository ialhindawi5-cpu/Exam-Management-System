"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/dal";
import { generateQuestionsFromPdf, type GeneratedQuestion } from "@/lib/ai";
import type { Prisma } from "@prisma/client";

// Keep the upload well under the Messages API's 32 MB request ceiling (base64
// inflates by ~33%) and under the server-action body limit set in next.config.
const MAX_PDF_BYTES = 10 * 1024 * 1024; // 10 MB

export type PdfImportResult =
  | { questions: GeneratedQuestion[] }
  | { error: string };

// Ensure the exam exists and belongs to the current teacher.
async function ownedExam(examId: string, teacherId: string) {
  const exam = await prisma.exam.findUnique({
    where: { id: examId },
    include: { subject: { select: { name: true } } },
  });
  if (!exam || exam.createdById !== teacherId) return null;
  return exam;
}

// Read an uploaded PDF and return draft questions for the teacher to review.
// Nothing is saved here — persistence happens in savePdfQuestionsToExam once
// the teacher confirms.
export async function generateExamQuestionsFromPdf(
  examId: string,
  _prev: PdfImportResult | undefined,
  formData: FormData,
): Promise<PdfImportResult> {
  const teacher = await requireRole("TEACHER");
  const exam = await ownedExam(examId, teacher.id);
  if (!exam) return { error: "Exam not found." };

  const file = formData.get("pdf");
  if (!(file instanceof File) || file.size === 0) {
    return { error: "Choose a PDF file to upload." };
  }
  const isPdf =
    file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
  if (!isPdf) return { error: "Only PDF files are supported." };
  if (file.size > MAX_PDF_BYTES) {
    return { error: "PDF is too large (max 10 MB). Split it into smaller files." };
  }

  const count = Math.min(30, Math.max(1, Number(formData.get("count") ?? 10)));
  const language = String(formData.get("language") ?? exam.language ?? "en");
  const instructions =
    String(formData.get("instructions") ?? "").trim() || undefined;

  const pdfBase64 = Buffer.from(await file.arrayBuffer()).toString("base64");

  try {
    const questions = await generateQuestionsFromPdf({
      pdfBase64,
      count,
      language,
      subject: exam.subject?.name,
      instructions,
    });
    if (questions.length === 0) {
      return {
        error:
          "No questions could be read from that PDF. Try a clearer file or add instructions.",
      };
    }
    return { questions };
  } catch (e) {
    return {
      error:
        e instanceof Error
          ? e.message
          : "Failed to read the PDF. Check your API key and try again.",
    };
  }
}

// Persist the chosen draft questions to the teacher's bank and attach them to
// the exam, in order, after any questions already on it.
export async function savePdfQuestionsToExam(
  examId: string,
  payload: { language: string; questions: GeneratedQuestion[] },
): Promise<{ added: number } | { error: string }> {
  const teacher = await requireRole("TEACHER");
  const exam = await ownedExam(examId, teacher.id);
  if (!exam) return { error: "Exam not found." };

  const { language, questions } = payload;
  if (!questions?.length) return { error: "No questions selected." };

  const data: Prisma.QuestionCreateManyInput[] = questions.map((q) => ({
    type: q.type,
    difficulty: q.difficulty,
    text: q.text,
    options: q.type === "MCQ" ? (q.options ?? []) : undefined,
    correctAnswer:
      q.type === "MCQ" || q.type === "TRUE_FALSE"
        ? (q.correctAnswer ?? null)
        : null,
    modelAnswer:
      q.type === "SHORT_ANSWER" || q.type === "ESSAY"
        ? (q.modelAnswer ?? null)
        : null,
    points: q.points,
    language,
    subjectId: exam.subjectId,
    createdById: teacher.id,
  }));

  // createManyAndReturn (Postgres) gives us the new ids so we can link them.
  const created = await prisma.question.createManyAndReturn({
    data,
    select: { id: true },
  });

  const last = await prisma.examQuestion.findFirst({
    where: { examId },
    orderBy: { order: "desc" },
  });
  let order = last?.order ?? 0;
  const links: Prisma.ExamQuestionCreateManyInput[] = created.map((q) => ({
    examId,
    questionId: q.id,
    order: (order += 1),
  }));
  await prisma.examQuestion.createMany({ data: links });

  revalidatePath(`/teacher/exams/${examId}`);
  return { added: created.length };
}
