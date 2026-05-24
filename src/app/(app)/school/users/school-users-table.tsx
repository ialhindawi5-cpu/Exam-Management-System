"use client";

import { useState, useTransition } from "react";
import {
  setMySchoolUserAccess,
  setMySchoolUserRole,
  setMySchoolUserPassword,
} from "@/lib/school-admin-actions";
import { Badge, Button, Select, EmptyState, cn } from "@/components/ui";
import type { AccessStatus } from "@prisma/client";

export type SchoolUserRow = {
  id: string;
  name: string;
  email: string;
  role: "TEACHER" | "STUDENT";
  accessStatus: AccessStatus;
  gradeLevel: string | null;
  createdAt: string;
};

const statusColor: Record<AccessStatus, "yellow" | "green" | "red"> = {
  PENDING: "yellow",
  APPROVED: "green",
  SUSPENDED: "red",
};

export function SchoolUsersTable({ users }: { users: SchoolUserRow[] }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function run(fn: () => Promise<{ error?: string } | { ok: boolean }>) {
    setError(null);
    startTransition(async () => {
      const res = await fn();
      if (res && "error" in res && res.error) setError(res.error);
    });
  }

  if (users.length === 0) {
    return <EmptyState>No teachers or students in your school yet.</EmptyState>;
  }

  return (
    <div>
      {error && (
        <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}
      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
            <tr>
              <th className="px-4 py-3">User</th>
              <th className="px-4 py-3">Role</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {users.map((u) => (
              <tr key={u.id} className={cn(pending && "opacity-60")}>
                <td className="px-4 py-3">
                  <div className="font-medium text-gray-900">{u.name}</div>
                  <div className="text-xs text-gray-500">{u.email}</div>
                  {u.role === "STUDENT" && u.gradeLevel && (
                    <div className="text-xs text-gray-400">{u.gradeLevel}</div>
                  )}
                </td>
                <td className="px-4 py-3">
                  <Select
                    className="w-32"
                    value={u.role}
                    disabled={pending}
                    onChange={(e) =>
                      run(() =>
                        setMySchoolUserRole(
                          u.id,
                          e.target.value as "TEACHER" | "STUDENT",
                        ),
                      )
                    }
                  >
                    <option value="TEACHER">Teacher</option>
                    <option value="STUDENT">Student</option>
                  </Select>
                </td>
                <td className="px-4 py-3">
                  <Badge color={statusColor[u.accessStatus]}>{u.accessStatus}</Badge>
                </td>
                <td className="px-4 py-3">
                  <div className="flex justify-end gap-2">
                    {u.accessStatus !== "APPROVED" && (
                      <Button
                        variant="success"
                        disabled={pending}
                        onClick={() => run(() => setMySchoolUserAccess(u.id, "APPROVED"))}
                      >
                        Approve
                      </Button>
                    )}
                    {u.accessStatus !== "SUSPENDED" && (
                      <Button
                        variant="secondary"
                        disabled={pending}
                        onClick={() => run(() => setMySchoolUserAccess(u.id, "SUSPENDED"))}
                      >
                        Suspend
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      disabled={pending}
                      onClick={() => {
                        const pw = prompt(
                          `Set a new password for ${u.name} (min 8 characters):`,
                        );
                        if (pw == null) return;
                        run(async () => {
                          const res = await setMySchoolUserPassword(u.id, pw);
                          if (!(res && "error" in res && res.error))
                            alert("Password updated.");
                          return res;
                        });
                      }}
                    >
                      Reset PW
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
