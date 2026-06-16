import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import type { QuestionType, Difficulty } from "@prisma/client";

// Default to a current, capable model; override with ANTHROPIC_MODEL.
export const MODEL = process.env.ANTHROPIC_MODEL ?? "claude-sonnet-4-6";

function client(): Anthropic {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error(
      "ANTHROPIC_API_KEY is not set. Add it to .env to use AI features.",
    );
  }
  return new Anthropic({ apiKey });
}

// Shared client for other server modules (e.g. the chat assistant).
export function anthropicClient(): Anthropic {
  return client();
}

// AI is only usable with a real Anthropic key (they start with "sk-ant-").
// A present-but-wrong key — e.g. an OpenAI "sk-proj-…" key — would otherwise
// pass a naive presence check and then fail every call with a 401.
export function aiEnabled(): boolean {
  const key = process.env.ANTHROPIC_API_KEY;
  return Boolean(key && key.startsWith("sk-ant-"));
}

// Why AI is unavailable, as a user-facing sentence — or null when it's fine.
// Lets callers tell "no key set" apart from "wrong key set".
export function aiUnavailableReason(): string | null {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) {
    return "The AI assistant is not configured. Ask your administrator to add an ANTHROPIC_API_KEY.";
  }
  if (!key.startsWith("sk-ant-")) {
    return 'The AI assistant\'s API key looks invalid — Anthropic keys start with "sk-ant-". Ask your administrator to set a valid ANTHROPIC_API_KEY.';
  }
  return null;
}

// Concatenate the text blocks of a model response.
function textOf(msg: Anthropic.Message): string {
  return msg.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("");
}

// Last-resort parse for when structured outputs aren't available (e.g. a model
// override that doesn't support them): pull the first JSON value out of prose.
function salvageJson<T>(text: string): T {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const raw = fenced ? fenced[1] : text;
  const start = raw.search(/[[{]/);
  if (start === -1) throw new Error("No JSON found in AI response.");
  const end = Math.max(raw.lastIndexOf("]"), raw.lastIndexOf("}"));
  return JSON.parse(raw.slice(start, end + 1)) as T;
}

function parseModelJson<T>(text: string): T {
  try {
    return JSON.parse(text) as T;
  } catch {
    return salvageJson<T>(text);
  }
}

// Run a request that must return JSON matching `schema`. Structured outputs
// (output_config.format) make the model emit schema-valid JSON, so no brittle
// extraction is needed. If the configured model doesn't support structured
// outputs the API rejects the request — we then retry without it and salvage
// the JSON from the text, so a model override never silently breaks AI.
async function createJson<T>(opts: {
  maxTokens: number;
  system: string;
  content: string | Anthropic.ContentBlockParam[];
  schema: Record<string, unknown>;
}): Promise<T> {
  const c = client();
  const base = {
    model: MODEL,
    max_tokens: opts.maxTokens,
    system: opts.system,
    messages: [{ role: "user" as const, content: opts.content }],
  };
  try {
    const msg = await c.messages.create({
      ...base,
      output_config: { format: { type: "json_schema", schema: opts.schema } },
    });
    return parseModelJson<T>(textOf(msg));
  } catch (e) {
    if (e instanceof Anthropic.BadRequestError) {
      const msg = await c.messages.create(base);
      return parseModelJson<T>(textOf(msg));
    }
    throw e;
  }
}

// Shared schema for a generated question. Fields beyond text/points are
// optional because they only apply to certain types; the normalizers below
// reconcile each item against its (or the requested) type.
const QUESTION_ITEM_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    type: { type: "string", enum: ["MCQ", "TRUE_FALSE", "SHORT_ANSWER", "ESSAY"] },
    difficulty: { type: "string", enum: ["EASY", "MEDIUM", "HARD"] },
    text: { type: "string" },
    options: { type: "array", items: { type: "string" } },
    correctAnswer: { type: "string" },
    modelAnswer: { type: "string" },
    points: { type: "number" },
  },
  required: ["text", "points"],
} as const;

const QUESTIONS_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: { questions: { type: "array", items: QUESTION_ITEM_SCHEMA } },
  required: ["questions"],
} as const;

export type GeneratedQuestion = {
  type: QuestionType;
  difficulty: Difficulty;
  text: string;
  options?: string[];
  correctAnswer?: string; // MCQ: option index as string; TRUE_FALSE: "true"/"false"
  modelAnswer?: string;
  points: number;
};

