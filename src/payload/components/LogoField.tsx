"use client";

import { useState } from "react";
import { useField } from "@payloadcms/ui";

// Custom Payload field: a real image picker that stores the logo as a data URL
// (so it works on Vercel with no file storage, and in Excel/Word reports).
export const LogoField = ({ path }: { path: string }) => {
  const { value, setValue } = useField<string | null>({ path });
  const [error, setError] = useState<string | null>(null);

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    setError(null);
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("Please choose an image file.");
      return;
    }
    if (file.size > 1_000_000) {
      setError("Image is too large (max ~1 MB). Please pick a smaller one.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setValue(reader.result as string);
    reader.readAsDataURL(file);
  }

  return (
    <div className="field-type" style={{ marginBottom: "1.5rem" }}>
      <label className="field-label" style={{ display: "block", marginBottom: ".5rem" }}>
        Logo
      </label>
      <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
        <div
          style={{
            width: 88,
            height: 88,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            border: "1px solid var(--theme-elevation-150)",
            borderRadius: 8,
            overflow: "hidden",
            background: "var(--theme-elevation-50)",
          }}
        >
          {value ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={value}
              alt="Logo preview"
              style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }}
            />
          ) : (
            <span style={{ fontSize: 12, color: "var(--theme-elevation-400)" }}>No logo</span>
          )}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: ".5rem" }}>
          <input
            type="file"
            accept="image/png,image/jpeg,image/gif"
            onChange={onFile}
          />
          {value && (
            <button
              type="button"
              className="btn btn--style-secondary btn--size-small"
              onClick={() => setValue(null)}
              style={{ alignSelf: "flex-start" }}
            >
              Remove logo
            </button>
          )}
        </div>
      </div>
      {error && (
        <p style={{ color: "var(--theme-error-500)", fontSize: 13, marginTop: ".5rem" }}>
          {error}
        </p>
      )}
      <p style={{ fontSize: 12, color: "var(--theme-elevation-400)", marginTop: ".5rem" }}>
        PNG, JPG, or GIF · up to ~1 MB. Shown in the header, public site, and report headers.
      </p>
    </div>
  );
};
