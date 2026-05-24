import { requireRole } from "@/lib/dal";
import { AppShell } from "@/components/app-shell";

const nav = [
  { href: "/student", label: "My Exams" },
  { href: "/student/profile", label: "Profile" },
];

export default async function StudentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireRole("STUDENT");
  return (
    <AppShell user={user} nav={nav}>
      {children}
    </AppShell>
  );
}
