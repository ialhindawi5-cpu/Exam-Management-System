import { requireRole } from "@/lib/dal";
import { AppShell } from "@/components/app-shell";

const nav = [
  { href: "/teacher", label: "Dashboard" },
  { href: "/teacher/questions", label: "Question Bank" },
  { href: "/teacher/exams", label: "Exams" },
];

export default async function TeacherLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireRole("TEACHER");
  return (
    <AppShell user={user} nav={nav}>
      {children}
    </AppShell>
  );
}
