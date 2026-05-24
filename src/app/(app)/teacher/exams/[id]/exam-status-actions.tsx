"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setExamStatus, deleteExam } from "@/lib/exam-actions";
import { Button } from "@/components/ui";
import type { ExamStatus } from "@prisma/client";

export function ExamStatusActions({
  examId,
  status,
}: {
  examId: string;
  status: ExamStatus;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function change(next: ExamStatus) {
    setError(null);
    startTransition(async () => {
      const res = await setExamStatus(examId, next);
      if (res && "error" in res && res.error) setError(res.error);
    });
  }

  return (
    <div className="flex items-center gap-2">
      {error && <span className="text-xs text-red-600">{error}</span>}
      {status !== "PUBLISHED" && (
        <Button variant="success" disabled={pending} onClick={() => change("PUBLISHED")}>
          Publish
        </Button>
      )}
      {status === "PUBLISHED" && (
        <Button variant="secondary" disabled={pending} onClick={() => change("CLOSED")}>
          Close
        </Button>
      )}
      {status === "CLOSED" && (
        <Button variant="secondary" disabled={pending} onClick={() => change("PUBLISHED")}>
          Reopen
        </Button>
      )}
      <Button
        variant="danger"
        disabled={pending}
        onClick={() => {
          if (confirm("Delete this exam and all its submissions?")) {
            startTransition(async () => {
              await deleteExam(examId);
              router.push("/teacher/exams");
            });
          }
        }}
      >
        Delete
      </Button>
    </div>
  );
}
