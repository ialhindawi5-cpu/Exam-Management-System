"use client";

import { useState, useTransition } from "react";
import { setOrderStatus, deleteOrder } from "@/lib/order-actions";
import { formatMoney } from "@/lib/pricing";
import { Badge, Button, Select, EmptyState, cn } from "@/components/ui";
import type { OrderStatus } from "@prisma/client";

export type OrderRow = {
  id: string;
  name: string;
  email: string;
  schoolName: string | null;
  schools: number;
  amount: number;
  currency: string;
  reference: string | null;
  proofUrl: string | null;
  status: OrderStatus;
  createdAt: string;
};

const statusColor: Record<OrderStatus, "yellow" | "green" | "red"> = {
  PENDING: "yellow",
  PAID: "green",
  CANCELLED: "red",
};

export function OrdersList({ orders }: { orders: OrderRow[] }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function run(fn: () => Promise<unknown>) {
    setError(null);
    startTransition(async () => {
      try {
        await fn();
      } catch {
        setError("Something went wrong. Please try again.");
      }
    });
  }

  if (orders.length === 0) {
    return <EmptyState>No orders yet.</EmptyState>;
  }

  // Shared per-row controls — reused by the desktop table and the mobile cards.
  const statusSelect = (o: OrderRow) => (
    <Select
      className="w-full sm:w-32"
      value={o.status}
      disabled={pending}
      onChange={(e) => run(() => setOrderStatus(o.id, e.target.value as OrderStatus))}
    >
      <option value="PENDING">Pending</option>
      <option value="PAID">Paid</option>
      <option value="CANCELLED">Cancelled</option>
    </Select>
  );

  const proof = (o: OrderRow) =>
    o.proofUrl ? (
      <a href={o.proofUrl} target="_blank" rel="noopener noreferrer">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={o.proofUrl}
          alt="Payment proof"
          className="h-12 w-12 rounded border border-gray-200 object-cover hover:opacity-80"
        />
      </a>
    ) : (
      <span className="text-xs text-gray-400">none</span>
    );

  const deleteButton = (o: OrderRow) => (
    <Button
      variant="danger"
      disabled={pending}
      onClick={() => {
        if (confirm(`Delete order from ${o.name}?`)) run(() => deleteOrder(o.id));
      }}
    >
      Delete
    </Button>
  );

  return (
    <div>
      {error && (
        <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      {/* Desktop / tablet: table */}
      <div className="hidden overflow-x-auto rounded-xl border border-gray-200 bg-white md:block">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
            <tr>
              <th className="px-4 py-3">Buyer</th>
              <th className="px-4 py-3">School / qty</th>
              <th className="px-4 py-3">Amount</th>
              <th className="px-4 py-3">Proof</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className={cn("divide-y divide-gray-100", pending && "opacity-60")}>
            {orders.map((o) => (
              <tr key={o.id}>
                <td className="px-4 py-3">
                  <div className="font-medium text-gray-900">{o.name}</div>
                  <div className="text-xs text-gray-500">{o.email}</div>
                  <div className="text-xs text-gray-400">
                    {new Date(o.createdAt).toLocaleDateString()}
                    {o.reference ? ` · ref ${o.reference}` : ""}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <div className="text-gray-800">{o.schoolName ?? "—"}</div>
                  <div className="text-xs text-gray-500">
                    {o.schools} school{o.schools === 1 ? "" : "s"}
                  </div>
                </td>
                <td className="px-4 py-3 font-medium text-gray-900">
                  {formatMoney(o.amount)}
                </td>
                <td className="px-4 py-3">{proof(o)}</td>
                <td className="px-4 py-3">
                  {statusSelect(o)}
                  <div className="mt-1">
                    <Badge color={statusColor[o.status]}>{o.status}</Badge>
                  </div>
                </td>
                <td className="px-4 py-3 text-right">{deleteButton(o)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile: stacked cards */}
      <div className="space-y-3 md:hidden">
        {orders.map((o) => (
          <div
            key={o.id}
            className={cn(
              "rounded-xl border border-gray-200 bg-white p-4",
              pending && "opacity-60",
            )}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="font-medium text-gray-900">{o.name}</div>
                <div className="truncate text-xs text-gray-500">{o.email}</div>
                <div className="text-xs text-gray-400">
                  {new Date(o.createdAt).toLocaleDateString()}
                  {o.reference ? ` · ref ${o.reference}` : ""}
                </div>
              </div>
              <Badge color={statusColor[o.status]}>{o.status}</Badge>
            </div>

            <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 text-sm">
              <div className="col-span-2">
                <dt className="text-xs font-medium uppercase tracking-wide text-gray-500">
                  School
                </dt>
                <dd className="text-gray-800">
                  {o.schoolName ?? "—"}{" "}
                  <span className="text-xs text-gray-500">
                    ({o.schools} school{o.schools === 1 ? "" : "s"})
                  </span>
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-gray-500">
                  Amount
                </dt>
                <dd className="font-medium text-gray-900">{formatMoney(o.amount)}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-gray-500">
                  Proof
                </dt>
                <dd className="mt-1">{proof(o)}</dd>
              </div>
            </dl>

            <div className="mt-3">
              <span className="text-xs font-medium uppercase tracking-wide text-gray-500">
                Status
              </span>
              <div className="mt-1">{statusSelect(o)}</div>
            </div>

            <div className="mt-3 flex flex-wrap gap-2">{deleteButton(o)}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
