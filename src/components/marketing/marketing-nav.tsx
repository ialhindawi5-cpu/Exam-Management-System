"use client";

import Link from "next/link";
import { useState } from "react";
import { cn } from "@/components/ui";

const LINKS = [
  { href: "#home", label: "Home" },
  { href: "#features", label: "Features" },
  { href: "#demo", label: "Demo" },
  { href: "#about", label: "About Us" },
  { href: "#contact", label: "Contact Us" },
];

export function MarketingNav({
  brandName,
  logoDataUrl,
}: {
  brandName: string;
  logoDataUrl: string | null;
}) {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-30 border-b border-gray-200 bg-white/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
        <a href="#home" className="flex items-center gap-2">
          {logoDataUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoDataUrl} alt={brandName} className="h-9 w-9 rounded object-contain" />
          ) : (
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand text-sm font-bold text-white">
              EM
            </span>
          )}
          <span className="text-lg font-bold text-gray-900">{brandName}</span>
        </a>

        {/* Desktop links */}
        <nav className="hidden items-center gap-1 md:flex">
          {LINKS.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className="rounded-lg px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 hover:text-gray-900"
            >
              {l.label}
            </a>
          ))}
          <Link
            href="/login"
            className="ml-2 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
          >
            Login
          </Link>
        </nav>

        {/* Mobile toggle */}
        <button
          type="button"
          aria-label="Toggle menu"
          className="rounded-lg p-2 text-gray-700 hover:bg-gray-100 md:hidden"
          onClick={() => setOpen((v) => !v)}
        >
          <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d={open ? "M6 18 18 6M6 6l12 12" : "M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5"} />
          </svg>
        </button>
      </div>

      {/* Mobile menu */}
      <div className={cn("border-t border-gray-100 md:hidden", open ? "block" : "hidden")}>
        <nav className="mx-auto flex max-w-6xl flex-col px-4 py-2">
          {LINKS.map((l) => (
            <a
              key={l.href}
              href={l.href}
              onClick={() => setOpen(false)}
              className="rounded-lg px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100"
            >
              {l.label}
            </a>
          ))}
          <Link
            href="/login"
            className="mt-1 rounded-lg bg-brand px-3 py-2 text-center text-sm font-semibold text-white"
          >
            Login
          </Link>
        </nav>
      </div>
    </header>
  );
}
