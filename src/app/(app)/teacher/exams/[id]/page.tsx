import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/dal";
import { aiEnabled } from "@/lib/ai";
import {
  googleConfigured,
  getGoogleAccount,
  getValidAccessToken,
} from "@/lib/google";
import { getEmailCollection } from "@/lib/google-forms";
import { Card, CardBody, Badge, Button } from "@/components/ui";
import { ExamStatusActions } from "./exam-status-actions";
import { ExamMetaForm } from "./exam-meta-form";
import { GoogleFormPanel } from "./google-form-panel";
import { SchedulePublish } from "./schedule-publish";
import { ResponsesPanel } from "./responses-panel";
import { PdfImportPanel } from "./pdf-import-panel";
import {
  ExamQuestionsManager,
  type QuestionLite,
} from "./exam-questions-manager";
import type { ExamStatus } from "@prisma/client";

const statusColor: Record<ExamStatus, "yellow" | "green" | "gray"> = {
  DRAFT: "yellow",
  PUBLISHED: "green",
  CLOSED: "gray",
};

export default async function ExamBuilderPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ google?: string }>;
}) {
  const teacher = await requireRole("TEACHER");
  const { id } = await params;
  const { google } = await searchParams;
  const notice =
    google === "connected" ? "connected" : google === "error" ? "error" : null;

  const exam = await prisma.exam.findUnique({
    where: { id },
    include: {
      examQuestions: {
        orderBy: { order: "asc" },
        include: { question: { include: { subject: { select: { name: true } } } } },
      },
    },
  });
  if (!exam || exam.createdById !== teacher.id) notFound();

  const currentIds = exam.examQuestions.map((eq) => eq.questionId);

  const [subjects, bank, googleAccount, collectEmails] = await Promise.all([
    prisma.subject.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.question.findMany({
      where: { createdById: teacher.id, id: { notIn: currentIds } },
      orderBy: { createdAt: "desc" },
      include: { subject: { select: { name: true } } },
    }),
    getGoogleAccount(teacher.id),
    // Read the form's current email-collection setting (best-effort) so the
    // panel's toggle reflects reality. Only meaningful once a form exists.
    exam.googleFormId
      ? getValidAccessToken(teacher.id)
          .then((token) =>
            getEmailCollection({ accessToken: token, formId: exam.googleFormId! }),
          )
          .catch(() => null)
      : Promise.resolve<boolean | null>(null),
  ]);

  const current: QuestionLite[] = exam.examQuestions.map((eq) => ({
    id: eq.question.id,
    type: eq.question.type,
    text: eq.question.text,
    difficulty: eq.question.difficulty,
    points: eq.points ?? eq.question.points,
    language: eq.question.language,
    subjectName: eq.question.subject?.name,
  }));

  const available: QuestionLite[] = bank.map((q) => ({
    id: q.id,
    type: q.type,
    text: q.text,
    difficulty: q.difficulty,
    points: q.points,
    language: q.language,
    subjectName: q.subject?.name,
  }));

  return (
    <>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold text-gray-900">{exam.title}</h1>
            <Badge color={statusColor[exam.status]}>{exam.status}</Badge>
          </div>
          <p className="mt-1 text-sm text-gray-500">
            Graded out of {exam.totalMarks}
            {exam.durationMins ? ` · ${exam.durationMins} min` : ""}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link href={`/print/exams/${exam.id}`} target="_blank">
            <Button variant="secondary">Print / export PDF</Button>
          </Link>
          <Link href={`/print/exams/${exam.id}/answer-key`} target="_blank">
            <Button variant="secondary">Answer key (PDF)</Button>
          </Link>
          <ExamStatusActions examId={exam.id} status={exam.status} />
        </div>
      </div>

      <div className="mb-6">
        <ExamMetaForm
          exam={{
            id: exam.id,
            title: exam.title,
            description: exam.description,
            subjectId: exam.subjectId,
            language: exam.language,
            totalMarks: exam.totalMarks,
            durationMins: exam.durationMins,
          }}
          subjects={subjects}
        />
      </div>

      {exam.status !== "CLOSED" && (
        <div className="mb-6">
          <SchedulePublish
            examId={exam.id}
            status={exam.status}
            scheduledPublishFor={exam.scheduledPublishAt?.toISOString() ?? null}
            scheduledCloseFor={exam.scheduledCloseAt?.toISOString() ?? null}
            questionCount={exam.examQuestions.length}
            googleReady={googleConfigured() && Boolean(googleAccount)}
          />
        </div>
      )}

      <div className="mb-6">
        <GoogleFormPanel
          examId={exam.id}
          examStatus={exam.status}
          questionCount={exam.examQuestions.length}
          googleConfigured={googleConfigured()}
          connected={Boolean(googleAccount)}
          needsFormsScope={
            Boolean(googleAccount) &&
            !googleAccount?.scope?.includes("forms.body")
          }
          needsDriveScope={
            Boolean(googleAccount) &&
            !googleAccount?.scope?.includes("drive.file")
          }
          googleEmail={googleAccount?.googleEmail ?? null}
          form={
            exam.googleFormId
              ? {
                  url: exam.googleFormUrl,
                  editUrl: exam.googleFormEditUrl,
                  answerKeyReleased: Boolean(exam.answerKeyReleasedAt),
                  collectEmails,
                }
              : null
          }
          notice={notice}
        />
      </div>

      {exam.googleFormId && (
        <div className="mb-6">
          <ResponsesPanel examId={exam.id} aiEnabled={aiEnabled()} />
        </div>
      )}

      <div className="mb-6">
        <PdfImportPanel
          examId={exam.id}
          examLanguage={exam.language}
          enabled={aiEnabled()}
        />
      </div>

      {exam.examQuestions.length === 0 && (
        <Card className="mb-4 border-blue-200 bg-blue-50">
          <CardBody className="text-sm text-blue-800">
            Tip: you can generate fresh questions in the{" "}
            <Link href="/teacher/questions/generate" className="font-medium underline">
              AI generator
            </Link>{" "}
            first, then add them here.
          </CardBody>
        </Card>
      )}

      <ExamQuestionsManager
        examId={exam.id}
        current={current}
        available={available}
        subjects={subjects}
      />
    </>
  );
}
