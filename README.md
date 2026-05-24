# Exam System

A web app for teachers to **build exams, grade them (automatically or manually), and export reports** — with an **admin dashboard** for granting access, and aligned with **Lebanese MEHE** conventions (grading out of 20, official subjects, Arabic/French/English support).

## Features

| Requirement | How it works |
|---|---|
| **Auto-generate exam complexity** | "Auto-fill by difficulty" pulls questions from your bank to hit an easy/medium/hard mix. Plus AI generation of brand-new questions by topic & difficulty. |
| **Add questions manually** | Full question editor: MCQ, True/False, Short answer, Essay. |
| **Auto correction** | MCQ & True/False graded instantly on submit. Short answer & essay get an AI-suggested score + feedback. |
| **Manual correction** | Every answer's score is editable on the grading screen; teacher overrides anything. |
| **Editable score** | `autoScore` (system) vs `finalScore` (teacher) — final score wins and scales to the exam total. |
| **Excel / Word reports** | One-click `.xlsx` and `.docx` export per exam, with class statistics. |
| **Admin dashboard** | Admin approves/suspends users, assigns roles (Admin/Teacher/Student), manages subjects. New users stay **PENDING** until approved. |
| **MEHE alignment** | Default grading out of **20**, official subjects seeded (EN/AR/FR), RTL support, MEHE-styled report layout. |

## Tech stack

Next.js 16 (App Router) · TypeScript · Tailwind CSS · Prisma 6 + PostgreSQL · custom JWT-cookie auth (`jose`) · Anthropic Claude API · ExcelJS · docx.

## Prerequisites

- Node.js 20+ (you have v24)
- A PostgreSQL database (local install, Docker, or a free cloud DB like [Neon](https://neon.tech) / [Supabase](https://supabase.com))

## Setup

```powershell
# 1. Configure environment
copy .env.example .env
#    then edit .env — set DATABASE_URL and AUTH_SECRET (and ANTHROPIC_API_KEY for AI)

# 2. Create the database schema
npm run db:push

# 3. Seed the admin account + official subjects
npm run db:seed

# 4. Run
npm run dev
```

Open http://localhost:3000.

### Getting a database quickly

- **Cloud (easiest):** create a free project at https://neon.tech, copy the connection string into `DATABASE_URL`.
- **Docker:** `docker run --name exam-pg -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=exam_system -p 5432:5432 -d postgres:16`
- **Local install:** install PostgreSQL, create a database named `exam_system`, and update `DATABASE_URL`.

## Default login

After seeding, sign in with the admin credentials from your `.env`
(`ADMIN_EMAIL` / `ADMIN_PASSWORD`, default `admin@school.edu.lb` / `ChangeMe123!`).
**Change these before deploying.**

## Roles & flow

1. **Admin** approves new teacher/student accounts and manages subjects.
2. **Teacher** builds a question bank, creates an exam (manual + auto-fill + AI), publishes it, grades submissions, and exports reports.
3. **Student** takes published exams and views results once graded.

## Scripts

| Command | Purpose |
|---|---|
| `npm run dev` | Start the dev server |
| `npm run build` / `npm start` | Production build / serve |
| `npm run db:push` | Apply the Prisma schema to the DB (no migration files) |
| `npm run db:migrate` | Create + apply a migration (for versioned schema changes) |
| `npm run db:seed` | Seed admin + subjects |
| `npm run db:studio` | Open Prisma Studio to inspect data |

## Project structure

```
prisma/schema.prisma     Data model (users, subjects, questions, exams, submissions, answers)
prisma/seed.ts           Admin + official MEHE subjects
src/lib/                 prisma, session (jose), DAL (auth+roles), AI, grading, server actions
src/components/          Shared UI kit + app shell
src/app/(auth)/          Login / register
src/app/admin/           Admin dashboard (users, subjects)
src/app/teacher/         Question bank, exam builder, grading, reports
src/app/student/         Take exams, view results
```

## MEHE integration note

This build follows MEHE **standards** and produces MEHE-**styled** report files. A live
API/SSO connection to a government system is **not** included — that would require official
credentials and documentation from MEHE. When you have the exact official report template,
the export layout in `src/app/teacher/exams/[id]/report/*` can be matched precisely.
