"use client";

import { useState, useTransition } from "react";
import {
  setMySchoolUserAccess,
  setMySchoolUserPassword,
} from "@/lib/school-admin-actions";
import { Badge, Button, EmptyState, cn } from "@/components/ui";
import type { AccessStatus } from "@prisma/client";

export type SchoolUserRow = {
  id: string;
  name: string;
  email: string;
  accessStatus: AccessStatus;
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

  function resetPw(u: SchoolUserRow) {
    const pw = prompt(`Set a new password for ${u.name} (min 8 characters):`);
    if (pw == null) return;
    run(async () => {
      const res = await setMySchoolUserPassword(u.id, pw);
      if (!(res && "error" in res && res.error)) alert("Password updated.");
      return res;
    });
  }

  if (users.length === 0) {
    return <EmptyState>No teachers in your school yet.</EmptyState>;
  }

  const actions = (u: SchoolUserRow) => (
    <>
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
      <Button variant="ghost" disabled={pending} onClick={() => resetPw(u)}>
        Reset PW
      </Button>
    </>
  );

  return (
    <div>
      {error && (
        <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      {/* Desktop / tablet: table */}
      <div className="hidden overflow-x-auto rounded-xl border border-gray-200 bg-white md:block">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
            <tr>
              <th className="px-4 py-3">User</th>
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
                </td>
                <td className="px-4 py-3">
                  <Badge color={statusColor[u.accessStatus]}>{u.accessStatus}</Badge>
                </td>
                <td className="px-4 py-3">
                  <div className="flex justify-end gap-2">{actions(u)}</div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile: stacked cards */}
      <div className="space-y-3 md:hidden">
        {users.map((u) => (
          <div
            key={u.id}
            className={cn(
              "rounded-xl border border-gray-200 bg-white p-4",
              pending && "opacity-60",
            )}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="font-medium text-gray-900">{u.name}</div>
                <div className="truncate text-xs text-gray-500">{u.email}</div>
              </div>
              <Badge color={statusColor[u.accessStatus]}>{u.accessStatus}</Badge>
            </div>

            <div className="mt-3 flex flex-wrap gap-2">{actions(u)}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
