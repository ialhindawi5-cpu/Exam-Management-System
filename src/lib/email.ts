import "server-only";
import { prisma } from "@/lib/prisma";

// Transactional email via Resend's HTTP API. We call the API with fetch (no SDK
// dependency, works on serverless) and read config lazily so importing this
// module never throws during `next build`. Email is always best-effort: callers
// wrap sends in try/catch so a mail failure never blocks the user's action.

function fromAddress(): string {
  // Resend's shared sender works out of the box for testing; set RESEND_FROM to
  // a verified-domain address (e.g. "Exam System <noreply@yourschool.com>") for
  // production deliverability.
  return process.env.RESEND_FROM || "Exam System <onboarding@resend.dev>";
}

// Public base URL for building links in emails (admin approval page, etc.).
function appBaseUrl(): string | null {
  if (process.env.NEXT_PUBLIC_APP_URL) {
    return process.env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "");
  }
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  }
  return null;
}

async function send(opts: {
  to: string[];
  subject: string;
  html: string;
  text: string;
}): Promise<void> {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    // Not configured — skip quietly so dev/registration still works.
    console.warn(`Email skipped (RESEND_API_KEY not set): ${opts.subject}`);
    return;
  }
  const to = Array.from(new Set(opts.to.map((e) => e.trim()).filter(Boolean)));
  if (to.length === 0) return;

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: fromAddress(),
      to,
      subject: opts.subject,
      html: opts.html,
      text: opts.text,
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Resend send failed (${res.status}): ${body}`);
  }
}

// Who gets the "new user awaiting approval" alert: the configured notification
// address(es) plus every ADMIN account's email, de-duplicated.
async function adminRecipients(): Promise<string[]> {
  const recipients = new Set<string>();
  const configured = process.env.ADMIN_NOTIFY_EMAIL;
  if (configured) {
    configured.split(",").map((s) => s.trim()).filter(Boolean).forEach((e) => recipients.add(e));
  }
  const admins = await prisma.user.findMany({
    where: { role: "ADMIN" },
    select: { email: true },
  });
  admins.forEach((a) => recipients.add(a.email));
  return Array.from(recipients);
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// ── Notifications ───────────────────────────────────────────────────────────

// Alert admins that a new teacher signed up and is PENDING approval.
export async function notifyAdminsOfPendingUser(u: {
  name: string;
  email: string;
  schoolName: string | null;
}): Promise<void> {
  const to = await adminRecipients();
  if (to.length === 0) return;

  const base = appBaseUrl();
  const link = base ? `${base}/admin/users` : null;
  const name = escapeHtml(u.name);
  const email = escapeHtml(u.email);
  const school = u.schoolName ? escapeHtml(u.schoolName) : "—";

  const html = `
    <h2>New user awaiting approval</h2>
    <p>A new teacher has registered and is waiting for your review:</p>
    <ul>
      <li><strong>Name:</strong> ${name}</li>
      <li><strong>Email:</strong> ${email}</li>
      <li><strong>School:</strong> ${school}</li>
    </ul>
    ${link ? `<p><a href="${link}">Review and approve or decline &rarr;</a></p>` : "<p>Open the admin Users page to approve or decline.</p>"}
  `.trim();

  const text = [
    "New user awaiting approval",
    "",
    `Name:   ${u.name}`,
    `Email:  ${u.email}`,
    `School: ${u.schoolName ?? "—"}`,
    "",
    link ? `Review: ${link}` : "Open the admin Users page to approve or decline.",
  ].join("\n");

  await send({ to, subject: `New user awaiting approval: ${u.name}`, html, text });
}

// Acknowledge to the new user that their registration was received and is
// pending an admin's review (approve or decline).
export async function notifyUserRegistrationReceived(u: {
  name: string;
  email: string;
}): Promise<void> {
  const name = escapeHtml(u.name);
  const html = `
    <h2>We received your registration</h2>
    <p>Hi ${name},</p>
    <p>Thanks for signing up. Your account is now <strong>pending review</strong>.
    An administrator will check your details and <strong>approve or decline</strong>
    your account. We'll email you as soon as a decision is made — you won't be able
    to sign in until then.</p>
  `.trim();
  const text = [
    `Hi ${u.name},`,
    "",
    "Thanks for signing up. Your account is now pending review. An administrator will",
    "check your details and approve or decline your account. We'll email you as soon",
    "as a decision is made — you won't be able to sign in until then.",
  ].join("\n");

  await send({ to: [u.email], subject: "We received your registration", html, text });
}

// Tell the user the outcome of the admin's review.
export async function notifyUserDecision(
  u: { name: string; email: string },
  approved: boolean,
): Promise<void> {
  const name = escapeHtml(u.name);
  const base = appBaseUrl();
  const loginLink = base ? `${base}/login` : null;

  const html = approved
    ? `
      <h2>Your account has been approved</h2>
      <p>Hi ${name},</p>
      <p>Good news — an administrator has <strong>approved</strong> your account.
      You can now sign in.</p>
      ${loginLink ? `<p><a href="${loginLink}">Sign in &rarr;</a></p>` : ""}
    `.trim()
    : `
      <h2>Your account request was declined</h2>
      <p>Hi ${name},</p>
      <p>An administrator has reviewed your registration and was unable to approve
      your account at this time. If you believe this is a mistake, please contact
      your school administrator.</p>
    `.trim();

  const text = approved
    ? [
        `Hi ${u.name},`,
        "",
        "Good news — an administrator has approved your account. You can now sign in.",
        loginLink ? `\nSign in: ${loginLink}` : "",
      ].join("\n")
    : [
        `Hi ${u.name},`,
        "",
        "An administrator has reviewed your registration and was unable to approve your",
        "account at this time. If you believe this is a mistake, please contact your",
        "school administrator.",
      ].join("\n");

  await send({
    to: [u.email],
    subject: approved ? "Your account has been approved" : "Your account request was declined",
    html,
    text,
  });
}
