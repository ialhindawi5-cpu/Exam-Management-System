import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/dal";
import { PageHeader } from "@/components/ui";
import { QuestionForm } from "../question-form";

export default async function NewQuestionPage() {
  await requireRole("TEACHER");
  const subjects = await prisma.subject.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });

  return (
    <>
      <PageHeader title="New question" description="Add a question to your bank." />
      <QuestionForm
        subjects={subjects}
        defaults={{
          type: "MCQ",
          difficulty: "MEDIUM",
          subjectId: null,
          language: "en",
          text: "",
          imageUrl: null,
          points: 1,
          required: false,
          options: ["", ""],
          correctIndex: 0,
          correctIndices: [],
          tfAnswer: "true",
          modelAnswer: "",
          keywords: [],
        }}
      />
    </>
  );
}
