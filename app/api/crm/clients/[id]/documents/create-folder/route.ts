import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { decryptPracticeCredential } from "@/app/lib/practiceCredentialCrypto";

export const dynamic = "force-dynamic";

type ProviderRecord = {
  id: string;
  organisation_id: string;
  provider: "egnyte" | "google_drive" | "onedrive" | "dropbox" | "manual";
  provider_domain?: string | null;
  provider_base_url?: string | null;
  root_folder_path?: string | null;
  access_token_encrypted?: string | null;
};

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

function encodeEgnytePath(path: string) {
  return String(path || "")
    .split("/")
    .filter(Boolean)
    .map((part) => encodeURIComponent(part))
    .join("/");
}

function providerBaseUrl(provider: ProviderRecord) {
  return String(
    provider.provider_base_url ||
      `https://${provider.provider_domain}.egnyte.com`
  ).replace(/\/+$/, "");
}

function safeFolderName(value: string) {
  const name = String(value || "").trim();

  if (!name) throw new Error("Folder name is required.");
  if (name.length > 255) throw new Error("Folder name is too long.");

  if (/[\/\\]/.test(name) || name === "." || name === "..") {
    throw new Error("Folder names cannot contain / or \\.");
  }

  if (/[\u0000-\u001f]/.test(name)) {
    throw new Error("Folder name contains unsupported characters.");
  }

  return name;
}

async function egnyteError(response: Response, fallback: string) {
  const text = await response.text();

  let json: any = null;

  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }

  if (response.status === 401) {
    return new Error(
      "Egnyte token is no longer valid. Reconnect Egnyte in Settings."
    );
  }

  if (response.status === 409) {
    return new Error("A folder with that name already exists.");
  }

  return new Error(
    json?.error_description ||
      json?.message ||
      json?.Errors?.[0]?.description ||
      text ||
      `${fallback} (${response.status}).`
  );
}

async function createEgnyteFolder(
  provider: ProviderRecord,
  destinationPath: string
) {
  if (!provider.access_token_encrypted) {
    throw new Error(
      "Egnyte is not connected for this practice. Connect Egnyte in Settings first."
    );
  }

  const accessToken = decryptPracticeCredential(
    provider.access_token_encrypted
  );

  const response = await fetch(
    `${providerBaseUrl(provider)}/pubapi/v1/fs/${encodeEgnytePath(
      destinationPath
    )}`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        action: "add_folder",
      }),
      cache: "no-store",
    }
  );

  if (!response.ok) {
    throw await egnyteError(response, "Could not create Egnyte folder");
  }

  const json = await response.json().catch(() => ({}));

  return {
    id: json?.folder_id || json?.id || null,
    path: normalisePath(json?.path || destinationPath),
  };
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { profile, response } = await currentContext(request);
    if (response || !profile) return response;

    const { id: clientId } = await context.params;
    const organisationId = profile.organisation_id;

    const body = await request.json().catch(() => ({}));
    const parentPath = normalisePath(String(body?.parentPath || "").trim());
    const folderName = safeFolderName(body?.folderName);

    if (!parentPath || parentPath === "/") {
      return NextResponse.json(
        { error: "Parent folder is required." },
        { status: 400 }
      );
    }

    const { data: client, error: clientError } = await admin
      .from("crm_clients")
      .select("id")
      .eq("id", clientId)
      .eq("organisation_id", organisationId)
      .maybeSingle();

    if (clientError) throw clientError;

    if (!client) {
      return NextResponse.json(
        { error: "Client not found." },
        { status: 404 }
      );
    }

    const { data: mapping, error: mappingError } = await admin
      .from("crm_client_document_locations")
      .select(
        "id,organisation_id,client_id,provider_id,folder_path,is_primary,is_active"
      )
      .eq("organisation_id", organisationId)
      .eq("client_id", clientId)
      .eq("is_active", true)
      .eq("is_primary", true)
      .limit(1)
      .maybeSingle();

    if (mappingError) throw mappingError;

    if (!mapping) {
      return NextResponse.json(
        {
          error:
            "This client is not linked to a document-provider folder.",
        },
        { status: 400 }
      );
    }

    if (!isInsideRoot(mapping.folder_path, parentPath)) {
      return NextResponse.json(
        {
          error:
            "The new folder location is outside this client’s linked document root.",
        },
        { status: 403 }
      );
    }

    const destinationPath = normalisePath(`${parentPath}/${folderName}`);

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
      return NextResponse.json(
        {
          error:
            "The document provider linked to this client is no longer active.",
        },
        { status: 400 }
      );
    }

    const providerRecord = provider as ProviderRecord;

    if (providerRecord.provider !== "egnyte") {
      return NextResponse.json(
        {
          error: `New Folder is not enabled for ${providerRecord.provider} yet.`,
        },
        { status: 501 }
      );
    }

    const created = await createEgnyteFolder(
      providerRecord,
      destinationPath
    );

    return NextResponse.json({
      success: true,
      folder: {
        id: created.id,
        name: folderName,
        path: created.path,
        modified_at: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error("CLIENT DOCUMENT CREATE FOLDER ERROR:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Could not create the folder.",
      },
      { status: 500 }
    );
  }
}
