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

async function currentContext(request: Request) {
  const token = bearerToken(request);

  if (!token) {
    return {
      profile: null,
      response: NextResponse.json(
        { error: "Not authenticated." },
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
      profile: null,
      response: NextResponse.json(
        { error: "Not authenticated." },
        { status: 401 }
      ),
    };
  }

  const { data: profile, error } = await admin
    .from("user_profiles")
    .select("id,user_id,organisation_id,access_enabled,can_access_crm")
    .eq("user_id", user.id)
    .maybeSingle();

  if (
    error ||
    !profile ||
    !profile.organisation_id ||
    profile.access_enabled === false ||
    profile.can_access_crm === false
  ) {
    return {
      profile: null,
      response: NextResponse.json(
        { error: "CRM access is required." },
        { status: 403 }
      ),
    };
  }

  return { profile, response: null };
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
      "id,organisation_id,provider,provider_domain,provider_base_url,root_folder_path,access_token_encrypted"
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


function safeFileName(value: string) {
  return String(value || "document")
    .replace(/[\r\n"]/g, "_")
    .trim() || "document";
}

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { profile, response } = await currentContext(request);
    if (response || !profile) return response;

    const { id: clientId } = await context.params;
    const organisationId = profile.organisation_id;

    const url = new URL(request.url);
    const path = String(url.searchParams.get("path") || "").trim();
    const disposition =
      url.searchParams.get("disposition") === "inline"
        ? "inline"
        : "attachment";

    if (!path) {
      return NextResponse.json(
        { error: "File path is required." },
        { status: 400 }
      );
    }

    const { mapping, adapter, provider } =
      await clientProviderContext(organisationId, clientId);

    if (!isInsideRoot(mapping.folder_path, path)) {
      return NextResponse.json(
        {
          error:
            "The requested file is outside this client’s linked document root.",
        },
        { status: 403 }
      );
    }

    const result = await adapter.downloadFile({
      provider,
      path,
    });

    return new Response(result.bytes, {
      status: 200,
      headers: {
        "Content-Type": result.content_type,
        "Content-Disposition": `${disposition}; filename="${safeFileName(
          result.file_name
        )}"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    console.error("CLIENT DOCUMENT DOWNLOAD ERROR:", error);

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
