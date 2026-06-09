import "server-only";
import type { QuestionType } from "@prisma/client";

// ── Google Forms API client ─────────────────────────────────────────────────
// Builds a Google Form from an exam's questions. The form is created as a QUIZ
// but WITHOUT an answer key, so students can take it without seeing any grade.
// After the exam, `releaseAnswerKey` pushes the correct answers + point values
// so Google auto-grades the objective questions (results stay with the teacher,
// who owns the form). Open questions (short answer / essay) get points only and
// are graded manually by the teacher in Google Forms.

const FORMS_API = "https://forms.googleapis.com/v1";
const DRIVE_API = "https://www.googleapis.com/drive/v3";

export type FormQuestionInput = {
  type: QuestionType;
  text: string;
  options: string[] | null; // MCQ choices
  correctAnswer: string | null; // MCQ: index into options; TRUE_FALSE: "true"/"false"
  points: number;
  required: boolean;
  language: string;
  imageUrl: string | null; // public URL of the question's image, or null
};

export type CreatedForm = {
  formId: string;
  responderUri: string;
  editUrl: string;
};

// The Forms API rejects newlines in "displayed text" fields (item titles and
// choice option values) with a 400 INVALID_ARGUMENT. Collapse any line breaks
// (and the surrounding whitespace) into a single space so such text is accepted.
function singleLine(s: string): string {
  return s.replace(/\s*[\r\n]+\s*/g, " ").trim();
}

function trueFalseLabels(language: string): { yes: string; no: string } {
  if (language === "fr") return { yes: "Vrai", no: "Faux" };
  if (language === "ar") return { yes: "صح", no: "خطأ" };
  return { yes: "True", no: "False" };
}

async function formsFetch<T>(
  accessToken: string,
  path: string,
  init?: RequestInit,
): Promise<T> {
  const res = await fetch(`${FORMS_API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Google Forms API error (${res.status}): ${text}`);
  }
  return (await res.json()) as T;
}

// The choice/text question body for an item (no grading at this stage).
function questionBody(q: FormQuestionInput): Record<string, unknown> {
  if (q.type === "MCQ" || q.type === "CHECKBOX" || q.type === "DROPDOWN") {
    // Google rejects choice questions with blank or duplicate option values, so
    // drop empties and keep the first occurrence of each value. Grading matches
    // by answer text (see correctChoiceValues), so this never affects scoring.
    const seen = new Set<string>();
    const options: { value: string }[] = [];
    for (const raw of q.options ?? []) {
      const value = singleLine(String(raw ?? ""));
      if (!value || seen.has(value)) continue;
      seen.add(value);
      options.push({ value });
    }
    const choiceType =
      q.type === "CHECKBOX"
        ? "CHECKBOX"
        : q.type === "DROPDOWN"
          ? "DROP_DOWN"
          : "RADIO";
    return {
      required: q.required,
      choiceQuestion: { type: choiceType, options },
    };
  }
  if (q.type === "TRUE_FALSE") {
    const { yes, no } = trueFalseLabels(q.language);
    return {
      required: q.required,
      choiceQuestion: { type: "RADIO", options: [{ value: yes }, { value: no }] },
    };
  }
  // SHORT_ANSWER / ESSAY → free text (essay = paragraph).
  return {
    required: q.required,
    textQuestion: { paragraph: q.type === "ESSAY" },
  };
}

function createItemRequests(questions: FormQuestionInput[], startIndex = 0) {
  let qNum = 0; // number only real questions, skipping text/instruction blocks
  return questions.map((q, i) => {
    const location = { index: startIndex + i };

    // Informational block with no answer field. With a picture → an imageItem
    // (the text becomes the caption shown above the image); otherwise a plain
    // text/instructions item.
    if (q.type === "TEXT") {
      const item = q.imageUrl
        ? {
            ...(q.text ? { title: singleLine(q.text) } : {}),
            imageItem: { image: { sourceUri: q.imageUrl, altText: "Image" } },
          }
        : { title: singleLine(q.text), textItem: {} };
      return { createItem: { item, location } };
    }

    qNum += 1;
    const questionItem: Record<string, unknown> = { question: questionBody(q) };
    // Attach the question's image (Google fetches sourceUri server-side).
    if (q.imageUrl) {
      questionItem.image = { sourceUri: q.imageUrl, altText: "Question image" };
    }
    return {
      createItem: {
        item: { title: singleLine(`${qNum}. ${q.text}`), questionItem },
        location,
      },
    };
  });
}

