import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/dal";
import { PageHeader } from "@/components/ui";
import { SettingsForm } from "./settings-form";

export default async function AdminSettingsPage() {
  await requireRole("ADMIN");

  const settings = await prisma.appSetting.findUnique({
    where: { id: "singleton" },
  });

  return (
    <>
      <PageHeader
        title="Settings"
        description="Default branding used when a user or exam has no school logo."
      />
      <SettingsForm
        initialSchoolName={settings?.schoolName ?? null}
        initialLogo={settings?.logoDataUrl ?? null}
      />
    </>
  );
}
