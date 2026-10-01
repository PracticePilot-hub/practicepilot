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

if (!supabaseUrl) throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL");
if (!supabaseServiceKey) throw new Error("Missing Supabase server key");

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
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

  return { host, port, user, pass, fromName, fromEmail };
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const email = String(body?.email || "").trim().toLowerCase();

    if (!email || !email.includes("@")) {
      return NextResponse.json(
        { error: "Enter a valid email address." },
        { status: 400 }
      );
    }

    const { data, error } = await supabase.auth.admin.generateLink({
      type: "recovery",
      email,
    });

    if (error || !data?.properties?.hashed_token) {
      return NextResponse.json({
        success: true,
        message:
          "If that email address has a PracticePilot login, a password reset email has been sent.",
      });
    }

    const origin = new URL(request.url).origin.replace(/\/+$/, "");
    const tokenHash = String(data.properties.hashed_token).trim();

    const resetLink =
      `${origin}/portal-auth?token_hash=${encodeURIComponent(tokenHash)}` +
      `&type=recovery&next=${encodeURIComponent(
        "/reset-password?mode=update"
      )}`;

    const smtp = getSmtpConfig();

    const transporter = nodemailer.createTransport({
      host: smtp.host,
      port: smtp.port,
      secure: smtp.port === 465,
      auth: { user: smtp.user, pass: smtp.pass },
    });

    await transporter.sendMail({
      from: `"${smtp.fromName}" <${smtp.fromEmail}>`,
      to: email,
      subject: "Reset your PracticePilot password",
      html: `
        <div style="font-family:Arial,sans-serif;line-height:1.6;color:#0B2F4F;max-width:620px;margin:0 auto;">
          <div style="padding:22px 0;border-bottom:1px solid #D5DDE6;">
            <div style="font-size:22px;font-weight:800;">PracticePilot</div>
          </div>
          <div style="padding:26px 0;">
            <p>Hi,</p>
            <p>
              A password reset was requested for
              <strong>${escapeHtml(email)}</strong>.
            </p>
            <p style="margin:28px 0;">
              <a
                href="${resetLink}"
                style="display:inline-block;background:#0B5CAB;color:#ffffff;text-decoration:none;padding:12px 18px;font-weight:700;border-radius:8px;"
              >
                Reset Password
              </a>
            </p>
            <p style="font-size:13px;color:#64748b;">
              If you did not request this reset, you can ignore this email.
            </p>
          </div>
        </div>
      `,
    });

    return NextResponse.json({
      success: true,
      message:
        "If that email address has a PracticePilot login, a password reset email has been sent.",
    });
  } catch (error) {
    console.error("RESET PASSWORD REQUEST ERROR:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Could not send the password reset email.",
      },
      { status: 500 }
    );
  }
}
