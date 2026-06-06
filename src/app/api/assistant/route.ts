import Anthropic from "@anthropic-ai/sdk";
import type AnthropicNS from "@anthropic-ai/sdk";
import { getCurrentUser } from "@/lib/dal";
import { aiUnavailableReason, anthropicClient, MODEL } from "@/lib/ai";
import { prisma } from "@/lib/prisma";
import type { Role, Prisma, QuestionType, Difficulty } from "@prisma/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ChatMessage = { role: "user" | "assistant"; content: string };

function langName(code: string): string {
  return code === "ar" ? "Arabic" : code === "fr" ? "French" : "English";
}

function systemPrompt(role: Role, name: string, language: string): string {
  const common = `You are the built-in AI assistant for an Exam Management System used by schools.
You are chatting with ${name}, whose role is ${role}.
Reply in the same language the user writes in (Arabic, French, or English). If their language is unclear, use ${langName(language)}.
Help them use the app and with their exam-related tasks. Be concise, friendly, and practical.
The system supports: a question bank (MCQ, true/false, short answer, essay, with images and Arabic/French/English),
AI question generation, exams (manual build or auto-fill by difficulty), and generating a Google Form from an exam
that students take online (the teacher releases the answer key afterwards to auto-grade objective questions).
Per-school branding is supported. Grading defaults to a score out of 20.`;

  const byRole: Record<Role, string> = {
    ADMIN:
      "As an admin they manage schools, approve users, assign roles, view orders/messages, and set branding. Guide them to the right admin page.",
    TEACHER:
      "As a teacher they build a question bank, create and publish exams, and generate a Google Form for students to take. " +
      "When they ask you to create/generate questions AND save them, use the add_questions_to_bank tool. " +
      "When they ask you to build/create an exam or quiz, use the create_exam tool (it creates a draft and adds the questions). " +
      "For MCQ provide 4 options and set correctAnswer to the 0-based index (as a string). " +
      "For true/false set correctAnswer to 'true' or 'false'. For short answer/essay include a modelAnswer. " +
      "After acting, briefly confirm what you did. If you created an exam, share the link you were given so they can open it.",
    SCHOOL_ADMIN:
      "As a school admin they manage their own school's branding (logo and theme) and the teachers that belong to their school. Guide them to their school pages.",
  };

  return `${common}\n${byRole[role]}\nIf a request is outside the app, still help where reasonable. Keep replies short unless asked for detail.`;
}

// ── Tool: add questions to the teacher's bank ───────────────────────────────
const addQuestionsTool: AnthropicNS.Tool = {
  name: "add_questions_to_bank",
  description:
    "Add one or more questions to the teacher's question bank. Use only when the teacher asks to create/generate and save questions.",
  input_schema: {
    type: "object",
    properties: {
      questions: {
        type: "array",
        items: {
          type: "object",
          properties: {
            type: { type: "string", enum: ["MCQ", "TRUE_FALSE", "SHORT_ANSWER", "ESSAY"] },
            difficulty: { type: "string", enum: ["EASY", "MEDIUM", "HARD"] },
            text: { type: "string" },
            options: { type: "array", items: { type: "string" } },
            correctAnswer: { type: "string", description: "MCQ: 0-based index; TRUE_FALSE: 'true'/'false'" },
            modelAnswer: { type: "string" },
            points: { type: "number" },
          },
          required: ["type", "text"],
        },
      },
      subject: { type: "string", description: "Optional subject name to attach to the questions" },
      language: { type: "string", description: "en, fr, or ar (default en)" },
    },
    required: ["questions"],
  },
};

type GenQ = {
  type: QuestionType;
  difficulty?: Difficulty;
  text?: string;
  options?: string[];
  correctAnswer?: string;
  modelAnswer?: string;
  points?: number;
};
type AddInput = { questions?: GenQ[]; subject?: string; language?: string };

