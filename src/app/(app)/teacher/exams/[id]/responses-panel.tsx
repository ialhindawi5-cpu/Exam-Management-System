"use client";

import { useState, useTransition } from "react";
import {
  getExamResponses,
  type ExamResponseQuestion,
} from "@/lib/exam-actions";
import type { ExamResponse } from "@/lib/google-forms";
import { Card, CardBody, Button, Badge } from "@/components/ui";

type View = "student" | "question";

export function ResponsesPanel({ examId }: { examId: string }) {
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

  return (
    <Card>
      <CardBody>
        <div className="mb-3 flex items-center justify-between gap-3">
          <h3 className="font-semibold text-gray-900">Student responses</h3>
          {loaded && (
            <Badge color={responses.length ? "green" : "gray"}>
              {responses.length} response{responses.length === 1 ? "" : "s"}
            </Badge>
          )}
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
              <StudentView questions={questions} responses={responses} />
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

// One card per submission, listing every question and that student's answer.
function StudentView({
  questions,
  responses,
}: {
  questions: ExamResponseQuestion[];
  responses: ExamResponse[];
}) {
  return (
    <div className="space-y-4">
      {responses.map((r, i) => {
        const when = formatTime(r.submittedAt);
        return (
          <div
            key={r.responseId}
            className="rounded-lg border border-gray-200 p-3"
          >
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <div>
                <span className="text-sm font-medium text-gray-900">
                  {respondentLabel(r, i)}
                </span>
                {when && (
                  <span className="ml-2 text-xs text-gray-400">{when}</span>
                )}
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
                  </li>
                );
              })}
            </ol>
          </div>
        );
      })}
    </div>
  );
}

// One block per question, listing every student's answer underneath.
function QuestionView({
  questions,
  responses,
}: {
  questions: ExamResponseQuestion[];
  responses: ExamResponse[];
}) {
  return (
    <div className="space-y-4">
      {questions.map((q) => (
        <div key={q.index} className="rounded-lg border border-gray-200 p-3">
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
      ))}
    </div>
  );
}
