import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "../(app)/globals.css";

// Standalone root layout for printable pages: no dashboard chrome, so the
// browser's Print → Save as PDF produces a clean document. A separate route
// group keeps it from inheriting the app shell while avoiding two <html> docs.

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Printable exam",
};

export default function PrintRootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${geistSans.variable} antialiased`}>
      <body className="bg-white text-gray-900">{children}</body>
    </html>
  );
}
