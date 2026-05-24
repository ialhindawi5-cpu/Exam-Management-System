"use client";

import { useState, useTransition } from "react";
import { deleteQuestion } from "@/lib/question-actions";
import { Button } from "@/components/ui";

export function QuestionDeleteButton({ id }: { id: string }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <span className="inline-flex items-center gap-2">
      {error && <span className="text-xs text-red-600">{error}</span>}
      <Button
        variant="danger"
        disabled={pending}
        onClick={() => {
          if (!confirm("Delete this question?")) return;
          setError(null);
          startTransition(async () => {
            const res = await deleteQuestion(id);
            if (res?.error) setError(res.error);
          });
        }}
      >
        Delete
      </Button>
    </span>
  );
}
