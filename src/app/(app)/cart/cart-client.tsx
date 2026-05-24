"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { placeOrder, type OrderState } from "@/lib/order-actions";
import {
  PRICE_PER_SCHOOL,
  WHISH_NUMBER,
  formatMoney,
} from "@/lib/pricing";
import { ImageUpload } from "@/components/image-upload";
import { Button, Card, CardBody, Input, Label } from "@/components/ui";

export function CartClient() {
  const [state, action, pending] = useActionState<OrderState, FormData>(
    placeOrder,
    undefined,
  );
  const [schools, setSchools] = useState(1);
  const total = Math.max(1, schools) * PRICE_PER_SCHOOL;

  if (state?.ok) {
    return (
      <Card>
        <CardBody className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-green-100 text-2xl">
            ✅
          </div>
          <h2 className="text-lg font-semibold text-gray-900">Order received!</h2>
          <p className="mt-2 text-sm text-gray-500">
            Thanks — we’ve recorded your order and your payment proof. We’ll
            verify your Whish Money payment and activate your access shortly.
          </p>
          <div className="mt-6">
            <Link href="/">
              <Button variant="secondary">Back to home</Button>
            </Link>
          </div>
        </CardBody>
      </Card>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
      {/* Order form */}
      <Card>
        <CardBody>
          <h2 className="mb-1 text-lg font-semibold text-gray-900">Your order</h2>
          <p className="mb-4 text-sm text-gray-500">
            Per-school license. Pay via Whish Money, then attach the proof.
          </p>
          <form action={action} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="name">Full name</Label>
                <Input id="name" name="name" required />
              </div>
              <div>
                <Label htmlFor="email">Email</Label>
                <Input id="email" name="email" type="email" required />
              </div>
            </div>
            <div>
              <Label htmlFor="schoolName">School name</Label>
              <Input id="schoolName" name="schoolName" />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="schools">Number of schools</Label>
                <Input
                  id="schools"
                  name="schools"
                  type="number"
                  min="1"
                  max="100"
                  value={schools}
                  onChange={(e) => setSchools(Number(e.target.value) || 1)}
                  required
                />
              </div>
              <div>
                <Label htmlFor="reference">Whish transfer reference (optional)</Label>
                <Input id="reference" name="reference" placeholder="e.g. TXN number" />
              </div>
            </div>
            <div>
              <Label>Payment proof (screenshot) — required</Label>
              <ImageUpload name="proofUrl" label="Proof" />
            </div>

            {state?.error && (
              <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
                {state.error}
              </p>
            )}

            <Button type="submit" disabled={pending}>
              {pending ? "Submitting…" : "I’ve paid — place order"}
            </Button>
          </form>
        </CardBody>
      </Card>

      {/* Summary + payment instructions */}
      <div className="space-y-4">
        <Card>
          <CardBody>
            <h3 className="font-semibold text-gray-900">Summary</h3>
            <div className="mt-3 flex justify-between text-sm text-gray-600">
              <span>{schools} × school license / year</span>
              <span>{formatMoney(PRICE_PER_SCHOOL)} each</span>
            </div>
            <div className="mt-3 flex justify-between border-t border-gray-100 pt-3 text-base font-semibold text-gray-900">
              <span>Total / year</span>
              <span>{formatMoney(total)}</span>
            </div>
          </CardBody>
        </Card>

        <Card className="border-blue-200 bg-blue-50">
          <CardBody>
            <h3 className="font-semibold text-gray-900">Pay with Whish Money</h3>
            <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-gray-700">
              <li>Open the Whish Money app.</li>
              <li>
                Send <strong>{formatMoney(total)}</strong> to{" "}
                <strong className="whitespace-nowrap">{WHISH_NUMBER}</strong>.
              </li>
              <li>Take a screenshot of the confirmation.</li>
              <li>Upload it as the payment proof and place your order.</li>
            </ol>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
