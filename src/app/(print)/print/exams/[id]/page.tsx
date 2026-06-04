import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/dal";
import { PrintControls } from "./print-controls";

// Localized header labels. Falls back to English for any other language.
const LABELS = {
  en: { name: "Name", date: "Date", total: "Total marks", minutes: "min", instructions: "Instructions", pts: "pts" },
  fr: { name: "Nom", date: "Date", total: "Total des points", minutes: "min", instructions: "Consignes", pts: "pts" },
  ar: { name: "الاسم", date: "التاريخ", total: "مجموع الدرجات", minutes: "دقيقة", instructions: "تعليمات", pts: "نقاط" },
} as const;

function labelsFor(lang: string) {
  return LABELS[lang as keyof typeof LABELS] ?? LABELS.en;
}

function trueFalseLabels(lang: string): [string, string] {
  if (lang === "fr") return ["Vrai", "Faux"];
  if (lang === "ar") return ["صح", "خطأ"];
  return ["True", "False"];
}

// An empty radio bubble drawn before a single-choice option.
function Bubble() {
  return (
    <span className="inline-block h-4 w-4 shrink-0 rounded-full border border-gray-500" />
  );
}

// An empty square drawn before a checkbox option (multiple answers allowed).
function Box() {
  return (
    <span className="inline-block h-4 w-4 shrink-0 rounded-sm border border-gray-500" />
  );
}

// A blank ruled line for hand-written answers.
function BlankLine() {
  return <div className="h-7 border-b border-gray-300" />;
}

export default async function PrintExamPage({
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
          <h1 className="text-2xl font-bold text-gray-900">{exam.title}</h1>
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

        <div className="mt-4 flex flex-wrap gap-x-10 gap-y-2 text-sm text-gray-800">
          <span>
            {L.name}:
            <span className="ms-2 inline-block min-w-[14rem] border-b border-gray-500">
              &nbsp;
            </span>
          </span>
          <span>
            {L.date}:
            <span className="ms-2 inline-block min-w-[8rem] border-b border-gray-500">
              &nbsp;
            </span>
          </span>
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
                    {options.map((opt, k) => (
                      <li key={k} className="flex items-center gap-2">
                        <Bubble />
                        <span className="text-gray-800">{opt}</span>
                      </li>
                    ))}
                  </ul>
                )}

                {q.type === "CHECKBOX" && (
                  <ul className="space-y-1.5">
                    {options.map((opt, k) => (
                      <li key={k} className="flex items-center gap-2">
                        <Box />
                        <span className="text-gray-800">{opt}</span>
                      </li>
                    ))}
                  </ul>
                )}

                {q.type === "TRUE_FALSE" && (
                  <ul className="space-y-1.5">
                    {trueFalseLabels(q.language).map((opt) => (
                      <li key={opt} className="flex items-center gap-2">
                        <Bubble />
                        <span className="text-gray-800">{opt}</span>
                      </li>
                    ))}
                  </ul>
                )}

                {q.type === "SHORT_ANSWER" && (
                  <div className="pt-2">
                    <BlankLine />
                  </div>
                )}

                {q.type === "ESSAY" && (
                  <div className="space-y-3 pt-2">
                    {Array.from({ length: 5 }).map((_, k) => (
                      <BlankLine key={k} />
                    ))}
                  </div>
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
