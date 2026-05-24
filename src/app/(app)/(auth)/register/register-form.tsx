"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { register, type AuthState } from "@/lib/auth-actions";
import { Button, Card, CardBody, Input, Label, Select } from "@/components/ui";
import { GRADE_LEVELS } from "@/lib/labels";

export function RegisterForm({
  schools,
}: {
  schools: { id: string; name: string }[];
}) {
  const [state, action, pending] = useActionState<AuthState, FormData>(
    register,
    undefined,
  );
  const [role, setRole] = useState("TEACHER");

  return (
    <Card>
      <CardBody>
        <h2 className="mb-4 text-lg font-semibold text-gray-900">
          Create account
        </h2>
        <form action={action} className="space-y-4">
          <div>
            <Label htmlFor="name">Full name</Label>
            <Input id="name" name="name" autoComplete="name" required />
          </div>
          <div>
            <Label htmlFor="email">Email</Label>
            <Input id="email" name="email" type="email" autoComplete="email" required />
          </div>
          <div>
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete="new-password"
              required
            />
          </div>
          <div>
            <Label htmlFor="role">I am a</Label>
            <Select
              id="role"
              name="role"
              value={role}
              onChange={(e) => setRole(e.target.value)}
            >
              <option value="TEACHER">Teacher</option>
              <option value="STUDENT">Student</option>
            </Select>
          </div>

          <div>
            <Label htmlFor="schoolId">School</Label>
            <Select id="schoolId" name="schoolId" defaultValue="" required>
              <option value="" disabled>
                {schools.length ? "— Select your school —" : "No schools available"}
              </option>
              {schools.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </Select>
            {schools.length === 0 && (
              <p className="mt-1 text-xs text-red-500">
                Registration is unavailable until an administrator creates a school.
              </p>
            )}
          </div>

          {role === "STUDENT" && (
            <div>
              <Label htmlFor="gradeLevel">Grade / class</Label>
              <Select id="gradeLevel" name="gradeLevel" defaultValue="">
                <option value="">— Select your grade —</option>
                {GRADE_LEVELS.map((g) => (
                  <option key={g} value={g}>
                    {g}
                  </option>
                ))}
              </Select>
            </div>
          )}

          {state?.error && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
              {state.error}
            </p>
          )}

          <Button
            type="submit"
            disabled={pending || schools.length === 0}
            className="w-full"
          >
            {pending ? "Creating…" : "Create account"}
          </Button>
          <p className="text-center text-xs text-gray-400">
            New accounts require admin approval before access is granted.
          </p>
        </form>

        <p className="mt-4 text-center text-sm text-gray-500">
          Already registered?{" "}
          <Link href="/login" className="font-medium text-brand hover:underline">
            Sign in
          </Link>
        </p>
      </CardBody>
    </Card>
  );
}
