import { redirect } from "next/navigation";
import { getCurrentUser, dashboardPathFor } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { RegisterForm } from "./register-form";

export default async function RegisterPage() {
  const user = await getCurrentUser();
  if (user && user.accessStatus === "APPROVED") {
    redirect(dashboardPathFor(user.role));
  }
  const schools = await prisma.school.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });
  return <RegisterForm schools={schools} />;
}
