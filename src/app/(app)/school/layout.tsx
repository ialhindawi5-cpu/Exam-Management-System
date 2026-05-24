import { requireRole } from "@/lib/dal";
import { AppShell } from "@/components/app-shell";

const nav = [
  { href: "/school", label: "My School" },
  { href: "/school/users", label: "Users" },
];

export default async function SchoolAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireRole("SCHOOL_ADMIN");
  return (
    <AppShell user={user} nav={nav}>
      {children}
    </AppShell>
  );
}
