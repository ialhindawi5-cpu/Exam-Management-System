import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/dal";
import { PageHeader, Card, CardBody, EmptyState, Button } from "@/components/ui";
import { SchoolBrandingForm } from "./branding-form";

export default async function SchoolHome() {
  const admin = await requireRole("SCHOOL_ADMIN");

  if (!admin.schoolId) {
    return (
      <>
        <PageHeader title="My School" />
        <EmptyState>
          No school is assigned to your account yet. Please ask the system
          administrator to assign you to a school.
        </EmptyState>
      </>
    );
  }

  const school = await prisma.school.findUnique({ where: { id: admin.schoolId } });
  if (!school) {
    return (
      <>
        <PageHeader title="My School" />
        <EmptyState>Your assigned school could not be found.</EmptyState>
      </>
    );
  }

  const [teachers, students, exams] = await Promise.all([
    prisma.user.count({ where: { schoolId: school.id, role: "TEACHER" } }),
    prisma.user.count({ where: { schoolId: school.id, role: "STUDENT" } }),
    prisma.exam.count({ where: { schoolId: school.id } }),
  ]);

  const stats = [
    { label: "Teachers", value: teachers },
    { label: "Students", value: students },
    { label: "Exams", value: exams },
  ];

  return (
    <>
      <PageHeader
        title={school.name}
        description="Manage your school's branding and the users who belong to it."
        action={
          <Link href="/school/users">
            <Button variant="secondary">Manage users →</Button>
          </Link>
        }
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        {stats.map((s) => (
          <Card key={s.label}>
            <CardBody>
              <span className="text-3xl font-bold text-gray-900">{s.value}</span>
              <p className="mt-1 text-sm text-gray-500">{s.label}</p>
            </CardBody>
          </Card>
        ))}
      </div>

      <h2 className="mb-3 text-lg font-semibold text-gray-900">Branding &amp; design</h2>
      <SchoolBrandingForm
        name={school.name}
        logoDataUrl={school.logoDataUrl}
        themeColor={school.themeColor}
      />
    </>
  );
}
