import Link from "next/link";
import { Card, CardBody, Button } from "@/components/ui";

export default function ForgotPasswordPage() {
  return (
    <Card>
      <CardBody className="text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-blue-100 text-2xl">
          🔑
        </div>
        <h2 className="text-lg font-semibold text-gray-900">
          Reset your password
        </h2>
        <p className="mt-2 text-sm text-gray-500">
          Please contact your school administrator. They can set a new password
          for your account from the admin panel, then share it with you so you
          can sign in and change it.
        </p>
        <div className="mt-6">
          <Link href="/login">
            <Button variant="secondary">Back to sign in</Button>
          </Link>
        </div>
      </CardBody>
    </Card>
  );
}
