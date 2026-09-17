import { NextResponse } from "next/server";
import nodemailer from "nodemailer";
import crypto from "crypto";

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

function encryptSecret(value: string) {
  const key = getCredentialKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);

  const encrypted = Buffer.concat([
    cipher.update(value, "utf8"),
    cipher.final(),
  ]);

  const authTag = cipher.getAuthTag();

  return [
    "v1",
    iv.toString("base64"),
    authTag.toString("base64"),
    encrypted.toString("base64"),
  ].join(":");
}

function decryptSecret(value: string) {
  const parts = String(value || "").split(":");

  if (parts.length !== 4 || parts[0] !== "v1") {
    throw new Error("Stored email credential is not in a supported format.");
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

import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";
export const revalidate = 0;
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

async function currentProfile(request: Request) {
  const token = (request.headers.get("authorization") || "")
    .replace(/^Bearer\s+/i, "")
    .trim();

  if (!token) {
    return {
      profile: null as any,
      response: NextResponse.json(
        { success: false, error: "Not authenticated." },
        { status: 401 }
      ),
    };
  }

  const {
    data: { user },
    error: authError,
  } = await admin.auth.getUser(token);

  if (authError || !user) {
    return {
      profile: null as any,
      response: NextResponse.json(
        { success: false, error: "Not authenticated." },
        { status: 401 }
      ),
    };
  }

  const { data: profile, error } = await admin
    .from("user_profiles")
    .select(
      "user_id, organisation_id, role, access_enabled, can_manage_practice_users"
    )
    .eq("user_id", user.id)
    .maybeSingle();

  if (error || !profile || profile.access_enabled === false) {
    return {
      profile: null as any,
      response: NextResponse.json(
        { success: false, error: "Access denied." },
        { status: 403 }
      ),
    };
  }

  const canManage =
    profile.role === "Super Admin" ||
    profile.role === "Admin" ||
    profile.role === "Client Manager" ||
    profile.can_manage_practice_users === true;

  if (!canManage) {
    return {
      profile: null as any,
      response: NextResponse.json(
        {
          success: false,
          error:
            "Only an authorised practice manager may configure outgoing email.",
        },
        { status: 403 }
      ),
    };
  }

  if (!profile.organisation_id) {
    return {
      profile: null as any,
      response: NextResponse.json(
        { success: false, error: "Your user is not linked to a practice." },
        { status: 400 }
      ),
    };
  }

  return { profile, response: null as NextResponse | null };
}

function cleanEmail(value: unknown) {
  return String(value || "").trim();
}

function validEmail(value: string) {
  return value.includes("@") && value.includes(".");
}

function validateSettings(body: any, requirePassword: boolean) {
  const senderName = String(body?.senderName || "").trim();
  const senderEmail = cleanEmail(body?.senderEmail);
  const replyToEmail = cleanEmail(body?.replyToEmail);
  const smtpHost = String(body?.smtpHost || "").trim();
  const smtpPort = Number(body?.smtpPort || 587);
  const smtpUsername = String(body?.smtpUsername || "").trim();
  const smtpPassword = String(body?.smtpPassword || "");
  const encryptionMode = String(body?.encryptionMode || "starttls");

  if (!senderName) throw new Error("Sender name is required.");
  if (!validEmail(senderEmail)) throw new Error("A valid sender email is required.");

  if (replyToEmail && !validEmail(replyToEmail)) {
    throw new Error("Reply-to email is not valid.");
  }

  if (!smtpHost) throw new Error("SMTP host is required.");

  if (!Number.isInteger(smtpPort) || smtpPort <= 0 || smtpPort > 65535) {
    throw new Error("SMTP port is invalid.");
  }

  if (!smtpUsername) throw new Error("SMTP username is required.");

  if (requirePassword && !smtpPassword) {
    throw new Error("SMTP password is required.");
  }

  if (!["none", "starttls", "ssl"].includes(encryptionMode)) {
    throw new Error("Encryption mode is invalid.");
  }

  return {
    senderName,
    senderEmail,
    replyToEmail: replyToEmail || null,
    smtpHost,
    smtpPort,
    smtpUsername,
    smtpPassword,
    encryptionMode,
  };
}

function createTransport(settings: {
  smtpHost: string;
  smtpPort: number;
  smtpUsername: string;
  smtpPassword: string;
  encryptionMode: string;
}) {
  return nodemailer.createTransport({
    host: settings.smtpHost,
    port: settings.smtpPort,
    secure: settings.encryptionMode === "ssl",
    requireTLS: settings.encryptionMode === "starttls",
    auth: {
      user: settings.smtpUsername,
      pass: settings.smtpPassword,
    },
  });
}

export async function GET(request: Request) {
  try {
    const { profile, response } = await currentProfile(request);
    if (response) return response;

    const { data, error } = await admin
      .from("organisation_email_settings")
      .select(
        "id, sender_name, sender_email, reply_to_email, smtp_host, smtp_port, smtp_username, encryption_mode, is_active, last_test_status, last_tested_at, last_test_message, smtp_password_encrypted"
      )
      .eq("organisation_id", profile.organisation_id)
      .maybeSingle();

    if (error) throw error;

    return NextResponse.json({
      success: true,
      settings: data
        ? {
            id: data.id,
            sender_name: data.sender_name,
            sender_email: data.sender_email,
            reply_to_email: data.reply_to_email,
            smtp_host: data.smtp_host,
            smtp_port: data.smtp_port,
            smtp_username: data.smtp_username,
            encryption_mode: data.encryption_mode,
            is_active: data.is_active,
            last_test_status: data.last_test_status,
            last_tested_at: data.last_tested_at,
            last_test_message: data.last_test_message,
            password_configured: Boolean(data.smtp_password_encrypted),
          }
        : null,
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        error: error?.message || "Could not load email settings.",
      },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const { profile, response } = await currentProfile(request);
    if (response) return response;

    const body = await request.json();
    const action = String(body?.action || "save");

    const { data: existing, error: existingError } = await admin
      .from("organisation_email_settings")
      .select("*")
      .eq("organisation_id", profile.organisation_id)
      .maybeSingle();

    if (existingError) throw existingError;

    if (action === "save") {
      const values = validateSettings(body, !existing);

      let encryptedPassword = existing?.smtp_password_encrypted || null;

      if (values.smtpPassword) {
        encryptedPassword = encryptSecret(values.smtpPassword);
      }

      if (!encryptedPassword) {
        throw new Error("SMTP password is required.");
      }

      const payload = {
        organisation_id: profile.organisation_id,
        sender_name: values.senderName,
        sender_email: values.senderEmail,
        reply_to_email: values.replyToEmail,
        smtp_host: values.smtpHost,
        smtp_port: values.smtpPort,
        smtp_username: values.smtpUsername,
        smtp_password_encrypted: encryptedPassword,
        encryption_mode: values.encryptionMode,
        is_active: body?.isActive !== false,
        updated_at: new Date().toISOString(),
      };

      if (existing) {
        const { error } = await admin
          .from("organisation_email_settings")
          .update(payload)
          .eq("id", existing.id)
          .eq("organisation_id", profile.organisation_id);

        if (error) throw error;
      } else {
        const { error } = await admin
          .from("organisation_email_settings")
          .insert(payload);

        if (error) throw error;
      }

      return NextResponse.json({ success: true });
    }

    if (action === "test") {
      const values = validateSettings(
        body,
        !existing && !String(body?.smtpPassword || "")
      );

      let smtpPassword = values.smtpPassword;

      if (!smtpPassword && existing?.smtp_password_encrypted) {
        smtpPassword = decryptSecret(existing.smtp_password_encrypted);
      }

      if (!smtpPassword) {
        throw new Error("SMTP password is required before testing.");
      }

      const testEmail = cleanEmail(body?.testEmail);

      if (!validEmail(testEmail)) {
        throw new Error("Enter a valid test email address.");
      }

      const transporter = createTransport({
        ...values,
        smtpPassword,
      });

      let status: "success" | "failed" = "success";
      let message = "Test email sent successfully.";

      try {
        await transporter.verify();

        await transporter.sendMail({
          from: `"${values.senderName}" <${values.senderEmail}>`,
          to: testEmail,
          replyTo: values.replyToEmail || values.senderEmail,
          subject: "PracticePilot email connection test",
          html: `
            <div style="font-family:Arial,sans-serif;color:#10233a;line-height:1.5;">
              <h2>PracticePilot email connection test</h2>
              <p>This message confirms that your practice outgoing email account is working.</p>
              <p><strong>Sender:</strong> ${values.senderName} &lt;${values.senderEmail}&gt;</p>
            </div>
          `,
        });
      } catch (error: any) {
        status = "failed";
        message = error?.message || "Email connection test failed.";
      }

      if (existing) {
        await admin
          .from("organisation_email_settings")
          .update({
            last_test_status: status,
            last_tested_at: new Date().toISOString(),
            last_test_message: message,
            updated_at: new Date().toISOString(),
          })
          .eq("id", existing.id)
          .eq("organisation_id", profile.organisation_id);
      }

      if (status === "failed") {
        return NextResponse.json(
          { success: false, error: message },
          { status: 400 }
        );
      }

      return NextResponse.json({
        success: true,
        message,
      });
    }

    return NextResponse.json(
      { success: false, error: "Unknown email-settings action." },
      { status: 400 }
    );
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        error: error?.message || "Could not save email settings.",
      },
      { status: 500 }
    );
  }
}