export async function generateQuestions(opts: {
  subject?: string;
  topic: string;
  difficulty: Difficulty;
  type: QuestionType;
  count: number;
  language: string;
}): Promise<GeneratedQuestion[]> {
  const { subject, topic, difficulty, type, count, language } = opts;
  const langName =
    language === "ar" ? "Arabic" : language === "fr" ? "French" : "English";

  const system = `You are an expert exam author for the Lebanese (MEHE) school curriculum.
Write clear, curriculum-appropriate questions. Respond with JSON only — no prose.`;

  const shape =
    type === "MCQ"
      ? `Each item: {"type":"MCQ","text":string,"options":[4 strings],"correctAnswer":"<index 0-3 as string>","points":number}`
      : type === "TRUE_FALSE"
        ? `Each item: {"type":"TRUE_FALSE","text":string,"correctAnswer":"true"|"false","points":number}`
        : type === "SHORT_ANSWER"
          ? `Each item: {"type":"SHORT_ANSWER","text":string,"modelAnswer":string,"points":number}`
          : `Each item: {"type":"ESSAY","text":string,"modelAnswer":string (key points / rubric),"points":number}`;

  const prompt = `Generate ${count} ${difficulty} ${type} question(s) in ${langName}.
${subject ? `Subject: ${subject}. ` : ""}Topic: ${topic}.
Return a JSON object {"questions": [...]} whose items are: ${shape}.
Use points appropriate to difficulty (easy 1, medium 2, hard 3).`;

  const { questions: items } = await createJson<{ questions: GeneratedQuestion[] }>({
    maxTokens: 2048,
    system,
    content: prompt,
    schema: QUESTIONS_SCHEMA,
  });
  // Normalize / harden the output.
  return items.map((q) => ({
    type,
    difficulty,
    text: String(q.text ?? "").trim(),
    options: type === "MCQ" ? (q.options ?? []).map(String) : undefined,
    correctAnswer:
      type === "MCQ" || type === "TRUE_FALSE"
        ? String(q.correctAnswer ?? "")
        : undefined,
    modelAnswer:
      type === "SHORT_ANSWER" || type === "ESSAY"
        ? String(q.modelAnswer ?? "")
        : undefined,
    points: Number(q.points) > 0 ? Number(q.points) : 1,
  }));
}

// Question types the PDF importer (and AI generator) can produce. Checkbox /
// dropdown are created manually, so we keep the model to this set.
const PDF_TYPES: QuestionType[] = ["MCQ", "TRUE_FALSE", "SHORT_ANSWER", "ESSAY"];

// Harden one raw model item into a GeneratedQuestion, honouring its own type
// and difficulty (the PDF importer returns a mix, unlike generateQuestions
// which is asked for a single fixed type).
function normalizeGenerated(raw: GeneratedQuestion): GeneratedQuestion {
  const type = PDF_TYPES.includes(raw.type) ? raw.type : "SHORT_ANSWER";
  const difficulty: Difficulty = (["EASY", "MEDIUM", "HARD"] as Difficulty[]).includes(
    raw.difficulty,
  )
    ? raw.difficulty
    : "MEDIUM";
  return {
    type,
    difficulty,
    text: String(raw.text ?? "").trim(),
    options: type === "MCQ" ? (raw.options ?? []).map(String) : undefined,
    correctAnswer:
      (type === "MCQ" || type === "TRUE_FALSE") && raw.correctAnswer != null
        ? String(raw.correctAnswer)
        : undefined,
    modelAnswer:
      type === "SHORT_ANSWER" || type === "ESSAY"
        ? String(raw.modelAnswer ?? "")
        : undefined,
    points: Number(raw.points) > 0 ? Number(raw.points) : 1,
  };
}

