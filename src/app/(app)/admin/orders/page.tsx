import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/dal";
import { PageHeader } from "@/components/ui";
import { OrdersList, type OrderRow } from "./orders-list";

export default async function AdminOrdersPage() {
  await requireRole("ADMIN");

  const orders = await prisma.order.findMany({ orderBy: { createdAt: "desc" } });

  const rows: OrderRow[] = orders.map((o) => ({
    id: o.id,
    name: o.name,
    email: o.email,
    schoolName: o.schoolName,
    schools: o.schools,
    amount: o.amount,
    currency: o.currency,
    reference: o.reference,
    proofUrl: o.proofUrl,
    status: o.status,
    createdAt: o.createdAt.toISOString(),
  }));

  return (
    <>
      <PageHeader
        title="Orders"
        description="License purchases from the public cart. Review the proof, then mark each as paid."
      />
      <OrdersList orders={rows} />
    </>
  );
}
