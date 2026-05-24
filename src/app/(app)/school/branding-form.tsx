"use client";

import { useActionState, useState } from "react";
import { updateMySchool, type SchoolAdminState } from "@/lib/school-admin-actions";
import { ImageUpload } from "@/components/image-upload";
import { Button, Card, CardBody, Input, Label } from "@/components/ui";

export function SchoolBrandingForm({
  name,
  logoDataUrl,
  themeColor,
}: {
  name: string;
  logoDataUrl: string | null;
  themeColor: string | null;
}) {
  const [state, action, pending] = useActionState<SchoolAdminState, FormData>(
    updateMySchool,
    undefined,
  );
  const [color, setColor] = useState(themeColor ?? "#1d4ed8");

  return (
    <Card>
      <CardBody>
        <form action={action} className="space-y-4">
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
            <Label htmlFor="themeColor">Theme color (design)</Label>
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
          <Button type="submit" disabled={pending}>
            {pending ? "Saving…" : "Save branding"}
          </Button>
        </form>
      </CardBody>
    </Card>
  );
}
