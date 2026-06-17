"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/dal";
import {
  aiEnabled,
  aiUnavailableReason,
  extractAnswerKey,
  gradeAgainstKey,
  type ExtractedKeyItem,
} from "@/lib/ai";
import { getExamResponses } from "@/lib/exam-actions";
import type { ExamResponse } from "@/lib/google-forms";
import type { Prisma } from "@prisma/client";

// Keep the upload under the Messages API request ceiling (see pdf-actions.ts).
const MAX_PDF_BYTES = 10 * 1024 * 1024; // 10 MB

// ── Shared shapes for the grading panel ─────────────────────────────────────

// One question's mark for one student. `aiScore` is the AI's original
// suggestion; `score` is the current mark (equal to `aiScore` until a teacher
// edits it).
export type PerQuestionMark = {
  index: number;
  title: string;
  maxPoints: number;
  aiScore: number;
  score: number;
  feedback: string;
};

export type StudentGrade = {
  responseId: string;
  studentEmail: string | null;
  perQuestion: PerQuestionMark[];
  totalScore: number;
  maxScore: number;
  aiTotal: number;
  edited: boolean;
};

export type GradingData = {
  hasKey: boolean;
  keyFileName: string | null;
  keyUploadedAt: string | null;
  answerKey: ExtractedKeyItem[];
  questions: { index: number; title: string; maxPoints: number }[];
  responses: ExamResponse[];
  grades: StudentGrade[];
  aiEnabled: boolean;
  // A soft note when responses couldn't be loaded (e.g. Google reconnect needed)
  // — stored grades are still returned so the teacher keeps their marks.
  responsesError: string | null;
};

// Ensure the exam exists and belongs to the current teacher.
async function ownedExam(examId: string, teacherId: string) {
  const exam = await prisma.exam.findUnique({ where: { id: examId } });
  if (!exam || exam.createdById !== teacherId) return null;
  return exam;
}

// Coerce a stored `perQuestion` Json blob back into typed marks.
function parsePerQuestion(raw: unknown): PerQuestionMark[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((m) => {
    const o = (m ?? {}) as Record<string, unknown>;
    const maxPoints = Number(o.maxPoints) || 0;
    const aiScore = Number(o.aiScore) || 0;
    const score = Number.isFinite(Number(o.score)) ? Number(o.score) : aiScore;
    return {
      index: Number(o.index) || 0,
      title: String(o.title ?? ""),
      maxPoints,
      aiScore,
      score,
      feedback: String(o.feedback ?? ""),
    };
  });
}

function parseAnswerKey(raw: unknown): ExtractedKeyItem[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((k) => {
    const o = (k ?? {}) as Record<string, unknown>;
    const points = Number(o.points);
    return {
      index: Number(o.index) || 0,
      title: String(o.title ?? ""),
      answer: String(o.answer ?? ""),
      points: Number.isFinite(points) && points >= 0 ? points : undefined,
    };
  });
}

function toStudentGrade(row: {
  responseId: string;
  studentEmail: string | null;
  perQuestion: unknown;
  totalScore: number;
  maxScore: number;
  aiTotal: number;
  edited: boolean;
}): StudentGrade {
  return {
    responseId: row.responseId,
    studentEmail: row.studentEmail,
    perQuestion: parsePerQuestion(row.perQuestion),
    totalScore: row.totalScore,
    maxScore: row.maxScore,
    aiTotal: row.aiTotal,
    edited: row.edited,
  };
}

export type UploadKeyResult =
  | { ok: true; key: ExtractedKeyItem[] }
  | { error: string };