// An imageItem request that brands the form with the school's logo at the very
// top. The Forms API fetches `sourceUri` server-side, so the URL must be
// publicly reachable (see /api/branding/logo/[schoolId]).
function logoItemRequest(opts: { logoUrl: string; logoAlt: string }) {
  return {
    createItem: {
      item: {
        imageItem: {
          image: {
            sourceUri: opts.logoUrl,
            altText: opts.logoAlt,
          },
        },
      },
      location: { index: 0 },
    },
  };
}

// Insert the school logo at the top of the form (index 0) as its own request.
// Best-effort: Google fetches the image server-side, so an unreachable URL (e.g.
// a protected/preview host) throws — we log and move on rather than fail the
// whole form.
async function addLogoBestEffort(opts: {
  accessToken: string;
  formId: string;
  logoUrl: string;
  logoAlt: string;
}): Promise<void> {
  try {
    await formsFetch(opts.accessToken, `/forms/${opts.formId}:batchUpdate`, {
      method: "POST",
      body: JSON.stringify({
        requests: [
          logoItemRequest({ logoUrl: opts.logoUrl, logoAlt: opts.logoAlt }),
        ],
      }),
    });
  } catch (e) {
    console.error("Embedding school logo failed (non-fatal):", e);
  }
}

// Create a brand-new quiz form for the exam and populate its questions.
// When `logoUrl` is set, the school's logo is inserted as the first form item
// so the quiz is visually branded (Google Forms' API can't set the form's
// theme color, so the logo is the available branding hook).
export async function createExamForm(opts: {
  accessToken: string;
  title: string;
  description?: string | null;
  questions: FormQuestionInput[];
  logoUrl?: string | null;
  logoAlt?: string | null;
}): Promise<CreatedForm> {
  const created = await formsFetch<{ formId: string; responderUri: string }>(
    opts.accessToken,
    "/forms",
    {
      method: "POST",
      body: JSON.stringify({
        info: {
          title: singleLine(opts.title),
          documentTitle: singleLine(opts.title),
        },
      }),
    },
  );

  const requests: Record<string, unknown>[] = [
    // Turn it into a quiz (so points/answer key can be added later).
    {
      updateSettings: {
        settings: { quizSettings: { isQuiz: true } },
        updateMask: "quizSettings.isQuiz",
      },
    },
  ];
  if (opts.description?.trim()) {
    requests.push({
      updateFormInfo: {
        info: { description: opts.description.trim() },
        updateMask: "description",
      },
    });
  }
  requests.push(...createItemRequests(opts.questions, 0));

  await formsFetch(opts.accessToken, `/forms/${created.formId}:batchUpdate`, {
    method: "POST",
    body: JSON.stringify({ requests }),
  });

  // Brand the form with the school logo at the top — best-effort and in its own
  // request, so a fetch failure (e.g. the image URL isn't publicly reachable by
  // Google's servers) never blocks form creation.
  if (opts.logoUrl) {
    await addLogoBestEffort({
      accessToken: opts.accessToken,
      formId: created.formId,
      logoUrl: opts.logoUrl,
      logoAlt: opts.logoAlt ?? "School logo",
    });
  }

  // Collect respondent emails by default, so the teacher can tell whose answers
  // are whose. Best-effort — never fail form creation over this. The teacher can
  // turn it off from the exam page afterwards.
  try {
    await setEmailCollection({
      accessToken: opts.accessToken,
      formId: created.formId,
      enabled: true,
    });
  } catch (e) {
    console.error("Default email collection failed (non-fatal):", e);
  }

  return {
    formId: created.formId,
    responderUri: created.responderUri,
    editUrl: `https://docs.google.com/forms/d/${created.formId}/edit`,
  };
}

// Turn respondent-email collection on or off. When on, students type their
// email when submitting (RESPONDER_INPUT — no Google sign-in required); when
// off, responses are anonymous. Throws on failure so callers can surface it.
export async function setEmailCollection(opts: {
  accessToken: string;
  formId: string;
  enabled: boolean;
}): Promise<void> {
  await formsFetch(opts.accessToken, `/forms/${opts.formId}:batchUpdate`, {
    method: "POST",
    body: JSON.stringify({
      requests: [
        {
          updateSettings: {
            settings: {
              emailCollectionType: opts.enabled ? "RESPONDER_INPUT" : "DO_NOT_COLLECT",
            },
            updateMask: "emailCollectionType",
          },
        },
      ],
    }),
  });
}

