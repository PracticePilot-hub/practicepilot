import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getDocumentProviderAdapter } from "@/app/lib/documentProviders/index";

export const dynamic = "force-dynamic";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const serviceKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_SECRET_KEY ||
  process.env.SUPABASE_SERVICE_KEY ||
  "";

if (!supabaseUrl) throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL");
if (!serviceKey) throw new Error("Missing Supabase service-role key");

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

export async function GET(request: Request) {
  try {
    const token = bearerToken(request);

    if (!token) {
      return NextResponse.json(
        { error: "Not authenticated." },
        { status: 401 }
      );
    }

    const {
      data: { user },
      error: authError,
    } = await admin.auth.getUser(token);

    if (authError || !user) {
      return NextResponse.json(
        { error: "Not authenticated." },
        { status: 401 }
      );
    }

    const url = new URL(request.url);
    const documentId = String(
      url.searchParams.get("document") || ""
    ).trim();

    if (!documentId) {
      return NextResponse.json(
        { error: "Document ID is required." },
        { status: 400 }
      );
    }

    const { data: documentRow, error: documentError } = await admin
      .from("crm_document_workflow")
      .select(
        "id,organisation_id,client_id,provider_path,document_name,workflow_status,client_visible"
      )
      .eq("id", documentId)
      .eq("client_visible", true)
      .eq("workflow_status", "approved")
      .maybeSingle();

    if (documentError) throw documentError;

    if (!documentRow) {
      return NextResponse.json(
        { error: "Document is not available in the Client Portal." },
        { status: 404 }
      );
    }

    const { data: access, error: accessError } = await admin
      .from("crm_client_portal_users")
      .select("id,can_view_documents,is_active,invitation_status")
      .eq("auth_user_id", user.id)
      .eq("organisation_id", documentRow.organisation_id)
      .eq("client_id", documentRow.client_id)
      .eq("is_active", true)
      .eq("invitation_status", "active")
      .maybeSingle();

    if (accessError) throw accessError;

    if (!access || !access.can_view_documents) {
      return NextResponse.json(
        { error: "You do not have access to this document." },
        { status: 403 }
      );
    }

    const { data: mapping, error: mappingError } = await admin
      .from("crm_client_document_locations")
      .select(
        "provider_id,folder_path,is_active,is_primary"
      )
      .eq("organisation_id", documentRow.organisation_id)
      .eq("client_id", documentRow.client_id)
      .eq("is_active", true)
      .eq("is_primary", true)
      .limit(1)
      .maybeSingle();

    if (mappingError) throw mappingError;

    if (!mapping) {
      throw new Error(
        "The client document provider is not linked."
      );
    }

    const { data: provider, error: providerError } = await admin
      .from("organisation_document_providers")
      .select(
        "id,organisation_id,provider,provider_domain,provider_base_url,root_folder_path,access_token_encrypted"
      )
      .eq("id", mapping.provider_id)
      .eq("organisation_id", documentRow.organisation_id)
      .eq("is_active", true)
      .maybeSingle();

    if (providerError) throw providerError;

    if (!provider) {
      throw new Error(
        "The client document provider is not available."
      );
    }

    const adapter = getDocumentProviderAdapter(provider.provider);

    const result = await adapter.downloadFile({
      provider,
      path: documentRow.provider_path,
    });

    return new NextResponse(result.bytes, {
      status: 200,
      headers: {
        "Content-Type":
          result.content_type || "application/octet-stream",
        "Content-Disposition":
          `attachment; filename="${encodeURIComponent(
            result.file_name || documentRow.document_name
          )}"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    console.error("CLIENT PORTAL DOWNLOAD ERROR:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Could not download the document.",
      },
      { status: 500 }
    );
  }
}
