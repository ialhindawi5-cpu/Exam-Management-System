import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/dal";
import { Card, CardBody, PageHeader, Button, Badge } from "@/components/ui";
import { formatMoney } from "@/lib/pricing";
import type { Role } from "@prisma/client";

export default async function AdminOverview() {
  await requireRole("ADMIN");

  const [schools, usersByRole, pendingUsers, subjects, orders, unreadMessages] =
    await Promise.all([
      prisma.school.count(),
      prisma.user.groupBy({ by: ["role"], _count: { _all: true } }),
      prisma.user.count({ where: { accessStatus: "PENDING" } }),
      prisma.subject.count(),
      prisma.order.findMany({ select: { amount: true, status: true } }),
      prisma.contactMessage.count({ where: { read: false } }),
    ]);

  const roleCount = (r: Role) =>
    usersByRole.find((g) => g.role === r)?._count._all ?? 0;
  const teachers = roleCount("TEACHER");
  const students = roleCount("STUDENT");
  const totalUsers = usersByRole.reduce((sum, g) => sum + g._count._all, 0);

  const paidOrders = orders.filter((o) => o.status === "PAID");
  const pendingOrders = orders.filter((o) => o.status === "PENDING").length;
  const revenue = paidOrders.reduce((sum, o) => sum + o.amount, 0);

  const stats: {
    label: string;
    value: string | number;
    href: string;
    hint?: string;
  }[] = [
    { label: "Schools", value: schools, href: "/admin/schools" },
    {
      label: "Users",
      value: totalUsers,
      href: "/admin/users",
      hint: `${teachers} teachers · ${students} students`,
    },
    {
      label: "Paid revenue",
      value: formatMoney(revenue),
      href: "/admin/orders",
      hint: `${paidOrders.length} paid · ${pendingOrders} pending`,
    },
    { label: "Subjects", value: subjects, href: "/admin/subjects" },
  ];

  return (
    <>
      <PageHeader
        title="Admin overview"
        description="Schools, users, payments, and messages at a glance."
        action={
          <Link href="/cms">
            <Button variant="secondary">Edit site content →</Button>
          </Link>
        }
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s) => (
          <Link key={s.label} href={s.href}>
            <Card className="h-full transition hover:shadow-md">
              <CardBody>
                <span className="text-3xl font-bold text-gray-900">{s.value}</span>
                <p className="mt-1 text-sm font-medium text-gray-700">{s.label}</p>
                {s.hint && <p className="mt-0.5 text-xs text-gray-400">{s.hint}</p>}
              </CardBody>
            </Card>
          </Link>
        ))}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card className={pendingUsers > 0 ? "border-yellow-300 bg-yellow-50" : ""}>
          <CardBody>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-800">
                  Pending user approvals
                </p>
                <p className="mt-1 text-xs text-gray-500">
                  New accounts waiting for access.
                </p>
              </div>
              <Badge color={pendingUsers > 0 ? "yellow" : "gray"}>
                {pendingUsers}
              </Badge>
            </div>
            <Link href="/admin/users" className="mt-3 inline-block">
              <Button variant="secondary">Review users</Button>
            </Link>
          </CardBody>
        </Card>

        <Card className={unreadMessages > 0 ? "border-blue-300 bg-blue-50" : ""}>
          <CardBody>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-800">Unread messages</p>
                <p className="mt-1 text-xs text-gray-500">
                  New contact-form submissions.
                </p>
              </div>
              <Badge color={unreadMessages > 0 ? "blue" : "gray"}>
                {unreadMessages}
              </Badge>
            </div>
            <Link href="/admin/messages" className="mt-3 inline-block">
              <Button variant="secondary">View messages</Button>
            </Link>
          </CardBody>
        </Card>
      </div>
    </>
  );
}
