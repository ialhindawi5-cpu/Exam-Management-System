"use client";

import { useActionState } from "react";
import { updateExamMeta, type ExamFormState } from "@/lib/exam-actions";
import {
  Button,
  Card,
  CardBody,
  Input,
  Label,
  Select,
  Textarea,
} from "@/components/ui";
import { LANGUAGES } from "@/lib/labels";

export type ExamMeta = {
  id: string;
  title: string;
  description: string | null;
  subjectId: string | null;
  language: string;
  totalMarks: number;
  durationMins: number | null;
};

export function ExamMetaForm({
  exam,
  subjects,
}: {
  exam: ExamMeta;
  subjects: { id: string; name: string }[];
}) {
  const action = updateExamMeta.bind(null, exam.id);
  const [state, formAction, pending] = useActionState<ExamFormState, FormData>(
    action,
    undefined,
  );

  return (
    <Card>
      <CardBody>
        <details>
          <summary className="cursor-pointer font-semibold text-gray-900">
            Exam details
          </summary>
          <form action={formAction} className="mt-4 space-y-4">
            <div>
              <Label htmlFor="title">Title</Label>
              <Input id="title" name="title" defaultValue={exam.title} required />
            </div>
            <div>
              <Label htmlFor="description">Description / instructions</Label>
              <Textarea
                id="description"
                name="description"
                rows={4}
                defaultValue={exam.description ?? ""}
                placeholder="e.g. Read each question carefully. No calculators allowed."
              />
              <p className="mt-1 text-xs text-gray-500">
                Shown at the top of the generated Google Form, below the
                auto-added school name, total marks and duration.
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="subjectId">Subject</Label>
                <Select id="subjectId" name="subjectId" defaultValue={exam.subjectId ?? ""}>
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
                <Select id="language" name="language" defaultValue={exam.language}>
                  {LANGUAGES.map((l) => (
                    <option key={l.code} value={l.code}>
                      {l.label}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <Label htmlFor="totalMarks">Total marks</Label>
                <Input
                  id="totalMarks"
                  name="totalMarks"
                  type="number"
                  min="1"
                  defaultValue={exam.totalMarks}
                />
              </div>
              <div>
                <Label htmlFor="durationMins">Duration (min)</Label>
                <Input
                  id="durationMins"
                  name="durationMins"
                  type="number"
                  min="1"
                  defaultValue={exam.durationMins ?? ""}
                />
              </div>
            </div>
            {state?.error && (
              <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
                {state.error}
              </p>
            )}
            <Button type="submit" disabled={pending}>
              {pending ? "Saving…" : "Save details"}
            </Button>
          </form>
        </details>
      </CardBody>
    </Card>
  );
}
