// Path: app/api/client-portal/requests/[id]/upload/route.ts

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

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

function firstText(...values: unknown[]) {
  for (const value of values) {
    const text = String(value ?? "").trim();
    if (text) return text;
  }

  return "";
}

function normaliseEgnyteDomain(value: string) {
  const text = value
    .trim()
    .replace(/^https?:\/\//i, "")
    .replace(/\/+$/g, "");

  if (!text) return "";

  return text.includes(".") ? text : `${text}.egnyte.com`;
}

function encodeEgnytePath(value: string) {
  return value
    .split("/")
    .filter(Boolean)
    .map((segment) => encodeURIComponent(segment))
    .join("/");
}

function cleanFilename(value: string) {
  return value
    .replace(/[\\/:*?"<>|]/g, "-")
    .replace(/\s+/g, " ")
    .trim();
}

function providerIdentity(row: Record<string, any>) {
  return firstText(
    row.provider_type,
    row.provider,
    row.provider_key,
    row.provider_name,
    row.name,
    row.type
  ).toLowerCase();
}

function mergedProviderConfig(row: Record<string, any>) {
  const nested = [
    row.settings,
    row.config,
    row.configuration,
    row.credentials,
    row.oauth,
    row.metadata,
  ].filter(
    (value) => value && typeof value === "object" && !Array.isArray(value)
  );

  return Object.assign({}, ...nested, row);
}

async function getPortalUser(request: Request) {
  const token = bearerToken(request);

  if (!token) {
    return {
      response: NextResponse.json(
        { error: "Not authenticated." },
        { status: 401 }
      ),
      user: null,
      accessRows: [] as any[],
    };
  }

  const {
    data: { user },
    error: authError,
  } = await admin.auth.getUser(token);

  if (authError || !user) {
    return {
      response: NextResponse.json(
        { error: "Not authenticated." },
        { status: 401 }
      ),
      user: null,
      accessRows: [] as any[],
    };
  }

  const { data: accessRows, error: accessError } = await admin
    .from("crm_client_portal_users")
    .select("id,organisation_id,client_id,is_active")
    .eq("auth_user_id", user.id)
    .eq("is_active", true);

  if (accessError) throw accessError;

  return {
    response: null as NextResponse | null,
    user,
    accessRows: accessRows || [],
  };
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id: requestId } = await context.params;
    const portal = await getPortalUser(request);

    if (portal.response) return portal.response;

    const { data: portalRequest, error: requestError } = await admin
      .from("crm_client_portal_requests")
      .select(
        "id,organisation_id,client_id,request_type,status,assigned_portal_user_id,requires_upload,upload_folder_path,upload_folder_name"
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

    const { data: providerRows, error: providerError } = await admin
      .from("organisation_document_providers")
      .select("*")
      .eq("organisation_id", portalRequest.organisation_id);

    if (providerError) throw providerError;

    const providerRow = (providerRows || []).find((row: any) => {
      const identity = providerIdentity(row);

      return (
        identity.includes("egnyte") &&
        row.is_active !== false &&
        row.active !== false &&
        row.enabled !== false
      );
    });

    if (!providerRow) {
      return NextResponse.json(
        {
          error:
            "The practice's Egnyte document provider is not available.",
        },
        { status: 409 }
      );
    }

    const provider = mergedProviderConfig(providerRow);

    const domain = normaliseEgnyteDomain(
      firstText(
        provider.egnyte_domain,
        provider.domain,
        provider.provider_domain,
        provider.subdomain,
        provider.host
      )
    );

    const accessToken = firstText(
      provider.access_token,
      provider.oauth_access_token,
      provider.egnyte_access_token,
      provider.token,
      provider.oauth_token
    );

    if (!domain || !accessToken) {
      return NextResponse.json(
        {
          error:
            "The practice's Egnyte connection is missing its saved domain or access token.",
        },
        { status: 409 }
      );
    }

    const filename = cleanFilename(fileEntry.name);

    if (!filename) {
      return NextResponse.json(
        { error: "The file name is not valid." },
        { status: 400 }
      );
    }

    const destinationPath =
      `${folderPath.replace(/\/+$/g, "")}/${filename}`;

    const uploadUrl =
      `https://${domain}/pubapi/v1/fs-content/` +
      encodeEgnytePath(destinationPath);

    const bytes = Buffer.from(await fileEntry.arrayBuffer());

    const egnyteResponse = await fetch(uploadUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type":
          fileEntry.type || "application/octet-stream",
      },
      body: bytes,
    });

    const egnyteText = await egnyteResponse.text();

    if (!egnyteResponse.ok) {
      let detail = egnyteText;

      try {
        const parsed = JSON.parse(egnyteText);
        detail =
          parsed?.errorMessage ||
          parsed?.message ||
          parsed?.error ||
          egnyteText;
      } catch {
        // Keep raw Egnyte response text.
      }

      throw new Error(
        detail
          ? `Egnyte upload failed: ${detail}`
          : `Egnyte upload failed with status ${egnyteResponse.status}.`
      );
    }

    const submittedAt = new Date().toISOString();

    const uploadRecord = {
      file_name: filename,
      provider: "egnyte",
      provider_path: destinationPath,
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
        "CLIENT PORTAL REQUEST STATUS UPDATE FAILED AFTER EGNYTE UPLOAD:",
        updateError
      );

      return NextResponse.json(
        {
          error:
            "The file reached Egnyte, but PracticePilot could not mark the request as submitted. Please contact your accounting team.",
          uploaded: true,
          provider_path: destinationPath,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      request: updatedRequest,
      uploaded_file: uploadRecord,
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
