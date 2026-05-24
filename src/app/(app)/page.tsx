import Link from "next/link";
import { getSettings } from "@/lib/settings";
import { getHomepageContent } from "@/lib/payload";
import { MarketingNav } from "@/components/marketing/marketing-nav";
import { ContactForm } from "@/components/marketing/contact-form";

// Render on each request so edits made in the CMS (Payload) appear immediately,
// and so the production build never needs a database connection to prerender.
export const dynamic = "force-dynamic";

// Built-in defaults — used when the Payload "homepage" global has no content
// (or before the CMS is set up). Editing the homepage in /cms overrides these.
const DEFAULT_FEATURES = [
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
];

const DEFAULT_STEPS = [
  { title: "Admin sets up", body: "Create schools, approve users, and assign roles." },
  { title: "Teachers build exams", body: "Add questions, auto-fill by difficulty, and publish." },
  { title: "Students take exams", body: "Answer online; objective questions grade automatically." },
  { title: "Grade & export", body: "Adjust marks, release results, and download reports." },
];

export default async function HomePage() {
  const [settings, content] = await Promise.all([
    getSettings(),
    getHomepageContent(),
  ]);
  const brandName = settings.schoolName ?? "Exam Management System";

  // Editable copy, with built-in fallbacks.
  const heroBadge = content?.heroBadge || "For schools, teachers & students";
  const heroTitle =
    content?.heroTitle || "Create, deliver, and grade exams — all in one place";
  const heroSubtitle =
    content?.heroSubtitle ||
    "Build a question bank, generate exams (manually or with AI), grade automatically or by hand, and export polished reports.";
  const primaryCtaLabel = content?.primaryCtaLabel || "Get started";
  const secondaryCtaLabel = content?.secondaryCtaLabel || "Explore features";
  const featuresTitle = content?.featuresTitle || "Features";
  const featuresSubtitle =
    content?.featuresSubtitle || "Everything you need to run exams end to end.";
  const features = content?.features?.length ? content.features : DEFAULT_FEATURES;
  const stepsTitle = content?.stepsTitle || "How it works";
  const stepsSubtitle = content?.stepsSubtitle || "From setup to results in four steps.";
  const steps = content?.steps?.length ? content.steps : DEFAULT_STEPS;
  const aboutTitle = content?.aboutTitle || "About us";
  const aboutBody =
    content?.aboutBody ||
    `${brandName} is a complete examination platform built for schools. It gives administrators control over schools and users, lets teachers create and grade exams effortlessly, and gives students a clean place to take exams and see their results once released.`;
  const contactTitle = content?.contactTitle || "Contact us";
  const contactBlurb =
    content?.contactBlurb ||
    "Questions or a request? Send a message and we'll get back to you.";
  const contactEmail = content?.contactEmail || "i.alhindawi5@gmail.com";
  const contactPhone = content?.contactPhone || "+961 76 934110";

  return (
    <div id="home" className="flex min-h-screen flex-col bg-white">
      <MarketingNav brandName={brandName} logoDataUrl={settings.logoDataUrl} />

      {/* Hero */}
      <section className="bg-gradient-to-b from-blue-50 to-white">
        <div className="mx-auto max-w-6xl px-4 py-20 text-center">
          <span className="inline-block rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-brand">
            {heroBadge}
          </span>
          <h1 className="mx-auto mt-5 max-w-3xl text-4xl font-bold tracking-tight text-gray-900 sm:text-5xl">
            {heroTitle}
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-gray-600">{heroSubtitle}</p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link
              href="/cart"
              className="rounded-lg bg-brand px-6 py-3 text-sm font-semibold text-white hover:bg-blue-700"
            >
              {primaryCtaLabel}
            </Link>
            <a
              href="#features"
              className="rounded-lg border border-gray-300 bg-white px-6 py-3 text-sm font-semibold text-gray-800 hover:bg-gray-50"
            >
              {secondaryCtaLabel}
            </a>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="scroll-mt-20 py-20">
        <div className="mx-auto max-w-6xl px-4">
          <h2 className="text-center text-3xl font-bold text-gray-900">{featuresTitle}</h2>
          <p className="mx-auto mt-2 max-w-2xl text-center text-gray-600">
            {featuresSubtitle}
          </p>
          <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((f, i) => (
              <div
                key={f.title ?? i}
                className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm transition hover:shadow-md"
              >
                <div className="text-3xl">{f.icon}</div>
                <h3 className="mt-3 text-lg font-semibold text-gray-900">{f.title}</h3>
                <p className="mt-1 text-sm text-gray-600">{f.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Demo / How it works */}
      <section id="demo" className="scroll-mt-20 bg-gray-50 py-20">
        <div className="mx-auto max-w-6xl px-4">
          <h2 className="text-center text-3xl font-bold text-gray-900">{stepsTitle}</h2>
          <p className="mx-auto mt-2 max-w-2xl text-center text-gray-600">
            {stepsSubtitle}
          </p>
          <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {steps.map((s, i) => (
              <div key={s.title ?? i} className="rounded-2xl bg-white p-6 shadow-sm">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-brand text-sm font-bold text-white">
                  {i + 1}
                </div>
                <h3 className="mt-3 font-semibold text-gray-900">{s.title}</h3>
                <p className="mt-1 text-sm text-gray-600">{s.body}</p>
              </div>
            ))}
          </div>
          <div className="mt-10 text-center">
            <Link
              href="/login"
              className="rounded-lg bg-brand px-6 py-3 text-sm font-semibold text-white hover:bg-blue-700"
            >
              Try the live demo — Login
            </Link>
          </div>
        </div>
      </section>

      {/* About */}
      <section id="about" className="scroll-mt-20 py-20">
        <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 lg:grid-cols-2">
          <div>
            <h2 className="text-3xl font-bold text-gray-900">{aboutTitle}</h2>
            <p className="mt-4 whitespace-pre-line text-gray-600">{aboutBody}</p>
          </div>
          <div className="grid grid-cols-2 gap-4">
            {[
              ["3", "User roles"],
              ["4", "Question types"],
              ["3", "Languages"],
              ["∞", "Schools & exams"],
            ].map(([big, label]) => (
              <div key={label} className="rounded-2xl border border-gray-200 bg-white p-6 text-center">
                <div className="text-3xl font-bold text-brand">{big}</div>
                <div className="mt-1 text-sm text-gray-600">{label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Contact */}
      <section id="contact" className="scroll-mt-20 bg-gray-50 py-20">
        <div className="mx-auto grid max-w-6xl gap-10 px-4 lg:grid-cols-2">
          <div>
            <h2 className="text-3xl font-bold text-gray-900">{contactTitle}</h2>
            <p className="mt-3 text-gray-600">{contactBlurb}</p>
            <div className="mt-6 space-y-2 text-sm text-gray-600">
              <p>📧 {contactEmail}</p>
              <p>📱 {contactPhone}</p>
            </div>
          </div>
          <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
            <ContactForm />
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-200 bg-white">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-4 py-8 sm:flex-row">
          <span className="text-sm text-gray-500">
            © {new Date().getFullYear()} {brandName}. All rights reserved.
          </span>
          <nav className="flex gap-4 text-sm text-gray-500">
            <a href="#features" className="hover:text-gray-900">Features</a>
            <a href="#demo" className="hover:text-gray-900">Demo</a>
            <a href="#about" className="hover:text-gray-900">About</a>
            <a href="#contact" className="hover:text-gray-900">Contact</a>
            <Link href="/login" className="hover:text-gray-900">Login</Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