async function runAddQuestions(teacherId: string, raw: unknown): Promise<string> {
  const input = (raw ?? {}) as AddInput;
  const qs = Array.isArray(input.questions) ? input.questions : [];
  if (qs.length === 0) return "No questions were provided.";

  let subjectId: string | null = null;
  if (typeof input.subject === "string" && input.subject.trim()) {
    const s = await prisma.subject.findFirst({
      where: { name: { equals: input.subject.trim(), mode: "insensitive" } },
    });
    subjectId = s?.id ?? null;
  }
  const language = input.language === "fr" || input.language === "ar" ? input.language : "en";

  const data: Prisma.QuestionCreateManyInput[] = qs
    .map((q) => ({
      type: q.type,
      difficulty: q.difficulty ?? "MEDIUM",
      text: String(q.text ?? "").trim(),
      options: q.type === "MCQ" ? (q.options ?? []) : undefined,
      correctAnswer:
        q.type === "MCQ" || q.type === "TRUE_FALSE"
          ? String(q.correctAnswer ?? "")
          : null,
      modelAnswer:
        q.type === "SHORT_ANSWER" || q.type === "ESSAY" ? q.modelAnswer ?? null : null,
      points: Number(q.points) > 0 ? Number(q.points) : 1,
      language,
      subjectId,
      createdById: teacherId,
    }))
    .filter((d) => d.text.length > 0);

  if (data.length === 0) return "None of the questions had text, so nothing was added.";
  await prisma.question.createMany({ data });
  return `Added ${data.length} question(s) to the bank${subjectId ? " under the chosen subject" : ""}.`;
}

// ── Tool: create a full exam (draft) with questions ─────────────────────────
const createExamTool: AnthropicNS.Tool = {
  name: "create_exam",
  description:
    "Create a new exam (as a draft) for the teacher and add the given questions to it. " +
    "Use when the teacher asks to build/create an exam or quiz.",
  input_schema: {
    type: "object",
    properties: {
      title: { type: "string" },
      description: { type: "string" },
      subject: { type: "string", description: "Optional subject name" },
      totalMarks: { type: "number", description: "Final score scale (default 20)" },
      durationMins: { type: "number" },
      language: { type: "string", description: "en, fr, or ar (default en)" },
      questions: {
        type: "array",
        items: {
          type: "object",
          properties: {
            type: { type: "string", enum: ["MCQ", "TRUE_FALSE", "SHORT_ANSWER", "ESSAY"] },
            difficulty: { type: "string", enum: ["EASY", "MEDIUM", "HARD"] },
            text: { type: "string" },
            options: { type: "array", items: { type: "string" } },
            correctAnswer: { type: "string", description: "MCQ: 0-based index; TRUE_FALSE: 'true'/'false'" },
            modelAnswer: { type: "string" },
            points: { type: "number" },
          },
          required: ["type", "text"],
        },
      },
    },
    required: ["title", "questions"],
  },
};

type CreateExamInput = AddInput & {
  title?: string;
  description?: string;
  totalMarks?: number;
  durationMins?: number;
};

