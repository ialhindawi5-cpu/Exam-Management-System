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
                      {u.name} {isSelf && <span className="text-xs text-gray-400">(you)</span>}
                    </div>
                    <div className="text-xs text-gray-500">{u.email}</div>
                  </td>
                  <td className="px-4 py-3">
                    <Select
                      className="w-40"
                      value={u.schoolId ?? ""}
                      disabled={pending}
                      onChange={(e) =>
                        run(() => setUserSchool(u.id, e.target.value || null))
                      }
                    >
                      <option value="">— None —</option>
                      {schools.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                    </Select>
                  </td>
                  <td className="px-4 py-3">
                    <Select
                      className="w-40"
                      value={u.role}
                      disabled={isSelf || pending}
                      onChange={(e) =>
                        run(() => setUserRole(u.id, e.target.value as Role))
                      }
                    >
                      <option value="ADMIN">Admin</option>
                      <option value="SCHOOL_ADMIN">School Admin</option>
                      <option value="TEACHER">Teacher</option>
                      <option value="STUDENT">Student</option>
                    </Select>
                  </td>
                  <td className="px-4 py-3">
                    <Badge color={statusColor[u.accessStatus]}>
                      {u.accessStatus}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-2">
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
                      <Button
                        variant="ghost"
                        disabled={pending}
                        onClick={() => {
                          const pw = prompt(
                            `Set a new password for ${u.name} (min 8 characters):`,
                          );
                          if (pw == null) return;
                          run(async () => {
                            const res = await setUserPassword(u.id, pw);
                            if (!(res && "error" in res && res.error))
                              alert("Password updated.");
                            return res;
                          });
                        }}
                      >
                        Reset PW
                      </Button>
                      {!isSelf && (
                        <Button
                          variant="danger"
                          disabled={pending}
                          onClick={() => {
                            if (
                              confirm(
                                `Delete ${u.name}? This removes their account and data.`,
                              )
                            )
                              run(() => deleteUser(u.id));
                          }}
                        >
                          Delete
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
