"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { updateSchool, type SchoolState } from "@/lib/school-actions";
import { ImageUpload } from "@/components/image-upload";
import { Button, Card, CardBody, Input, Label } from "@/components/ui";

export function SchoolEditForm({
  id,
  name,
  logoDataUrl,
  themeColor,
}: {
  id: string;
  name: string;
  logoDataUrl: string | null;
  themeColor: string | null;
}) {
  const action = updateSchool.bind(null, id);
  const [state, formAction, pending] = useActionState<SchoolState, FormData>(
    action,
    undefined,
  );
  const [color, setColor] = useState(themeColor ?? "#1d4ed8");

  return (
    <Card>
      <CardBody>
        <form action={formAction} className="space-y-4">
          <div>
            <Label htmlFor="name">School name</Label>
            <Input id="name" name="name" defaultValue={name} required />
          </div>
          <div>
            <Label>Logo</Label>
            <ImageUpload
              name="logoDataUrl"
              initial={logoDataUrl}
              label="Logo"
              onColor={setColor}
            />
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
                Auto-set when you upload a logo — adjust if you like.
              </span>
            </div>
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
          <div className="flex gap-3">
            <Button type="submit" disabled={pending}>
              {pending ? "Saving…" : "Save school"}
            </Button>
            <Link href="/admin/schools">
              <Button type="button" variant="secondary">
                Back
              </Button>
            </Link>
          </div>
        </form>
      </CardBody>
    </Card>
  );
}
