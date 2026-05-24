import { requireRole } from "@/lib/dal";
import { AppShell } from "@/components/app-shell";

const nav = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/schools", label: "Schools" },
  { href: "/admin/users", label: "Users" },
  { href: "/admin/subjects", label: "Subjects" },
  { href: "/admin/orders", label: "Orders" },
  { href: "/admin/messages", label: "Messages" },
  { href: "/admin/settings", label: "Settings" },
  // Payload CMS (separate admin) for editing page content & branding.
  { href: "/cms", label: "Content (CMS)" },
];

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireRole("ADMIN");
  return (
    <AppShell user={user} nav={nav}>
      {children}
    </AppShell>
  );
}
