"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/dal";
import { generateQuestions, type GeneratedQuestion } from "@/lib/ai";
import type { QuestionType, Difficulty, Prisma } from "@prisma/client";

export type GenerateResult =
  | { questions: GeneratedQuestion[] }
  | { error: string };

export async function generateDrafts(
  _prev: GenerateResult | undefined,
  formData: FormData,
): Promise<GenerateResult> {
  await requireRole("TEACHER");

  const topic = String(formData.get("topic") ?? "").trim();
  if (!topic) return { error: "Enter a topic to generate questions about." };

  const type = String(formData.get("type") ?? "MCQ") as QuestionType;
  const difficulty = String(formData.get("difficulty") ?? "MEDIUM") as Difficulty;
  const language = String(formData.get("language") ?? "en");
  const count = Math.min(10, Math.max(1, Number(formData.get("count") ?? 5)));
  const subjectId = String(formData.get("subjectId") ?? "");

  let subjectName: string | undefined;
  if (subjectId) {
    const s = await prisma.subject.findUnique({ where: { id: subjectId } });
    subjectName = s?.name;
  }

  try {
    const questions = await generateQuestions({
      subject: subjectName,
      topic,
      difficulty,
      type,
      count,
      language,
    });
    return { questions };
  } catch (e) {
    return {
      error:
        e instanceof Error
          ? e.message
          : "Failed to generate questions. Check your API key and try again.",
    };
  }
}

// Persist the drafts the teacher chose to keep.
export async function saveGenerated(payload: {
  subjectId: string | null;
  language: string;
  questions: GeneratedQuestion[];
}): Promise<{ saved: number } | { error: string }> {
  const teacher = await requireRole("TEACHER");
  const { subjectId, language, questions } = payload;
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
    subjectId: subjectId || null,
    createdById: teacher.id,
  }));

  await prisma.question.createMany({ data });
  revalidatePath("/teacher/questions");
  return { saved: data.length };
}
