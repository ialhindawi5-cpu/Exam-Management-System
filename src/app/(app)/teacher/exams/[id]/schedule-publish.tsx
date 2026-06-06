"use client";

import { useState, useTransition } from "react";
import { scheduleExamPublish } from "@/lib/exam-actions";
import { Card, CardBody, Button } from "@/components/ui";

export function SchedulePublish({
  examId,
  scheduledFor,
  questionCount,
  googleReady,
}: {
  examId: string;
  scheduledFor: string | null; // ISO timestamp, or null when not scheduled
  questionCount: number;
  googleReady: boolean; // Google configured on the server AND this teacher connected
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [value, setValue] = useState("");

  function submit(whenIso: string | null) {
    setError(null);
    startTransition(async () => {
      const res = await scheduleExamPublish(examId, whenIso);
      if ("error" in res) setError(res.error);
    });
  }

  function onSchedule() {
    if (!value) {
      setError("Pick a date and time.");
      return;
    }
    // datetime-local gives a value in the user's local time; convert to ISO/UTC.
    const when = new Date(value);
    if (Number.isNaN(when.getTime())) {
      setError("Choose a valid date and time.");
      return;
    }
    submit(when.toISOString());
  }

  return (
    <Card>
      <CardBody>
        <h3 className="mb-1 font-semibold text-gray-900">Schedule publish</h3>
        <p className="mb-3 text-sm text-gray-600">
          Automatically publish this exam — and open its Google Form to students —
          at a time you choose.
        </p>

        {error && (
          <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
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
              {pending ? "Cancelling…" : "Cancel schedule"}
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
              <Button
                disabled={pending || questionCount === 0}
                onClick={onSchedule}
              >
                {pending ? "Scheduling…" : "Schedule"}
              </Button>
            </div>
            {questionCount === 0 && (
              <p className="text-xs text-gray-400">
                Add at least one question first.
              </p>
            )}
            {!googleReady && (
              <p className="text-xs text-amber-600">
                Connect your Google account so the form is created automatically
                at that time.
              </p>
            )}
            <p className="text-xs text-gray-400">
              Uses your device&apos;s time zone. Publishing runs within a minute
              of the scheduled time.
            </p>
          </div>
        )}
      </CardBody>
    </Card>
  );
}
