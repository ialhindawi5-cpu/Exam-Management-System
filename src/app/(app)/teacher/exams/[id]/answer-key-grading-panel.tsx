"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import {
  uploadAnswerKey,
  gradeNextBatch,
  clearGrades,
  getGradingData,
  saveGradeEdits,
  type UploadKeyResult,
  type GradingData,
  type StudentGrade,
} from "@/lib/grading-actions";
import type { ExamResponse } from "@/lib/google-forms";
import { Card, CardBody, Button, Badge, Input, Label } from "@/components/ui";

export function AnswerKeyGradingPanel({
  examId,
  aiEnabled,
  hasGoogleForm,
  initialKeyFileName,
  initialKeyUploadedAt,
}: {
  examId: string;
  aiEnabled: boolean;
  hasGoogleForm: boolean;
  initialKeyFileName: string | null;
  initialKeyUploadedAt: string | null;
}) {
  const upload = uploadAnswerKey.bind(null, examId);
  const [uploadState, uploadAction, uploading] = useActionState<
    UploadKeyResult | undefined,
    FormData
  >(upload, undefined);

  // Reflect the most recent key: either what we were given on load, or whatever
  // a fresh upload just produced.
  const [keyFileName, setKeyFileName] = useState(initialKeyFileName);
  const [keyUploadedAt, setKeyUploadedAt] = useState(initialKeyUploadedAt);

  const [data, setData] = useState<GradingData | null>(null);
  const [loading, startLoading] = useTransition();
  const [gradeError, setGradeError] = useState<string | null>(null);
  const [gradeNotice, setGradeNotice] = useState<string | null>(null);
  // Grading runs in client-driven batches; this tracks live progress. Null when idle.
  const [progress, setProgress] = useState<
    { done: number; total: number } | null
  >(null);
  const cancelRef = useRef(false);

  const grading = progress !== null;

  function load() {
    setGradeError(null);
    startLoading(async () => {
      const d = await getGradingData(examId);
      setData(d);
      setKeyFileName(d.keyFileName);
      setKeyUploadedAt(d.keyUploadedAt);
    });
  }

  // When an upload succeeds, refresh the panel so the key + grading controls show.
  useEffect(() => {
    if (uploadState && "ok" in uploadState) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uploadState]);

  // Grade in batches until done. Resumable: skips already-graded responses, so
  // this also "fills in" any that previously failed. `regrade` wipes first.
  async function runGrading(regrade: boolean) {
    setGradeError(null);
    setGradeNotice(null);
    cancelRef.current = false;
    setProgress({ done: 0, total: 0 });
    try {
      if (regrade) {
        const cleared = await clearGrades(examId);
        if ("error" in cleared) {
          setGradeError(cleared.error);
          setProgress(null);
          return;
        }
      }
      let failed = 0;
      // Loop one batch at a time; each call is short enough to never time out.
      for (;;) {
        if (cancelRef.current) break;
        const res = await gradeNextBatch(examId, 8);
        if ("error" in res) {
          setGradeError(res.error);
          break;
        }
        failed += res.failedNow;
        setProgress({ done: res.totalGraded, total: res.totalResponses });
        if (res.remaining === 0) {
          setGradeNotice(
            `Graded ${res.totalGraded} of ${res.totalResponses} response${
              res.totalResponses === 1 ? "" : "s"
            }` + (failed ? ` · ${failed} failed — click again to retry` : ""),
          );
          break;
        }
        // Guard against a stuck loop: if a full batch made no progress, stop.
        if (res.gradedNow === 0 && res.failedNow === 0) break;
      }
    } finally {
      setProgress(null);
      const d = await getGradingData(examId);
      setData(d);
    }
  }

  if (!aiEnabled) {
    return (
      <Card>
        <CardBody>
          <h3 className="mb-1 font-semibold text-gray-900">
            Answer key &amp; AI grading
          </h3>
          <p className="text-sm text-gray-600">
            AI grading is disabled. Add{" "}
            <code className="rounded bg-gray-100 px-1">ANTHROPIC_API_KEY</code>{" "}
            to your <code className="rounded bg-gray-100 px-1">.env</code> and
            restart the server to enable it.
          </p>
        </CardBody>
      </Card>
    );
  }

  if (!hasGoogleForm) {
    return (
      <Card>
        <CardBody>
          <h3 className="mb-1 font-semibold text-gray-900">
            Answer key &amp; AI grading
          </h3>
          <p className="text-sm text-gray-600">
            Generate the Google Form and collect responses first — grading marks
            each student&apos;s response against your uploaded answer key.
          </p>
        </CardBody>
      </Card>
    );
  }

  const hasKey = Boolean(keyFileName) || (data?.hasKey ?? false);

  return (
    <Card>
      <CardBody>
        <div className="mb-3 flex items-center justify-between gap-3">
          <h3 className="font-semibold text-gray-900">Answer key &amp; AI grading</h3>
          {hasKey && <Badge color="green">Answer key uploaded</Badge>}
        </div>

        {/* ── Upload the answer key PDF ── */}
        <form action={uploadAction} className="space-y-2">
          <Label htmlFor="answer-key-pdf">
            {hasKey ? "Replace answer key (PDF)" : "Upload answer key (PDF)"}
          </Label>
          <div className="flex flex-wrap items-center gap-2">
            <Input
              id="answer-key-pdf"
              name="pdf"
              type="file"
              accept="application/pdf,.pdf"
              required
              className="max-w-xs"
            />
            <Button type="submit" disabled={uploading}>
              {uploading ? "Reading PDF…" : "Read answer key"}
            </Button>
          </div>
          <p className="text-xs text-gray-500">
            The AI reads the correct answers from your PDF and lines them up with
            this exam&apos;s questions, then grades every response against them.
          </p>
        </form>

        {keyFileName && (
          <p className="mt-2 text-xs text-gray-500">
            Current key: <span className="font-medium text-gray-700">{keyFileName}</span>
            {keyUploadedAt ? ` · ${new Date(keyUploadedAt).toLocaleString()}` : ""}
          </p>
        )}

        {uploadState && "error" in uploadState && (
          <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            {uploadState.error}
          </p>
        )}

        {/* ── Grade + review ── */}
        <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-gray-100 pt-4">
          <Button
            variant="success"
            disabled={grading || !hasKey}
            onClick={() => runGrading(false)}
          >
            {grading ? "Grading…" : "Grade all responses with AI"}
          </Button>
          {grading ? (
            <Button variant="secondary" onClick={() => (cancelRef.current = true)}>
              Stop
            </Button>
          ) : (
            <Button
              variant="secondary"
              disabled={!hasKey}
              onClick={() => runGrading(true)}
              title="Discard all marks and grade every response again from scratch"
            >
              Re-grade all
            </Button>
          )}
          <Button variant="secondary" disabled={loading || grading} onClick={load}>
            {loading ? "Loading…" : data ? "Refresh" : "Load grades"}
          </Button>
          {data && (
            <a href={`/teacher/exams/${examId}/export-responses`}>
              <Button variant="ghost">Export to Excel</Button>
            </a>
          )}
        </div>

        {progress && (
          <div className="mt-3">
            <div className="mb-1 flex justify-between text-xs text-gray-600">
              <span>
                Grading… {progress.done}
                {progress.total ? ` / ${progress.total}` : ""} responses
              </span>
              {progress.total > 0 && (
                <span>{Math.round((progress.done / progress.total) * 100)}%</span>
              )}
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-gray-200">
              <div
                className="h-full rounded-full bg-green-600 transition-all"
                style={{
                  width: progress.total
                    ? `${Math.min((progress.done / progress.total) * 100, 100)}%`
                    : "10%",
                }}
              />
            </div>
            <p className="mt-1 text-[11px] text-gray-400">
              You can leave this open — grading continues in batches and is
              resumable if interrupted.
            </p>
          </div>
        )}

        {gradeError && (
          <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            {gradeError}
          </p>
        )}
        {gradeNotice && (
          <p className="mt-3 rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">
            {gradeNotice}
          </p>
        )}

        {data && <GradesReview examId={examId} data={data} />}
      </CardBody>
    </Card>
  );
}

