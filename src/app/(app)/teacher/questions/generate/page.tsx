import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/dal";
import { aiEnabled } from "@/lib/ai";
import { PageHeader } from "@/components/ui";
import { GeneratePanel } from "./generate-panel";

export default async function GeneratePage() {
  await requireRole("TEACHER");
  const subjects = await prisma.subject.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });

  return (
    <>
      <PageHeader
        title="Generate questions with AI"
        description="Describe a topic; review and keep the questions you like."
      />
      <GeneratePanel subjects={subjects} enabled={aiEnabled()} />
    </>
  );
}
