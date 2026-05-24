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

export function aiEnabled(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

// Pull the first JSON value (object or array) out of a model response.
function extractJson<T>(text: string): T {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const raw = fenced ? fenced[1] : text;
  const start = raw.search(/[[{]/);
  if (start === -1) throw new Error("No JSON found in AI response.");
  // Find the matching end by scanning from the last bracket.
  const end = Math.max(raw.lastIndexOf("]"), raw.lastIndexOf("}"));
  return JSON.parse(raw.slice(start, end + 1)) as T;
}

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
Return a JSON array. ${shape}.
Use points appropriate to difficulty (easy 1, medium 2, hard 3).`;

  const msg = await client().messages.create({
    model: MODEL,
    max_tokens: 2048,
    system,
    messages: [{ role: "user", content: prompt }],
  });

  const text = msg.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("");

  const items = extractJson<GeneratedQuestion[]>(text);
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

  const msg = await client().messages.create({
    model: MODEL,
    max_tokens: 512,
    system,
    messages: [{ role: "user", content: prompt }],
  });

  const text = msg.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("");

  const parsed = extractJson<AiGrade>(text);
  let score = Number(parsed.score);
  if (!Number.isFinite(score)) score = 0;
  score = Math.max(0, Math.min(maxPoints, score));
  return { score, feedback: String(parsed.feedback ?? "") };
}
