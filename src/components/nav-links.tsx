"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { cn } from "@/components/ui";

export type NavItem = { href: string; label: string };

export function NavLinks({ items }: { items: NavItem[] }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(href + "/");

  return (
    <>
      {/* Desktop: inline links */}
      <nav className="hidden items-center gap-1 lg:flex">
        {items.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "rounded-lg px-3 py-1.5 text-sm font-medium transition",
              isActive(item.href)
                ? "bg-blue-50 text-brand"
                : "text-gray-600 hover:bg-gray-100 hover:text-gray-900",
            )}
          >
            {item.label}
          </Link>
        ))}
      </nav>

      {/* Mobile: hamburger toggle */}
      <button
        type="button"
        aria-label="Toggle menu"
        aria-expanded={open}
        className="rounded-lg p-2 text-gray-700 hover:bg-gray-100 lg:hidden"
        onClick={() => setOpen((v) => !v)}
      >
        <svg
          className="h-6 w-6"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={1.5}
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d={open ? "M6 18 18 6M6 6l12 12" : "M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5"}
          />
        </svg>
      </button>

      {/* Mobile: dropdown panel — positioned against the sticky header */}
      {open && (
        <>
          {/* click-away backdrop */}
          <button
            type="button"
            aria-hidden
            tabIndex={-1}
            className="fixed inset-0 z-0 cursor-default lg:hidden"
            onClick={() => setOpen(false)}
          />
          <div className="absolute inset-x-0 top-full z-10 border-b border-gray-200 bg-white shadow-md lg:hidden">
            <nav className="mx-auto flex max-w-6xl flex-col gap-1 px-4 py-2">
              {items.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className={cn(
                    "rounded-lg px-3 py-2.5 text-sm font-medium transition",
                    isActive(item.href)
                      ? "bg-blue-50 text-brand"
                      : "text-gray-700 hover:bg-gray-100",
                  )}
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>
        </>
      )}
    </>
  );
}
