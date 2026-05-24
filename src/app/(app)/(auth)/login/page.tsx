import { redirect } from "next/navigation";
import { getCurrentUser, dashboardPathFor } from "@/lib/dal";
import { LoginForm } from "./login-form";

export default async function LoginPage() {
  const user = await getCurrentUser();
  if (user && user.accessStatus === "APPROVED") {
    redirect(dashboardPathFor(user.role));
  }
  return <LoginForm />;
}
