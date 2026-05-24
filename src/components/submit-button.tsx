"use client";

import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui";

export function SubmitButton({
  children,
  pendingText,
  variant,
  confirm: confirmMsg,
}: {
  children: React.ReactNode;
  pendingText?: string;
  variant?: "primary" | "secondary" | "danger" | "success";
  confirm?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      disabled={pending}
      variant={variant}
      onClick={(e) => {
        if (confirmMsg && !confirm(confirmMsg)) e.preventDefault();
      }}
    >
      {pending ? (pendingText ?? "Working…") : children}
    </Button>
  );
}
