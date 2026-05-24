"use client";

import { useState, useTransition } from "react";
import {
  setFinalMark,
  setStudentGrade,
  setSubmissionReleased,
} from "@/lib/grading-actions";
import { Button, Card, CardBody, Input, Select, Label, Badge } from "@/components/ui";
import { GRADE_LEVELS } from "@/lib/labels";

export function ResultControls({
  submissionId,
  totalMarks,
  displayScore,
  isOverridden,
  gradeLevel,
  released,
}: {
  submissionId: string;
  totalMarks: number;
  displayScore: number;
  isOverridden: boolean;
  gradeLevel: string | null;
  released: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [mark, setMark] = useState(String(displayScore));
  const [grade, setGrade] = useState(gradeLevel ?? "");
  const [msg, setMsg] = useState<string | null>(null);

  function run(fn: () => Promise<unknown>, okMsg: string) {
    setMsg(null);
    startTransition(async () => {
      const res = (await fn()) as { error?: string } | undefined;
      setMsg(res && "error" in res && res.error ? res.error : okMsg);
    });
  }

  return (
    <Card className="mb-6">
      <CardBody className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-gray-900">Result controls</h3>
          <Badge color={released ? "green" : "gray"}>
            {released ? "Released to student" : "Not released"}
          </Badge>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          {/* Final mark override */}
          <div>
            <Label htmlFor="finalMark">Final mark / {totalMarks}</Label>
            <div className="flex gap-2">
              <Input
                id="finalMark"
                type="number"
                min="0"
                max={totalMarks}
                step="0.25"
                value={mark}
                onChange={(e) => setMark(e.target.value)}
              />
              <Button
                variant="secondary"
                disabled={pending}
                onClick={() =>
                  run(() => setFinalMark(submissionId, Number(mark)), "Mark saved.")
                }
              >
                Set
              </Button>
            </div>
            {isOverridden ? (
              <button
                type="button"
                className="mt-1 text-xs text-brand hover:underline"
                onClick={() =>
                  run(() => setFinalMark(submissionId, null), "Reverted to computed score.")
                }
              >
                Revert to computed score
              </button>
            ) : (
              <p className="mt-1 text-xs text-gray-400">Computed from question scores.</p>
            )}
          </div>

          {/* Student grade level */}
          <div>
            <Label htmlFor="grade">Student grade / class</Label>
            <div className="flex gap-2">
              <Select id="grade" value={grade} onChange={(e) => setGrade(e.target.value)}>
                <option value="">— Not set —</option>
                {GRADE_LEVELS.map((g) => (
                  <option key={g} value={g}>
                    {g}
                  </option>
                ))}
              </Select>
              <Button
                variant="secondary"
                disabled={pending}
                onClick={() =>
                  run(() => setStudentGrade(submissionId, grade || null), "Grade saved.")
                }
              >
                Save
              </Button>
            </div>
          </div>

          {/* Release toggle */}
          <div>
            <Label>Release</Label>
            {released ? (
              <Button
                variant="secondary"
                disabled={pending}
                className="w-full"
                onClick={() =>
                  run(() => setSubmissionReleased(submissionId, false), "Result hidden from student.")
                }
              >
                Hide from student
              </Button>
            ) : (
              <Button
                variant="success"
                disabled={pending}
                className="w-full"
                onClick={() =>
                  run(() => setSubmissionReleased(submissionId, true), "Result released to student.")
                }
              >
                Release to student
              </Button>
            )}
          </div>
        </div>

        {msg && <p className="text-sm text-gray-600">{msg}</p>}
      </CardBody>
    </Card>
  );
}
