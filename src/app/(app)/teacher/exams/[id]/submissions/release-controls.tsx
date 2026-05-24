"use client";

import { useState, useTransition } from "react";
import { releaseExamResults } from "@/lib/grading-actions";
import { Button } from "@/components/ui";

export function ReleaseControls({ examId }: { examId: string }) {
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  function run(released: boolean) {
    setMsg(null);
    startTransition(async () => {
      const res = await releaseExamResults(examId, released);
      setMsg(
        "error" in res
          ? res.error
          : released
            ? `Released ${res.count} result(s).`
            : `Hid ${res.count} result(s).`,
      );
    });
  }

  return (
    <div className="flex items-center gap-2">
      {msg && <span className="text-xs text-gray-500">{msg}</span>}
      <Button variant="success" disabled={pending} onClick={() => run(true)}>
        Release all results
      </Button>
      <Button variant="secondary" disabled={pending} onClick={() => run(false)}>
        Hide all
      </Button>
    </div>
  );
}