// Read an uploaded answer-key PDF and align it to the exam's gradable questions,
// then store the structured key on the exam. The questions (and their indices)
// come from the Google Form, so the key lines up with student responses.
export async function uploadAnswerKey(
  examId: string,
  _prev: UploadKeyResult | undefined,
  formData: FormData,
): Promise<UploadKeyResult> {
  const teacher = await requireRole("TEACHER");
  const exam = await ownedExam(examId, teacher.id);
  if (!exam) return { error: "Exam not found." };
  if (!aiEnabled()) {
    return { error: aiUnavailableReason() ?? "AI grading is not configured." };
  }

  const file = formData.get("pdf");
  if (!(file instanceof File) || file.size === 0) {
    return { error: "Choose a PDF answer key to upload." };
  }
  const isPdf =
    file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
  if (!isPdf) return { error: "Only PDF files are supported." };
  if (file.size > MAX_PDF_BYTES) {
    return { error: "PDF is too large (max 10 MB)." };
  }

  // Align the key to the form's questions (and their response indices).
  const res = await getExamResponses(examId);
  if ("error" in res) return { error: res.error };
  const questions = res.questions.map((q) => ({
    index: q.index,
    title: q.title,
    maxPoints: q.maxPoints,
  }));
  if (questions.length === 0) {
    return { error: "This exam's form has no gradable questions." };
  }

  const pdfBase64 = Buffer.from(await file.arrayBuffer()).toString("base64");
  try {
    const key = await extractAnswerKey({
      pdfBase64,
      questions,
      language: exam.language,
    });
    // Seed each question's points from the Google Form's value; the teacher can
    // then adjust them in the panel (e.g. raise an essay imported as 0 points).
    const maxByIndex = new Map(questions.map((q) => [q.index, q.maxPoints]));
    const keyWithPoints: ExtractedKeyItem[] = key.map((k) => ({
      ...k,
      points: maxByIndex.get(k.index) ?? 0,
    }));
    await prisma.exam.update({
      where: { id: examId },
      data: {
        answerKey: keyWithPoints as unknown as Prisma.InputJsonValue,
        answerKeyFileName: file.name,
        answerKeyUploadedAt: new Date(),
      },
    });
    revalidatePath(`/teacher/exams/${examId}`);
    return { ok: true, key: keyWithPoints };
  } catch (e) {
    console.error("Answer-key extraction failed:", e);
    return {
      error:
        e instanceof Error
          ? e.message
          : "Failed to read the PDF. Check your API key and try again.",
    };
  }
}

export type SaveKeyPointsResult =
  | { ok: true; answerKey: ExtractedKeyItem[] }
  | { error: string };

// Update the per-question max marks on the stored answer key. The teacher sets
// how much each question is worth; the next grading pass (and the totals) use
// these values. Set a question to 0 to leave it ungraded (e.g. name / class).
export async function saveAnswerKeyPoints(
  examId: string,
  updates: { index: number; points: number }[],
): Promise<SaveKeyPointsResult> {
  const teacher = await requireRole("TEACHER");
  const exam = await ownedExam(examId, teacher.id);
  if (!exam) return { error: "Exam not found." };

  const answerKey = parseAnswerKey(exam.answerKey);
  if (answerKey.length === 0) return { error: "Upload an answer key first." };

  const byIndex = new Map(updates.map((u) => [u.index, u.points]));
  const next = answerKey.map((k) => {
    if (!byIndex.has(k.index)) return k;
    let p = Number(byIndex.get(k.index));
    if (!Number.isFinite(p) || p < 0) p = 0;
    return { ...k, points: p };
  });

  await prisma.exam.update({
    where: { id: examId },
    data: { answerKey: next as unknown as Prisma.InputJsonValue },
  });
  revalidatePath(`/teacher/exams/${examId}`);
  return { ok: true, answerKey: next };
}

export type GradeBatchResult =
  | {
      ok: true;
      gradedNow: number; // successfully graded in THIS batch
      failedNow: number; // errored in this batch (will retry on next call)
      totalGraded: number; // total responses with a saved grade so far
      totalResponses: number;
      remaining: number; // still ungraded after this batch
    }
  | { error: string };

