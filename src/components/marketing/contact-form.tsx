"use client";

import { useActionState, useRef } from "react";
import { sendContactMessage, type ContactState } from "@/lib/contact-actions";
import { Button, Input, Label, Textarea } from "@/components/ui";

export function ContactForm() {
  const [state, action, pending] = useActionState<ContactState, FormData>(
    sendContactMessage,
    undefined,
  );
  const ref = useRef<HTMLFormElement>(null);

  if (state?.ok && ref.current) ref.current.reset();

  return (
    <form ref={ref} action={action} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="c-name">Name</Label>
          <Input id="c-name" name="name" required />
        </div>
        <div>
          <Label htmlFor="c-email">Email</Label>
          <Input id="c-email" name="email" type="email" required />
        </div>
      </div>
      <div>
        <Label htmlFor="c-subject">Subject (optional)</Label>
        <Input id="c-subject" name="subject" />
      </div>
      <div>
        <Label htmlFor="c-message">Message</Label>
        <Textarea id="c-message" name="message" rows={5} required />
      </div>

      {state?.error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>
      )}
      {state?.ok && (
        <p className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">
          Thanks! Your message has been sent.
        </p>
      )}

      <Button type="submit" disabled={pending}>
        {pending ? "Sending…" : "Send message"}
      </Button>
    </form>
  );
}
