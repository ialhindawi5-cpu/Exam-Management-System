"use client";

import { useState, useTransition } from "react";
import {
  aiGradeSubmission,
  setAnswerScore,
  finalizeSubmission,
} from "@/lib/grading-actions";
import {
  Button,
  Card,
  CardBody,
  Input,
  Textarea,
  Badge,
} from "@/components/ui";
import { QUESTION_TYPE_LABELS, aiEnabledHint } from "@/lib/labels";
import type { QuestionType } from "@prisma/client";

export type GradeAnswer = {
  id: string;
  type: QuestionType;
  questionText: string;
  imageUrl: string | null;
  language: string;
  options: string[];
  correctAnswer: string | null;
  response: string | null;
  maxPoints: number;
  autoScore: number | null;
  finalScore: number | null;
  feedback: string | null;
  aiGraded: boolean;
  isObjective: boolean;
};

function AnswerRow({ answer, index }: { answer: GradeAnswer; index: number }) {
  const [score, setScore] = useState(
    answer.finalScore != null ? String(answer.finalScore) : "",
  );
  const [feedback, setFeedback] = useState(answer.feedback ?? "");
  const [pending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);

  const dir = answer.language === "ar" ? "rtl" : "ltr";
  const studentText =
    answer.type === "MCQ" && answer.response != null
      ? (answer.options[Number(answer.response)] ?? "—")
      : answer.type === "TRUE_FALSE"
        ? answer.response === "true"
          ? "True"
          : answer.response === "false"
            ? "False"
            : "—"
        : (answer.response ?? "—");

  const correctText =
    answer.type === "MCQ" && answer.correctAnswer != null
      ? answer.options[Number(answer.correctAnswer)]
      : answer.type === "TRUE_FALSE"
        ? answer.correctAnswer === "true"
          ? "True"
          : "False"
        : null;

  return (
    <Card>
      <CardBody>
        <div className="mb-2 flex items-start justify-between gap-3">
          <p className="font-medium text-gray-900" dir={dir}>
            <span className="text-gray-400">{index + 1}. </span>
            {answer.questionText}
          </p>
          <div className="flex shrink-0 items-center gap-2">
            <Badge color="blue">{QUESTION_TYPE_LABELS[answer.type]}</Badge>
            {answer.aiGraded && <Badge color="purple">AI graded</Badge>}
          </div>
        </div>

        {answer.imageUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={answer.imageUrl}
            alt="Question image"
            className="mb-2 max-h-56 rounded-lg border border-gray-200"
          />
        )}
        <div className="mb-1 text-sm" dir={dir}>
          <span className="text-gray-500">Student answer: </span>
          <span className="text-gray-900">{studentText}</span>
        </div>
        {correctText != null && (
          <div className="mb-2 text-sm" dir={dir}>
            <span className="text-gray-500">Correct: </span>
            <span className="text-green-700">{correctText}</span>
          </div>
        )}

        <div className="mt-3 flex flex-wrap items-end gap-3">
          <div className="w-28">
            <label className="mb-1 block text-xs font-medium text-gray-600">
              Score / {answer.maxPoints}
            </label>
            <Input
              type="number"
              min="0"
              max={answer.maxPoints}
              step="0.5"
              value={score}
              onChange={(e) => {
                setScore(e.target.value);
                setSaved(false);
              }}
            />
          </div>
          <div className="min-w-[240px] flex-1">
            <label className="mb-1 block text-xs font-medium text-gray-600">
              Feedback (optional)
            </label>
            <Textarea
              rows={2}
              value={feedback}
              onChange={(e) => {
                setFeedback(e.target.value);
                setSaved(false);
              }}
            />
          </div>
          <Button
            variant="secondary"
            disabled={pending || score === ""}
            onClick={() =>
              startTransition(async () => {
                await setAnswerScore(answer.id, Number(score), feedback);
                setSaved(true);
              })
            }
          >
            {pending ? "Saving…" : saved ? "Saved ✓" : "Save"}
          </Button>
        </div>
      </CardBody>
    </Card>
  );
}

export function GradingPanel({
  submissionId,
  answers,
  status,
  aiEnabled,
}: {
  submissionId: string;
  answers: GradeAnswer[];
  status: string;
  aiEnabled: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const hasOpen = answers.some((a) => !a.isObjective);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {hasOpen && (
          <Button
            disabled={pending || !aiEnabled}
            title={aiEnabled ? "" : aiEnabledHint}
            onClick={() => {
              setMsg(null);
              startTransition(async () => {
                const res = await aiGradeSubmission(submissionId);
                setMsg(
                  "error" in res
                    ? res.error
                    : `AI graded ${res.graded} open answer(s).`,
                );
              });
            }}
          >
            ✨ AI-grade open answers
          </Button>
        )}
        <Button
          variant="success"
          disabled={pending}
          onClick={() => {
            setMsg(null);
            startTransition(async () => {
              const res = await finalizeSubmission(submissionId);
              setMsg("error" in res ? res.error : "Submission finalized.");
            });
          }}
        >
          {status === "GRADED" ? "Re-finalize" : "Finalize grading"}
        </Button>
        {msg && <span className="text-sm text-gray-600">{msg}</span>}
      </div>

      {answers.map((a, i) => (
        <AnswerRow
          key={`${a.id}:${a.finalScore}:${a.aiGraded}:${a.feedback ?? ""}`}
          answer={a}
          index={i}
        />
      ))}
    </div>
  );
}