// Grade ONE response against the answer key and upsert its ExamGrade. Shared by
// the batch grader. Throws on AI/DB failure so the caller can count it.
async function gradeOneResponse(
  examId: string,
  language: string,
  questions: { index: number; title: string; maxPoints: number }[],
  keyByIndex: Map<number, string>,
  r: ExamResponse,
): Promise<void> {
  const items = questions.map((q) => ({
    index: q.index,
    title: q.title,
    maxPoints: q.maxPoints,
    correctAnswer: keyByIndex.get(q.index) ?? "",
    studentAnswer: r.answers[q.index]?.value ?? "",
  }));
  const marks = await gradeAgainstKey({ items, language });
  const markByIndex = new Map(marks.map((m) => [m.index, m]));

  const perQuestion: PerQuestionMark[] = questions.map((q) => {
    const m = markByIndex.get(q.index);
    const score = m?.score ?? 0;
    return {
      index: q.index,
      title: q.title,
      maxPoints: q.maxPoints,
      aiScore: score,
      score,
      feedback: m?.feedback ?? "",
    };
  });
  const totalScore = perQuestion.reduce((s, m) => s + m.score, 0);
  const maxScore = perQuestion.reduce((s, m) => s + m.maxPoints, 0);

  const data = {
    studentEmail: r.email,
    perQuestion: perQuestion as unknown as Prisma.InputJsonValue,
    totalScore,
    maxScore,
    aiTotal: totalScore,
    edited: false,
  };
  await prisma.examGrade.upsert({
    where: { examId_responseId: { examId, responseId: r.responseId } },
    update: { ...data, gradedAt: new Date() },
    create: { examId, responseId: r.responseId, ...data },
  });
}

// Grade the NEXT batch of not-yet-graded responses, in parallel. The client
// calls this repeatedly until `remaining` is 0 — this keeps every request short
// (no serverless timeout) and makes grading resumable: already-graded responses
// are skipped, so a failed/closed tab just continues where it left off. Use
// `clearGrades` first for a full re-grade. `batchSize` also bounds concurrency.
export async function gradeNextBatch(
  examId: string,
  batchSize = 8,
): Promise<GradeBatchResult> {
  const teacher = await requireRole("TEACHER");
  const exam = await ownedExam(examId, teacher.id);
  if (!exam) return { error: "Exam not found." };
  if (!aiEnabled()) {
    return { error: aiUnavailableReason() ?? "AI grading is not configured." };
  }
  const answerKey = parseAnswerKey(exam.answerKey);
  if (answerKey.length === 0) {
    return { error: "Upload an answer-key PDF first." };
  }

  const res = await getExamResponses(examId);
  if ("error" in res) return { error: res.error };
  const { questions, responses } = res;
  if (responses.length === 0) {
    return { error: "There are no responses to grade yet." };
  }

  const keyByIndex = new Map(answerKey.map((k) => [k.index, k.answer]));
  // Grade against the teacher-set points (fall back to the form's value), so a
  // question imported as 0 points can be made worth marks and actually graded.
  const pointsByIndex = new Map(
    answerKey.map((k) => [k.index, k.points]),
  );
  const gradingQuestions = questions.map((q) => ({
    ...q,
    maxPoints: pointsByIndex.get(q.index) ?? q.maxPoints,
  }));
  const size = Math.min(Math.max(batchSize, 1), 20);

  // Skip responses that already have a saved grade (resumable).
  const existing = await prisma.examGrade.findMany({
    where: { examId },
    select: { responseId: true },
  });
  const done = new Set(existing.map((g) => g.responseId));
  const pending = responses.filter((r) => !done.has(r.responseId));
  const batch = pending.slice(0, size);

  let gradedNow = 0;
  let failedNow = 0;
  // Grade the batch concurrently — the main speed-up over the old sequential loop.
  const results = await Promise.allSettled(
    batch.map((r) =>
      gradeOneResponse(examId, exam.language, gradingQuestions, keyByIndex, r),
    ),
  );
  for (const [i, result] of results.entries()) {
    if (result.status === "fulfilled") gradedNow += 1;
    else {
      failedNow += 1;
      console.error(`Grading response ${batch[i].responseId} failed:`, result.reason);
    }
  }

  const totalGraded = done.size + gradedNow;
  const remaining = Math.max(responses.length - totalGraded, 0);
  if (remaining === 0 || gradedNow > 0) revalidatePath(`/teacher/exams/${examId}`);
  return {
    ok: true,
    gradedNow,
    failedNow,
    totalGraded,
    totalResponses: responses.length,
    remaining,
  };
}

// Delete all saved grades for an exam so the next grading pass starts fresh.
// Used by "Re-grade all" (discards any teacher edits too).
export async function clearGrades(
  examId: string,
): Promise<{ ok: true; deleted: number } | { error: string }> {
  const teacher = await requireRole("TEACHER");
  const exam = await ownedExam(examId, teacher.id);
  if (!exam) return { error: "Exam not found." };
  const { count } = await prisma.examGrade.deleteMany({ where: { examId } });
  revalidatePath(`/teacher/exams/${examId}`);
  return { ok: true, deleted: count };
}

