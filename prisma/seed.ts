import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

// Official Lebanese (MEHE) general-education subjects with multilingual labels.
const SUBJECTS: { name: string; nameAr: string; nameFr: string }[] = [
  { name: "Arabic Language", nameAr: "اللغة العربية", nameFr: "Langue arabe" },
  { name: "French Language", nameAr: "اللغة الفرنسية", nameFr: "Langue française" },
  { name: "English Language", nameAr: "اللغة الإنكليزية", nameFr: "Langue anglaise" },
  { name: "Mathematics", nameAr: "الرياضيات", nameFr: "Mathématiques" },
  { name: "Physics", nameAr: "الفيزياء", nameFr: "Physique" },
  { name: "Chemistry", nameAr: "الكيمياء", nameFr: "Chimie" },
  { name: "Life Sciences", nameAr: "علوم الحياة", nameFr: "Sciences de la vie" },
  { name: "History", nameAr: "التاريخ", nameFr: "Histoire" },
  { name: "Geography", nameAr: "الجغرافيا", nameFr: "Géographie" },
  { name: "Civics", nameAr: "التربية الوطنية", nameFr: "Éducation civique" },
  { name: "Philosophy", nameAr: "الفلسفة", nameFr: "Philosophie" },
  { name: "Economics", nameAr: "الاقتصاد", nameFr: "Économie" },
  { name: "Information Technology", nameAr: "المعلوماتية", nameFr: "Informatique" },
];

async function main() {
  // Bootstrap admin (already APPROVED so it can sign in immediately).
  const email = process.env.ADMIN_EMAIL ?? "admin@school.edu.lb";
  const password = process.env.ADMIN_PASSWORD ?? "ChangeMe123!";
  const passwordHash = await bcrypt.hash(password, 10);

  await prisma.user.upsert({
    where: { email },
    update: { role: "ADMIN", accessStatus: "APPROVED" },
    create: {
      name: "Administrator",
      email,
      passwordHash,
      role: "ADMIN",
      accessStatus: "APPROVED",
    },
  });
  console.log(`✓ Admin ready: ${email}`);

  for (const s of SUBJECTS) {
    await prisma.subject.upsert({
      where: { name: s.name },
      update: { nameAr: s.nameAr, nameFr: s.nameFr },
      create: s,
    });
  }
  console.log(`✓ Seeded ${SUBJECTS.length} subjects`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
