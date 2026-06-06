"use client";

import { useState, useTransition } from "react";
import { scheduleExamPublish, scheduleExamClose } from "@/lib/exam-actions";
import { Card, CardBody, Button } from "@/components/ui";
import type { ExamStatus } from "@prisma/client";

type ScheduleAction = (
  examId: string,
  whenIso: string | null,
) => Promise<{ ok: true; scheduledFor: string | null } | { error: string }>;

export function SchedulePublish({
  examId,
  status,
  scheduledPublishFor,
  scheduledCloseFor,
  questionCount,
  googleReady,
}: {
  examId: string;
  status: ExamStatus;
  scheduledPublishFor: string | null; // ISO timestamp, or null
  scheduledCloseFor: string | null; // ISO timestamp, or null
  questionCount: number;
  googleReady: boolean; // Google configured on the server AND this teacher connected
}) {
  const publishHint =
    questionCount === 0
      ? "Add at least one question first."
      : !googleReady
        ? "Connect your Google account so the form is created automatically at that time."
        : null;

  return (
    <Card>
      <CardBody>
        <h3 className="mb-1 font-semibold text-gray-900">Schedule</h3>
        <p className="mb-3 text-sm text-gray-600">
          Automatically publish or close this exam at times you choose.
        </p>
        <div className="space-y-3">
          {status === "DRAFT" && (
            <ScheduleRow
              examId={examId}
              action={scheduleExamPublish}
              scheduledFor={scheduledPublishFor}
              title="Publish"
              actionLabel="Schedule publish"
              description="Open the exam's Google Form to students at this time."
              disabled={questionCount === 0}
              hint={publishHint}
            />
          )}
          {(status === "DRAFT" || status === "PUBLISHED") && (
            <ScheduleRow
              examId={examId}
              action={scheduleExamClose}
              scheduledFor={scheduledCloseFor}
              title="Close"
              actionLabel="Schedule close"
              description="Mark the form closed at this time so students see a “closed” notice."
              note="Google's API can't stop a form from accepting responses — it only adds a closed banner. To fully block submissions, also turn off “Accepting responses” in the form afterward."
            />
          )}
        </div>
      </CardBody>
    </Card>
  );
}

function ScheduleRow({
  examId,
  action,
  scheduledFor,
  title,
  actionLabel,
  description,
  disabled = false,
  hint = null,
  note = null,
}: {
  examId: string;
  action: ScheduleAction;
  scheduledFor: string | null;
  title: string;
  actionLabel: string;
  description: string;
  disabled?: boolean;
  hint?: string | null; // amber caveat shown under the input
  note?: string | null; // gray explanatory note
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [value, setValue] = useState("");

  function submit(whenIso: string | null) {
    setError(null);
    startTransition(async () => {
      const res = await action(examId, whenIso);
      if ("error" in res) setError(res.error);
    });
  }

  function onSchedule() {
    if (!value) {
      setError("Pick a date and time.");
      return;
    }
    const when = new Date(value); // datetime-local is local time → convert to ISO/UTC
    if (Number.isNaN(when.getTime())) {
      setError("Choose a valid date and time.");
      return;
    }
    submit(when.toISOString());
  }

  return (
    <div className="rounded-lg border border-gray-200 p-3">
      <div className="text-sm font-medium text-gray-800">{title}</div>
      <p className="mb-2 text-xs text-gray-500">{description}</p>

      {error && (
        <p className="mb-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      {scheduledFor ? (
        <div className="flex flex-wrap items-center gap-3">
          <span className="rounded-lg bg-blue-50 px-3 py-2 text-sm text-blue-800">
            Scheduled for{" "}
            <span className="font-medium">
              {new Date(scheduledFor).toLocaleString()}
            </span>
          </span>
          <Button
            variant="secondary"
            disabled={pending}
            onClick={() => submit(null)}
          >
            {pending ? "Cancelling…" : "Cancel"}
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          <div className="flex flex-wrap items-end gap-2">
            <input
              type="datetime-local"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-blue-200"
            />
            <Button disabled={pending || disabled} onClick={onSchedule}>
              {pending ? "Scheduling…" : actionLabel}
            </Button>
          </div>
          {hint && <p className="text-xs text-amber-600">{hint}</p>}
          {note && <p className="text-xs text-gray-400">{note}</p>}
          <p className="text-xs text-gray-400">Uses your device&apos;s time zone.</p>
        </div>
      )}
    </div>
  );
}
