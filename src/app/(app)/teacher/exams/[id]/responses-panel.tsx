"use client";

import { useState, useTransition } from "react";
import {
  getExamResponses,
  gradeOpenAnswerAction,
  type ExamResponseQuestion,
} from "@/lib/exam-actions";
import type { ExamResponse } from "@/lib/google-forms";
import { Card, CardBody, Button, Badge } from "@/components/ui";

type View = "student" | "question";

function isOpen(type: ExamResponseQuestion["type"]): boolean {
  return type === "SHORT_ANSWER" || type === "ESSAY";
}

export function ResponsesPanel({
  examId,
  aiEnabled,
}: {
  examId: string;
  aiEnabled: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [needsReconnect, setNeedsReconnect] = useState(false);
  const [questions, setQuestions] = useState<ExamResponseQuestion[]>([]);
  const [responses, setResponses] = useState<ExamResponse[]>([]);
  const [view, setView] = useState<View>("student");

  const reconnectHref = `/api/google/connect?returnTo=${encodeURIComponent(
    `/teacher/exams/${examId}`,
  )}`;

  function load() {
    setError(null);
    setNeedsReconnect(false);
    startTransition(async () => {
      const res = await getExamResponses(examId);
      if ("error" in res) {
        setError(res.error);
        setNeedsReconnect(Boolean(res.needsReconnect));
        return;
      }
      setQuestions(res.questions);
      setResponses(res.responses);
      setLoaded(true);
    });
  }

  // Average score across responses that have been graded (the Google Forms
  // score, shown once an answer key has been released for the form).
  const scored = responses.filter((r) => r.totalScore !== null);
  const maxTotal = questions.reduce((s, q) => s + q.maxPoints, 0);
  const avgScore =
    scored.length > 0
      ? scored.reduce((s, r) => s + (r.totalScore ?? 0), 0) / scored.length
      : null;

  return (
    <Card>
      <CardBody>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h3 className="font-semibold text-gray-900">Student responses</h3>
          <div className="flex items-center gap-2">
            {avgScore !== null && (
              <Badge color="blue">
                Avg {Math.round(avgScore * 100) / 100}
                {maxTotal > 0 ? ` / ${maxTotal}` : ""}
              </Badge>
            )}
            {loaded && (
              <Badge color={responses.length ? "green" : "gray"}>
                {responses.length} response{responses.length === 1 ? "" : "s"}
              </Badge>
            )}
          </div>
        </div>

        {error && (
          <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        )}

        {needsReconnect && (
          <div className="mb-3">
            <a href={reconnectHref}>
              <Button>Reconnect Google account</Button>
            </a>
          </div>
        )}

        {!loaded ? (
          <div className="space-y-2">
            <p className="text-sm text-gray-600">
              Load the answers students have submitted through the Google Form.
            </p>
            <Button disabled={pending} onClick={load}>
              {pending ? "Loading…" : "Load responses"}
            </Button>
          </div>
        ) : responses.length === 0 ? (
          <div className="space-y-2">
            <p className="text-sm text-gray-500">No responses yet.</p>
            <Button variant="secondary" disabled={pending} onClick={load}>
              {pending ? "Refreshing…" : "Refresh"}
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              {/* View toggle */}
              <div className="inline-flex rounded-lg border border-gray-300 p-0.5 text-sm">
                <button
                  type="button"
                  onClick={() => setView("student")}
                  className={tabClass(view === "student")}
                >
                  By student
                </button>
                <button
                  type="button"
                  onClick={() => setView("question")}
                  className={tabClass(view === "question")}
                >
                  By question
                </button>
              </div>
              <div className="flex items-center gap-2">
                <a href={`/teacher/exams/${examId}/export-responses`}>
                  <Button variant="secondary" disabled={pending}>
                    Export to Excel
                  </Button>
                </a>
                <Button variant="ghost" disabled={pending} onClick={load}>
                  {pending ? "Refreshing…" : "Refresh"}
                </Button>
              </div>
            </div>

            {view === "student" ? (
              <StudentView
                examId={examId}
                aiEnabled={aiEnabled}
                questions={questions}
                responses={responses}
              />
            ) : (
              <QuestionView questions={questions} responses={responses} />
            )}
          </div>
        )}
      </CardBody>
    </Card>
  );
}

function tabClass(active: boolean) {
  return [
    "rounded-md px-3 py-1 font-medium transition",
    active ? "bg-brand text-white" : "text-gray-600 hover:bg-gray-100",
  ].join(" ");
}

function respondentLabel(r: ExamResponse, index: number) {
  return r.email ?? `Response ${index + 1}`;
}

function formatTime(iso: string | null) {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d.toLocaleString();
}

// Marks an answer's correctness when the form has been graded.
function CorrectMark({ correct }: { correct: boolean | null }) {
  if (correct === null) return null;
  return correct ? (
    <span className="text-green-600" title="Correct">
      ✓
    </span>
  ) : (
    <span className="text-red-600" title="Incorrect">
      ✗
    </span>
  );
}

function AnswerText({ value }: { value: string }) {
  return value ? (
    <span className="text-gray-900">{value}</span>
  ) : (
    <span className="italic text-gray-400">No answer</span>
  );
}

// Grading aid for long/short-answer questions: each keyword found in the
// student's answer is auto-ticked and awards its points; the teacher can adjust.
// The score is shown for reference only — it isn't saved (enter it in Google
// Forms). Capped at the question's max points.
function KeywordRubric({
  keywords,
  answer,
  maxPoints,
}: {
  keywords: { text: string; points: number }[];
  answer: string;
  maxPoints: number;
}) {
  const haystack = answer.toLowerCase();
  const [checked, setChecked] = useState<boolean[]>(() =>
    keywords.map((k) => haystack.includes(k.text.toLowerCase())),
  );

  const awarded = keywords.reduce(
    (sum, k, i) => (checked[i] ? sum + k.points : sum),
    0,
  );
  const score = maxPoints > 0 ? Math.min(awarded, maxPoints) : awarded;

  function toggle(i: number) {
    setChecked((prev) => prev.map((c, idx) => (idx === i ? !c : c)));
  }

  return (
    <div className="mt-1.5 ml-3 rounded-md border border-gray-200 bg-gray-50 p-2">
      <div className="mb-1 flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-wide text-gray-500">
          Keyword rubric
        </span>
        <span className="text-sm font-semibold text-gray-800">
          {score}
          {maxPoints > 0 ? ` / ${maxPoints}` : ""}
        </span>
      </div>
      <ul className="space-y-1">
        {keywords.map((k, i) => (
          <li key={i}>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                className="h-4 w-4 accent-brand"
                checked={checked[i]}
                onChange={() => toggle(i)}
              />
              <span className={checked[i] ? "text-gray-900" : "text-gray-400"}>
                {k.text}
              </span>
              <span className="text-xs text-gray-400">+{k.points}</span>
            </label>
          </li>
        ))}
      </ul>
    </div>
  );
}

// AI grading aid for open-ended answers: on demand, asks the model to score the
// answer against the question's stored model answer and explain why. Advisory
// only — the teacher enters the final mark in Google Forms.
function AiGrade({
  examId,
  questionIndex,
  answer,
}: {
  examId: string;
  questionIndex: number;
  answer: string;
}) {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<
    { score: number; feedback: string; maxPoints: number } | null
  >(null);
  const [error, setError] = useState<string | null>(null);

  function grade() {
    setError(null);
    startTransition(async () => {
      const res = await gradeOpenAnswerAction(examId, questionIndex, answer);
      if ("error" in res) {
        setError(res.error);
        setResult(null);
      } else {
        setResult(res);
      }
    });
  }

  return (
    <div className="mt-1.5 ml-3">
      <button
        type="button"
        onClick={grade}
        disabled={pending}
        className="rounded-md border border-blue-200 bg-blue-50 px-2 py-1 text-xs font-medium text-brand hover:bg-blue-100 disabled:opacity-50"
      >
        {pending ? "Grading…" : result ? "Re-grade with AI" : "Grade with AI"}
      </button>
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
      {result && (
        <div className="mt-1 rounded-md border border-blue-100 bg-blue-50/50 p-2 text-xs">
          <div className="font-semibold text-gray-800">
            AI suggestion: {result.score} / {result.maxPoints}
          </div>
          <p className="mt-0.5 text-gray-600">{result.feedback}</p>
          <p className="mt-1 text-[10px] uppercase tracking-wide text-gray-400">
            Advisory — enter the final mark in Google Forms
          </p>
        </div>
      )}
    </div>
  );
}

// "By student" view: shows ONE student's full response at a time with a
// prev/next navigator ("‹ N of M ›") — mirrors the Google Forms individual
// response view. Stacking 200+ responses was unusable; this pages through them.
function StudentView({
  examId,
  aiEnabled,
  questions,
  responses,
}: {
  examId: string;
  aiEnabled: boolean;
  questions: ExamResponseQuestion[];
  responses: ExamResponse[];
}) {
  const total = responses.length;
  const [idx, setIdx] = useState(0);
  // Clamp in case the list shrank (e.g. after a refresh) since last render.
  const current = Math.min(Math.max(idx, 0), total - 1);
  const r = responses[current];
  const when = formatTime(r.submittedAt);

  function go(to: number) {
    setIdx(Math.min(Math.max(to, 0), total - 1));
  }

  return (
    <div className="space-y-3">
      {/* Individual-response navigator */}
      <div className="flex items-center justify-between gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
        <button
          type="button"
          onClick={() => go(current - 1)}
          disabled={current === 0}
          className="rounded-md border border-gray-300 bg-white px-3 py-1 text-sm font-medium text-gray-700 transition hover:bg-gray-100 disabled:opacity-40"
        >
          ‹ Prev
        </button>
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <span>Response</span>
          <input
            type="number"
            min={1}
            max={total}
            value={current + 1}
            onChange={(e) => {
              const n = Number(e.target.value);
              if (Number.isFinite(n)) go(n - 1);
            }}
            className="w-16 rounded-md border border-gray-300 px-2 py-1 text-center"
            aria-label="Go to response number"
          />
          <span>of {total}</span>
        </div>
        <button
          type="button"
          onClick={() => go(current + 1)}
          disabled={current >= total - 1}
          className="rounded-md border border-gray-300 bg-white px-3 py-1 text-sm font-medium text-gray-700 transition hover:bg-gray-100 disabled:opacity-40"
        >
          Next ›
        </button>
      </div>

      {/* The selected student's full response */}
      <div className="rounded-lg border border-gray-200 p-3">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <div>
            <span className="text-sm font-medium text-gray-900">
              {respondentLabel(r, current)}
            </span>
            {when && <span className="ml-2 text-xs text-gray-400">{when}</span>}
          </div>
          {r.totalScore !== null && (
            <Badge color="blue">Score: {r.totalScore}</Badge>
          )}
        </div>
        <ol className="space-y-2">
          {questions.map((q) => {
            const a = r.answers[q.index];
            return (
              <li key={q.index} className="text-sm">
                <p className="text-gray-700">{q.title}</p>
                <p className="mt-0.5 flex items-center gap-2 pl-3">
                  <AnswerText value={a?.value ?? ""} />
                  <CorrectMark correct={a?.correct ?? null} />
                  {a?.score !== null && a?.score !== undefined && (
                    <span className="text-xs text-gray-400">
                      {a.score} pt{a.score === 1 ? "" : "s"}
                    </span>
                  )}
                </p>
                {q.keywords.length > 0 && (
                  <KeywordRubric
                    key={`${q.index}:${a?.value ?? ""}`}
                    keywords={q.keywords}
                    answer={a?.value ?? ""}
                    maxPoints={q.maxPoints}
                  />
                )}
                {aiEnabled && isOpen(q.type) && (a?.value ?? "").trim() && (
                  <AiGrade
                    key={`ai:${q.index}:${a?.value ?? ""}`}
                    examId={examId}
                    questionIndex={q.index}
                    answer={a?.value ?? ""}
                  />
                )}
              </li>
            );
          })}
        </ol>
      </div>
    </div>
  );
}

// "By question" view: shows ONE question at a time with a prev/next navigator
// ("‹ N of M ›") plus a dropdown to jump to any question — mirrors the Google
// Forms "Question" tab. Every student's answer to that question is listed below.
function QuestionView({
  questions,
  responses,
}: {
  questions: ExamResponseQuestion[];
  responses: ExamResponse[];
}) {
  const total = questions.length;
  const [idx, setIdx] = useState(0);
  const current = Math.min(Math.max(idx, 0), total - 1);
  const q = questions[current];

  function go(to: number) {
    setIdx(Math.min(Math.max(to, 0), total - 1));
  }

  return (
    <div className="space-y-3">
      {/* Question navigator: dropdown + prev/next */}
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
        <select
          value={current}
          onChange={(e) => go(Number(e.target.value))}
          className="min-w-0 max-w-[60%] flex-1 truncate rounded-md border border-gray-300 bg-white px-2 py-1 text-sm text-gray-700"
          aria-label="Select question"
        >
          {questions.map((qq, i) => (
            <option key={qq.index} value={i}>
              {i + 1}. {qq.title}
            </option>
          ))}
        </select>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => go(current - 1)}
            disabled={current === 0}
            className="rounded-md border border-gray-300 bg-white px-3 py-1 text-sm font-medium text-gray-700 transition hover:bg-gray-100 disabled:opacity-40"
          >
            ‹
          </button>
          <span className="text-sm text-gray-600">
            {current + 1} of {total}
          </span>
          <button
            type="button"
            onClick={() => go(current + 1)}
            disabled={current >= total - 1}
            className="rounded-md border border-gray-300 bg-white px-3 py-1 text-sm font-medium text-gray-700 transition hover:bg-gray-100 disabled:opacity-40"
          >
            ›
          </button>
        </div>
      </div>

      {/* The selected question + every student's answer to it */}
      <div className="rounded-lg border border-gray-200 p-3">
        <p className="mb-2 text-sm font-medium text-gray-900">
          {q.title}
          {q.maxPoints > 0 && (
            <span className="ml-2 text-xs font-normal text-gray-400">
              {q.maxPoints} pt{q.maxPoints === 1 ? "" : "s"}
            </span>
          )}
        </p>
        <ul className="space-y-1">
          {responses.map((r, i) => {
            const a = r.answers[q.index];
            return (
              <li
                key={r.responseId}
                className="flex flex-wrap items-center gap-2 text-sm"
              >
                <span className="min-w-0 truncate text-gray-500">
                  {respondentLabel(r, i)}:
                </span>
                <AnswerText value={a?.value ?? ""} />
                <CorrectMark correct={a?.correct ?? null} />
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