// Banner prepended to a form's description while the exam is unpublished/closed.
// A visible signal that pairs with setFormAcceptingResponses: the toggle is the
// hard stop on forms that support it (created via the 2026+ publish model),
// while this banner also covers legacy forms where the toggle isn't available.
export const FORM_CLOSED_BANNER =
  "⛔ This exam is closed — responses are no longer being accepted.";

// Mark a form open or closed to new responses (best-effort). Since the API can't
// actually stop submissions, "closed" prepends FORM_CLOSED_BANNER to the form's
// description and "open" restores the plain exam description. Pass the exam's own
// description so the banner is added/removed without losing the real text.
export async function setFormResponsesClosed(opts: {
  accessToken: string;
  formId: string;
  closed: boolean;
  description?: string | null;
}): Promise<void> {
  const base = (opts.description ?? "").trim();
  const description = opts.closed
    ? base
      ? `${FORM_CLOSED_BANNER}\n\n${base}`
      : FORM_CLOSED_BANNER
    : base;
  await formsFetch(opts.accessToken, `/forms/${opts.formId}:batchUpdate`, {
    method: "POST",
    body: JSON.stringify({
      requests: [
        {
          updateFormInfo: {
            info: { description },
            updateMask: "description",
          },
        },
      ],
    }),
  });
}

// Publish a form and turn response acceptance on or off via the 2026 publish
// model (forms.setPublishSettings). This is the real "stop accepting responses"
// switch — `isAcceptingResponses: false` keeps the form visible but blocks new
// submissions. Forms created via the API since 2026-03-31 are unpublished by
// default, so we also set isPublished: true to actually open them.
//
// Best-effort and non-throwing: legacy forms created before the publish model
// have no publishSettings and return an error; we log and return false so the
// caller falls back to the description banner. Needs only the forms.body scope.
export async function setFormAcceptingResponses(opts: {
  accessToken: string;
  formId: string;
  accepting: boolean;
  // Whether the form is published (visible) at all. Defaults to true. Pass false
  // to fully unpublish (draft) rather than leaving it "published but closed".
  published?: boolean;
}): Promise<{ ok: boolean; error?: string }> {
  const isPublished = opts.published ?? true;
  try {
    await formsFetch(opts.accessToken, `/forms/${opts.formId}:setPublishSettings`, {
      method: "POST",
      body: JSON.stringify({
        publishSettings: {
          publishState: { isPublished, isAcceptingResponses: opts.accepting },
        },
        updateMask: "publishState",
      }),
    });
    return { ok: true };
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e);
    console.error("setPublishSettings failed:", error);
    return { ok: false, error };
  }
}

