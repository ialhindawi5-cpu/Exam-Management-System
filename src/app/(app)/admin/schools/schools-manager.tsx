"use client";

import Link from "next/link";
import { useActionState, useRef, useState, useTransition } from "react";
import { createSchool, deleteSchool, type SchoolState } from "@/lib/school-actions";
import { ImageUpload } from "@/components/image-upload";
import { Button, Card, CardBody, Input, Label, Badge } from "@/components/ui";

export type SchoolRow = {
  id: string;
  name: string;
  logoDataUrl: string | null;
  themeColor: string | null;
  teachers: number;
  students: number;
  exams: number;
};

export function SchoolsManager({ schools }: { schools: SchoolRow[] }) {
  const [state, action, pending] = useActionState<SchoolState, FormData>(
    createSchool,
    undefined,
  );
  const [delPending, startDelete] = useTransition();
  const [delError, setDelError] = useState<string | null>(null);
  const [color, setColor] = useState("#1d4ed8");
  const formRef = useRef<HTMLFormElement>(null);

  // Reset the add form after a successful create.
  if (state?.ok && formRef.current) formRef.current.reset();

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
      <div>
        {delError && (
          <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            {delError}
          </p>
        )}
        <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-4 py-3">School</th>
                <th className="px-4 py-3">Teachers</th>
                <th className="px-4 py-3">Students</th>
                <th className="px-4 py-3">Exams</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {schools.map((s) => (
                <tr key={s.id}>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      {s.logoDataUrl && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={s.logoDataUrl}
                          alt={s.name}
                          className="h-8 w-8 rounded object-contain"
                        />
                      )}
                      <span
                        className="h-4 w-4 shrink-0 rounded-full border border-gray-200"
                        style={{ backgroundColor: s.themeColor ?? "#1d4ed8" }}
                        title={s.themeColor ?? "default"}
                      />
                      <span className="font-medium text-gray-900">{s.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3"><Badge color="blue">{s.teachers}</Badge></td>
                  <td className="px-4 py-3"><Badge color="green">{s.students}</Badge></td>
                  <td className="px-4 py-3"><Badge color="gray">{s.exams}</Badge></td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-2">
                      <Link href={`/admin/schools/${s.id}`}>
                        <Button variant="secondary">Edit</Button>
                      </Link>
                      <Button
                        variant="danger"
                        disabled={delPending}
                        onClick={() => {
                          setDelError(null);
                          if (!confirm(`Delete "${s.name}"?`)) return;
                          startDelete(async () => {
                            const res = await deleteSchool(s.id);
                            if (res?.error) setDelError(res.error);
                          });
                        }}
                      >
                        Delete
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
              {schools.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-gray-500">
                    No schools yet. Add your first one.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Card className="h-fit">
        <CardBody>
          <h3 className="mb-3 font-semibold text-gray-900">Add school</h3>
          <form ref={formRef} action={action} className="space-y-3">
            <div>
              <Label htmlFor="name">School name</Label>
              <Input id="name" name="name" required />
            </div>
            <div>
              <Label>Logo (optional)</Label>
              <ImageUpload name="logoDataUrl" label="Logo" onColor={setColor} />
            </div>
            <div>
              <Label htmlFor="themeColor">Theme color</Label>
              <div className="flex items-center gap-2">
                <input
                  id="themeColor"
                  name="themeColor"
                  type="color"
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  className="h-9 w-12 cursor-pointer rounded border border-gray-300"
                />
                <span className="text-xs text-gray-500">
                  Auto-set from the logo — adjust if you like.
                </span>
              </div>
            </div>
            {state?.error && (
              <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
                {state.error}
              </p>
            )}
            <Button type="submit" disabled={pending} className="w-full">
              {pending ? "Saving…" : "Add school"}
            </Button>
          </form>
        </CardBody>
      </Card>
    </div>
  );
}