// Read a PDF and turn it into exam questions. The model auto-detects intent:
// if the PDF is already a question paper it extracts the questions (and any
// indicated answers) faithfully; if it's study material it writes new ones.
export async function generateQuestionsFromPdf(opts: {
  pdfBase64: string;
  count: number;
  language: string;
  subject?: string;
  instructions?: string;
}): Promise<GeneratedQuestion[]> {
  const { pdfBase64, count, language, subject, instructions } = opts;
  const langName =
    language === "ar" ? "Arabic" : language === "fr" ? "French" : "English";

  const system = `You are an expert exam author for the Lebanese (MEHE) school curriculum.
You are given a PDF. Choose the mode that fits its content:
- If the PDF already contains exam questions, EXTRACT them faithfully — keep the wording, the answer options, and any indicated correct answers.
- If the PDF is study material (lecture notes, a textbook chapter, an article), GENERATE new curriculum-appropriate exam questions that test understanding of its content.
Write all questions in ${langName}. Respond with JSON only — no prose.`;

  const shapes = `Return a JSON object {"questions": [...]} whose items are each one of:
{"type":"MCQ","difficulty":"EASY"|"MEDIUM"|"HARD","text":string,"options":[2-5 strings],"correctAnswer":"<0-based index of the correct option, as a string>","points":number}
{"type":"TRUE_FALSE","difficulty":...,"text":string,"correctAnswer":"true"|"false","points":number}
{"type":"SHORT_ANSWER","difficulty":...,"text":string,"modelAnswer":string,"points":number}
{"type":"ESSAY","difficulty":...,"text":string,"modelAnswer":string (key points / rubric),"points":number}`;

  const prompt = `Produce up to ${count} question(s).
${subject ? `Subject: ${subject}. ` : ""}${instructions ? `Additional instructions: ${instructions}\n` : ""}${shapes}
If a correct answer is neither indicated in the PDF nor determinable, omit "correctAnswer" for MCQ/TRUE_FALSE, or give your best "modelAnswer" for open questions.
Use points appropriate to difficulty (easy 1, medium 2, hard 3).`;

  const { questions: items } = await createJson<{ questions: GeneratedQuestion[] }>({
    maxTokens: 8192,
    system,
    content: [
      {
        type: "document",
        source: {
          type: "base64",
          media_type: "application/pdf",
          data: pdfBase64,
        },
      },
      { type: "text", text: prompt },
    ],
    schema: QUESTIONS_SCHEMA,
  });
  return items
    .map(normalizeGenerated)
    .filter((q) => q.text.length > 0)
    .slice(0, count);
}

export type AiGrade = { score: number; feedback: string };

export async function gradeOpenAnswer(opts: {
  questionText: string;
  modelAnswer: string | null;
  studentAnswer: string;
  maxPoints: number;
  language: string;
}): Promise<AiGrade> {
  const { questionText, modelAnswer, studentAnswer, maxPoints, language } = opts;
  const langName =
    language === "ar" ? "Arabic" : language === "fr" ? "French" : "English";

  const system = `You are a fair, consistent exam grader. Grade the student's answer
against the question and (if provided) the model answer. Award partial credit.
Respond in ${langName} for the feedback. Respond with JSON only:
{"score": <number between 0 and ${maxPoints}>, "feedback": "<one or two sentences>"}`;

  const prompt = `Question: ${questionText}
${modelAnswer ? `Model answer / rubric: ${modelAnswer}` : "No model answer provided; grade on correctness and completeness."}
Maximum points: ${maxPoints}
Student's answer: ${studentAnswer || "(no answer)"}`;

  const parsed = await createJson<AiGrade>({
    maxTokens: 512,
    system,
    content: prompt,
    schema: {
      type: "object",
      additionalProperties: false,
      properties: {
        score: { type: "number" },
        feedback: { type: "string" },
      },
      required: ["score", "feedback"],
    },
  });
  let score = Number(parsed.score);
  if (!Number.isFinite(score)) score = 0;
  score = Math.max(0, Math.min(maxPoints, score));
  return { score, feedback: String(parsed.feedback ?? "") };
}

// ── Answer-key PDF grading ──────────────────────────────────────────────────
// The teacher uploads a marking scheme / answer key as a PDF. We first read it
// once into a structured key aligned to the exam's questions (extractAnswerKey),
// then grade each student's response against that key (gradeAgainstKey).

export type ExtractedKeyItem = {
  index: number; // matches the exam question's response index
  title: string; // the question text, for the teacher to verify alignment
  answer: string; // the correct answer / marking notes read from the PDF
};

const KEY_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    key: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          index: { type: "number" },
          answer: { type: "string" },
        },
        required: ["index", "answer"],
      },
    },
  },
  required: ["key"],
} as const;

