import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/dal";
import { PageHeader } from "@/components/ui";
import { SchoolEditForm } from "./edit-form";

export default async function EditSchoolPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireRole("ADMIN");
  const { id } = await params;

  const school = await prisma.school.findUnique({ where: { id } });
  if (!school) notFound();

  return (
    <>
      <PageHeader title={`Edit ${school.name}`} description="Update this school's name, logo, and theme color." />
      <SchoolEditForm
        id={school.id}
        name={school.name}
        logoDataUrl={school.logoDataUrl}
        themeColor={school.themeColor}
      />
    </>
  );
}
