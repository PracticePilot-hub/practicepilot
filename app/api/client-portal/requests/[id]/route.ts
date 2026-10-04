// Path: app/api/client-portal/requests/[id]/route.ts

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import nodemailer from "nodemailer";

export const dynamic = "force-dynamic";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const serviceKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_SECRET_KEY ||
  process.env.SUPABASE_SERVICE_KEY ||
  "";

if (!supabaseUrl) throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL");
if (!serviceKey) throw new Error("Missing Supabase server key");

const admin = createClient(supabaseUrl, serviceKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});

function bearerToken(request: Request) {
  return (request.headers.get("authorization") || "")
    .replace(/^Bearer\s+/i, "")
    .trim();
}

function getSmtpConfig() {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || 587);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const fromName = process.env.SMTP_FROM_NAME || "PracticePilot";
  const fromEmail = process.env.SMTP_FROM_EMAIL || user;

  if (!host || !user || !pass || !fromEmail) {
    throw new Error("Missing SMTP configuration.");
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

async function practiceRecipient(createdByUserId: string | null) {
  if (!createdByUserId) return "";

  const { data, error } = await admin.auth.admin.getUserById(
    createdByUserId
  );

  if (error) {
    console.error("PORTAL RESPONSE PRACTICE USER LOOKUP ERROR:", error);
    return "";
  }

  return String(data?.user?.email || "").trim().toLowerCase();
}

async function clientName(clientId: string) {
  const { data, error } = await admin
    .from("crm_clients")
    .select("client_name")
    .eq("id", clientId)
    .maybeSingle();

  if (error) {
    console.error("PORTAL RESPONSE CLIENT LOOKUP ERROR:", error);
    return "Client";
  }

  return String(data?.client_name || "Client").trim() || "Client";
}

async function sendPracticeResponseEmail(args: {
  to: string;
  clientName: string;
  requestTitle: string;
  responseLabel: string;
  responseDetail: string | null;
  practiceUrl: string;
}) {
  if (!args.to) return false;

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

  const detail = args.responseDetail
    ? `<div style="margin-top:8px;color:#526577;">${escapeHtml(
        args.responseDetail
      )}</div>`
    : "";

  await transporter.sendMail({
    from: `"${smtp.fromName}" <${smtp.fromEmail}>`,
    to: args.to,
    subject: `${args.clientName} — client responded in PracticePilot`,
    html: `
      <div style="font-family:Arial,sans-serif;line-height:1.55;color:#10233A;max-width:620px;margin:0 auto;">
        <div style="padding:22px 0;border-bottom:1px solid #D5DDE6;">
          <div style="font-size:22px;font-weight:800;">PracticePilot</div>
        </div>
        <div style="padding:24px 0;">
          <p>A client has responded to a portal request for <strong>${escapeHtml(
            args.clientName
          )}</strong>.</p>
          <div style="margin:18px 0;padding:16px;border:1px solid #DCE4EC;background:#F7FAFC;">
            <div style="font-size:16px;font-weight:800;margin-bottom:8px;">
              ${escapeHtml(args.requestTitle)}
            </div>
            <div><strong>Client response:</strong> ${escapeHtml(
              args.responseLabel
            )}</div>
            ${detail}
          </div>
          <p style="margin:24px 0;">
            <a
              href="${args.practiceUrl}"
              style="display:inline-block;background:#1768D2;color:#FFFFFF;text-decoration:none;padding:12px 18px;font-weight:700;"
            >
              Open Requests & Actions
            </a>
          </p>
        </div>
      </div>
    `,
  });

  return true;
}

async function portalContext(request: Request) {
  const token = bearerToken(request);

  if (!token) {
    return {
      error: NextResponse.json(
        { error: "Not authenticated." },
        { status: 401 }
      ),
      user: null,
      accessRows: [],
    };
  }

  const {
    data: { user },
    error: authError,
  } = await admin.auth.getUser(token);

  if (authError || !user) {
    return {
      error: NextResponse.json(
        { error: "Not authenticated." },
        { status: 401 }
      ),
      user: null,
      accessRows: [],
    };
  }

  const { data: accessRows, error: accessError } = await admin
    .from("crm_client_portal_users")
    .select("id,organisation_id,client_id,email,is_active")
    .eq("auth_user_id", user.id)
    .eq("is_active", true);

  if (accessError) throw accessError;

  return {
    error: null,
    user,
    accessRows: accessRows || [],
  };
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id: requestId } = await context.params;
    const ctx = await portalContext(request);

    if (ctx.error) return ctx.error;

    const body = await request.json().catch(() => ({}));

    const { data: portalRequest, error: loadError } = await admin
      .from("crm_client_portal_requests")
      .select(
        "id,organisation_id,client_id,request_type,title,status,assigned_portal_user_id,requires_response,requires_approval,created_by_user_id"
      )
      .eq("id", requestId)
      .maybeSingle();

    if (loadError) throw loadError;

    if (!portalRequest) {
      return NextResponse.json(
        { error: "Request not found." },
        { status: 404 }
      );
    }

    const access = ctx.accessRows.find(
      (row: any) =>
        row.organisation_id === portalRequest.organisation_id &&
        row.client_id === portalRequest.client_id &&
        (
          !portalRequest.assigned_portal_user_id ||
          portalRequest.assigned_portal_user_id === row.id
        )
    );

    if (!access) {
      return NextResponse.json(
        { error: "You do not have access to this request." },
        { status: 403 }
      );
    }

    if (
      ["submitted", "completed", "cancelled"].includes(
        String(portalRequest.status || "")
      )
    ) {
      return NextResponse.json(
        { error: "This request can no longer be changed." },
        { status: 409 }
      );
    }

    const action = String(body?.action || "").trim();
    const responseText =
      String(body?.response_text || "").trim() || null;

    const update: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    let responseLabel = "Submitted";
    let responseDetail: string | null = responseText;

    if (portalRequest.request_type === "question") {
      if (action !== "respond" || !responseText) {
        return NextResponse.json(
          { error: "A written response is required." },
          { status: 400 }
        );
      }

      update.response_text = responseText;
      responseLabel = "Written response submitted";
      responseDetail = responseText;
    } else if (portalRequest.request_type === "approval") {
      const choice = String(body?.approval_choice || "");

      if (!["approved", "declined"].includes(choice)) {
        return NextResponse.json(
          { error: "Choose Approve or Decline." },
          { status: 400 }
        );
      }

      update.response_text = JSON.stringify({
        decision: choice,
        comment: responseText,
      });
      responseLabel = choice === "approved" ? "Approved" : "Declined";
      responseDetail = responseText;
    } else if (portalRequest.request_type === "confirmation") {
      const choice = String(body?.confirmation_choice || "");

      if (!["confirmed", "cannot_confirm"].includes(choice)) {
        return NextResponse.json(
          { error: "Choose a confirmation option." },
          { status: 400 }
        );
      }

      update.response_text = JSON.stringify({
        confirmation: choice,
        comment: responseText,
      });
      responseLabel =
        choice === "confirmed" ? "Confirmed" : "Cannot confirm";
      responseDetail = responseText;
    } else {
      return NextResponse.json(
        {
          error:
            "Document requests must be completed through the upload action.",
        },
        { status: 400 }
      );
    }

    update.status = "submitted";
    update.submitted_at = new Date().toISOString();

    const { data, error } = await admin
      .from("crm_client_portal_requests")
      .update(update)
      .eq("id", requestId)
      .eq("organisation_id", portalRequest.organisation_id)
      .eq("client_id", portalRequest.client_id)
      .select(
        "id,request_type,title,status,response_text,submitted_at,updated_at"
      )
      .single();

    if (error) throw error;

    let notificationSent = false;

    try {
      const to = await practiceRecipient(
        portalRequest.created_by_user_id
      );
      const name = await clientName(portalRequest.client_id);
      const origin = new URL(request.url).origin.replace(/\/+$/, "");

      notificationSent = await sendPracticeResponseEmail({
        to,
        clientName: name,
        requestTitle: portalRequest.title,
        responseLabel,
        responseDetail,
        practiceUrl:
          `${origin}/crm/client/${portalRequest.client_id}/portal-requests`,
      });
    } catch (mailError) {
      console.error(
        "CLIENT PORTAL RESPONSE PRACTICE EMAIL ERROR:",
        mailError
      );
    }

    return NextResponse.json({
      success: true,
      request: data,
      notification_sent: notificationSent,
    });
  } catch (error) {
    console.error("CLIENT PORTAL REQUEST ACTION ERROR:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Could not submit the request.",
      },
      { status: 500 }
    );
  }
}
