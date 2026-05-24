export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-gray-50 to-gray-100 p-4">
      <div className="w-full max-w-md">
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-bold text-gray-900">
            Welcome to the Exam Management System
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Teacher exam management
          </p>
        </div>
        {children}
      </div>
    </div>
  );
}
