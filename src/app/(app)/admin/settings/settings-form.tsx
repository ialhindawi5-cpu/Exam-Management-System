"use client";

import { useActionState, useState } from "react";
import { updateSettings, type SettingsState } from "@/lib/settings-actions";
import { Button, Card, CardBody, Input, Label } from "@/components/ui";

export function SettingsForm({
  initialSchoolName,
  initialLogo,
}: {
  initialSchoolName: string | null;
  initialLogo: string | null;
}) {
  const [state, action, pending] = useActionState<SettingsState, FormData>(
    updateSettings,
    undefined,
  );
  const [logo, setLogo] = useState<string | null>(initialLogo);
  const [fileError, setFileError] = useState<string | null>(null);

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    setFileError(null);
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setFileError("Please choose an image file.");
      return;
    }
    if (file.size > 1_000_000) {
      setFileError("Image is too large (max ~1 MB). Please pick a smaller one.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setLogo(reader.result as string);
    reader.readAsDataURL(file);
  }

  return (
    <Card>
      <CardBody>
        <form action={action} className="space-y-5">
          <div>
            <Label htmlFor="schoolName">School / institution name</Label>
            <Input
              id="schoolName"
              name="schoolName"
              defaultValue={initialSchoolName ?? ""}
              placeholder="e.g. Lycée National — Beirut"
            />
            <p className="mt-1 text-xs text-gray-400">
              Shown in the header and on exported reports.
            </p>
          </div>

          <div>
            <Label htmlFor="logo">Logo</Label>
            <div className="flex items-center gap-4">
              <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-lg border border-gray-200 bg-gray-50">
                {logo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={logo} alt="Logo preview" className="max-h-full max-w-full" />
                ) : (
                  <span className="text-xs text-gray-400">No logo</span>
                )}
              </div>
              <div className="space-y-2">
                <input
                  id="logo"
                  type="file"
                  accept="image/png,image/jpeg,image/gif"
                  onChange={onFile}
                  className="block text-sm text-gray-600 file:mr-3 file:rounded-lg file:border-0 file:bg-gray-100 file:px-3 file:py-1.5 file:text-sm file:font-medium hover:file:bg-gray-200"
                />
                {logo && (
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => setLogo(null)}
                  >
                    Remove logo
                  </Button>
                )}
              </div>
            </div>
            <p className="mt-1 text-xs text-gray-400">PNG, JPG, or GIF · up to ~1 MB.</p>
            {fileError && <p className="mt-1 text-sm text-red-600">{fileError}</p>}
          </div>

          {/* Carries the chosen logo (data URL) to the server action. */}
          <input type="hidden" name="logoDataUrl" value={logo ?? ""} />

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
