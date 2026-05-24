import ExcelJS from "exceljs";
import { requireRole } from "@/lib/dal";
import { buildReport } from "@/lib/report-data";
import { getSettings, parseDataUrl } from "@/lib/settings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function safeName(s: string) {
  return s.replace(/[^a-z0-9]+/gi, "_").slice(0, 50) || "exam";
}

export async function GET(
  _req: Request,
  ctx: RouteContext<"/teacher/exams/[id]/report/excel">,
) {
  const teacher = await requireRole("TEACHER");
  const { id } = await ctx.params;
  const report = await buildReport(id, teacher.id);
  if (!report) return new Response("Not found", { status: 404 });

  const { exam, rows, stats } = report;
  const settings = await getSettings();
  // Prefer the exam's school branding, fall back to the global default.
  const schoolName = exam.schoolName ?? settings.schoolName;
  const schoolLogo = exam.schoolLogo ?? settings.logoDataUrl;
  const headerArgb =
    "FF" + (exam.schoolTheme ?? "#1d4ed8").replace("#", "").toUpperCase();

  const wb = new ExcelJS.Workbook();
  wb.creator = schoolName ?? "Exam System";
  const ws = wb.addWorksheet("Results");
  ws.columns = [
    { key: "name", width: 28 },
    { key: "email", width: 30 },
    { key: "grade", width: 18 },
    { key: "raw", width: 14 },
    { key: "score", width: 16 },
    { key: "verdict", width: 14 },
  ];

  // Logo floats at the top-right corner.
  const logo = parseDataUrl(schoolLogo);
  if (logo) {
    const imageId = wb.addImage({ base64: logo.base64, extension: logo.extension });
    ws.addImage(imageId, { tl: { col: 5, row: 0 }, ext: { width: 90, height: 90 } });
  }

  let r = 1;
  const centerMerge = (text: string, size: number, bold = true) => {
    ws.mergeCells(`A${r}:F${r}`);
    const cell = ws.getCell(`A${r}`);
    cell.value = text;
    cell.font = { size, bold };
    cell.alignment = { horizontal: "center" };
    r += 1;
  };

  if (schoolName) centerMerge(schoolName, 14);
  centerMerge(exam.title, 16);
  centerMerge("Examination Results Report", 11, false);
  r += 1; // blank

  const pair = (k: string, v: string) => {
    const row = ws.getRow(r);
    row.getCell(1).value = k;
    row.getCell(1).font = { bold: true };
    row.getCell(2).value = v;
    r += 1;
  };

  pair("Subject", exam.subjectName ?? "—");
  pair("Graded out of", String(exam.totalMarks));
  pair("Questions", String(exam.questionCount));
  pair("Generated", new Date().toISOString().slice(0, 10));
  r += 1;

  ws.getCell(`A${r}`).value = "Class statistics";
  ws.getCell(`A${r}`).font = { bold: true, size: 12 };
  r += 1;
  pair("Submitted", String(stats.submitted));
  pair("Graded", String(stats.graded));
  pair("Average", `${stats.average} / ${exam.totalMarks}`);
  pair("Pass rate", `${stats.passRate}%`);
  pair("Highest", `${stats.highest} / ${exam.totalMarks}`);
  pair("Lowest", `${stats.lowest} / ${exam.totalMarks}`);
  r += 1;

  // Results table
  const headerRow = ws.getRow(r);
  ["Student", "Email", "Grade", "Raw points", `Score / ${exam.totalMarks}`, "Verdict"].forEach(
    (h, i) => {
      const cell = headerRow.getCell(i + 1);
      cell.value = h;
      cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: headerArgb } };
      cell.alignment = { horizontal: "center" };
    },
  );
  r += 1;

  for (const row of rows) {
    const dataRow = ws.getRow(r);
    dataRow.getCell(1).value = row.name;
    dataRow.getCell(2).value = row.email;
    dataRow.getCell(3).value = row.gradeLevel ?? "—";
    dataRow.getCell(4).value = row.rawScore ?? "—";
    dataRow.getCell(5).value = row.scaledScore ?? "—";
    dataRow.getCell(6).value = row.verdict;
    r += 1;
  }

  const buffer = (await wb.xlsx.writeBuffer()) as unknown as ArrayBuffer;
  return new Response(buffer, {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="report_${safeName(exam.title)}.xlsx"`,
    },
  });
}
