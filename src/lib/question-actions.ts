"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/dal";
import type { QuestionType, Difficulty, Prisma } from "@prisma/client";

export type QuestionFormState = { error?: string } | undefined;

export type Keyword = { text: string; points: number };

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
  keywords: Keyword[]; // open questions only; [] otherwise
};

// Parse the question form's keyword rubric (a JSON array submitted as a hidden
// field). Drops blank keywords and clamps points to non-negative numbers.
function parseKeywords(raw: FormDataEntryValue | null): Keyword[] {
  if (typeof raw !== "string" || !raw.trim()) return [];
  let arr: unknown;
  try {
    arr = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(arr)) return [];
  return arr
    .map((k) => {
      const obj = (k ?? {}) as { text?: unknown; points?: unknown };
      const text = String(obj.text ?? "").trim();
      const points = Number(obj.points);
      return { text, points: Number.isFinite(points) && points >= 0 ? points : 0 };
    })
    .filter((k) => k.text.length > 0);
}

// Parse + validate the dynamic question form. Returns either fields or an error.
function parse(formData: FormData): { data: ParsedQuestion } | { error: string } {
  const type = String(formData.get("type") ?? "") as QuestionType;
  const difficulty = (String(formData.get("difficulty") ?? "MEDIUM") ||
    "MEDIUM") as Difficulty;
  const subjectId = (formData.get("subjectId") as string) || null;
  const language = (formData.get("language") as string) || "en";
  const text = String(formData.get("text") ?? "").trim();
  // Informational content blocks (text / image) carry no points.
  const isContent = type === "TEXT" || type === "IMAGE";
  const points = isContent ? 0 : Number(formData.get("points") ?? 1);

  if (
    !["MCQ", "CHECKBOX", "DROPDOWN", "TRUE_FALSE", "SHORT_ANSWER", "ESSAY", "TEXT", "IMAGE"].includes(
      type,
    )
  ) {
    return { error: "Invalid question type." };
  }
  // A picture item's title is optional; everything else needs text.
  if (!text && type !== "IMAGE") {
    return {
      error: type === "TEXT" ? "Enter the text to display." : "Question text is required.",
    };
  }
  if (!Number.isFinite(points) || points < 0) {
    return { error: "Points must be zero or a positive number." };
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
  if (type === "IMAGE" && !imageUrl) {
    return { error: "Upload a picture for this item." };
  }

  let options: string[] | null = null;
  let correctAnswer: string | null = null;
  let modelAnswer: string | null = null;
  let keywords: Keyword[] = [];

  if (type === "MCQ" || type === "CHECKBOX" || type === "DROPDOWN") {
    options = formData
      .getAll("option")
      .map((o) => String(o).trim())
      .filter(Boolean);
    if (options.length < 2) {
      return { error: "Add at least two options for this question." };
    }
    if (type === "CHECKBOX") {
      // correctAnswer stores the comma-separated indices of every correct option.
      const opts = options; // non-null binding for use inside the closure
      const indices = String(formData.get("correctAnswer") ?? "")
        .split(",")
        .map((s) => Number(s.trim()))
        .filter((n) => Number.isInteger(n) && n >= 0 && n < opts.length);
      const unique = Array.from(new Set(indices)).sort((a, b) => a - b);
      if (unique.length === 0) {
        return { error: "Select at least one correct option." };
      }
      correctAnswer = unique.join(",");
    } else {
      // MCQ / DROPDOWN — a single correct option, stored as its index.
      const idx = Number(formData.get("correctAnswer"));
      if (!Number.isInteger(idx) || idx < 0 || idx >= options.length) {
        return { error: "Select which option is the correct answer." };
      }
      correctAnswer = String(idx);
    }
  } else if (type === "TRUE_FALSE") {
    const v = String(formData.get("correctAnswer") ?? "");
    if (v !== "true" && v !== "false") {
      return { error: "Select True or False as the correct answer." };
    }
    correctAnswer = v;
  } else if (type === "SHORT_ANSWER" || type === "ESSAY") {
    // Model answer optional but recommended for AI grading; optional keyword
    // rubric used to grade the answer in-app.
    modelAnswer = String(formData.get("modelAnswer") ?? "").trim() || null;
    keywords = parseKeywords(formData.get("keywords"));
  }
  // TEXT: no options, answer, model answer, or keywords — just the text.

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
      keywords,
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
        keywords: d.keywords as Prisma.InputJsonValue,
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
        keywords: d.keywords as Prisma.InputJsonValue,
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
