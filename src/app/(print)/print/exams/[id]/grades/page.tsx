import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/dal";
import { getExamResponses } from "@/lib/exam-actions";
import { PrintControls } from "../print-controls";

// A printable grade report, grouped by class/section. The teacher reaches this
// from the grading panel's "Download PDF" buttons and uses the browser's
// "Save as PDF". `nameQ`/`sectionQ` are the response-answer indices the teacher
// picked for the student-name and section questions; `section`, when present,
// limits the report to that one section (otherwise every section is printed,
// one per page).

function round(n: number): number {
  return Math.round(n * 100) / 100;
}

type Row = {
  name: string;
  section: string;
  total: number | null;
  max: number | null;
};

export default async function GradesPrintPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ nameQ?: string; sectionQ?: string; section?: string }>;
}) {
  const teacher = await requireRole("TEACHER");
  const { id } = await params;
  const sp = await searchParams;
  const nameQ = Number(sp.nameQ);
  const sectionQ = Number(sp.sectionQ);
  const sectionFilter = sp.section ? String(sp.section) : null;

  const exam = await prisma.exam.findUnique({
    where: { id },
    select: { title: true, totalMarks: true, createdById: true, language: true },
  });
  if (!exam || exam.createdById !== teacher.id) notFound();

  const grades = await prisma.examGrade.findMany({ where: { examId: id } });
  const gradeByResponse = new Map(grades.map((g) => [g.responseId, g]));

  const res = await getExamResponses(id);
  const rtl = exam.language === "ar";

  if ("error" in res) {
    return (
      <div className="mx-auto max-w-3xl px-8 py-8">
        <PrintControls />
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          Could not load responses: {res.error}
        </p>
      </div>
    );
  }

  const rows: Row[] = res.responses.map((r, i) => {
    const g = gradeByResponse.get(r.responseId);
    const name =
      (Number.isInteger(nameQ) ? r.answers[nameQ]?.value?.trim() : "") ||
      r.email ||
      `Response ${i + 1}`;
    const section =
      (Number.isInteger(sectionQ) ? r.answers[sectionQ]?.value?.trim() : "") ||
      "—";
    return {
      name,
      section,
      total: g ? g.totalScore : null,
      max: g ? g.maxScore : null,
    };
  });

  // Group rows by section, then keep only the requested section if filtering.
  const groups = new Map<string, Row[]>();
  for (const row of rows) {
    if (sectionFilter && row.section !== sectionFilter) continue;
    const list = groups.get(row.section) ?? [];
    list.push(row);
    groups.set(row.section, list);
  }
  const sections = [...groups.keys()].sort((a, b) => a.localeCompare(b));

  return (
    <div
      dir={rtl ? "rtl" : "ltr"}
      className="mx-auto max-w-3xl px-8 py-8 print:py-0"
    >
      <PrintControls />

      {sections.length === 0 && (
        <p className="text-sm text-gray-500">No responses to report.</p>
      )}

      {sections.map((section, si) => {
        const list = groups
          .get(section)!
          .slice()
          .sort((a, b) => a.name.localeCompare(b.name));
        const graded = list.filter((r) => r.total !== null);
        const max = graded.find((r) => r.max !== null)?.max ?? exam.totalMarks;
        const avg =
          graded.length > 0
            ? graded.reduce((s, r) => s + (r.total ?? 0), 0) / graded.length
            : null;

        return (
          <section
            key={section}
            className={si > 0 ? "break-before-page pt-8" : ""}
          >
            <header className="mb-4 border-b-2 border-gray-800 pb-3">
              <h1 className="text-xl font-bold text-gray-900">{exam.title}</h1>
              <p className="mt-1 text-sm text-gray-700">
                Grade report — Section <strong>{section}</strong> · {list.length}{" "}
                student{list.length === 1 ? "" : "s"}
                {avg !== null && <> · Average {round(avg)} / {round(max)}</>}
              </p>
            </header>

            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-gray-400 text-start">
                  <th className="w-10 py-1 text-start font-semibold">#</th>
                  <th className="py-1 text-start font-semibold">Student</th>
                  <th className="w-28 py-1 text-end font-semibold">Mark</th>
                </tr>
              </thead>
              <tbody>
                {list.map((r, i) => (
                  <tr key={i} className="border-b border-gray-200">
                    <td className="py-1.5 text-gray-500">{i + 1}</td>
                    <td className="py-1.5 text-gray-900">{r.name}</td>
                    <td className="py-1.5 text-end font-medium text-gray-900">
                      {r.total !== null
                        ? `${round(r.total)} / ${round(r.max ?? max)}`
                        : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        );
      })}
    </div>
  );
}
