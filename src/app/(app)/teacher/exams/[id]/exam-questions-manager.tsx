"use client";

import { useMemo, useState, useTransition } from "react";
import {
  addQuestion,
  removeQuestion,
  autoFillByDifficulty,
} from "@/lib/exam-actions";
import {
  Button,
  Card,
  CardBody,
  Input,
  Label,
  Select,
  Badge,
} from "@/components/ui";
import {
  QUESTION_TYPE_LABELS,
  DIFFICULTY_LABELS,
} from "@/lib/labels";
import type { QuestionType, Difficulty } from "@prisma/client";

export type QuestionLite = {
  id: string;
  type: QuestionType;
  text: string;
  difficulty: Difficulty;
  points: number;
  language: string;
  subjectName?: string | null;
};

const diffColor: Record<Difficulty, "green" | "yellow" | "red"> = {
  EASY: "green",
  MEDIUM: "yellow",
  HARD: "red",
};

export function ExamQuestionsManager({
  examId,
  current,
  available,
  subjects,
}: {
  examId: string;
  current: QuestionLite[];
  available: QuestionLite[];
  subjects: { id: string; name: string }[];
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  // Auto-fill inputs
  const [easy, setEasy] = useState(0);
  const [medium, setMedium] = useState(0);
  const [hard, setHard] = useState(0);
  const [subjectId, setSubjectId] = useState("");

  const totalPoints = useMemo(
    () => current.reduce((sum, q) => sum + q.points, 0),
    [current],
  );

  const filtered = useMemo(() => {
    const s = search.toLowerCase();
    return available.filter((q) => q.text.toLowerCase().includes(s));
  }, [available, search]);

  function run(fn: () => Promise<unknown>) {
    setError(null);
    startTransition(async () => {
      const res = (await fn()) as { error?: string } | undefined;
      if (res && "error" in res && res.error) setError(res.error);
    });
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
      {/* Current questions */}
      <div>
        <div className="mb-2 flex items-center justify-between">
          <h3 className="font-semibold text-gray-900">
            Exam questions ({current.length})
          </h3>
          <span className="text-sm text-gray-500">
            {totalPoints} raw points
          </span>
        </div>
        {error && (
          <p className="mb-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        )}
        {current.length === 0 ? (
          <div className="rounded-xl border border-dashed border-gray-300 bg-white p-8 text-center text-sm text-gray-500">
            No questions yet. Add from your bank or auto-fill by difficulty.
          </div>
        ) : (
          <ol className="space-y-2">
            {current.map((q, i) => (
              <li
                key={q.id}
                className="flex items-start justify-between gap-3 rounded-xl border border-gray-200 bg-white p-3"
              >
                <div className="min-w-0">
                  <div className="mb-1 flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold text-gray-400">
                      {i + 1}.
                    </span>
                    <Badge color="blue">{QUESTION_TYPE_LABELS[q.type]}</Badge>
                    <Badge color={diffColor[q.difficulty]}>
                      {DIFFICULTY_LABELS[q.difficulty]}
                    </Badge>
                    <span className="text-xs text-gray-400">{q.points} pt</span>
                  </div>
                  <p
                    className="text-sm text-gray-800"
                    dir={q.language === "ar" ? "rtl" : "ltr"}
                  >
                    {q.text}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  disabled={pending}
                  onClick={() => run(() => removeQuestion(examId, q.id))}
                >
                  Remove
                </Button>
              </li>
            ))}
          </ol>
        )}
      </div>

      {/* Tools */}
      <div className="space-y-6">
        <Card>
          <CardBody>
            <h3 className="mb-1 font-semibold text-gray-900">
              Auto-fill by difficulty
            </h3>
            <p className="mb-3 text-xs text-gray-500">
              Pull random questions from your bank to hit a complexity mix.
            </p>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <Label htmlFor="easy">Easy</Label>
                <Input
                  id="easy"
                  type="number"
                  min="0"
                  value={easy}
                  onChange={(e) => setEasy(Number(e.target.value))}
                />
              </div>
              <div>
                <Label htmlFor="medium">Medium</Label>
                <Input
                  id="medium"
                  type="number"
                  min="0"
                  value={medium}
                  onChange={(e) => setMedium(Number(e.target.value))}
                />
              </div>
              <div>
                <Label htmlFor="hard">Hard</Label>
                <Input
                  id="hard"
                  type="number"
                  min="0"
                  value={hard}
                  onChange={(e) => setHard(Number(e.target.value))}
                />
              </div>
            </div>
            <div className="mt-2">
              <Label htmlFor="autofill-subject">Limit to subject (optional)</Label>
              <Select
                id="autofill-subject"
                value={subjectId}
                onChange={(e) => setSubjectId(e.target.value)}
              >
                <option value="">Any subject</option>
                {subjects.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </Select>
            </div>
            <Button
              className="mt-3 w-full"
              disabled={pending || easy + medium + hard === 0}
              onClick={() =>
                run(() =>
                  autoFillByDifficulty(
                    examId,
                    { EASY: easy, MEDIUM: medium, HARD: hard },
                    { subjectId: subjectId || null },
                  ),
                )
              }
            >
              Auto-fill
            </Button>
          </CardBody>
        </Card>

        <Card>
          <CardBody>
            <h3 className="mb-2 font-semibold text-gray-900">Add from bank</h3>
            <Input
              placeholder="Search questions…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <div className="mt-3 max-h-96 space-y-2 overflow-y-auto">
              {filtered.length === 0 ? (
                <p className="text-sm text-gray-500">
                  No more questions available.
                </p>
              ) : (
                filtered.map((q) => (
                  <div
                    key={q.id}
                    className="flex items-start justify-between gap-2 rounded-lg border border-gray-200 p-2"
                  >
                    <div className="min-w-0">
                      <div className="flex gap-1.5">
                        <Badge color={diffColor[q.difficulty]}>
                          {DIFFICULTY_LABELS[q.difficulty]}
                        </Badge>
                        <span className="text-xs text-gray-400">{q.points} pt</span>
                      </div>
                      <p className="mt-1 line-clamp-2 text-xs text-gray-700">
                        {q.text}
                      </p>
                    </div>
                    <Button
                      variant="secondary"
                      disabled={pending}
                      onClick={() => run(() => addQuestion(examId, q.id))}
                    >
                      Add
                    </Button>
                  </div>
                ))
              )}
            </div>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
