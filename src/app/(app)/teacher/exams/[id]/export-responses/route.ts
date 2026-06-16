import type { NextRequest } from "next/server";
import ExcelJS from "exceljs";
import { prisma } from "@/lib/prisma";
import { getExamResponses } from "@/lib/exam-actions";

// exceljs needs the Node runtime; the data depends on auth + live Google data.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function sanitizeFilename(name: string) {
  return name.replace(/[^\w.-]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 80) || "exam";
}

// Mirror the panel's label: email when collected, otherwise a positional name.
function respondentLabel(email: string | null, index: number) {
  return email ?? `Response ${index + 1}`;
}

function parseDate(iso: string | null): Date | null {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
}

// GET /teacher/exams/[id]/export-responses
// Streams an .xlsx of every submitted response: an "Answers" sheet (students ×
// questions) and a "Scores" sheet (per-question points + totals). Ownership and
// the Google scope check are enforced by getExamResponses.
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const res = await getExamResponses(id);
  if ("error" in res) {
    return new Response(res.error, { status: res.needsReconnect ? 403 : 400 });
  }
  const { questions, responses } = res;

  const exam = await prisma.exam.findUnique({
    where: { id },
    select: { title: true },
  });
  const title = exam?.title ?? "Exam";

  // AI/teacher grades persisted in-app (from the answer-key grading panel),
  // keyed by Google Forms response id so we can line them up with each student.
  const gradeRows = await prisma.examGrade.findMany({ where: { examId: id } });
  const gradeByResponse = new Map(gradeRows.map((g) => [g.responseId, g]));

  const wb = new ExcelJS.Workbook();
  wb.creator = "Exam System";

  const baseHeaders = ["#", "Student", "Submitted", "Total score"];
  const baseWidths = [5, 28, 20, 12];

  // ---- Sheet 1: Answers (one row per student, one column per question) ----
  const answers = wb.addWorksheet("Answers");
  answers.addRow([
    ...baseHeaders,
    ...questions.map((q, i) => `Q${i + 1}. ${q.title}`),
  ]);
  responses.forEach((r, i) => {
    answers.addRow([
      i + 1,
      respondentLabel(r.email, i),
      parseDate(r.submittedAt) ?? "",
      r.totalScore ?? "",
      ...questions.map((q) => r.answers[q.index]?.value ?? ""),
    ]);
  });

  // ---- Sheet 2: Scores (per-question points awarded + max reference) ----
  const scores = wb.addWorksheet("Scores");
  const maxTotal = questions.reduce((sum, q) => sum + q.maxPoints, 0);
  scores.addRow([
    ...baseHeaders,
    ...questions.map((_, i) => `Q${i + 1}`),
    "Max total",
  ]);
  scores.addRow([
    "",
    "Max points",
    "",
    "",
    ...questions.map((q) => q.maxPoints),
    maxTotal,
  ]);
  responses.forEach((r, i) => {
    scores.addRow([
      i + 1,
      respondentLabel(r.email, i),
      parseDate(r.submittedAt) ?? "",
      r.totalScore ?? "",
      ...questions.map((q) => {
        const a = r.answers[q.index];
        return a && a.score !== null && a.score !== undefined ? a.score : "";
      }),
      maxTotal,
    ]);
  });

  // ---- Sheet 3: Final marks (AI grade + teacher edits), if any exist ----
  if (gradeRows.length > 0) {
    type Mark = { index: number; score: number };
    const marks = wb.addWorksheet("Final marks");
    marks.addRow([
      "#",
      "Student",
      "Final total",
      "Max total",
      "AI total",
      "Edited?",
      ...questions.map((_, i) => `Q${i + 1}`),
    ]);
    responses.forEach((r, i) => {
      const g = gradeByResponse.get(r.responseId);
      if (!g) return;
      const perQ = Array.isArray(g.perQuestion)
        ? (g.perQuestion as unknown as Mark[])
        : [];
      const scoreByIndex = new Map(perQ.map((m) => [Number(m.index), Number(m.score)]));
      marks.addRow([
        i + 1,
        respondentLabel(r.email, i),
        g.totalScore,
        g.maxScore,
        g.aiTotal,
        g.edited ? "yes" : "",
        ...questions.map((q) => {
          const s = scoreByIndex.get(q.index);
          return s === undefined ? "" : s;
        }),
      ]);
    });
  }

  // Shared styling: bold header, frozen header + label columns, sane widths.
  // The Answers/Scores sheets share the same base columns (with "Submitted" in
  // column 3); the "Final marks" sheet has its own shape, so only header + width
  // styling is applied generically and its date format is skipped.
  for (const sheet of wb.worksheets) {
    sheet.getRow(1).font = { bold: true };
    sheet.views = [{ state: "frozen", ySplit: 1, xSplit: 2 }];
    const total = sheet.columnCount;
    for (let c = 1; c <= total; c++) {
      const col = sheet.getColumn(c);
      col.width = c <= baseWidths.length ? baseWidths[c - 1] : 24;
      if (c > baseWidths.length) col.alignment = { wrapText: true, vertical: "top" };
    }
  }
  // Format the "Submitted" column (column 3) as a date-time on the two response
  // sheets only — on "Final marks" column 3 is a numeric total.
  for (const sheet of [answers, scores]) {
    sheet.getColumn(3).numFmt = "yyyy-mm-dd hh:mm";
  }

  const buffer = await wb.xlsx.writeBuffer();
  const filename = `${sanitizeFilename(title)}-responses.xlsx`;

  return new Response(buffer as BodyInit, {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
