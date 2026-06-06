"use client";

import { useState, useTransition } from "react";
import {
  createOrSyncGoogleForm,
  releaseExamAnswerKey,
  setExamEmailCollection,
} from "@/lib/exam-actions";
import { Card, CardBody, Button, Badge } from "@/components/ui";
import type { ExamStatus } from "@prisma/client";

export type GoogleFormInfo = {
  url: string | null;
  editUrl: string | null;
  answerKeyReleased: boolean;
  // Whether the form collects student emails. null = couldn't be determined.
  collectEmails: boolean | null;
} | null;

export function GoogleFormPanel({
  examId,
  examStatus,
  questionCount,
  googleConfigured,
  connected,
  needsDriveScope,
  googleEmail,
  form,
  notice,
}: {
  examId: string;
  examStatus: ExamStatus;
  questionCount: number;
  googleConfigured: boolean;
  connected: boolean;
  needsDriveScope: boolean;
  googleEmail: string | null;
  form: GoogleFormInfo;
  notice: "connected" | "error" | null;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const connectHref = `/api/google/connect?returnTo=${encodeURIComponent(
    `/teacher/exams/${examId}`,
  )}`;

  function run(fn: () => Promise<{ error?: string } | { ok: true } | { ok: true; url: string | null }>) {
    setError(null);
    startTransition(async () => {
      const res = await fn();
      if (res && "error" in res && res.error) setError(res.error);
    });
  }

  async function copyLink() {
    if (!form?.url) return;
    try {
      await navigator.clipboard.writeText(form.url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard may be unavailable */
    }
  }

  return (
    <Card>
      <CardBody>
        <div className="mb-3 flex items-center justify-between gap-3">
          <h3 className="font-semibold text-gray-900">Google Form</h3>
          {form ? (
            <Badge color="green">Created</Badge>
          ) : connected ? (
            <Badge color="gray">Not created</Badge>
          ) : null}
        </div>

        {notice === "connected" && (
          <p className="mb-3 rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">
            Google account connected.
          </p>
        )}
        {notice === "error" && (
          <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            Could not connect your Google account. Please try again.
          </p>
        )}
        {error && (
          <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        )}

        {!googleConfigured ? (
          <p className="text-sm text-gray-500">
            Google Forms isn&apos;t configured on the server yet. Ask your
            administrator to set <code>GOOGLE_CLIENT_ID</code> and{" "}
            <code>GOOGLE_CLIENT_SECRET</code>.
          </p>
        ) : !connected ? (
          <div className="space-y-3">
            <p className="text-sm text-gray-600">
              Connect your Google account to turn this exam into a Google Form
              that students can take online.
            </p>
            <a href={connectHref}>
              <Button>Connect Google account</Button>
            </a>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-xs text-gray-500">
              Connected as{" "}
              <span className="font-medium text-gray-700">
                {googleEmail ?? "your Google account"}
              </span>
              .
            </p>

            {needsDriveScope && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                Reconnect your Google account to grant the new permission that
                lets students open the form link. Without it, a published form
                may not be accessible to students.
                <div className="mt-2">
                  <a href={connectHref}>
                    <Button variant="secondary">Reconnect Google account</Button>
                  </a>
                </div>
              </div>
            )}

            {!form ? (
              <div className="space-y-2">
                <p className="text-sm text-gray-600">
                  Generate a Google Form quiz from this exam&apos;s{" "}
                  {questionCount} question{questionCount === 1 ? "" : "s"}. No
                  answer key is added yet — students won&apos;t see any score.
                </p>
                <Button
                  disabled={pending || questionCount === 0}
                  onClick={() => run(() => createOrSyncGoogleForm(examId))}
                >
                  {pending ? "Creating…" : "Create Google Form"}
                </Button>
                {questionCount === 0 && (
                  <p className="text-xs text-gray-400">
                    Add at least one question first.
                  </p>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                {/* Closed / unpublished notice */}
                {examStatus !== "PUBLISHED" && (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                    This exam is{" "}
                    <span className="font-medium">
                      {examStatus === "DRAFT" ? "unpublished" : "closed"}
                    </span>
                    . The form has been set to stop accepting responses and shows
                    a “closed” notice. For older forms created before 2026, also
                    turn off{" "}
                    <span className="font-medium">Accepting responses</span> on the
                    Responses tab to be sure.
                    {form.editUrl && (
                      <>
                        {" "}
                        <a
                          href={form.editUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-medium underline"
                        >
                          Open the form →
                        </a>
                      </>
                    )}{" "}
                    Re-publishing the exam reopens it.
                  </div>
                )}

                {/* Student link */}
                <div>
                  <p className="mb-1 text-xs font-medium uppercase tracking-wide text-gray-500">
                    Student link
                  </p>
                  <div className="flex flex-wrap items-center gap-2">
                    <a
                      href={form.url ?? "#"}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="break-all text-sm font-medium text-brand hover:underline"
                    >
                      {form.url}
                    </a>
                    <Button variant="secondary" onClick={copyLink}>
                      {copied ? "Copied!" : "Copy"}
                    </Button>
                  </div>
                  <p className="mt-1 text-xs text-gray-400">
                    Share this with students so they can take the exam.
                  </p>
                </div>

                {/* Edit link */}
                {form.editUrl && (
                  <div>
                    <a
                      href={form.editUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-gray-600 hover:underline"
                    >
                      Edit the form in Google Forms →
                    </a>
                  </div>
                )}

                {/* Email collection */}
                <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
                  <label className="flex items-start gap-2">
                    <input
                      type="checkbox"
                      className="mt-0.5 h-4 w-4 accent-brand"
                      checked={form.collectEmails === true}
                      disabled={pending}
                      onChange={(e) =>
                        run(() =>
                          setExamEmailCollection(examId, e.target.checked),
                        )
                      }
                    />
                    <span>
                      <span className="text-sm font-medium text-gray-800">
                        Collect student emails
                      </span>
                      <span className="block text-xs text-gray-500">
                        When on, students enter their email as they submit, so
                        you can see whose answers are whose. When off, responses
                        are anonymous.
                      </span>
                      {form.collectEmails === null && (
                        <span className="mt-1 block text-xs text-amber-600">
                          Couldn&apos;t read the current setting — toggling will
                          set it.
                        </span>
                      )}
                    </span>
                  </label>
                </div>

                {/* Answer key / grading */}
                <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
                  <div className="mb-1 flex items-center justify-between gap-2">
                    <span className="text-sm font-medium text-gray-800">
                      Answer key &amp; grading
                    </span>
                    {form.answerKeyReleased && (
                      <Badge color="green">Released</Badge>
                    )}
                  </div>
                  <p className="mb-2 text-xs text-gray-500">
                    {form.answerKeyReleased
                      ? "Correct answers and points have been pushed. Google has graded the objective questions; grade open questions in Google Forms. Grades stay visible only to you."
                      : "After the exam is over, release the answer key to push the correct answers and points. Google grades the multiple-choice / true-false questions automatically; you grade open questions in Google Forms. Keep the form's grade-release setting on “Later, after manual review” so only you see the grades."}
                  </p>
                  {examStatus === "PUBLISHED" && !form.answerKeyReleased && (
                    <p className="mb-2 text-xs text-amber-600">
                      Tip: close the exam first so no more responses come in.
                    </p>
                  )}
                  <Button
                    variant={form.answerKeyReleased ? "secondary" : "success"}
                    disabled={pending}
                    onClick={() => run(() => releaseExamAnswerKey(examId))}
                  >
                    {pending
                      ? "Working…"
                      : form.answerKeyReleased
                        ? "Re-push answer key"
                        : "Release answer key & grade"}
                  </Button>
                </div>

                {/* Re-sync */}
                <div>
                  <Button
                    variant="ghost"
                    disabled={pending}
                    onClick={() => {
                      if (
                        confirm(
                          "Re-sync rebuilds the form from this exam's current questions and clears the released answer key. Continue?",
                        )
                      )
                        run(() => createOrSyncGoogleForm(examId));
                    }}
                  >
                    Re-sync questions to form
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </CardBody>
    </Card>
  );
}
