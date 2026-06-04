"use client";

import { useState, useTransition } from "react";
import {
  setAccessStatus,
  setUserRole,
  deleteUser,
  setUserPassword,
} from "@/lib/admin-actions";
import { setUserSchool } from "@/lib/school-actions";
import { Badge, Button, Select, cn } from "@/components/ui";
import type { Role, AccessStatus } from "@prisma/client";

export type AdminUserRow = {
  id: string;
  name: string;
  email: string;
  role: Role;
  accessStatus: AccessStatus;
  schoolId: string | null;
  createdAt: string;
};

const statusColor: Record<AccessStatus, "yellow" | "green" | "red"> = {
  PENDING: "yellow",
  APPROVED: "green",
  SUSPENDED: "red",
};

export function UsersTable({
  users,
  currentUserId,
  schools,
}: {
  users: AdminUserRow[];
  currentUserId: string;
  schools: { id: string; name: string }[];
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function run(fn: () => Promise<{ error?: string } | { ok: boolean }>) {
    setError(null);
    startTransition(async () => {
      const res = await fn();
      if (res && "error" in res && res.error) setError(res.error);
    });
  }

  function resetPw(u: AdminUserRow) {
    const pw = prompt(`Set a new password for ${u.name} (min 8 characters):`);
    if (pw == null) return;
    run(async () => {
      const res = await setUserPassword(u.id, pw);
      if (!(res && "error" in res && res.error)) alert("Password updated.");
      return res;
    });
  }

  // Shared per-row controls — reused by the desktop table and the mobile cards.
  const schoolSelect = (u: AdminUserRow) => (
    <Select
      className="w-full sm:w-40"
      value={u.schoolId ?? ""}
      disabled={pending}
      onChange={(e) => run(() => setUserSchool(u.id, e.target.value || null))}
    >
      <option value="">— None —</option>
      {schools.map((s) => (
        <option key={s.id} value={s.id}>
          {s.name}
        </option>
      ))}
    </Select>
  );

  const roleSelect = (u: AdminUserRow, isSelf: boolean) => (
    <Select
      className="w-full sm:w-40"
      value={u.role}
      disabled={isSelf || pending}
      onChange={(e) => run(() => setUserRole(u.id, e.target.value as Role))}
    >
      <option value="ADMIN">Admin</option>
      <option value="SCHOOL_ADMIN">School Admin</option>
      <option value="TEACHER">Teacher</option>
    </Select>
  );

  const actions = (u: AdminUserRow, isSelf: boolean) => (
    <>
      {u.accessStatus !== "APPROVED" && (
        <Button
          variant="success"
          disabled={pending}
          onClick={() => run(() => setAccessStatus(u.id, "APPROVED"))}
        >
          Approve
        </Button>
      )}
      {u.accessStatus !== "SUSPENDED" && !isSelf && (
        <Button
          variant="secondary"
          disabled={pending}
          onClick={() => run(() => setAccessStatus(u.id, "SUSPENDED"))}
        >
          Suspend
        </Button>
      )}
      <Button variant="ghost" disabled={pending} onClick={() => resetPw(u)}>
        Reset PW
      </Button>
      {!isSelf && (
        <Button
          variant="danger"
          disabled={pending}
          onClick={() => {
            if (
              confirm(`Delete ${u.name}? This removes their account and data.`)
            )
              run(() => deleteUser(u.id));
          }}
        >
          Delete
        </Button>
      )}
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
              <th className="px-4 py-3">School</th>
              <th className="px-4 py-3">Role</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {users.map((u) => {
              const isSelf = u.id === currentUserId;
              return (
                <tr key={u.id} className={cn(pending && "opacity-60")}>
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-900">
                      {u.name}{" "}
                      {isSelf && <span className="text-xs text-gray-400">(you)</span>}
                    </div>
                    <div className="text-xs text-gray-500">{u.email}</div>
                  </td>
                  <td className="px-4 py-3">{schoolSelect(u)}</td>
                  <td className="px-4 py-3">{roleSelect(u, isSelf)}</td>
                  <td className="px-4 py-3">
                    <Badge color={statusColor[u.accessStatus]}>
                      {u.accessStatus}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-2">{actions(u, isSelf)}</div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Mobile: stacked cards */}
      <div className="space-y-3 md:hidden">
        {users.map((u) => {
          const isSelf = u.id === currentUserId;
          return (
            <div
              key={u.id}
              className={cn(
                "rounded-xl border border-gray-200 bg-white p-4",
                pending && "opacity-60",
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="font-medium text-gray-900">
                    {u.name}{" "}
                    {isSelf && <span className="text-xs text-gray-400">(you)</span>}
                  </div>
                  <div className="truncate text-xs text-gray-500">{u.email}</div>
                </div>
                <Badge color={statusColor[u.accessStatus]}>{u.accessStatus}</Badge>
              </div>

              <div className="mt-3 space-y-2">
                <label className="block">
                  <span className="text-xs font-medium uppercase tracking-wide text-gray-500">
                    School
                  </span>
                  <div className="mt-1">{schoolSelect(u)}</div>
                </label>
                <label className="block">
                  <span className="text-xs font-medium uppercase tracking-wide text-gray-500">
                    Role
                  </span>
                  <div className="mt-1">{roleSelect(u, isSelf)}</div>
                </label>
              </div>

              <div className="mt-3 flex flex-wrap gap-2">{actions(u, isSelf)}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
