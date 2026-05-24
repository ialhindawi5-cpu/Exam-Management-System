import { redirect } from "next/navigation";
import { getCurrentUser, dashboardPathFor } from "@/lib/dal";
import { LogoutButton } from "@/components/logout-button";
import { Card, CardBody } from "@/components/ui";

export default async function PendingPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.accessStatus === "APPROVED") redirect(dashboardPathFor(user.role));
  if (user.accessStatus === "SUSPENDED") redirect("/suspended");

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardBody className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-yellow-100 text-2xl">
            ⏳
          </div>
          <h1 className="text-lg font-semibold text-gray-900">
            Awaiting approval
          </h1>
          <p className="mt-2 text-sm text-gray-500">
            Hi {user.name}, your account has been created but needs an
            administrator to approve access. You’ll be able to sign in once
            approved.
          </p>
          <div className="mt-6 flex justify-center">
            <LogoutButton />
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
