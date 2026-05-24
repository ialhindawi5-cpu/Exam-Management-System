"use client";

import { useActionState } from "react";
import { updateProfile, type ProfileState } from "@/lib/profile-actions";
import { Button, Card, CardBody, Input, Label, Select } from "@/components/ui";
import { GRADE_LEVELS } from "@/lib/labels";

export function ProfileForm({
  name,
  gradeLevel,
  email,
}: {
  name: string;
  gradeLevel: string | null;
  email: string;
}) {
  const [state, action, pending] = useActionState<ProfileState, FormData>(
    updateProfile,
    undefined,
  );

  return (
    <Card>
      <CardBody>
        <form action={action} className="space-y-4">
          <div>
            <Label htmlFor="name">Full name</Label>
            <Input id="name" name="name" defaultValue={name} required />
          </div>
          <div>
            <Label>Email</Label>
            <Input value={email} disabled />
          </div>
          <div>
            <Label htmlFor="gradeLevel">Grade / class</Label>
            <Select id="gradeLevel" name="gradeLevel" defaultValue={gradeLevel ?? ""}>
              <option value="">— Not set —</option>
              {GRADE_LEVELS.map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </Select>
          </div>

          {state?.error && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
              {state.error}
            </p>
          )}
          {state?.ok && (
            <p className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">
              Saved.
            </p>
          )}

          <Button type="submit" disabled={pending}>
            {pending ? "Saving…" : "Save profile"}
          </Button>
        </form>
      </CardBody>
    </Card>
  );
}
