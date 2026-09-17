import crypto from "crypto";
import nodemailer from "nodemailer";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_SECRET_KEY ||
  process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !serviceKey) {
  throw new Error("Missing Supabase admin environment variables.");
}

const admin = createClient(supabaseUrl, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

function getCredentialKey() {
  const secret =
    process.env.PRACTICEPILOT_EMAIL_CREDENTIAL_KEY ||
    process.env.PRACTICEPILOT_CREDENTIAL_KEY;

  if (!secret) {
    throw new Error(
      "Missing PRACTICEPILOT_EMAIL_CREDENTIAL_KEY environment variable."
    );
  }

  return crypto.createHash("sha256").update(secret).digest();
}

function decryptSecret(value: string) {
  const parts = String(value || "").split(":");

  if (parts.length !== 4 || parts[0] !== "v1") {
    throw new Error("Stored practice email credential is not valid.");
  }

  const key = getCredentialKey();
  const iv = Buffer.from(parts[1], "base64");
  const authTag = Buffer.from(parts[2], "base64");
  const encrypted = Buffer.from(parts[3], "base64");

  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(authTag);

  const decrypted = Buffer.concat([
    decipher.update(encrypted),
    decipher.final(),
  ]);

  return decrypted.toString("utf8");
}

async function getPracticeEmailSettings(organisationId: string) {
  const { data, error } = await admin
    .from("organisation_email_settings")
    .select(
      "sender_name, sender_email, reply_to_email, smtp_host, smtp_port, smtp_username, smtp_password_encrypted, encryption_mode, is_active"
    )
    .eq("organisation_id", organisationId)
    .maybeSingle();

  if (error) throw error;

  if (!data) {
    throw new Error(
      "This practice has not configured an outgoing email account in Settings → Email Sending."
    );
  }

  if (data.is_active === false) {
    throw new Error(
      "The practice outgoing email account is currently disabled."
    );
  }

  return {
    senderName: data.sender_name,
    senderEmail: data.sender_email,
    replyToEmail: data.reply_to_email || data.sender_email,
    smtpHost: data.smtp_host,
    smtpPort: Number(data.smtp_port || 587),
    smtpUsername: data.smtp_username,
    smtpPassword: decryptSecret(data.smtp_password_encrypted),
    encryptionMode: data.encryption_mode || "starttls",
  };
}

function escapeHtml(value: string | null | undefined) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}


async function sendHtmlMail(args: {
  organisationId: string;
  to: string;
  cc?: string | null;
  subject: string;
  heading: string;
  greetingName?: string | null;
  intro: string;
  bodyHtml?: string;
  actionLabel?: string;
  actionUrl?: string;
  footerNote?: string;
}) {
  const settings = await getPracticeEmailSettings(args.organisationId);

  const transporter = nodemailer.createTransport({
    host: settings.smtpHost,
    port: settings.smtpPort,
    secure: settings.encryptionMode === "ssl",
    requireTLS: settings.encryptionMode === "starttls",
    auth: {
      user: settings.smtpUsername,
      pass: settings.smtpPassword,
    },
  });

  const safeName = escapeHtml(args.greetingName || "there");

  const button =
    args.actionLabel && args.actionUrl
      ? `
        <p style="margin:24px 0;">
          <a href="${escapeHtml(args.actionUrl)}"
             style="background:#1758d5;color:#ffffff;text-decoration:none;padding:12px 18px;font-weight:700;display:inline-block;">
            ${escapeHtml(args.actionLabel)}
          </a>
        </p>
        <p style="font-size:12px;color:#64748b;">
          If the button does not work, copy and paste this link into your browser:<br />
          <a href="${escapeHtml(args.actionUrl)}">${escapeHtml(args.actionUrl)}</a>
        </p>
      `
      : "";

  await transporter.sendMail({
    from: `"${settings.senderName}" <${settings.senderEmail}>`,
    replyTo: settings.replyToEmail,
    to: args.to,
    cc: args.cc || undefined,
    subject: args.subject,
    html: `
      <div style="font-family:Arial,sans-serif;color:#10233a;line-height:1.55;max-width:720px;margin:0 auto;">
        <div style="background:#10233a;color:#ffffff;padding:18px 20px;">
          <div style="font-size:20px;font-weight:800;">${escapeHtml(
            settings.senderName
          )}</div>
          <div style="font-size:12px;color:#cbd5e1;">Secretarial Services · powered by PracticePilot</div>
        </div>

        <div style="border:1px solid #d8dee7;border-top:none;padding:22px 20px;">
          <p>Hi ${safeName},</p>

          <h2 style="margin:0 0 12px;color:#10233a;">
            ${escapeHtml(args.heading)}
          </h2>

          <p>${escapeHtml(args.intro)}</p>

          ${args.bodyHtml || ""}

          ${button}

          ${
            args.footerNote
              ? `<p style="margin-top:22px;font-size:12px;color:#64748b;">${escapeHtml(
                  args.footerNote
                )}</p>`
              : ""
          }

          <p style="margin-top:24px;">
            Kind regards,<br />
            <strong>${escapeHtml(settings.senderName)}</strong>
          </p>
        </div>
      </div>
    `,
  });
}

