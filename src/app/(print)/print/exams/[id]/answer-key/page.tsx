import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/dal";
import { PrintControls } from "../print-controls";

// Localized header / answer labels. Falls back to English for any other language.
const LABELS = {
  en: {
    name: "Name",
    date: "Date",
    total: "Total marks",
    minutes: "min",
    instructions: "Instructions",
    pts: "pts",
    answerKey: "Answer Key",
    correctAnswer: "Correct answer",
    modelAnswer: "Model answer",
    noAnswer: "No answer key for this question.",
  },
  fr: {
    name: "Nom",
    date: "Date",
    total: "Total des points",
    minutes: "min",
    instructions: "Consignes",
    pts: "pts",
    answerKey: "Corrigé",
    correctAnswer: "Bonne réponse",
    modelAnswer: "Réponse type",
    noAnswer: "Pas de corrigé pour cette question.",
  },
  ar: {
    name: "الاسم",
    date: "التاريخ",
    total: "مجموع الدرجات",
    minutes: "دقيقة",
    instructions: "تعليمات",
    pts: "نقاط",
    answerKey: "نموذج الإجابة",
    correctAnswer: "الإجابة الصحيحة",
    modelAnswer: "الإجابة النموذجية",
    noAnswer: "لا يوجد نموذج إجابة لهذا السؤال.",
  },
} as const;

function labelsFor(lang: string) {
  return LABELS[lang as keyof typeof LABELS] ?? LABELS.en;
}

function trueFalseLabels(lang: string): [string, string] {
  if (lang === "fr") return ["Vrai", "Faux"];
  if (lang === "ar") return ["صح", "خطأ"];
  return ["True", "False"];
}

// Parse `correctAnswer` into the set of correct option indices for a choice
// question. MCQ/DROPDOWN store a single index; CHECKBOX stores a comma-separated
// list. Mirrors the grading logic in src/lib/google-forms.ts. Also defensively
// matches an option by value in case the answer was stored as text, not an index.
function correctIndexSet(
  correctAnswer: string | null,
  options: string[],
): Set<number> {
  const set = new Set<number>();
  if (!correctAnswer) return set;
  for (const raw of correctAnswer.split(",")) {
    const trimmed = raw.trim();
    if (!trimmed) continue;
    const idx = Number(trimmed);
    if (Number.isInteger(idx) && idx >= 0 && idx < options.length) {
      set.add(idx);
      continue;
    }
    const byValue = options.indexOf(trimmed);
    if (byValue >= 0) set.add(byValue);
  }
  return set;
}

// A filled (correct) single-choice bubble.
function BubbleCorrect() {
  return (
    <span className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 border-green-600">
      <span className="h-2 w-2 rounded-full bg-green-600" />
    </span>
  );
}

// An empty (incorrect) single-choice bubble.
function Bubble() {
  return (
    <span className="inline-block h-4 w-4 shrink-0 rounded-full border border-gray-400" />
  );
}

// A checked (correct) checkbox.
function BoxCorrect() {
  return (
    <span className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-sm border-2 border-green-600 text-green-600">
      <svg viewBox="0 0 16 16" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2.5">
        <path d="M3 8.5l3 3 7-7" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </span>
  );
}

// An empty (incorrect) checkbox.
function Box() {
  return (
    <span className="inline-block h-4 w-4 shrink-0 rounded-sm border border-gray-400" />
  );
}

export default async function PrintExamAnswerKeyPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const teacher = await requireRole("TEACHER");
  const { id } = await params;

  const exam = await prisma.exam.findUnique({
    where: { id },
    include: {
      subject: { select: { name: true } },
      examQuestions: {
        orderBy: { order: "asc" },
        include: { question: true },
      },
    },
  });
  if (!exam || exam.createdById !== teacher.id) notFound();

  const L = labelsFor(exam.language);
  const examRtl = exam.language === "ar";

  return (
    <div
      dir={examRtl ? "rtl" : "ltr"}
      className="mx-auto max-w-3xl px-8 py-8 print:py-0"
    >
      <PrintControls />

      <header className="mb-8 border-b-2 border-gray-800 pb-4">
        <div className="flex items-start justify-between gap-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-green-700">
              {L.answerKey}
            </p>
            <h1 className="text-2xl font-bold text-gray-900">{exam.title}</h1>
          </div>
          <div className="shrink-0 text-end text-sm text-gray-700">
            {exam.subject?.name && <p>{exam.subject.name}</p>}
            <p>
              {L.total}: {exam.totalMarks}
            </p>
            {exam.durationMins ? (
              <p>
                {exam.durationMins} {L.minutes}
              </p>
            ) : null}
          </div>
        </div>

        {exam.description && (
          <p className="mt-3 text-sm text-gray-700">
            <strong>{L.instructions}:</strong> {exam.description}
          </p>
        )}
      </header>

      <ol className="space-y-6">
        {exam.examQuestions.map((eq, i) => {
          const q = eq.question;
          const points = eq.points ?? q.points;
          const rtl = q.language === "ar";
          const options = Array.isArray(q.options) ? (q.options as string[]) : [];
          const correctSet = correctIndexSet(q.correctAnswer, options);
          const [tTrue, tFalse] = trueFalseLabels(q.language);
          const tfOptions: { label: string; correct: boolean }[] = [
            { label: tTrue, correct: q.correctAnswer === "true" },
            { label: tFalse, correct: q.correctAnswer === "false" },
          ];
          const openAnswer = q.modelAnswer ?? q.correctAnswer ?? null;

          return (
            <li
              key={eq.id}
              dir={rtl ? "rtl" : "ltr"}
              className="break-inside-avoid"
            >
              <div className="flex items-start justify-between gap-4">
                <p className="font-medium text-gray-900">
                  <span className="me-1">{i + 1}.</span>
                  {q.text}
                </p>
                <span className="shrink-0 text-sm text-gray-500">
                  ({points} {L.pts})
                </span>
              </div>

              {q.imageUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={q.imageUrl}
                  alt=""
                  className="mt-2 max-h-56 rounded border border-gray-200"
                />
              )}

              <div className="mt-2 ps-6">
                {(q.type === "MCQ" || q.type === "DROPDOWN") && (
                  <ul className="space-y-1.5">
                    {options.map((opt, k) => {
                      const correct = correctSet.has(k);
                      return (
                        <li key={k} className="flex items-center gap-2">
                          {correct ? <BubbleCorrect /> : <Bubble />}
                          <span
                            className={
                              correct
                                ? "font-semibold text-green-700"
                                : "text-gray-700"
                            }
                          >
                            {opt}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                )}

                {q.type === "CHECKBOX" && (
                  <ul className="space-y-1.5">
                    {options.map((opt, k) => {
                      const correct = correctSet.has(k);
                      return (
                        <li key={k} className="flex items-center gap-2">
                          {correct ? <BoxCorrect /> : <Box />}
                          <span
                            className={
                              correct
                                ? "font-semibold text-green-700"
                                : "text-gray-700"
                            }
                          >
                            {opt}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                )}

                {q.type === "TRUE_FALSE" && (
                  <ul className="space-y-1.5">
                    {tfOptions.map((opt) => (
                      <li key={opt.label} className="flex items-center gap-2">
                        {opt.correct ? <BubbleCorrect /> : <Bubble />}
                        <span
                          className={
                            opt.correct
                              ? "font-semibold text-green-700"
                              : "text-gray-700"
                          }
                        >
                          {opt.label}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}

                {(q.type === "SHORT_ANSWER" || q.type === "ESSAY") && (
                  <div className="rounded border border-green-200 bg-green-50 px-3 py-2 text-sm print:bg-transparent">
                    {openAnswer ? (
                      <>
                        <span className="font-semibold text-green-700">
                          {q.type === "ESSAY" ? L.modelAnswer : L.correctAnswer}:
                        </span>{" "}
                        <span className="whitespace-pre-wrap text-gray-800">
                          {openAnswer}
                        </span>
                      </>
                    ) : (
                      <span className="text-gray-500">{L.noAnswer}</span>
                    )}
                  </div>
                )}

                {(q.type === "TEXT" || q.type === "IMAGE") && (
                  <p className="text-sm text-gray-400">—</p>
                )}
              </div>
            </li>
          );
        })}
      </ol>

      {exam.examQuestions.length === 0 && (
        <p className="text-sm text-gray-500">This exam has no questions yet.</p>
      )}
    </div>
  );
}
