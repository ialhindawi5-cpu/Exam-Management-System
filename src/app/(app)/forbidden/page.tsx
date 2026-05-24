import Link from "next/link";
import { getCurrentUser, dashboardPathFor } from "@/lib/dal";
import { Card, CardBody, Button } from "@/components/ui";

export default async function ForbiddenPage() {
  const user = await getCurrentUser();
  const home = user ? dashboardPathFor(user.role) : "/login";

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardBody className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-gray-100 text-2xl">
            🔒
          </div>
          <h1 className="text-lg font-semibold text-gray-900">Access denied</h1>
          <p className="mt-2 text-sm text-gray-500">
            You don’t have permission to view this page.
          </p>
          <div className="mt-6 flex justify-center">
            <Link href={home}>
              <Button>Go to my dashboard</Button>
            </Link>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