// Read an answer-key PDF and align its answers to the exam's questions. Returns
// one entry per provided question (its `index` preserved), with `answer` set to
// what the PDF gives for that question — or an empty string if the PDF doesn't
// cover it. Nothing is invented: grading later treats a blank answer as "no key
// for this question".
export async function extractAnswerKey(opts: {
  pdfBase64: string;
  questions: { index: number; title: string; maxPoints: number }[];
  language: string;
}): Promise<ExtractedKeyItem[]> {
  const { pdfBase64, questions, language } = opts;
  const langName =
    language === "ar" ? "Arabic" : language === "fr" ? "French" : "English";

  const system = `You are reading an exam ANSWER KEY (marking scheme) from a PDF.
You are given the exam's questions as a numbered list. For each question, find the
correct answer in the PDF and return it. Match by meaning, not just position — the
PDF may order or word things differently. If the PDF clearly does not contain an
answer for a question, return an empty string for that question's "answer". Never
invent an answer that is not supported by the PDF. Write answers in ${langName}.
Respond with JSON only.`;

  const list = questions
    .map((q) => `${q.index}. (${q.maxPoints} pts) ${q.title}`)
    .join("\n");
  const prompt = `Exam questions (the number is the "index" to use in your output):
${list}

Return {"key": [{"index": <the question's number>, "answer": "<correct answer from the PDF, or empty string>"}, ...]} with exactly one entry per question above.`;

  const { key } = await createJson<{ key: { index: number; answer: string }[] }>({
    maxTokens: 4096,
    system,
    content: [
      {
        type: "document",
        source: { type: "base64", media_type: "application/pdf", data: pdfBase64 },
      },
      { type: "text", text: prompt },
    ],
    schema: KEY_SCHEMA,
  });

  // Re-align to the requested questions so the result is always complete and in
  // order, regardless of what the model returned.
  const byIndex = new Map<number, string>();
  for (const k of key ?? []) {
    if (typeof k?.index === "number") byIndex.set(k.index, String(k.answer ?? "").trim());
  }
  return questions.map((q) => ({
    index: q.index,
    title: q.title,
    answer: byIndex.get(q.index) ?? "",
  }));
}

export type GradedQuestion = { index: number; score: number; feedback: string };

const GRADE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    grades: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          index: { type: "number" },
          score: { type: "number" },
          feedback: { type: "string" },
        },
        required: ["index", "score", "feedback"],
      },
    },
  },
  required: ["grades"],
} as const;

// Grade one student's whole response against the extracted answer key. Each item
// pairs a question (title + max points + the key's correct answer) with the
// student's submitted answer. Returns a score (0..maxPoints) and short feedback
// per question. Awards partial credit. A question whose `correctAnswer` is blank
// is graded on general correctness (the PDF gave no key for it).
export async function gradeAgainstKey(opts: {
  items: {
    index: number;
    title: string;
    maxPoints: number;
    correctAnswer: string;
    studentAnswer: string;
  }[];
  language: string;
}): Promise<GradedQuestion[]> {
  const { items, language } = opts;
  const langName =
    language === "ar" ? "Arabic" : language === "fr" ? "French" : "English";

  const system = `You are a fair, consistent exam grader. Grade each answer against
the provided correct answer (the answer key). Award partial credit where the
student's answer is partly right. For an objective question, an exact or
equivalent match earns full marks; a wrong answer earns 0. Keep each feedback to
one short sentence, written in ${langName}. Never exceed a question's maximum
points. Respond with JSON only.`;

  const body = items
    .map(
      (it) =>
        `#${it.index} (max ${it.maxPoints} pts)
Question: ${it.title}
Correct answer (key): ${it.correctAnswer || "(none provided — grade on general correctness)"}
Student's answer: ${it.studentAnswer || "(no answer)"}`,
    )
    .join("\n\n");

  const prompt = `Grade the following ${items.length} answer(s).
${body}

Return {"grades": [{"index": <the #>, "score": <0..max for that question>, "feedback": "<one sentence>"}, ...]} with one entry per question.`;

  const { grades } = await createJson<{ grades: GradedQuestion[] }>({
    maxTokens: 4096,
    system,
    content: prompt,
    schema: GRADE_SCHEMA,
  });

  // Clamp each score to its question's max and guarantee one entry per item.
  const byIndex = new Map<number, GradedQuestion>();
  for (const g of grades ?? []) {
    if (typeof g?.index === "number") byIndex.set(g.index, g);
  }
  return items.map((it) => {
    const g = byIndex.get(it.index);
    let score = Number(g?.score);
    if (!Number.isFinite(score)) score = 0;
    score = Math.max(0, Math.min(it.maxPoints, score));
    return { index: it.index, score, feedback: String(g?.feedback ?? "") };
  });
}