// Renders the extracted key (collapsible) and one editable card per graded
// student. Edits are saved per-student.
function GradesReview({
  examId,
  data,
}: {
  examId: string;
  data: GradingData;
}) {
  const responsesByItem = new Map<string, ExamResponse>(
    data.responses.map((r) => [r.responseId, r]),
  );

  return (
    <div className="mt-5 space-y-4">
      {data.responsesError && (
        <p className="rounded-lg bg-yellow-50 px-3 py-2 text-xs text-yellow-800">
          {data.responsesError} — showing saved marks; student answers may be
          hidden until reconnected.
        </p>
      )}

      {data.answerKey.length > 0 && (
        <details className="rounded-lg border border-gray-200 bg-gray-50 p-3">
          <summary className="cursor-pointer text-sm font-medium text-gray-700">
            Extracted answer key ({data.answerKey.length} questions)
          </summary>
          <ol className="mt-2 space-y-1.5 text-sm">
            {data.answerKey.map((k) => (
              <li key={k.index}>
                <span className="text-gray-500">{k.index + 1}.</span>{" "}
                <span className="text-gray-700">{k.title}</span>
                <div className="ps-5 text-green-700">
                  {k.answer ? `→ ${k.answer}` : "→ (no answer found in PDF)"}
                </div>
              </li>
            ))}
          </ol>
        </details>
      )}

      {data.grades.length === 0 ? (
        <p className="text-sm text-gray-500">
          No grades yet. Click <strong>Grade all responses with AI</strong> to
          score the submitted responses.
        </p>
      ) : (
        <div className="space-y-3">
          <p className="text-xs text-gray-500">
            {data.grades.length} graded · edit any mark; the total updates and is
            saved.
          </p>
          {data.grades.map((g) => (
            <StudentGradeCard
              key={g.responseId}
              examId={examId}
              grade={g}
              response={responsesByItem.get(g.responseId) ?? null}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function StudentGradeCard({
  examId,
  grade,
  response,
}: {
  examId: string;
  grade: StudentGrade;
  response: ExamResponse | null;
}) {
  // Local editable scores, keyed by question index, as strings (input values).
  const [scores, setScores] = useState<Record<number, string>>(() =>
    Object.fromEntries(grade.perQuestion.map((m) => [m.index, String(m.score)])),
  );
  // The final total is also directly editable (overrides the per-question sum).
  const [totalInput, setTotalInput] = useState(String(round(grade.totalScore)));
  const [saving, startSaving] = useTransition();
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [edited, setEdited] = useState(grade.edited);

  const total = Number(totalInput);

  const dirty =
    grade.perQuestion.some((m) => Number(scores[m.index]) !== m.score) ||
    (Number.isFinite(total) && total !== grade.totalScore);

  // Editing a per-question mark keeps the total field in sync with the new sum
  // (the teacher can still type a different final total afterwards).
  function setScore(index: number, value: string) {
    setSaved(false);
    const nextScores = { ...scores, [index]: value };
    setScores(nextScores);
    const sum = grade.perQuestion.reduce((s, m) => {
      const v = Number(nextScores[m.index]);
      return s + (Number.isFinite(v) ? v : 0);
    }, 0);
    setTotalInput(String(round(sum)));
  }

  function save() {
    setError(null);
    setSaved(false);
    const edits = grade.perQuestion.map((m) => ({
      index: m.index,
      score: Number(scores[m.index]) || 0,
    }));
    const override = Number(totalInput);
    startSaving(async () => {
      const res = await saveGradeEdits(
        examId,
        grade.responseId,
        edits,
        Number.isFinite(override) ? override : undefined,
      );
      if ("error" in res) {
        setError(res.error);
        return;
      }
      // Reflect the server's clamped values + edited flag.
      setScores(
        Object.fromEntries(
          res.grade.perQuestion.map((m) => [m.index, String(m.score)]),
        ),
      );
      setTotalInput(String(round(res.grade.totalScore)));
      setEdited(res.grade.edited);
      setSaved(true);
    });
  }

  const label = grade.studentEmail ?? `Response ${grade.responseId.slice(-6)}`;

  return (
    <div className="rounded-lg border border-gray-200 p-3">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-900">{label}</span>
          {edited && <Badge color="yellow">Edited</Badge>}
        </div>
        <div className="flex items-center gap-1 text-sm text-gray-700">
          <span>Total:</span>
          <Input
            type="number"
            min="0"
            max={grade.maxScore}
            step="0.5"
            value={totalInput}
            onChange={(e) => {
              setSaved(false);
              setTotalInput(e.target.value);
            }}
            className="w-16 text-right font-semibold"
            aria-label="Final total mark"
          />
          <span className="text-gray-500">/ {round(grade.maxScore)}</span>
          <span className="ml-1 text-xs text-gray-400">
            (AI: {round(grade.aiTotal)})
          </span>
        </div>
      </div>

      <ol className="space-y-2">
        {grade.perQuestion.map((m) => {
          const answer = response?.answers[m.index]?.value ?? "";
          return (
            <li key={m.index} className="text-sm">
              <div className="flex items-start justify-between gap-3">
                <p className="min-w-0 text-gray-700">
                  <span className="text-gray-400">{m.index + 1}.</span> {m.title}
                </p>
                <div className="flex shrink-0 items-center gap-1">
                  <Input
                    type="number"
                    min="0"
                    max={m.maxPoints}
                    step="0.5"
                    value={scores[m.index] ?? ""}
                    onChange={(e) => setScore(m.index, e.target.value)}
                    className="w-16 text-right"
                  />
                  <span className="text-xs text-gray-400">/ {m.maxPoints}</span>
                </div>
              </div>
              {response && (
                <p className="mt-0.5 ps-5 text-xs text-gray-500">
                  Answer:{" "}
                  {answer ? (
                    <span className="text-gray-700">{answer}</span>
                  ) : (
                    <span className="italic text-gray-400">No answer</span>
                  )}
                </p>
              )}
              {m.feedback && (
                <p className="mt-0.5 ps-5 text-xs italic text-gray-400">
                  AI: {m.feedback}
                </p>
              )}
            </li>
          );
        })}
      </ol>

      <div className="mt-2 flex items-center gap-2">
        <Button
          variant="secondary"
          disabled={saving || !dirty}
          onClick={save}
          className="px-3 py-1 text-xs"
        >
          {saving ? "Saving…" : "Save marks"}
        </Button>
        {saved && <span className="text-xs text-green-600">Saved</span>}
        {error && <span className="text-xs text-red-600">{error}</span>}
      </div>
    </div>
  );
}

// Trim floating-point noise from summed scores (e.g. 0.1 + 0.2).
function round(n: number): number {
  return Math.round(n * 100) / 100;
}
