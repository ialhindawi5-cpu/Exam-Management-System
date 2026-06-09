import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/dal";
import {
  PageHeader,
  Button,
  Badge,
  EmptyState,
  cn,
} from "@/components/ui";
import {
  QUESTION_TYPE_LABELS,
  DIFFICULTY_LABELS,
} from "@/lib/labels";
import { QuestionDeleteButton } from "./delete-button";
import type { Difficulty, Prisma } from "@prisma/client";

const diffColor: Record<Difficulty, "green" | "yellow" | "red"> = {
  EASY: "green",
  MEDIUM: "yellow",
  HARD: "red",
};

export default async function QuestionsPage({
  searchParams,
}: {
  searchParams: Promise<{ subject?: string; difficulty?: string; type?: string }>;
}) {
  const teacher = await requireRole("TEACHER");
  const sp = await searchParams;

  const where: Prisma.QuestionWhereInput = { createdById: teacher.id };
  if (sp.subject) where.subjectId = sp.subject;
  if (sp.difficulty) where.difficulty = sp.difficulty as Difficulty;
  if (sp.type) where.type = sp.type as Prisma.QuestionWhereInput["type"];

  const [questions, subjects] = await Promise.all([
    prisma.question.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: { subject: { select: { name: true } } },
    }),
    prisma.subject.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);

  return (
    <>
      <PageHeader
        title="Question Bank"
        description="Your questions — reusable across exams."
        action={
          <div className="flex flex-wrap gap-2">
            <Link href="/teacher/questions/generate">
              <Button variant="secondary">✨ Generate with AI</Button>
            </Link>
            <Link href="/teacher/questions/new">
              <Button>+ New question</Button>
            </Link>
          </div>
        }
      />

      {/* Filters */}
      <form className="mb-4 flex flex-wrap gap-2 text-sm" method="get">
        <select
          name="subject"
          defaultValue={sp.subject ?? ""}
          className="rounded-lg border border-gray-300 bg-white px-2 py-1.5"
        >
          <option value="">All subjects</option>
          {subjects.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
        <select
          name="difficulty"
          defaultValue={sp.difficulty ?? ""}
          className="rounded-lg border border-gray-300 bg-white px-2 py-1.5"
        >
          <option value="">All difficulties</option>
          {Object.entries(DIFFICULTY_LABELS).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
        <select
          name="type"
          defaultValue={sp.type ?? ""}
          className="rounded-lg border border-gray-300 bg-white px-2 py-1.5"
        >
          <option value="">All types</option>
          {Object.entries(QUESTION_TYPE_LABELS).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
        <Button type="submit" variant="secondary">
          Filter
        </Button>
      </form>

      {questions.length === 0 ? (
        <EmptyState>
          No questions yet. Create one manually or generate with AI.
        </EmptyState>
      ) : (
        <div className="space-y-3">
          {questions.map((q) => (
            <div
              key={q.id}
              className="flex items-start justify-between gap-4 rounded-xl border border-gray-200 bg-white p-4"
            >
              <div className="min-w-0">
                <div className="mb-1 flex flex-wrap items-center gap-2">
                  <Badge color="blue">{QUESTION_TYPE_LABELS[q.type]}</Badge>
                  <Badge color={diffColor[q.difficulty]}>
                    {DIFFICULTY_LABELS[q.difficulty]}
                  </Badge>
                  {q.subject && <Badge color="gray">{q.subject.name}</Badge>}
                  <span className="text-xs text-gray-400">{q.points} pt</span>
                </div>
                <p
                  className={cn("text-sm text-gray-800")}
                  dir={q.language === "ar" ? "rtl" : "ltr"}
                >
                  {q.text}
                </p>
                {q.imageUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={q.imageUrl}
                    alt="Question image"
                    className="mt-2 max-h-24 rounded border border-gray-200"
                  />
                )}
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <Link href={`/teacher/questions/${q.id}/edit`}>
                  <Button variant="secondary">Edit</Button>
                </Link>
                <QuestionDeleteButton id={q.id} />
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
