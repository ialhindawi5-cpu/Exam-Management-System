"use client";

import { useState, useTransition } from "react";
import { markMessageRead, deleteMessage } from "@/lib/contact-actions";
import { Badge, Button, EmptyState, cn } from "@/components/ui";

export type MessageRow = {
  id: string;
  name: string;
  email: string;
  subject: string | null;
  message: string;
  read: boolean;
  createdAt: string;
};

export function MessagesList({ messages }: { messages: MessageRow[] }) {
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

  if (messages.length === 0) {
    return <EmptyState>No messages yet.</EmptyState>;
  }

  return (
    <div className="space-y-3">
      {error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      )}
      {messages.map((m) => (
        <div
          key={m.id}
          className={cn(
            "rounded-xl border bg-white p-4",
            m.read ? "border-gray-200" : "border-blue-300 bg-blue-50/40",
            pending && "opacity-60",
          )}
        >
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <div className="flex items-center gap-2">
                <span className="font-medium text-gray-900">{m.name}</span>
                {!m.read && <Badge color="blue">New</Badge>}
              </div>
              <a
                href={`mailto:${m.email}`}
                className="text-xs text-gray-500 hover:text-brand"
              >
                {m.email}
              </a>
            </div>
            <span className="text-xs text-gray-400">
              {new Date(m.createdAt).toLocaleString()}
            </span>
          </div>

          {m.subject && (
            <p className="mt-2 text-sm font-medium text-gray-800">{m.subject}</p>
          )}
          <p className="mt-1 whitespace-pre-wrap text-sm text-gray-600">
            {m.message}
          </p>

          <div className="mt-3 flex flex-wrap justify-end gap-2">
            <a href={`mailto:${m.email}?subject=Re: ${encodeURIComponent(m.subject ?? "Your message")}`}>
              <Button variant="secondary">Reply</Button>
            </a>
            <Button
              variant="ghost"
              disabled={pending}
              onClick={() => run(() => markMessageRead(m.id, !m.read))}
            >
              {m.read ? "Mark unread" : "Mark read"}
            </Button>
            <Button
              variant="danger"
              disabled={pending}
              onClick={() => {
                if (confirm("Delete this message?")) run(() => deleteMessage(m.id));
              }}
            >
              Delete
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}
