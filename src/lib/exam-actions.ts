"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/dal";
import {
  getGoogleAccount,
  getValidAccessToken,
  googleConfigured,
} from "@/lib/google";
import {
  createExamForm,
  rebuildFormItems,
  releaseAnswerKey as pushAnswerKey,
  listFormResponses,
  setEmailCollection,
  setFormResponsesClosed,
  type FormQuestionInput,
  type ExamResponse,
} from "@/lib/google-forms";
import { gradeOpenAnswer, aiEnabled, aiUnavailableReason } from "@/lib/ai";
import type {
  Difficulty,
  Exam,
  ExamStatus,
  Prisma,
  QuestionType,
} from "@prisma/client";

export type ExamFormState = { error?: string } | undefined;

// A response question enriched with our DB rubric: the title comes from the
// form, max points + the keyword rubric come from the exam's stored question.
export type ExamResponseQuestion = {
  index: number;
  title: string;
  type: QuestionType;
  maxPoints: number;
  keywords: { text: string; points: number }[];
};

// Result of loading a Google Form's responses for display. `needsReconnect`
// signals the teacher granted Google access before the responses scope existed
// and must reconnect their account.
export type ExamResponsesResult =
  | { ok: true; questions: ExamResponseQuestion[]; responses: ExamResponse[] }
  | { error: string; needsReconnect?: boolean };

// Public origin where this app is reachable. Used to build URLs that Google's
// servers must fetch — e.g. the school logo embedded into a generated form.
// Returns null when neither is set (typical local dev), in which case external
// fetchers can't reach us and the logo is simply skipped.
function appBaseUrl(): string | null {
  if (process.env.NEXT_PUBLIC_APP_URL) {
    return process.env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "");
  }
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return null;
}

// Resolve the public logo URL for an exam's school, or null if there's nothing
// to embed (no school, no logo on file, or no public base URL).
async function resolveLogoForExam(exam: {
  schoolId: string | null;
}): Promise<{ logoUrl: string; logoAlt: string } | null> {
  const base = appBaseUrl();
  if (!base || !exam.schoolId) return null;
  const school = await prisma.school.findUnique({
    where: { id: exam.schoolId },
    select: { name: true, logoDataUrl: true },
  });
  if (!school?.logoDataUrl) return null;
  return {
    logoUrl: `${base}/api/branding/logo/${exam.schoolId}`,
    logoAlt: school.name,
  };
}

// Build the text shown at the top of the generated Google Form: an auto info
// line (school · total marks · duration) followed by the teacher's own
// description/instructions (or a sensible default). Used everywhere a form's
// description is set so create, re-sync, publish and close stay consistent.
async function buildFormDescription(exam: {
  schoolId: string | null;
  totalMarks: number;
  durationMins: number | null;
  description: string | null;
}): Promise<string> {
  let schoolName: string | null = null;
  if (exam.schoolId) {
    const school = await prisma.school.findUnique({
      where: { id: exam.schoolId },
      select: { name: true },
    });
    schoolName = school?.name ?? null;
  }
  const infoLine = [
    schoolName,
    `Total marks: ${exam.totalMarks}`,
    exam.durationMins ? `Duration: ${exam.durationMins} min` : null,
  ]
    .filter(Boolean)
    .join(" · ");
  const custom = exam.description?.trim() || "Answer all questions.";
  return infoLine ? `${infoLine}\n\n${custom}` : custom;
}

// Coerce a question's stored `keywords` Json into a clean rubric array.
function parseDbKeywords(raw: unknown): { text: string; points: number }[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((k) => {
      const obj = (k ?? {}) as { text?: unknown; points?: unknown };
      const text = String(obj.text ?? "").trim();
      const points = Number(obj.points);
      return { text, points: Number.isFinite(points) && points >= 0 ? points : 0 };
    })
    .filter((k) => k.text.length > 0);
}

// Ensure the exam exists and belongs to the current teacher.
async function ownedExam(examId: string, teacherId: string) {
  const exam = await prisma.exam.findUnique({ where: { id: examId } });
  if (!exam || exam.createdById !== teacherId) return null;
  return exam;
}

