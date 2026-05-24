import type { GlobalConfig } from "payload";

// Editable content for the public marketing landing page (src/app/page.tsx).
// Field defaults mirror the previously hardcoded copy so the page is unchanged
// until an admin edits it.
export const Homepage: GlobalConfig = {
  slug: "homepage",
  label: "Homepage",
  admin: {
    group: "Content",
    description: "Editable content for the public landing page.",
  },
  access: { read: () => true },
  fields: [
    // ── Hero ──────────────────────────────────────────────────────────────
    { name: "heroBadge", type: "text", defaultValue: "For schools, teachers & students" },
    {
      name: "heroTitle",
      type: "text",
      defaultValue: "Create, deliver, and grade exams — all in one place",
    },
    {
      name: "heroSubtitle",
      type: "textarea",
      defaultValue:
        "Build a question bank, generate exams (manually or with AI), grade automatically or by hand, and export polished reports.",
    },
    { name: "primaryCtaLabel", type: "text", defaultValue: "Get started" },
    { name: "secondaryCtaLabel", type: "text", defaultValue: "Explore features" },

    // ── Features ──────────────────────────────────────────────────────────
    { name: "featuresTitle", type: "text", defaultValue: "Features" },
    {
      name: "featuresSubtitle",
      type: "text",
      defaultValue: "Everything you need to run exams end to end.",
    },
    {
      name: "features",
      type: "array",
      admin: { description: "Feature cards shown in the Features section." },
      defaultValue: [
        {
          icon: "📚",
          title: "Rich question bank",
          body: "MCQ, true/false, short answer, and essay questions — with images and Arabic / French / English support.",
        },
        {
          icon: "✨",
          title: "AI assistance",
          body: "Generate fresh questions by topic and difficulty, and get AI-suggested scores for open answers.",
        },
        {
          icon: "🎯",
          title: "Smart exam builder",
          body: "Auto-fill an exam by difficulty mix to set its complexity, or hand-pick from your bank.",
        },
        {
          icon: "✅",
          title: "Auto & manual grading",
          body: "Objective questions grade instantly; every score stays editable, and you control when results are released.",
        },
        {
          icon: "🏫",
          title: "Multi-school",
          body: "Each school gets its own teachers, students, exams, logo, and theme color — kept fully separate.",
        },
        {
          icon: "📊",
          title: "Reports",
          body: "Export class results to styled Excel and Word documents with statistics, ready to share.",
        },
      ],
      fields: [
        { name: "icon", type: "text", admin: { description: "An emoji, e.g. 📚" } },
        { name: "title", type: "text", required: true },
        { name: "body", type: "textarea" },
      ],
    },

    // ── How it works ──────────────────────────────────────────────────────
    { name: "stepsTitle", type: "text", defaultValue: "How it works" },
    { name: "stepsSubtitle", type: "text", defaultValue: "From setup to results in four steps." },
    {
      name: "steps",
      type: "array",
      admin: { description: "Numbered steps (numbers are added automatically)." },
      defaultValue: [
        { title: "Admin sets up", body: "Create schools, approve users, and assign roles." },
        { title: "Teachers build exams", body: "Add questions, auto-fill by difficulty, and publish." },
        { title: "Students take exams", body: "Answer online; objective questions grade automatically." },
        { title: "Grade & export", body: "Adjust marks, release results, and download reports." },
      ],
      fields: [
        { name: "title", type: "text", required: true },
        { name: "body", type: "textarea" },
      ],
    },

    // ── About ─────────────────────────────────────────────────────────────
    { name: "aboutTitle", type: "text", defaultValue: "About us" },
    {
      name: "aboutBody",
      type: "textarea",
      defaultValue:
        "A complete examination platform built for schools. It gives administrators control over schools and users, lets teachers create and grade exams effortlessly, and gives students a clean place to take exams and see their results once released.",
    },

    // ── Contact ───────────────────────────────────────────────────────────
    { name: "contactTitle", type: "text", defaultValue: "Contact us" },
    {
      name: "contactBlurb",
      type: "textarea",
      defaultValue: "Questions or a request? Send a message and we’ll get back to you.",
    },
    { name: "contactEmail", type: "text", defaultValue: "i.alhindawi5@gmail.com" },
    { name: "contactPhone", type: "text", defaultValue: "+961 76 934110" },
  ],
};
