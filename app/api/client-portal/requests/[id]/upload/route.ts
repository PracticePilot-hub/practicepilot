import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import nodemailer from "nodemailer";
import { getDocumentProviderAdapter } from "@/app/lib/documentProviders/index";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MAX_FILE_SIZE = 10 * 1024 * 1024;

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

function cleanFilename(value: string) {
  return value
    .replace(/[\\/:*?"<>|]/g, "-")
    .replace(/\s+/g, " ")
    .trim();
}

function normalisePath(value: string) {
  const parts = String(value || "")
    .split("/")
    .filter(Boolean);

  return `/${parts.join("/")}`;
}

function isInsideRoot(rootPath: string, requestedPath: string) {
  const root = normalisePath(rootPath);
  const requested = normalisePath(requestedPath);

  return requested === root || requested.startsWith(`${root}/`);
}

function smtpConfig() {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || 587);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const fromName = process.env.SMTP_FROM_NAME || "PracticePilot";
  const fromEmail = process.env.SMTP_FROM_EMAIL || user;

  if (!host || !user || !pass || !fromEmail) return null;

  return {
    host,
    port,
    user,
    pass,
    fromName,
    fromEmail,
  };
}

async function getPortalContext(request: Request) {
  const token = bearerToken(request);

  if (!token) {
    throw new Error("Not authenticated.");
  }

  const {
    data: { user },
    error: authError,
  } = await admin.auth.getUser(token);

  if (authError || !user) {
    throw new Error("Not authenticated.");
  }

  const { data: accessRows, error: accessError } = await admin
    .from("crm_client_portal_users")
    .select("id,organisation_id,client_id,is_active")
    .eq("auth_user_id", user.id)
    .eq("is_active", true);

  if (accessError) throw accessError;

  return {
    user,
    accessRows: accessRows || [],
  };
}

async function clientProviderContext(
  organisationId: string,
  clientId: string
) {
  const { data: client, error: clientError } = await admin
    .from("crm_clients")
    .select("id")
    .eq("id", clientId)
    .eq("organisation_id", organisationId)
    .maybeSingle();

  if (clientError) throw clientError;
  if (!client) throw new Error("Client not found.");

  const { data: mapping, error: mappingError } = await admin
    .from("crm_client_document_locations")
    .select(
      "id,organisation_id,client_id,provider_id,folder_id,folder_path,folder_name,is_primary,is_active"
    )
    .eq("organisation_id", organisationId)
    .eq("client_id", clientId)
    .eq("is_active", true)
    .eq("is_primary", true)
    .limit(1)
    .maybeSingle();

  if (mappingError) throw mappingError;

  if (!mapping) {
    throw new Error(
      "This client is not linked to a document-provider folder."
    );
  }

  const { data: provider, error: providerError } = await admin
    .from("organisation_document_providers")
    .select(
      "id,organisation_id,provider,provider_domain,provider_base_url,root_folder_path,access_token_encrypted,is_active"
    )
    .eq("id", mapping.provider_id)
    .eq("organisation_id", organisationId)
    .eq("is_active", true)
    .maybeSingle();

  if (providerError) throw providerError;

  if (!provider) {
    throw new Error(
      "The document provider linked to this client is no longer active."
    );
  }

  return {
    mapping,
    provider,
    adapter: getDocumentProviderAdapter(provider.provider),
  };
}

async function practiceRecipient(createdByUserId: string | null) {
  if (!createdByUserId) return "";

  const { data, error } = await admin.auth.admin.getUserById(
    createdByUserId
  );

  if (error) {
    console.error(
      "PORTAL RESPONSE PRACTICE USER LOOKUP ERROR:",
      error
    );
    return "";
  }

  return String(data?.user?.email || "").trim().toLowerCase();
}

async function getClientName(clientId: string) {
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

async function sendPracticeNotification(args: {
  to: string;
  clientName: string;
  requestTitle: string;
  fileName: string;
  practiceUrl: string;
}) {
  const smtp = smtpConfig();

  if (!smtp || !args.to) return false;

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
    to: args.to,
    subject: `${args.clientName} — client responded in PracticePilot`,
    text:
      `A client has uploaded a document in response to a PracticePilot request.\n\n` +
      `Client: ${args.clientName}\n` +
      `Request: ${args.requestTitle}\n` +
      `File: ${args.fileName}\n\n` +
      `Open Requests & Actions: ${args.practiceUrl}`,
  });

  return true;
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id: requestId } = await context.params;
    const portal = await getPortalContext(request);

    const { data: portalRequest, error: requestError } = await admin
      .from("crm_client_portal_requests")
      .select(
        "id,organisation_id,client_id,request_type,title,status,assigned_portal_user_id,requires_upload,upload_folder_path,upload_folder_name,created_by_user_id"
      )
      .eq("id", requestId)
      .maybeSingle();

    if (requestError) throw requestError;

    if (!portalRequest) {
      return NextResponse.json(
        { error: "Request not found." },
        { status: 404 }
      );
    }

    const access = portal.accessRows.find(
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

    if (portalRequest.request_type !== "document_request") {
      return NextResponse.json(
        { error: "This request does not accept a file upload." },
        { status: 400 }
      );
    }

    if (!portalRequest.requires_upload) {
      return NextResponse.json(
        { error: "A file upload is not required for this request." },
        { status: 400 }
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

    const folderPath = String(
      portalRequest.upload_folder_path || ""
    ).trim();

    if (!folderPath) {
      return NextResponse.json(
        {
          error:
            "This request does not have an upload destination. Please contact your accounting team.",
        },
        { status: 409 }
      );
    }

    const formData = await request.formData();
    const fileEntry = formData.get("file");

    if (!(fileEntry instanceof File)) {
      return NextResponse.json(
        { error: "Choose a file to upload." },
        { status: 400 }
      );
    }

    if (!fileEntry.name.trim()) {
      return NextResponse.json(
        { error: "The selected file does not have a valid name." },
        { status: 400 }
      );
    }

    if (fileEntry.size < 1) {
      return NextResponse.json(
        { error: "The selected file is empty." },
        { status: 400 }
      );
    }

    if (fileEntry.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        {
          error:
            "The file is larger than the current 10 MB portal upload limit.",
        },
        { status: 413 }
      );
    }

    const filename = cleanFilename(fileEntry.name);

    if (!filename) {
      return NextResponse.json(
        { error: "The file name is not valid." },
        { status: 400 }
      );
    }

    const { mapping, provider, adapter } =
      await clientProviderContext(
        portalRequest.organisation_id,
        portalRequest.client_id
      );

    if (!isInsideRoot(mapping.folder_path, folderPath)) {
      return NextResponse.json(
        {
          error:
            "The upload folder is outside this client's linked document root.",
        },
        { status: 403 }
      );
    }

    const bytes = await fileEntry.arrayBuffer();

    const uploadResult = await adapter.uploadFile({
      provider,
      folderPath,
      fileName: filename,
      contentType:
        fileEntry.type || "application/octet-stream",
      bytes,
    });

    const submittedAt = new Date().toISOString();

    const uploadRecord = {
      file_name: filename,
      provider: provider.provider,
      provider_path: uploadResult.path,
      folder_path: folderPath,
      folder_name: portalRequest.upload_folder_name || null,
      size_bytes: fileEntry.size,
      content_type: fileEntry.type || null,
      uploaded_at: submittedAt,
    };

    const { data: updatedRequest, error: updateError } = await admin
      .from("crm_client_portal_requests")
      .update({
        status: "submitted",
        submitted_at: submittedAt,
        response_text: JSON.stringify(uploadRecord),
        updated_at: submittedAt,
      })
      .eq("id", portalRequest.id)
      .eq("organisation_id", portalRequest.organisation_id)
      .eq("client_id", portalRequest.client_id)
      .select(
        "id,title,status,submitted_at,response_text,updated_at"
      )
      .single();

    if (updateError) {
      console.error(
        "CLIENT PORTAL REQUEST STATUS UPDATE FAILED AFTER PROVIDER UPLOAD:",
        updateError
      );

      return NextResponse.json(
        {
          error:
            "The file reached the document provider, but PracticePilot could not mark the request as submitted. Please contact your accounting team.",
          uploaded: true,
          provider_path: uploadResult.path,
        },
        { status: 500 }
      );
    }

    let notificationSent = false;

    try {
      const to = await practiceRecipient(
        portalRequest.created_by_user_id
      );
      const name = await getClientName(portalRequest.client_id);
      const origin = new URL(request.url).origin.replace(/\/+$/, "");

      notificationSent = await sendPracticeNotification({
        to,
        clientName: name,
        requestTitle: portalRequest.title,
        fileName: filename,
        practiceUrl:
          `${origin}/crm/client/${portalRequest.client_id}/portal-requests`,
      });
    } catch (mailError) {
      console.error(
        "CLIENT PORTAL UPLOAD PRACTICE EMAIL ERROR:",
        mailError
      );
    }

    return NextResponse.json({
      success: true,
      request: updatedRequest,
      uploaded_file: uploadRecord,
      notification_sent: notificationSent,
    });
  } catch (error) {
    console.error("CLIENT PORTAL REQUEST UPLOAD ERROR:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Could not upload the requested document.",
      },
      { status: 500 }
    );
  }
}