// Load an exam's questions, in order, shaped for the Google Forms client.
async function loadFormQuestions(examId: string): Promise<FormQuestionInput[]> {
  const eqs = await prisma.examQuestion.findMany({
    where: { examId },
    orderBy: { order: "asc" },
    include: { question: true },
  });
  return eqs.map((eq) => {
    const opts = eq.question.options;
    return {
      type: eq.question.type,
      text: eq.question.text,
      options: Array.isArray(opts) ? (opts as string[]) : null,
      correctAnswer: eq.question.correctAnswer,
      points: eq.points ?? eq.question.points,
      required: eq.question.required,
      language: eq.question.language,
    };
  });
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

// Set the exam's status in the DB and keep its Google Form (if any) in sync:
// publishing (re)opens the form — creating it on first publish — while DRAFT or
// CLOSED marks it closed. Shared by the teacher action and the scheduler, so it
// takes the owning `teacherId` explicitly rather than reading the session.
// All form work is best-effort: a Google failure never blocks the status change.
async function applyExamStatus(
  exam: Exam,
  teacherId: string,
  status: ExamStatus,
): Promise<void> {
  await prisma.exam.update({ where: { id: exam.id }, data: { status } });

  if (!googleConfigured()) return;
  try {
    const account = await getGoogleAccount(teacherId);
    if (!account) return;
    const accessToken = await getValidAccessToken(teacherId);
    const formDescription = await buildFormDescription(exam);

    if (status === "PUBLISHED" && !exam.googleFormId) {
      // First publish with no form yet → generate one from the questions.
      const questions = await loadFormQuestions(exam.id);
      if (questions.length > 0) {
        const logo = await resolveLogoForExam(exam);
        const form = await createExamForm({
          accessToken,
          title: exam.title,
          description: formDescription,
          questions,
          logoUrl: logo?.logoUrl ?? null,
          logoAlt: logo?.logoAlt ?? null,
        });
        await prisma.exam.update({
          where: { id: exam.id },
          data: {
            googleFormId: form.formId,
            googleFormUrl: form.responderUri,
            googleFormEditUrl: form.editUrl,
            googleFormCreatedAt: new Date(),
          },
        });
      }
    } else if (exam.googleFormId) {
      // A form already exists → reflect the new state on it.
      await setFormResponsesClosed({
        accessToken,
        formId: exam.googleFormId,
        closed: status !== "PUBLISHED",
        description: formDescription,
      });
    }
  } catch (e) {
    console.error("Syncing Google Form to exam status failed:", e);
  }
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

  await applyExamStatus(exam, teacher.id, status);

  // A manual status change overrides any pending scheduled publish.
  if (exam.scheduledPublishAt) {
    await prisma.exam.update({
      where: { id: examId },
      data: { scheduledPublishAt: null },
    });
  }

  revalidatePath(`/teacher/exams/${examId}`);
  revalidatePath("/teacher/exams");
  return { ok: true };
}

// Schedule (or, with `whenIso === null`, cancel) automatic publishing of an
// exam. The actual publish is performed later by the cron job (publishDueExams).
export async function scheduleExamPublish(
  examId: string,
  whenIso: string | null,
): Promise<{ ok: true; scheduledFor: string | null } | { error: string }> {
  const teacher = await requireRole("TEACHER");
  const exam = await ownedExam(examId, teacher.id);
  if (!exam) return { error: "Exam not found." };

  if (whenIso === null) {
    await prisma.exam.update({
      where: { id: examId },
      data: { scheduledPublishAt: null },
    });
    revalidatePath(`/teacher/exams/${examId}`);
    return { ok: true, scheduledFor: null };
  }

  if (exam.status === "PUBLISHED") {
    return { error: "This exam is already published." };
  }
  const count = await prisma.examQuestion.count({ where: { examId } });
  if (count === 0) {
    return { error: "Add at least one question before scheduling." };
  }
  const when = new Date(whenIso);
  if (Number.isNaN(when.getTime())) {
    return { error: "Choose a valid date and time." };
  }
  if (when.getTime() <= Date.now()) {
    return { error: "Pick a time in the future." };
  }

  await prisma.exam.update({
    where: { id: examId },
    data: { scheduledPublishAt: when },
  });
  revalidatePath(`/teacher/exams/${examId}`);
  return { ok: true, scheduledFor: when.toISOString() };
}

export type PublishDueResult =
  | { published: number; skipped: number; failed: number }
  | { error: string };

// Publish every exam whose scheduled time has arrived. Invoked by the cron
// route; guarded by CRON_SECRET so it can't be triggered by clients. Each exam
// is published as its own teacher (using that teacher's stored Google account).
export async function publishDueExams(secret: string): Promise<PublishDueResult> {
  const expected = process.env.CRON_SECRET;
  if (!expected || secret !== expected) return { error: "unauthorized" };

  const due = await prisma.exam.findMany({
    where: {
      status: "DRAFT",
      scheduledPublishAt: { not: null, lte: new Date() },
    },
  });

  let published = 0;
  let skipped = 0;
  let failed = 0;
  for (const exam of due) {
    try {
      const count = await prisma.examQuestion.count({
        where: { examId: exam.id },
      });
      if (count === 0) {
        // Questions were removed after scheduling — drop the schedule so it
        // doesn't retry forever, and leave the exam as a draft.
        await prisma.exam.update({
          where: { id: exam.id },
          data: { scheduledPublishAt: null },
        });
        skipped += 1;
        continue;
      }
      await applyExamStatus(exam, exam.createdById, "PUBLISHED");
      await prisma.exam.update({
        where: { id: exam.id },
        data: { scheduledPublishAt: null },
      });
      published += 1;
      revalidatePath(`/teacher/exams/${exam.id}`);
    } catch (e) {
      console.error(`Scheduled publish failed for exam ${exam.id}:`, e);
      failed += 1;
    }
  }
  if (published > 0) revalidatePath("/teacher/exams");
  return { published, skipped, failed };
}

// Create the exam's Google Form (or re-sync its questions if one exists).
// Returns the responder URL students use to take the exam.
export async function createOrSyncGoogleForm(
  examId: string,
): Promise<{ ok: true; url: string | null } | { error: string }> {
  const teacher = await requireRole("TEACHER");
  const exam = await ownedExam(examId, teacher.id);
  if (!exam) return { error: "Exam not found." };
  if (!googleConfigured()) {
    return { error: "Google Forms is not configured on the server." };
  }
  const account = await getGoogleAccount(teacher.id);
  if (!account) return { error: "Connect your Google account first." };

  const questions = await loadFormQuestions(examId);
  if (questions.length === 0) {
    return { error: "Add at least one question before generating the form." };
  }

  try {
    const accessToken = await getValidAccessToken(teacher.id);
    const logo = await resolveLogoForExam(exam);
    const formDescription = await buildFormDescription(exam);
    if (exam.googleFormId) {
      // Re-sync: rebuild the form's questions; this clears any released key.
      await rebuildFormItems({
        accessToken,
        formId: exam.googleFormId,
        description: formDescription,
        questions,
        logoUrl: logo?.logoUrl ?? null,
        logoAlt: logo?.logoAlt ?? null,
      });
      await prisma.exam.update({
        where: { id: examId },
        data: { answerKeyReleasedAt: null },
      });
      revalidatePath(`/teacher/exams/${examId}`);
      return { ok: true, url: exam.googleFormUrl };
    }

    const form = await createExamForm({
      accessToken,
      title: exam.title,
      description: formDescription,
      questions,
      logoUrl: logo?.logoUrl ?? null,
      logoAlt: logo?.logoAlt ?? null,
    });
    await prisma.exam.update({
      where: { id: examId },
      data: {
        googleFormId: form.formId,
        googleFormUrl: form.responderUri,
        googleFormEditUrl: form.editUrl,
        googleFormCreatedAt: new Date(),
        answerKeyReleasedAt: null,
      },
    });
    revalidatePath(`/teacher/exams/${examId}`);
    return { ok: true, url: form.responderUri };
  } catch (e) {
    console.error("Google Form generation failed:", e);
    const detail = e instanceof Error ? e.message : String(e);
    return {
      error: `Could not create the Google Form. ${detail}`,
    };
  }
}

// Push the answer key + points to the form so Google grades it. Run this after
// the exam is over. Objective questions are auto-graded; open questions get
// points only (the teacher grades them in Google Forms). Results stay with the
// teacher, who owns the form.
export async function releaseExamAnswerKey(
  examId: string,
): Promise<{ ok: true } | { error: string }> {
  const teacher = await requireRole("TEACHER");
  const exam = await ownedExam(examId, teacher.id);
  if (!exam) return { error: "Exam not found." };
  if (!exam.googleFormId) return { error: "Generate the Google Form first." };
  const account = await getGoogleAccount(teacher.id);
  if (!account) return { error: "Connect your Google account first." };

  const questions = await loadFormQuestions(examId);
  try {
    const accessToken = await getValidAccessToken(teacher.id);
    await pushAnswerKey({
      accessToken,
      formId: exam.googleFormId,
      questions,
    });
    await prisma.exam.update({
      where: { id: examId },
      data: { answerKeyReleasedAt: new Date() },
    });
    revalidatePath(`/teacher/exams/${examId}`);
    return { ok: true };
  } catch (e) {
    console.error("Answer key release failed:", e);
    return {
      error:
        "Could not release the answer key. Try reconnecting your Google account.",
    };
  }
}

// Load every student's answers to the exam's Google Form, shaped for display.
export async function getExamResponses(
  examId: string,
): Promise<ExamResponsesResult> {
  const teacher = await requireRole("TEACHER");
  const exam = await ownedExam(examId, teacher.id);
  if (!exam) return { error: "Exam not found." };
  if (!exam.googleFormId) return { error: "Generate the Google Form first." };
  const account = await getGoogleAccount(teacher.id);
  if (!account) return { error: "Connect your Google account first." };

  // Reading responses needs a scope that didn't exist when older accounts were
  // connected. Detect the stale grant and prompt a reconnect rather than failing
  // with an opaque Google error.
  if (!account.scope?.includes("forms.responses")) {
    return {
      error: "Reconnect your Google account to allow reading form responses.",
      needsReconnect: true,
    };
  }

  try {
    const accessToken = await getValidAccessToken(teacher.id);
    const form = await listFormResponses({
      accessToken,
      formId: exam.googleFormId,
    });

    // Attach each question's max points + keyword rubric from our DB, matched by
    // position (the form's item order mirrors the exam's question order).
    const examQuestions = await prisma.examQuestion.findMany({
      where: { examId },
      orderBy: { order: "asc" },
      include: { question: true },
    });
    const questions: ExamResponseQuestion[] = form.questions.map((fq) => {
      const eq = examQuestions[fq.index];
      return {
        index: fq.index,
        title: fq.title,
        // "MCQ" when there's no matching DB question, so the open-answer-only
        // AI grading affordance stays hidden rather than failing on click.
        type: eq?.question.type ?? "MCQ",
        maxPoints: eq ? (eq.points ?? eq.question.points) : (fq.points ?? 0),
        keywords: parseDbKeywords(eq?.question.keywords),
      };
    });
    return { ok: true, questions, responses: form.responses };
  } catch (e) {
    console.error("Loading form responses failed:", e);
    return {
      error: "Could not load responses. Try reconnecting your Google account.",
      needsReconnect: true,
    };
  }
}

export type AiGradeResult =
  | { score: number; feedback: string; maxPoints: number }
  | { error: string };

// AI-grade one student's answer to an open-ended (short answer / essay)
// question, scored against the question's stored model answer. This is a
// teacher aid shown in the responses panel — the score is advisory and isn't
// written back to Google Forms (the teacher enters the final mark there).
export async function gradeOpenAnswerAction(
  examId: string,
  questionIndex: number,
  studentAnswer: string,
): Promise<AiGradeResult> {
  const teacher = await requireRole("TEACHER");
  const exam = await ownedExam(examId, teacher.id);
  if (!exam) return { error: "Exam not found." };
  if (!aiEnabled()) {
    return { error: aiUnavailableReason() ?? "AI grading is not configured." };
  }

  const examQuestions = await prisma.examQuestion.findMany({
    where: { examId },
    orderBy: { order: "asc" },
    include: { question: true },
  });
  const eq = examQuestions[questionIndex];
  if (!eq) return { error: "Question not found." };

  const q = eq.question;
  if (q.type !== "SHORT_ANSWER" && q.type !== "ESSAY") {
    return { error: "AI grading applies to open-ended questions only." };
  }
  if (!studentAnswer.trim()) {
    return { error: "There is no answer to grade." };
  }

  const maxPoints = eq.points ?? q.points;
  try {
    const { score, feedback } = await gradeOpenAnswer({
      questionText: q.text,
      modelAnswer: q.modelAnswer,
      studentAnswer,
      maxPoints,
      language: q.language,
    });
    return { score, feedback, maxPoints };
  } catch (e) {
    console.error("AI grading failed:", e);
    return { error: "AI grading failed. Please try again." };
  }
}

// Turn respondent-email collection on or off for the exam's Google Form. When
// off, responses are anonymous.
export async function setExamEmailCollection(
  examId: string,
  enabled: boolean,
): Promise<{ ok: true } | { error: string }> {
  const teacher = await requireRole("TEACHER");
  const exam = await ownedExam(examId, teacher.id);
  if (!exam) return { error: "Exam not found." };
  if (!exam.googleFormId) return { error: "Generate the Google Form first." };
  const account = await getGoogleAccount(teacher.id);
  if (!account) return { error: "Connect your Google account first." };

  try {
    const accessToken = await getValidAccessToken(teacher.id);
    await setEmailCollection({ accessToken, formId: exam.googleFormId, enabled });
    revalidatePath(`/teacher/exams/${examId}`);
    return { ok: true };
  } catch (e) {
    console.error("Updating email collection failed:", e);
    return {
      error: "Could not update the email setting. Try reconnecting your Google account.",
    };
  }
}

export async function deleteExam(examId: string) {
  const teacher = await requireRole("TEACHER");
  const exam = await ownedExam(examId, teacher.id);
  if (!exam) return { error: "Exam not found." };
  await prisma.exam.delete({ where: { id: examId } }); // cascades to exam questions
  revalidatePath("/teacher/exams");
  redirect("/teacher/exams");
}
