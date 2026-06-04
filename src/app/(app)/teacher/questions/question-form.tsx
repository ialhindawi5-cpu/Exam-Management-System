"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import {
  saveQuestion,
  type QuestionFormState,
  type Keyword,
} from "@/lib/question-actions";
import {
  Button,
  Card,
  CardBody,
  Input,
  Label,
  Select,
  Textarea,
} from "@/components/ui";
import { QUESTION_TYPES, DIFFICULTIES, QUESTION_TYPE_LABELS, DIFFICULTY_LABELS, LANGUAGES } from "@/lib/labels";
import { ImageUpload } from "@/components/image-upload";
import type { QuestionType, Difficulty } from "@prisma/client";

export type QuestionDefaults = {
  id?: string;
  type: QuestionType;
  difficulty: Difficulty;
  subjectId: string | null;
  language: string;
  text: string;
  imageUrl: string | null;
  points: number;
  required: boolean;
  options: string[];
  correctIndex: number; // single-correct types (MCQ / Dropdown)
  correctIndices: number[]; // multi-correct types (Checkboxes)
  tfAnswer: "true" | "false";
  modelAnswer: string;
  keywords: Keyword[]; // open types: keyword rubric
};

export function QuestionForm({
  subjects,
  defaults,
}: {
  subjects: { id: string; name: string }[];
  defaults: QuestionDefaults;
}) {
  const [state, action, pending] = useActionState<QuestionFormState, FormData>(
    saveQuestion,
    undefined,
  );

  const [type, setType] = useState<QuestionType>(defaults.type);
  const [options, setOptions] = useState<string[]>(
    defaults.options.length ? defaults.options : ["", ""],
  );
  const [correctIndex, setCorrectIndex] = useState(defaults.correctIndex);
  const [correctSet, setCorrectSet] = useState<Set<number>>(
    new Set(defaults.correctIndices),
  );

  // Choice-based types share one options editor; checkboxes allow many correct.
  const isMulti = type === "CHECKBOX";
  const isChoice = type === "MCQ" || type === "DROPDOWN" || type === "CHECKBOX";

  function updateOption(i: number, value: string) {
    setOptions((prev) => prev.map((o, idx) => (idx === i ? value : o)));
  }
  function addOption() {
    setOptions((prev) => [...prev, ""]);
  }
  function removeOption(i: number) {
    setOptions((prev) => prev.filter((_, idx) => idx !== i));
    setCorrectIndex((ci) => (i < ci ? ci - 1 : i === ci ? 0 : ci));
    // Drop the removed index and shift everything after it down by one.
    setCorrectSet((prev) => {
      const next = new Set<number>();
      for (const idx of prev) {
        if (idx === i) continue;
        next.add(idx > i ? idx - 1 : idx);
      }
      return next;
    });
  }
  function toggleCorrect(i: number) {
    setCorrectSet((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  }

  const correctAnswerValue = isMulti
    ? Array.from(correctSet)
        .sort((a, b) => a - b)
        .join(",")
    : String(correctIndex);

  // Keyword rubric for open (Short / Long answer) questions.
  const isOpen = type === "SHORT_ANSWER" || type === "ESSAY";
  const [keywords, setKeywords] = useState<Keyword[]>(defaults.keywords);

  function addKeyword() {
    setKeywords((prev) => [...prev, { text: "", points: 1 }]);
  }
  function removeKeyword(i: number) {
    setKeywords((prev) => prev.filter((_, idx) => idx !== i));
  }
  function updateKeyword(i: number, field: "text" | "points", value: string) {
    setKeywords((prev) =>
      prev.map((k, idx) =>
        idx === i
          ? { ...k, [field]: field === "points" ? Number(value) : value }
          : k,
      ),
    );
  }

  return (
    <Card>
      <CardBody>
        <form action={action} className="space-y-5">
          {defaults.id && <input type="hidden" name="id" value={defaults.id} />}

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="type">Question type</Label>
              <Select
                id="type"
                name="type"
                value={type}
                onChange={(e) => setType(e.target.value as QuestionType)}
              >
                {QUESTION_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {QUESTION_TYPE_LABELS[t]}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="difficulty">Difficulty</Label>
              <Select id="difficulty" name="difficulty" defaultValue={defaults.difficulty}>
                {DIFFICULTIES.map((d) => (
                  <option key={d} value={d}>
                    {DIFFICULTY_LABELS[d]}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="subjectId">Subject</Label>
              <Select id="subjectId" name="subjectId" defaultValue={defaults.subjectId ?? ""}>
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
              <Select id="language" name="language" defaultValue={defaults.language}>
                {LANGUAGES.map((l) => (
                  <option key={l.code} value={l.code}>
                    {l.label}
                  </option>
                ))}
              </Select>
            </div>
          </div>

          <div>
            <Label htmlFor="text">Question text</Label>
            <Textarea id="text" name="text" rows={3} defaultValue={defaults.text} required />
          </div>

          <div>
            <Label>Question image (optional)</Label>
            <ImageUpload name="imageUrl" initial={defaults.imageUrl} label="Image" />
          </div>

          <div className="flex items-end gap-6">
            <div className="w-40">
              <Label htmlFor="points">Points</Label>
              <Input
                id="points"
                name="points"
                type="number"
                min="0.5"
                step="0.5"
                defaultValue={defaults.points}
                required
              />
            </div>
            <label className="flex items-center gap-2 pb-2 text-sm text-gray-700">
              <input
                type="checkbox"
                name="required"
                defaultChecked={defaults.required}
                className="h-4 w-4"
              />
              Required (students must answer)
            </label>
          </div>

          {isChoice && (
            <div>
              <Label>
                {isMulti
                  ? "Options (check every correct answer)"
                  : "Options (select the correct one)"}
              </Label>
              {/* Carries the encoded correct answer(s) to the server. */}
              <input type="hidden" name="correctAnswer" value={correctAnswerValue} />
              <div className="space-y-2">
                {options.map((opt, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <input
                      type={isMulti ? "checkbox" : "radio"}
                      checked={isMulti ? correctSet.has(i) : correctIndex === i}
                      onChange={() => (isMulti ? toggleCorrect(i) : setCorrectIndex(i))}
                      className="h-4 w-4"
                      aria-label={`Mark option ${i + 1} correct`}
                    />
                    <Input
                      name="option"
                      value={opt}
                      onChange={(e) => updateOption(i, e.target.value)}
                      placeholder={`Option ${i + 1}`}
                    />
                    {options.length > 2 && (
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={() => removeOption(i)}
                      >
                        ✕
                      </Button>
                    )}
                  </div>
                ))}
              </div>
              <Button type="button" variant="secondary" className="mt-2" onClick={addOption}>
                + Add option
              </Button>
            </div>
          )}

          {type === "TRUE_FALSE" && (
            <div>
              <Label htmlFor="tf">Correct answer</Label>
              <Select id="tf" name="correctAnswer" defaultValue={defaults.tfAnswer} className="w-40">
                <option value="true">True</option>
                <option value="false">False</option>
              </Select>
            </div>
          )}

          {isOpen && (
            <>
              <div>
                <Label htmlFor="modelAnswer">
                  Model answer / rubric{" "}
                  <span className="font-normal text-gray-400">
                    (used for AI-assisted grading)
                  </span>
                </Label>
                <Textarea
                  id="modelAnswer"
                  name="modelAnswer"
                  rows={4}
                  defaultValue={defaults.modelAnswer}
                />
              </div>

              <div>
                <Label>
                  Keyword rubric{" "}
                  <span className="font-normal text-gray-400">
                    (each keyword found in a student&apos;s answer awards its
                    points when grading)
                  </span>
                </Label>
                {/* Carries the rubric to the server as JSON. */}
                <input
                  type="hidden"
                  name="keywords"
                  value={JSON.stringify(keywords)}
                />
                <div className="space-y-2">
                  {keywords.map((kw, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <Input
                        value={kw.text}
                        onChange={(e) => updateKeyword(i, "text", e.target.value)}
                        placeholder={`Keyword ${i + 1}`}
                      />
                      <Input
                        type="number"
                        min="0"
                        step="0.5"
                        className="w-24"
                        value={kw.points}
                        onChange={(e) =>
                          updateKeyword(i, "points", e.target.value)
                        }
                        aria-label="Points for this keyword"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={() => removeKeyword(i)}
                      >
                        ✕
                      </Button>
                    </div>
                  ))}
                </div>
                <Button
                  type="button"
                  variant="secondary"
                  className="mt-2"
                  onClick={addKeyword}
                >
                  + Add keyword
                </Button>
                {keywords.length === 0 && (
                  <p className="mt-1 text-xs text-gray-400">
                    Optional. Add keywords to grade this answer automatically in
                    the responses panel.
                  </p>
                )}
              </div>
            </>
          )}

          {state?.error && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
              {state.error}
            </p>
          )}

          <div className="flex gap-3">
            <Button type="submit" disabled={pending}>
              {pending ? "Saving…" : "Save question"}
            </Button>
            <Link href="/teacher/questions">
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
