// Path: app/api/auth/reset-password/route.ts

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import nodemailer from "nodemailer";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

const supabaseServiceKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_SECRET_KEY ||
  process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl) {
  throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL");
}

if (!supabaseServiceKey) {
  throw new Error("Missing Supabase server key");
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});

function getSmtpConfig() {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || 587);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const fromName = process.env.SMTP_FROM_NAME || "PracticePilot";
  const fromEmail = process.env.SMTP_FROM_EMAIL || user;

  if (!host || !user || !pass || !fromEmail) {
    throw new Error("Missing SMTP configuration");
  }

  return {
    host,
    port,
    user,
    pass,
    fromName,
    fromEmail,
  };
}

async function sendResetEmail({
  email,
  resetLink,
}: {
  email: string;
  resetLink: string;
}) {
  const smtp = getSmtpConfig();

  const transporter = nodemailer.createTransport({
    host: smtp.host,
    port: smtp.port,
    secure: smtp.port === 465,
    auth: {
      user: smtp.user,
      pass: smtp.pass,
    },
  });

  await transporter.sendMail({
    from: `"${smtp.fromName}" <${smtp.fromEmail}>`,
    to: email,
    subject: "Reset your PracticePilot password",
    html: `
      <div style="font-family: Arial, sans-serif; color: #0B2F4F; line-height: 1.6;">
        <h2>Reset your PracticePilot password</h2>

        <p>Hi,</p>

        <p>We received a request to reset the password for your PracticePilot account.</p>

        <p>
          Click the button below to set a new password:
        </p>

        <p style="margin: 24px 0;">
          <a href="${resetLink}" style="background:#0B5CAB;color:#ffffff;text-decoration:none;padding:12px 18px;border-radius:8px;font-weight:bold;display:inline-block;">
            Reset password
          </a>
        </p>

        <p>If the button does not work, copy and paste this link into your browser:</p>

        <p style="word-break: break-all;">
          <a href="${resetLink}">${resetLink}</a>
        </p>

        <p>If you did not request this, you can ignore this email.</p>

        <p>Kind regards,<br />The PracticePilot Team</p>
      </div>
    `,
  });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const email = String(body.email || "").trim().toLowerCase();

    if (!email) {
      return NextResponse.json(
        { error: "Email is required." },
        { status: 400 }
      );
    }

    const siteUrl =
      process.env.NEXT_PUBLIC_SITE_URL ||
      process.env.NEXT_PUBLIC_APP_URL ||
      "https://practicepilot.co.za";

    const { data, error } = await supabase.auth.admin.generateLink({
      type: "recovery",
      email,
      options: {
        redirectTo: `${siteUrl}/reset-password`,
      },
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const resetLink =
      data.properties?.action_link ||
      data.properties?.email_otp ||
      "";

    if (!resetLink || !resetLink.startsWith("http")) {
      return NextResponse.json(
        { error: "Could not generate password reset link." },
        { status: 500 }
      );
    }

    await sendResetEmail({
      email,
      resetLink,
    });

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message ?? "Failed to send reset email." },
      { status: 500 }
    );
  }
}