export async function sendMandateEmail(args: {
  organisationId: string;
  to: string;
  cc?: string | null;
  contactName?: string | null;
  workTitle: string;
  proposedEntityName?: string | null;
  mandateUrl: string;
}) {
  await sendHtmlMail({
    organisationId: args.organisationId,
    to: args.to,
    cc: args.cc,
    greetingName: args.contactName,
    subject: `Mandate: ${args.workTitle}`,
    heading: "Secretarial mandate ready for acceptance",
    intro:
      "Please review and accept the mandate for the secretarial work instructed.",
    bodyHtml: `
      <table style="border-collapse:collapse;width:100%;margin:18px 0;font-size:13px;">
        <tr>
          <td style="padding:8px;border-bottom:1px solid #e5eaf0;color:#64748b;">Work</td>
          <td style="padding:8px;border-bottom:1px solid #e5eaf0;font-weight:700;">${escapeHtml(
            args.workTitle
          )}</td>
        </tr>
        <tr>
          <td style="padding:8px;border-bottom:1px solid #e5eaf0;color:#64748b;">Entity / proposed name</td>
          <td style="padding:8px;border-bottom:1px solid #e5eaf0;font-weight:700;">${escapeHtml(
            args.proposedEntityName || "To be confirmed"
          )}</td>
        </tr>
      </table>
    `,
    actionLabel: "Review & Accept Mandate",
    actionUrl: args.mandateUrl,
    footerNote:
      "The same secure link will become your live progress page once the mandate has been accepted.",
  });
}

export async function sendMilestoneEmail(args: {
  organisationId: string;
  to: string;
  cc?: string | null;
  contactName?: string | null;
  workTitle: string;
  milestoneLabel: string;
  message: string;
  progressUrl: string;
}) {
  await sendHtmlMail({
    organisationId: args.organisationId,
    to: args.to,
    cc: args.cc,
    greetingName: args.contactName,
    subject: `Progress update: ${args.milestoneLabel}`,
    heading: args.milestoneLabel,
    intro: args.message,
    bodyHtml: `
      <p style="margin-top:18px;">
        <strong>Work order:</strong> ${escapeHtml(args.workTitle)}
      </p>
    `,
    actionLabel: "View Live Progress",
    actionUrl: args.progressUrl,
  });
}

export async function sendMandateAcceptedEmail(args: {
  organisationId: string;
  to: string;
  cc?: string | null;
  contactName?: string | null;
  workTitle: string;
  acceptanceReference: string;
  progressUrl: string;
}) {
  await sendHtmlMail({
    organisationId: args.organisationId,
    to: args.to,
    cc: args.cc,
    greetingName: args.contactName,
    subject: `Mandate accepted: ${args.workTitle}`,
    heading: "Mandate accepted",
    intro:
      "Thank you. Your instruction has been accepted and we can now proceed in accordance with the agreed payment rule.",
    bodyHtml: `
      <p>
        <strong>Acceptance reference:</strong><br />
        ${escapeHtml(args.acceptanceReference)}
      </p>
    `,
    actionLabel: "View Live Progress",
    actionUrl: args.progressUrl,
  });
}

export async function sendInternalMandateAcceptedNotice(args: {
  organisationId: string;
  acceptedByName: string;
  acceptedByEmail: string;
  workTitle: string;
  progressUrl: string;
}) {
  const settings = await getPracticeEmailSettings(args.organisationId);

  await sendHtmlMail({
    organisationId: args.organisationId,
    to: settings.replyToEmail || settings.senderEmail,
    greetingName: settings.senderName,
    subject: `Mandate accepted: ${args.workTitle}`,
    heading: "Client mandate accepted",
    intro: `${args.acceptedByName} (${args.acceptedByEmail}) accepted the mandate online.`,
    actionLabel: "Open Client Progress Page",
    actionUrl: args.progressUrl,
  });
}
