import Link from "next/link";
import { getSettings } from "@/lib/settings";
import { BILLING_NOTE, formatMoney, PRICE_PER_SCHOOL } from "@/lib/pricing";
import { CartClient } from "./cart-client";

// Render on request so the build never needs a DB connection to prerender this
// page, and so branding (logo/name) reflects live edits.
export const dynamic = "force-dynamic";

export default async function CartPage() {
  const settings = await getSettings();
  const brandName = settings.schoolName ?? "Exam Management System";

  return (
    <div className="flex min-h-screen flex-col bg-gray-50">
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-4">
          <Link href="/" className="text-lg font-bold text-gray-900">
            {brandName}
          </Link>
          <Link href="/login" className="text-sm font-medium text-brand hover:underline">
            Login
          </Link>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-10">
        <div className="mb-6">
          <Link href="/" className="text-sm text-gray-500 hover:text-gray-800">
            ← Back to home
          </Link>
          <h1 className="mt-2 text-2xl font-semibold text-gray-900">Checkout</h1>
          <p className="mt-1 text-sm text-gray-500">
            School license — {formatMoney(PRICE_PER_SCHOOL)} {BILLING_NOTE}.
          </p>
        </div>
        <CartClient />
      </main>
    </div>
  );
}
