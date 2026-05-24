import { logout } from "@/lib/auth-actions";
import { Button } from "@/components/ui";

// Server-action form; works without client JS.
export function LogoutButton({
  variant = "secondary",
}: {
  variant?: "secondary" | "ghost";
}) {
  return (
    <form action={logout}>
      <Button type="submit" variant={variant}>
        Log out
      </Button>
    </form>
  );
}
