import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  ImageRun,
  HeadingLevel,
  AlignmentType,
  Table,
  TableRow,
  TableCell,
  WidthType,
} from "docx";
import { requireRole } from "@/lib/dal";
import { buildReport } from "@/lib/report-data";
import { getSettings, parseDataUrl } from "@/lib/settings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function safeName(s: string) {
  return s.replace(/[^a-z0-9]+/gi, "_").slice(0, 50) || "exam";
}

function cell(text: string, opts: { bold?: boolean } = {}) {
  return new TableCell({
    children: [new Paragraph({ children: [new TextRun({ text, bold: opts.bold })] })],
    width: { size: 20, type: WidthType.PERCENTAGE },
  });
}

function metaLine(label: string, value: string) {
  return new Paragraph({
    children: [
      new TextRun({ text: `${label}: `, bold: true }),
      new TextRun({ text: value }),
    ],
  });
}

export async function GET(
  _req: Request,
  ctx: RouteContext<"/teacher/exams/[id]/report/word">,
) {
  const teacher = await requireRole("TEACHER");
  const { id } = await ctx.params;
  const report = await buildReport(id, teacher.id);
  if (!report) return new Response("Not found", { status: 404 });

  const { exam, rows, stats } = report;
  const settings = await getSettings();
  const schoolName = exam.schoolName ?? settings.schoolName;
  const schoolLogo = exam.schoolLogo ?? settings.logoDataUrl;
  const themeHex = (exam.schoolTheme ?? "#1d4ed8").replace("#", "");

  // Optional branding header (logo + school name).
  const brandingChildren: Paragraph[] = [];
  const logo = parseDataUrl(schoolLogo);
  if (logo) {
    brandingChildren.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [
          new ImageRun({
            data: logo.buffer,
            transformation: { width: 80, height: 80 },
            type: logo.extension === "jpeg" ? "jpg" : logo.extension,
          }),
        ],
      }),
    );
  }
  if (schoolName) {
    brandingChildren.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [new TextRun({ text: schoolName, bold: true, size: 28, color: themeHex })],
      }),
    );
  }

  const tableHeader = new TableRow({
    tableHeader: true,
    children: [
      cell("Student", { bold: true }),
      cell("Email", { bold: true }),
      cell("Grade", { bold: true }),
      cell("Raw", { bold: true }),
      cell(`Score / ${exam.totalMarks}`, { bold: true }),
      cell("Verdict", { bold: true }),
    ],
  });

  const dataRows = rows.map(
    (rrow) =>
      new TableRow({
        children: [
          cell(rrow.name),
          cell(rrow.email),
          cell(rrow.gradeLevel ?? "—"),
          cell(rrow.rawScore != null ? String(rrow.rawScore) : "—"),
          cell(rrow.scaledScore != null ? String(rrow.scaledScore) : "—"),
          cell(rrow.verdict),
        ],
      }),
  );

  const doc = new Document({
    sections: [
      {
        children: [
          ...brandingChildren,
          new Paragraph({
            heading: HeadingLevel.TITLE,
            alignment: AlignmentType.CENTER,
            children: [new TextRun({ text: exam.title, bold: true })],
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [
              new TextRun({
                text: "Examination Results Report",
                italics: true,
                color: "555555",
              }),
            ],
          }),
          new Paragraph({ text: "" }),
          metaLine("Subject", exam.subjectName ?? "—"),
          metaLine("Graded out of", String(exam.totalMarks)),
          metaLine("Questions", String(exam.questionCount)),
          metaLine("Generated", new Date().toISOString().slice(0, 10)),
          new Paragraph({ text: "" }),
          new Paragraph({
            heading: HeadingLevel.HEADING_2,
            children: [new TextRun({ text: "Class statistics" })],
          }),
          metaLine("Submitted", String(stats.submitted)),
          metaLine("Graded", String(stats.graded)),
          metaLine("Average", `${stats.average} / ${exam.totalMarks}`),
          metaLine("Pass rate", `${stats.passRate}%`),
          metaLine(
            "Highest / Lowest",
            `${stats.highest} / ${stats.lowest} (out of ${exam.totalMarks})`,
          ),
          new Paragraph({ text: "" }),
          new Paragraph({
            heading: HeadingLevel.HEADING_2,
            children: [new TextRun({ text: "Results" })],
          }),
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [tableHeader, ...dataRows],
          }),
        ],
      },
    ],
  });

  const buffer = (await Packer.toBuffer(doc)) as unknown as ArrayBuffer;
  return new Response(buffer, {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": `attachment; filename="report_${safeName(exam.title)}.docx"`,
    },
  });
}
