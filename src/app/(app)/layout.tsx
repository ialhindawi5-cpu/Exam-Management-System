import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

// Root layout for the application (everything except the Payload admin, which
// lives in the (payload) group with its own root layout). Keeping them in
// separate route groups avoids nesting two <html> documents.

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Exam Management System",
  description:
    "Exam management for teachers — question bank, auto/manual grading, and Excel/Word reports.",
  // Tab icon is served dynamically from the branding logo uploaded at
  // /admin/settings (falls back to /favicon.ico when none is set).
  icons: {
    icon: [
      { url: "/api/favicon" },
      { url: "/favicon.ico", sizes: "any" },
    ],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