async function runCreateExam(
  teacherId: string,
  schoolId: string | null,
  raw: unknown,
): Promise<string> {
  const input = (raw ?? {}) as CreateExamInput;
  const title = String(input.title ?? "").trim();
  if (!title) return "An exam title is required.";
  const qs = Array.isArray(input.questions) ? input.questions : [];

  let subjectId: string | null = null;
  if (typeof input.subject === "string" && input.subject.trim()) {
    const s = await prisma.subject.findFirst({
      where: { name: { equals: input.subject.trim(), mode: "insensitive" } },
    });
    subjectId = s?.id ?? null;
  }
  const language = input.language === "fr" || input.language === "ar" ? input.language : "en";
  const totalMarks = Number(input.totalMarks) > 0 ? Number(input.totalMarks) : 20;
  const durationMins = Number(input.durationMins) > 0 ? Number(input.durationMins) : null;

  const exam = await prisma.exam.create({
    data: {
      title,
      description: input.description?.trim() || null,
      subjectId,
      language,
      totalMarks,
      durationMins,
      createdById: teacherId,
      schoolId,
    },
  });

  let order = 0;
  for (const q of qs) {
    const text = String(q.text ?? "").trim();
    if (!text) continue;
    const question = await prisma.question.create({
      data: {
        type: q.type,
        difficulty: q.difficulty ?? "MEDIUM",
        text,
        options: q.type === "MCQ" ? (q.options ?? []) : undefined,
        correctAnswer:
          q.type === "MCQ" || q.type === "TRUE_FALSE" ? String(q.correctAnswer ?? "") : null,
        modelAnswer:
          q.type === "SHORT_ANSWER" || q.type === "ESSAY" ? q.modelAnswer ?? null : null,
        points: Number(q.points) > 0 ? Number(q.points) : 1,
        language,
        subjectId,
        createdById: teacherId,
      },
    });
    order += 1;
    await prisma.examQuestion.create({
      data: { examId: exam.id, questionId: question.id, order },
    });
  }

  return `Created the draft exam "${title}" with ${order} question(s). Open it at /teacher/exams/${exam.id} to review and publish.`;
}

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user || user.accessStatus !== "APPROVED") {
    return new Response("Unauthorized", { status: 401 });
  }
  const unavailable = aiUnavailableReason();
  if (unavailable) {
    return new Response(unavailable, { status: 200 });
  }

  let body: { messages?: ChatMessage[] };
  try {
    body = await req.json();
  } catch {
    return new Response("Bad request", { status: 400 });
  }

  const incoming = Array.isArray(body.messages) ? body.messages : [];
  const convo: AnthropicNS.MessageParam[] = incoming
    .filter(
      (m) =>
        (m.role === "user" || m.role === "assistant") &&
        typeof m.content === "string" &&
        m.content.trim().length > 0,
    )
    .slice(-16)
    .map((m) => ({ role: m.role, content: m.content.slice(0, 4000) }));

  if (convo.length === 0) return new Response("No message", { status: 400 });

  // Only teachers get the question-bank / exam-building tools.
  const tools = user.role === "TEACHER" ? [addQuestionsTool, createExamTool] : undefined;
  const client = anthropicClient();
  const system = systemPrompt(user.role, user.name, user.language);

  let finalText = "";
  try {
    // Tool-use loop: let the model call tools, then summarize.
    for (let round = 0; round < 4; round++) {
      const resp = await client.messages.create({
        model: MODEL,
        max_tokens: 1500,
        system,
        messages: convo,
        ...(tools ? { tools } : {}),
      });

      const text = resp.content
        .filter((b): b is AnthropicNS.TextBlock => b.type === "text")
        .map((b) => b.text)
        .join("");

      if (resp.stop_reason === "tool_use") {
        convo.push({ role: "assistant", content: resp.content });
        const results: AnthropicNS.ToolResultBlockParam[] = [];
        for (const block of resp.content) {
          if (block.type === "tool_use") {
            let result = "Unknown tool.";
            if (user.role === "TEACHER") {
              try {
                if (block.name === "add_questions_to_bank") {
                  result = await runAddQuestions(user.id, block.input);
                } else if (block.name === "create_exam") {
                  result = await runCreateExam(user.id, user.schoolId, block.input);
                }
              } catch {
                result = "The action failed due to an error.";
              }
            }
            results.push({ type: "tool_result", tool_use_id: block.id, content: result });
          }
        }
        convo.push({ role: "user", content: results });
        continue;
      }

      finalText = text;
      break;
    }
  } catch (err) {
    // Surface the cause so a misconfigured key isn't reported as a generic glitch.
    if (err instanceof Anthropic.AuthenticationError) {
      return new Response(
        'The AI assistant\'s API key was rejected. Ask your administrator to set a valid ANTHROPIC_API_KEY (it must start with "sk-ant-").',
        { status: 200 },
      );
    }
    if (err instanceof Anthropic.RateLimitError) {
      return new Response(
        "The AI assistant is busy right now. Please try again in a moment.",
        { status: 200 },
      );
    }
    return new Response("The assistant ran into an error. Please try again.", {
      status: 200,
    });
  }

  return new Response(finalText || "Done.", {
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
  });
}