// Give "anyone with the link" reader access to a form's published view, so
// students can open and submit it. Under the 2026 publish model, API-created
// forms aren't link-accessible by default — publishing alone isn't enough. Uses
// Drive's permissions.create (scope drive.file). Non-throwing: returns false if
// the scope is missing or the call fails, so the caller can prompt a reconnect.
export async function grantPublishedReaderAccess(opts: {
  accessToken: string;
  formId: string;
}): Promise<boolean> {
  try {
    const res = await fetch(`${DRIVE_API}/files/${opts.formId}/permissions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${opts.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ type: "anyone", view: "published", role: "reader" }),
    });
    if (!res.ok) {
      console.error(
        `Drive permissions.create failed (${res.status}): ${await res.text()}`,
      );
      return false;
    }
    return true;
  } catch (e) {
    console.error("Drive permissions.create failed:", e);
    return false;
  }
}

// Read whether the form currently collects respondent emails. Returns null if
// it can't be determined (e.g. the API call fails).
export async function getEmailCollection(opts: {
  accessToken: string;
  formId: string;
}): Promise<boolean | null> {
  try {
    const form = await formsFetch<{ settings?: { emailCollectionType?: string } }>(
      opts.accessToken,
      `/forms/${opts.formId}`,
    );
    const type = form.settings?.emailCollectionType;
    if (!type) return false;
    return type === "RESPONDER_INPUT" || type === "VERIFIED";
  } catch (e) {
    console.error("Read email collection setting failed:", e);
    return null;
  }
}

// Replace all items on an existing form with the current questions (used to
// re-sync after the exam's questions change). Also clears any answer key.
// Re-applies the school logo at the top when `logoUrl` is provided.
export async function rebuildFormItems(opts: {
  accessToken: string;
  formId: string;
  description?: string | null;
  questions: FormQuestionInput[];
  logoUrl?: string | null;
  logoAlt?: string | null;
}): Promise<void> {
  const form = await formsFetch<{ items?: unknown[] }>(
    opts.accessToken,
    `/forms/${opts.formId}`,
  );
  const count = form.items?.length ?? 0;

  const requests: Record<string, unknown>[] = [];
  // Delete existing items from last to first so indices stay valid.
  for (let i = count - 1; i >= 0; i--) {
    requests.push({ deleteItem: { location: { index: i } } });
  }
  if (opts.description !== undefined) {
    requests.push({
      updateFormInfo: {
        info: { description: opts.description?.trim() ?? "" },
        updateMask: "description",
      },
    });
  }
  requests.push(...createItemRequests(opts.questions, 0));

  await formsFetch(opts.accessToken, `/forms/${opts.formId}:batchUpdate`, {
    method: "POST",
    body: JSON.stringify({ requests }),
  });

  // Re-apply the school logo at the top — best-effort (see addLogoBestEffort).
  if (opts.logoUrl) {
    await addLogoBestEffort({
      accessToken: opts.accessToken,
      formId: opts.formId,
      logoUrl: opts.logoUrl,
      logoAlt: opts.logoAlt ?? "School logo",
    });
  }
  // Note: re-sync intentionally leaves the email-collection setting untouched,
  // so it never overrides the teacher's choice.
}

// Resolve the correct option value(s) for grading a choice question. Returns an
// empty array if none can be determined (then the question is left ungraded).
// Single-answer types yield one value; checkboxes can yield several.
function correctChoiceValues(q: FormQuestionInput): string[] {
  if (q.type === "TRUE_FALSE") {
    const { yes, no } = trueFalseLabels(q.language);
    if (q.correctAnswer === "true") return [yes];
    if (q.correctAnswer === "false") return [no];
    return [];
  }

  // Match the option values exactly as they were written to the form, so the
  // pushed correct answer lines up with a real choice (see questionBody).
  const options = (q.options ?? []).map(singleLine);
  // correctAnswer stores an index into options (or, defensively, the value).
  const resolve = (raw: string): string | null => {
    const trimmed = raw.trim();
    const idx = Number(trimmed);
    if (Number.isInteger(idx) && idx >= 0 && idx < options.length) {
      return options[idx];
    }
    const value = singleLine(trimmed);
    if (value && options.includes(value)) return value;
    return null;
  };

  if (q.type === "CHECKBOX") {
    // correctAnswer is a comma-separated list of indices.
    return (q.correctAnswer ?? "")
      .split(",")
      .map(resolve)
      .filter((v): v is string => v !== null);
  }

  // MCQ / DROPDOWN — a single index.
  if (q.correctAnswer == null) return [];
  const value = resolve(q.correctAnswer);
  return value !== null ? [value] : [];
}

// Push the answer key + point values so Google grades the form. Objective
// questions (MCQ / true-false) get correct answers; open questions get points
// only (the teacher grades them by hand). Question order must match the form.
export async function releaseAnswerKey(opts: {
  accessToken: string;
  formId: string;
  questions: FormQuestionInput[];
}): Promise<void> {
  // Map each real question to its actual position in the form. Items like the
  // school logo (imageItem) and text/instruction blocks (textItem) have no
  // questionItem and shift positions, so we target grading by the real
  // question-item indices rather than assuming question N is at form index N.
  const form = await formsFetch<{ items?: { questionItem?: unknown }[] }>(
    opts.accessToken,
    `/forms/${opts.formId}`,
  );
  const questionPositions: number[] = [];
  (form.items ?? []).forEach((item, idx) => {
    if (item.questionItem) questionPositions.push(idx);
  });

  const requests: Record<string, unknown>[] = [];
  let qi = 0; // index into questionPositions, over real (non-text) questions

  for (const q of opts.questions) {
    if (q.type === "TEXT") continue; // not a question on the form
    const index = questionPositions[qi];
    qi += 1;
    if (index === undefined) continue; // form has fewer questions than expected

    // Google quiz point values are whole numbers.
    const pointValue = Math.max(0, Math.round(q.points));
    const grading: Record<string, unknown> = { pointValue };

    if (
      q.type === "MCQ" ||
      q.type === "CHECKBOX" ||
      q.type === "DROPDOWN" ||
      q.type === "TRUE_FALSE"
    ) {
      const values = correctChoiceValues(q);
      if (values.length > 0) {
        grading.correctAnswers = { answers: values.map((value) => ({ value })) };
      }
    }

    requests.push({
      updateItem: {
        item: { questionItem: { question: { grading } } },
        location: { index },
        updateMask: "questionItem.question.grading",
      },
    });
  }

  if (requests.length === 0) return;

  await formsFetch(opts.accessToken, `/forms/${opts.formId}:batchUpdate`, {
    method: "POST",
    body: JSON.stringify({ requests }),
  });
}

// ── Reading responses ───────────────────────────────────────────────────────
// Fetch the form's structure (to map each answer back to its question) plus all
// student submissions, shaped for display. Answers are keyed by the question's
// position in the form (0-based), which matches the exam's question order.

export type ResponseAnswer = {
  value: string; // the student's answer (multiple values joined with ", ")
  score: number | null; // points awarded if the form has been graded, else null
  correct: boolean | null;
};

export type ResponseQuestion = {
  index: number;
  title: string;
  points: number | null;
};

export type ExamResponse = {
  responseId: string;
  email: string | null; // present only if the form collects emails
  submittedAt: string | null; // ISO timestamp
  totalScore: number | null; // present only once graded
  answers: Record<number, ResponseAnswer>; // keyed by question index
};

export type FormResponses = {
  questions: ResponseQuestion[];
  responses: ExamResponse[];
};

type ApiFormItem = {
  title?: string;
  questionItem?: {
    question?: { questionId?: string; grading?: { pointValue?: number } };
  };
};

type ApiAnswer = {
  textAnswers?: { answers?: { value?: string }[] };
  grade?: { score?: number; correct?: boolean };
};

type ApiResponse = {
  responseId?: string;
  createTime?: string;
  lastSubmittedTime?: string;
  respondentEmail?: string;
  totalScore?: number;
  answers?: Record<string, ApiAnswer>;
};

export async function listFormResponses(opts: {
  accessToken: string;
  formId: string;
}): Promise<FormResponses> {
  // 1. Form structure → map each questionId to its order, title and points.
  const form = await formsFetch<{ items?: ApiFormItem[] }>(
    opts.accessToken,
    `/forms/${opts.formId}`,
  );
  const questions: ResponseQuestion[] = [];
  const indexByQuestionId = new Map<string, number>();
  for (const item of form.items ?? []) {
    const q = item.questionItem?.question;
    if (!q?.questionId) continue; // skip page breaks, images, etc.
    const index = questions.length;
    indexByQuestionId.set(q.questionId, index);
    questions.push({
      index,
      title: item.title ?? `Question ${index + 1}`,
      points: typeof q.grading?.pointValue === "number" ? q.grading.pointValue : null,
    });
  }

  // 2. All responses (the endpoint paginates).
  const raw: ApiResponse[] = [];
  let pageToken: string | undefined;
  do {
    const qs = new URLSearchParams({ pageSize: "1000" });
    if (pageToken) qs.set("pageToken", pageToken);
    const page = await formsFetch<{
      responses?: ApiResponse[];
      nextPageToken?: string;
    }>(opts.accessToken, `/forms/${opts.formId}/responses?${qs.toString()}`);
    raw.push(...(page.responses ?? []));
    pageToken = page.nextPageToken;
  } while (pageToken);

  // 3. Shape each response, mapping its answers onto our question indices.
  const responses: ExamResponse[] = raw.map((r, i) => {
    const answers: Record<number, ResponseAnswer> = {};
    for (const [questionId, a] of Object.entries(r.answers ?? {})) {
      const index = indexByQuestionId.get(questionId);
      if (index === undefined) continue;
      const value = (a.textAnswers?.answers ?? [])
        .map((x) => x.value ?? "")
        .filter(Boolean)
        .join(", ");
      answers[index] = {
        value,
        score: typeof a.grade?.score === "number" ? a.grade.score : null,
        correct: typeof a.grade?.correct === "boolean" ? a.grade.correct : null,
      };
    }
    return {
      responseId: r.responseId ?? `response-${i}`,
      email: r.respondentEmail ?? null,
      submittedAt: r.lastSubmittedTime ?? r.createTime ?? null,
      totalScore: typeof r.totalScore === "number" ? r.totalScore : null,
      answers,
    };
  });

  // Newest first.
  responses.sort((a, b) => (b.submittedAt ?? "").localeCompare(a.submittedAt ?? ""));
  return { questions, responses };
}
