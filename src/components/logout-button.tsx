import { logout } from "@/lib/auth-actions";
import { Button } from "@/components/ui";

// Server-action form; works without client JS.
export function LogoutButton({
  variant = "secondary",
  className,
}: {
  variant?: "secondary" | "ghost";
  className?: string;
}) {
  return (
    <form action={logout} className={className}>
      <Button type="submit" variant={variant} className={className ? "w-full" : undefined}>
        Log out
      </Button>
    </form>
  );
}
