import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/dal";
import { PageHeader } from "@/components/ui";
import { MessagesList, type MessageRow } from "./messages-list";

export default async function AdminMessagesPage() {
  await requireRole("ADMIN");

  const messages = await prisma.contactMessage.findMany({
    orderBy: [{ read: "asc" }, { createdAt: "desc" }],
  });

  const rows: MessageRow[] = messages.map((m) => ({
    id: m.id,
    name: m.name,
    email: m.email,
    subject: m.subject,
    message: m.message,
    read: m.read,
    createdAt: m.createdAt.toISOString(),
  }));

  return (
    <>
      <PageHeader
        title="Messages"
        description="Submissions from the public contact form."
      />
      <MessagesList messages={rows} />
    </>
  );
}
