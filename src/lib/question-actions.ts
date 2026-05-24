"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/dal";
import type { QuestionType, Difficulty } from "@prisma/client";

export type QuestionFormState = { error?: string } | undefined;

type ParsedQuestion = {
  type: QuestionType;
  difficulty: Difficulty;
  subjectId: string | null;
  language: string;
  text: string;
  imageUrl: string | null;
  points: number;
  required: boolean;
  options: string[] | null;
  correctAnswer: string | null;
  modelAnswer: string | null;
};

// Parse + validate the dynamic question form. Returns either fields or an error.
function parse(formData: FormData): { data: ParsedQuestion } | { error: string } {
  const type = String(formData.get("type") ?? "") as QuestionType;
  const difficulty = (String(formData.get("difficulty") ?? "MEDIUM") ||
    "MEDIUM") as Difficulty;
  const subjectId = (formData.get("subjectId") as string) || null;
  const language = (formData.get("language") as string) || "en";
  const text = String(formData.get("text") ?? "").trim();
  const points = Number(formData.get("points") ?? 1);

  if (!["MCQ", "TRUE_FALSE", "SHORT_ANSWER", "ESSAY"].includes(type)) {
    return { error: "Invalid question type." };
  }
  if (!text) return { error: "Question text is required." };
  if (!Number.isFinite(points) || points <= 0) {
    return { error: "Points must be a positive number." };
  }

  const imageUrl = (formData.get("imageUrl") as string) || null;
  if (imageUrl) {
    if (!/^data:image\/(png|jpe?g|gif|webp);base64,/i.test(imageUrl)) {
      return { error: "Question image must be a PNG, JPG, GIF, or WebP." };
    }
    if (imageUrl.length > 1_400_000) {
      return { error: "Question image is too large (max ~1 MB)." };
    }
  }

  let options: string[] | null = null;
  let correctAnswer: string | null = null;
  let modelAnswer: string | null = null;

  if (type === "MCQ") {
    options = formData
      .getAll("option")
      .map((o) => String(o).trim())
      .filter(Boolean);
    if (options.length < 2) {
      return { error: "Add at least two options for a multiple-choice question." };
    }
    const idx = Number(formData.get("correctAnswer"));
    if (!Number.isInteger(idx) || idx < 0 || idx >= options.length) {
      return { error: "Select which option is the correct answer." };
    }
    correctAnswer = String(idx); // store index into options
  } else if (type === "TRUE_FALSE") {
    const v = String(formData.get("correctAnswer") ?? "");
    if (v !== "true" && v !== "false") {
      return { error: "Select True or False as the correct answer." };
    }
    correctAnswer = v;
  } else {
    // SHORT_ANSWER / ESSAY — model answer optional but recommended for AI grading.
    modelAnswer = String(formData.get("modelAnswer") ?? "").trim() || null;
  }

  return {
    data: {
      type,
      difficulty,
      subjectId,
      language,
      text,
      imageUrl,
      points,
      required: formData.get("required") === "on",
      options,
      correctAnswer,
      modelAnswer,
    },
  };
}

export async function saveQuestion(
  _prev: QuestionFormState,
  formData: FormData,
): Promise<QuestionFormState> {
  const teacher = await requireRole("TEACHER");
  const id = (formData.get("id") as string) || null;

  const result = parse(formData);
  if ("error" in result) return { error: result.error };
  const d = result.data;

  if (id) {
    // Update — only the owner may edit.
    const existing = await prisma.question.findUnique({ where: { id } });
    if (!existing || existing.createdById !== teacher.id) {
      return { error: "Question not found." };
    }
    await prisma.question.update({
      where: { id },
      data: {
        type: d.type,
        difficulty: d.difficulty,
        subjectId: d.subjectId,
        language: d.language,
        text: d.text,
        imageUrl: d.imageUrl,
        points: d.points,
        required: d.required,
        options: d.options ?? undefined,
        correctAnswer: d.correctAnswer,
        modelAnswer: d.modelAnswer,
      },
    });
  } else {
    await prisma.question.create({
      data: {
        type: d.type,
        difficulty: d.difficulty,
        subjectId: d.subjectId,
        language: d.language,
        text: d.text,
        imageUrl: d.imageUrl,
        points: d.points,
        required: d.required,
        options: d.options ?? undefined,
        correctAnswer: d.correctAnswer,
        modelAnswer: d.modelAnswer,
        createdById: teacher.id,
      },
    });
  }

  revalidatePath("/teacher/questions");
  redirect("/teacher/questions");
}

export async function deleteQuestion(id: string) {
  const teacher = await requireRole("TEACHER");
  const existing = await prisma.question.findUnique({ where: { id } });
  if (!existing || existing.createdById !== teacher.id) {
    return { error: "Question not found." };
  }
  // Block deletion if the question is used in an exam.
  const usage = await prisma.examQuestion.count({ where: { questionId: id } });
  if (usage > 0) {
    return { error: "This question is used in an exam and cannot be deleted." };
  }
  await prisma.question.delete({ where: { id } });
  revalidatePath("/teacher/questions");
  return { ok: true };
}
