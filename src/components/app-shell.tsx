import { NavLinks, type NavItem } from "@/components/nav-links";
import { LogoutButton } from "@/components/logout-button";
import { Badge } from "@/components/ui";
import { ChatWidget } from "@/components/assistant/chat-widget";
import { getBrandingForSchool } from "@/lib/settings";
import type { CurrentUser } from "@/lib/dal";

const roleColor = {
  ADMIN: "purple",
  SCHOOL_ADMIN: "blue",
  TEACHER: "blue",
  STUDENT: "green",
} as const;

export async function AppShell({
  user,
  nav,
  children,
}: {
  user: CurrentUser;
  nav: NavItem[];
  children: React.ReactNode;
}) {
  const { schoolName, logoDataUrl, themeColor } = await getBrandingForSchool(
    user.schoolId,
  );
  // Override the brand color for this school's users (cascades to bg-brand/text-brand).
  const themeStyle = themeColor
    ? ({ ["--brand"]: themeColor } as React.CSSProperties)
    : undefined;
  return (
    <div className="flex min-h-screen flex-col" style={themeStyle}>
      <div className="h-1 w-full bg-brand" />
      <header className="sticky top-0 z-10 border-b border-gray-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-4">
          <div className="flex items-center gap-6">
            <span className="flex min-w-0 items-center gap-2 text-base font-bold text-gray-900">
              {logoDataUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={logoDataUrl} alt="Logo" className="h-8 w-8 shrink-0 rounded object-contain" />
              )}
              <span className="truncate">{schoolName || "Exam System"}</span>
            </span>
            <NavLinks items={nav} />
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden text-right sm:block">
              <div className="text-sm font-medium text-gray-800">{user.name}</div>
              <div className="text-xs text-gray-500">{user.email}</div>
            </div>
            <Badge color={roleColor[user.role]}>{user.role}</Badge>
            <LogoutButton variant="ghost" />
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">{children}</main>
      {user.role !== "STUDENT" && (
        <ChatWidget userName={user.name} role={user.role} lang={user.language} />
      )}
    </div>
  );
}
