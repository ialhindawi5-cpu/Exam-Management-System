"use client";

import { useState } from "react";
import { Button } from "@/components/ui";

function toHex(n: number) {
  return n.toString(16).padStart(2, "0");
}

// Find the dominant (most common) vivid color in an image, ignoring
// transparent, near-white, and near-black pixels. Returns a #rrggbb hex.
function dominantColor(img: HTMLImageElement): string | null {
  const size = 48;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.drawImage(img, 0, 0, size, size);
  let data: Uint8ClampedArray;
  try {
    data = ctx.getImageData(0, 0, size, size).data;
  } catch {
    return null; // tainted canvas (shouldn't happen for data URLs)
  }

  const buckets = new Map<number, { c: number; r: number; g: number; b: number }>();
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i], g = data[i + 1], b = data[i + 2], a = data[i + 3];
    if (a < 128) continue;
    if (r > 235 && g > 235 && b > 235) continue; // near-white
    if (r < 20 && g < 20 && b < 20) continue; // near-black
    const key = ((r >> 4) << 8) | ((g >> 4) << 4) | (b >> 4);
    const e = buckets.get(key) ?? { c: 0, r: 0, g: 0, b: 0 };
    e.c += 1; e.r += r; e.g += g; e.b += b;
    buckets.set(key, e);
  }
  let best: { c: number; r: number; g: number; b: number } | null = null;
  for (const e of buckets.values()) if (!best || e.c > best.c) best = e;
  if (!best) return null;
  return `#${toHex(Math.round(best.r / best.c))}${toHex(Math.round(best.g / best.c))}${toHex(Math.round(best.b / best.c))}`;
}

export function ImageUpload({
  name,
  initial = null,
  maxBytes = 1_000_000,
  label = "Image",
  onColor,
}: {
  name: string;
  initial?: string | null;
  maxBytes?: number;
  label?: string;
  onColor?: (hex: string) => void;
}) {
  const [data, setData] = useState<string | null>(initial);
  const [err, setErr] = useState<string | null>(null);

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    setErr(null);
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setErr("Please choose an image file.");
      return;
    }
    if (file.size > maxBytes) {
      setErr(`Image is too large (max ~${Math.round(maxBytes / 1000)} KB).`);
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const url = reader.result as string;
      setData(url);
      if (onColor) {
        const img = new Image();
        img.onload = () => {
          const c = dominantColor(img);
          if (c) onColor(c);
        };
        img.src = url;
      }
    };
    reader.readAsDataURL(file);
  }

  return (
    <div>
      <div className="flex items-center gap-4">
        <div className="flex h-24 w-32 items-center justify-center overflow-hidden rounded-lg border border-gray-200 bg-gray-50">
          {data ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={data} alt={`${label} preview`} className="max-h-full max-w-full" />
          ) : (
            <span className="text-xs text-gray-400">No {label.toLowerCase()}</span>
          )}
        </div>
        <div className="space-y-2">
          <input
            type="file"
            accept="image/png,image/jpeg,image/gif,image/webp"
            onChange={onFile}
            className="block text-sm text-gray-600 file:mr-3 file:rounded-lg file:border-0 file:bg-gray-100 file:px-3 file:py-1.5 file:text-sm file:font-medium hover:file:bg-gray-200"
          />
          {data && (
            <Button type="button" variant="ghost" onClick={() => setData(null)}>
              Remove {label.toLowerCase()}
            </Button>
          )}
        </div>
      </div>
      {err && <p className="mt-1 text-sm text-red-600">{err}</p>}
      <input type="hidden" name={name} value={data ?? ""} />
    </div>
  );
}
