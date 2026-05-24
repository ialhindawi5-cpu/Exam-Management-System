"use client";

import { useRef, useState, useTransition } from "react";
import { createSubject, deleteSubject } from "@/lib/admin-actions";
import { Button, Card, CardBody, Input, Label, Badge } from "@/components/ui";

export type SubjectRow = {
  id: string;
  name: string;
  nameAr: string | null;
  nameFr: string | null;
  questionCount: number;
};

export function SubjectsManager({ subjects }: { subjects: SubjectRow[] }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
            <tr>
              <th className="px-4 py-3">English</th>
              <th className="px-4 py-3">Arabic</th>
              <th className="px-4 py-3">French</th>
              <th className="px-4 py-3">Questions</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {subjects.map((s) => (
              <tr key={s.id}>
                <td className="px-4 py-3 font-medium text-gray-900">{s.name}</td>
                <td className="px-4 py-3" dir="rtl">{s.nameAr ?? "—"}</td>
                <td className="px-4 py-3">{s.nameFr ?? "—"}</td>
                <td className="px-4 py-3">
                  <Badge color="gray">{s.questionCount}</Badge>
                </td>
                <td className="px-4 py-3 text-right">
                  <Button
                    variant="danger"
                    disabled={pending}
                    onClick={() => {
                      if (confirm(`Delete subject "${s.name}"?`))
                        startTransition(async () => {
                          await deleteSubject(s.id);
                        });
                    }}
                  >
                    Delete
                  </Button>
                </td>
              </tr>
            ))}
            {subjects.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-gray-500">
                  No subjects yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <Card className="h-fit">
        <CardBody>
          <h3 className="mb-3 font-semibold text-gray-900">Add subject</h3>
          <form
            ref={formRef}
            action={(fd) => {
              setError(null);
              startTransition(async () => {
                const res = await createSubject(fd);
                if (res?.error) setError(res.error);
                else formRef.current?.reset();
              });
            }}
            className="space-y-3"
          >
            <div>
              <Label htmlFor="name">Name (English)</Label>
              <Input id="name" name="name" required />
            </div>
            <div>
              <Label htmlFor="nameAr">Name (Arabic)</Label>
              <Input id="nameAr" name="nameAr" dir="rtl" />
            </div>
            <div>
              <Label htmlFor="nameFr">Name (French)</Label>
              <Input id="nameFr" name="nameFr" />
            </div>
            {error && (
              <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
                {error}
              </p>
            )}
            <Button type="submit" disabled={pending} className="w-full">
              {pending ? "Saving…" : "Add subject"}
            </Button>
          </form>
        </CardBody>
      </Card>
    </div>
  );
}
