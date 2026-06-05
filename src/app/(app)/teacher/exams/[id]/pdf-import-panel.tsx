"use client";

import { useActionState, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  generateExamQuestionsFromPdf,
  savePdfQuestionsToExam,
  type PdfImportResult,
} from "@/lib/pdf-actions";
import {
  Button,
  Card,
  CardBody,
  Input,
  Label,
  Select,
  Textarea,
  Badge,
} from "@/components/ui";
import { QUESTION_TYPE_LABELS, LANGUAGES } from "@/lib/labels";

export function PdfImportPanel({
  examId,
  examLanguage,
  enabled,
}: {
  examId: string;
  examLanguage: string;
  enabled: boolean;
}) {
  const router = useRouter();
  const action = generateExamQuestionsFromPdf.bind(null, examId);
  const [state, formAction, pending] = useActionState<
    PdfImportResult | undefined,
    FormData
  >(action, undefined);

  const [language, setLanguage] = useState(examLanguage || "en");
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [adding, startAdding] = useTransition();
  const [addError, setAddError] = useState<string | null>(null);
  const [added, setAdded] = useState<number | null>(null);

  const questions = state && "questions" in state ? state.questions : [];

  // Each new generation (a fresh `state` object) resets the review state. Done
  // during render — the endorsed pattern for syncing state to a changed input.
  const [prevState, setPrevState] = useState(state);
  if (state !== prevState) {
    setPrevState(state);
    setSelected(new Set());
    setAddError(null);
    setAdded(null);
  }

  function toggle(i: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  }

  function addSelected() {
    const chosen = questions.filter((_, i) =>
      selected.size ? selected.has(i) : true,
    );
    setAddError(null);
    startAdding(async () => {
      const res = await savePdfQuestionsToExam(examId, {
        language,
        questions: chosen,
      });
      if ("error" in res) setAddError(res.error);
      else {
        setAdded(res.added);
        router.refresh();
      }
    });
  }

  if (!enabled) {
    return (
      <Card>
        <CardBody>
          <h3 className="mb-1 font-semibold text-gray-900">
            Import questions from a PDF
          </h3>
          <p className="text-sm text-gray-600">
            AI import is disabled. Add{" "}
            <code className="rounded bg-gray-100 px-1">ANTHROPIC_API_KEY</code>{" "}
            to your <code className="rounded bg-gray-100 px-1">.env</code> file
            and restart the server to enable it.
          </p>
        </CardBody>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardBody>
          <h3 className="mb-1 font-semibold text-gray-900">
            Import questions from a PDF
          </h3>
          <p className="mb-3 text-xs text-gray-500">
            Upload a question paper or study material. The AI reads it and drafts
            questions for you to review before they&apos;re added to this exam.
          </p>
          <form action={formAction} className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Label htmlFor="pdf">PDF file</Label>
              <Input
                id="pdf"
                name="pdf"
                type="file"
                accept="application/pdf,.pdf"
                required
              />
            </div>
            <div>
              <Label htmlFor="pdf-language">Language</Label>
              <Select
                id="pdf-language"
                name="language"
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
              >
                {LANGUAGES.map((l) => (
                  <option key={l.code} value={l.code}>
                    {l.label}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="pdf-count">Max questions</Label>
              <Input
                id="pdf-count"
                name="count"
                type="number"
                min="1"
                max="30"
                defaultValue="10"
              />
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="pdf-instructions">
                Instructions (optional)
              </Label>
              <Textarea
                id="pdf-instructions"
                name="instructions"
                rows={2}
                placeholder="e.g. Focus on chapter 3, prefer multiple-choice, keep it for Grade 9…"
              />
            </div>
            <div className="sm:col-span-2">
              <Button type="submit" disabled={pending}>
                {pending ? "Reading PDF…" : "Read PDF"}
              </Button>
            </div>
          </form>
          {state && "error" in state && (
            <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
              {state.error}
            </p>
          )}
        </CardBody>
      </Card>

      {questions.length > 0 && added === null && (
        <Card>
          <CardBody>
            <div className="mb-3 flex items-center justify-between">
              <h3 className="font-semibold text-gray-900">
                Review &amp; add ({questions.length} found)
              </h3>
              <Button onClick={addSelected} disabled={adding} variant="success">
                {adding ? "Adding…" : "Add to exam"}
              </Button>
            </div>
            {addError && (
              <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
                {addError}
              </p>
            )}
            <div className="space-y-3">
              {questions.map((q, i) => {
                const isSelected = selected.size ? selected.has(i) : true;
                return (
                  <label
                    key={i}
                    className="flex cursor-pointer gap-3 rounded-lg border border-gray-200 p-3 hover:bg-gray-50"
                  >
                    <input
                      type="checkbox"
                      className="mt-1 h-4 w-4"
                      checked={isSelected}
                      onChange={() => toggle(i)}
                    />
                    <div
                      className="min-w-0"
                      dir={language === "ar" ? "rtl" : "ltr"}
                    >
                      <div className="mb-1 flex gap-2">
                        <Badge color="blue">
                          {QUESTION_TYPE_LABELS[q.type]}
                        </Badge>
                        <span className="text-xs text-gray-400">
                          {q.points} pt
                        </span>
                      </div>
                      <p className="text-sm text-gray-800">{q.text}</p>
                      {q.type === "MCQ" && q.options && (
                        <ul className="mt-1 space-y-0.5 text-sm text-gray-600">
                          {q.options.map((o, oi) => (
                            <li
                              key={oi}
                              className={
                                String(oi) === q.correctAnswer
                                  ? "font-medium text-green-700"
                                  : ""
                              }
                            >
                              {String.fromCharCode(65 + oi)}. {o}
                              {String(oi) === q.correctAnswer && " ✓"}
                            </li>
                          ))}
                        </ul>
                      )}
                      {q.type === "TRUE_FALSE" && q.correctAnswer && (
                        <p className="mt-1 text-sm text-green-700">
                          Answer: {q.correctAnswer === "true" ? "True" : "False"}
                        </p>
                      )}
                      {(q.type === "SHORT_ANSWER" || q.type === "ESSAY") &&
                        q.modelAnswer && (
                          <p className="mt-1 text-sm text-gray-500">
                            Model: {q.modelAnswer}
                          </p>
                        )}
                    </div>
                  </label>
                );
              })}
            </div>
          </CardBody>
        </Card>
      )}

      {added !== null && (
        <Card className="border-green-200 bg-green-50">
          <CardBody className="text-sm text-green-800">
            Added {added} question{added === 1 ? "" : "s"} to the exam — see the
            list below. Upload another PDF to add more.
          </CardBody>
        </Card>
      )}
    </div>
  );
}
