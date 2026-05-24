"use client";

import { useActionState } from "react";
import Link from "next/link";
import { createExam, type ExamFormState } from "@/lib/exam-actions";
import {
  Button,
  Card,
  CardBody,
  Input,
  Label,
  Select,
  Textarea,
} from "@/components/ui";
import { LANGUAGES, DEFAULT_TOTAL_MARKS } from "@/lib/labels";

export function ExamCreateForm({
  subjects,
}: {
  subjects: { id: string; name: string }[];
}) {
  const [state, action, pending] = useActionState<ExamFormState, FormData>(
    createExam,
    undefined,
  );

  return (
    <Card>
      <CardBody>
        <form action={action} className="space-y-5">
          <div>
            <Label htmlFor="title">Exam title</Label>
            <Input id="title" name="title" placeholder="e.g. Grade 9 — Mathematics Midterm" required />
          </div>
          <div>
            <Label htmlFor="description">Description (optional)</Label>
            <Textarea id="description" name="description" rows={2} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="subjectId">Subject</Label>
              <Select id="subjectId" name="subjectId" defaultValue="">
                <option value="">— None —</option>
                {subjects.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="language">Language</Label>
              <Select id="language" name="language" defaultValue="en">
                {LANGUAGES.map((l) => (
                  <option key={l.code} value={l.code}>
                    {l.label}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="totalMarks">Total marks (scale)</Label>
              <Input
                id="totalMarks"
                name="totalMarks"
                type="number"
                min="1"
                step="1"
                defaultValue={DEFAULT_TOTAL_MARKS}
              />
              <p className="mt-1 text-xs text-gray-400">
                Final scores scale to this. Lebanese default is 20.
              </p>
            </div>
            <div>
              <Label htmlFor="durationMins">Duration (minutes, optional)</Label>
              <Input id="durationMins" name="durationMins" type="number" min="1" />
            </div>
          </div>

          {state?.error && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
              {state.error}
            </p>
          )}

          <div className="flex gap-3">
            <Button type="submit" disabled={pending}>
              {pending ? "Creating…" : "Create & add questions"}
            </Button>
            <Link href="/teacher/exams">
              <Button type="button" variant="secondary">
                Cancel
              </Button>
            </Link>
          </div>
        </form>
      </CardBody>
    </Card>
  );
}
