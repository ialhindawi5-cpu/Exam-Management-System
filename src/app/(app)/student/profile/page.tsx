import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/dal";
import { PageHeader } from "@/components/ui";
import { ProfileForm } from "./profile-form";

export default async function StudentProfilePage() {
  const student = await requireRole("STUDENT");
  const user = await prisma.user.findUnique({
    where: { id: student.id },
    select: { name: true, email: true, gradeLevel: true },
  });

  return (
    <>
      <PageHeader title="My profile" description="Update your name and grade/class." />
      <ProfileForm
        name={user?.name ?? ""}
        email={user?.email ?? ""}
        gradeLevel={user?.gradeLevel ?? null}
      />
    </>
  );
}
