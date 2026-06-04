"use client";

import { useActionState, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { generateDrafts, saveGenerated, type GenerateResult } from "@/lib/ai-actions";
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
  AI_QUESTION_TYPES,
  DIFFICULTIES,
  QUESTION_TYPE_LABELS,
  DIFFICULTY_LABELS,
  LANGUAGES,
} from "@/lib/labels";

export function GeneratePanel({
  subjects,
  enabled,
}: {
  subjects: { id: string; name: string }[];
  enabled: boolean;
}) {
  const router = useRouter();
  const [state, action, pending] = useActionState<
    GenerateResult | undefined,
    FormData
  >(generateDrafts, undefined);

  const [subjectId, setSubjectId] = useState("");
  const [language, setLanguage] = useState("en");
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [saving, startSaving] = useTransition();
  const [saveError, setSaveError] = useState<string | null>(null);

  const questions = state && "questions" in state ? state.questions : [];

  // Default all generated questions to selected.
  function toggle(i: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  }

  function saveSelected() {
    const chosen = questions.filter((_, i) =>
      selected.size ? selected.has(i) : true,
    );
    setSaveError(null);
    startSaving(async () => {
      const res = await saveGenerated({
        subjectId: subjectId || null,
        language,
        questions: chosen,
      });
      if ("error" in res) setSaveError(res.error);
      else router.push("/teacher/questions");
    });
  }

  if (!enabled) {
    return (
      <Card>
        <CardBody>
          <p className="text-sm text-gray-600">
            AI generation is disabled. Add{" "}
            <code className="rounded bg-gray-100 px-1">ANTHROPIC_API_KEY</code> to
            your <code className="rounded bg-gray-100 px-1">.env</code> file and
            restart the server to enable it.
          </p>
        </CardBody>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardBody>
          <form action={action} className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Label htmlFor="topic">Topic</Label>
              <Input
                id="topic"
                name="topic"
                placeholder="e.g. Photosynthesis, Pythagorean theorem…"
                required
              />
            </div>
            <div>
              <Label htmlFor="subjectId">Subject</Label>
              <Select
                id="subjectId"
                name="subjectId"
                value={subjectId}
                onChange={(e) => setSubjectId(e.target.value)}
              >
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
              <Select
                id="language"
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
              <Label htmlFor="type">Type</Label>
              <Select id="type" name="type" defaultValue="MCQ">
                {AI_QUESTION_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {QUESTION_TYPE_LABELS[t]}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="difficulty">Difficulty</Label>
              <Select id="difficulty" name="difficulty" defaultValue="MEDIUM">
                {DIFFICULTIES.map((d) => (
                  <option key={d} value={d}>
                    {DIFFICULTY_LABELS[d]}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="count">How many</Label>
              <Input
                id="count"
                name="count"
                type="number"
                min="1"
                max="10"
                defaultValue="5"
              />
            </div>
            <div className="sm:col-span-2">
              <Button type="submit" disabled={pending}>
                {pending ? "Generating…" : "Generate"}
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

      {questions.length > 0 && (
        <Card>
          <CardBody>
            <div className="mb-3 flex items-center justify-between">
              <h3 className="font-semibold text-gray-900">
                Review &amp; save ({questions.length} generated)
              </h3>
              <Button onClick={saveSelected} disabled={saving} variant="success">
                {saving ? "Saving…" : "Save selected"}
              </Button>
            </div>
            {saveError && (
              <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
                {saveError}
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
                    <div className="min-w-0" dir={language === "ar" ? "rtl" : "ltr"}>
                      <div className="mb-1 flex gap-2">
                        <Badge color="blue">{QUESTION_TYPE_LABELS[q.type]}</Badge>
                        <span className="text-xs text-gray-400">{q.points} pt</span>
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
                      {q.type === "TRUE_FALSE" && (
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
    </div>
  );
}