// Load everything the grading panel needs: the stored answer key + grades, plus
// the live responses (to show each student's answers next to their marks).
export async function getGradingData(examId: string): Promise<GradingData> {
  const teacher = await requireRole("TEACHER");
  const exam = await ownedExam(examId, teacher.id);
  if (!exam) {
    return {
      hasKey: false,
      keyFileName: null,
      keyUploadedAt: null,
      answerKey: [],
      questions: [],
      responses: [],
      grades: [],
      aiEnabled: aiEnabled(),
      responsesError: "Exam not found.",
    };
  }

  const answerKey = parseAnswerKey(exam.answerKey);
  const gradeRows = await prisma.examGrade.findMany({
    where: { examId },
    orderBy: { studentEmail: "asc" },
  });

  // Live responses are best-effort: if Google can't be reached we still return
  // the stored grades so the teacher keeps their marks.
  let responses: ExamResponse[] = [];
  let questions: { index: number; title: string; maxPoints: number }[] =
    answerKey.map((k) => ({ index: k.index, title: k.title, maxPoints: 0 }));
  let responsesError: string | null = null;
  const res = await getExamResponses(examId);
  if ("error" in res) {
    responsesError = res.error;
  } else {
    responses = res.responses;
    questions = res.questions.map((q) => ({
      index: q.index,
      title: q.title,
      maxPoints: q.maxPoints,
    }));
  }

  return {
    hasKey: answerKey.length > 0,
    keyFileName: exam.answerKeyFileName,
    keyUploadedAt: exam.answerKeyUploadedAt?.toISOString() ?? null,
    answerKey,
    questions,
    responses,
    grades: gradeRows.map(toStudentGrade),
    aiEnabled: aiEnabled(),
    responsesError,
  };
}

export type SaveGradeResult =
  | { ok: true; grade: StudentGrade }
  | { error: string };

// Persist a teacher's overrides for one student. `edits` is a sparse list of
// { index, score } per-question marks (each clamped to that question's max).
// `totalOverride`, when given, sets the final total directly (clamped to
// [0, maxScore]) instead of using the per-question sum — so the teacher can type
// a final mark that differs from the sum. The grade is flagged as teacher-edited.
export async function saveGradeEdits(
  examId: string,
  responseId: string,
  edits: { index: number; score: number }[],
  totalOverride?: number,
): Promise<SaveGradeResult> {
  const teacher = await requireRole("TEACHER");
  const exam = await ownedExam(examId, teacher.id);
  if (!exam) return { error: "Exam not found." };

  const row = await prisma.examGrade.findUnique({
    where: { examId_responseId: { examId, responseId } },
  });
  if (!row) return { error: "Grade not found — run AI grading first." };

  const perQuestion = parsePerQuestion(row.perQuestion);
  const editByIndex = new Map(edits.map((e) => [e.index, e.score]));
  const next = perQuestion.map((m) => {
    if (!editByIndex.has(m.index)) return m;
    let score = Number(editByIndex.get(m.index));
    if (!Number.isFinite(score)) score = 0;
    // Only floor at 0 — the teacher may award marks beyond the form's point
    // value (e.g. for questions the Google Form imported as 0 points).
    score = Math.max(0, score);
    return { ...m, score };
  });
  const computed = next.reduce((s, m) => s + m.score, 0);

  // Use the explicit total when provided (and valid), else the per-question sum.
  let totalScore = computed;
  if (totalOverride !== undefined && Number.isFinite(totalOverride)) {
    totalScore = Math.max(0, totalOverride);
  }

  const edited =
    next.some((m) => m.score !== m.aiScore) || totalScore !== row.aiTotal;

  const updated = await prisma.examGrade.update({
    where: { examId_responseId: { examId, responseId } },
    data: {
      perQuestion: next as unknown as Prisma.InputJsonValue,
      totalScore,
      edited,
    },
  });
  revalidatePath(`/teacher/exams/${examId}`);
  return { ok: true, grade: toStudentGrade(updated) };
}
