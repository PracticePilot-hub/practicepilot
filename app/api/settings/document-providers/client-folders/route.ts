import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { decryptPracticeCredential } from "@/app/lib/practiceCredentialCrypto";

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

function canManage(profile: any) {
  return Boolean(
    profile?.is_practice_owner ||
      profile?.can_manage_practice_users ||
      ["Client Manager", "Admin", "Super Admin"].includes(
        String(profile?.role || "")
      )
  );
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
    .select(
      "id,user_id,organisation_id,role,access_enabled,can_access_crm,can_manage_practice_users,is_practice_owner"
    )
    .eq("user_id", user.id)
    .maybeSingle();

  if (
    error ||
    !profile ||
    !profile.organisation_id ||
    profile.access_enabled === false ||
    profile.can_access_crm === false ||
    !canManage(profile)
  ) {
    return {
      profile: null,
      response: NextResponse.json(
        { error: "Practice manager CRM access is required." },
        { status: 403 }
      ),
    };
  }

  return { profile, response: null };
}

async function getProvider(organisationId: string) {
  const { data, error } = await admin
    .from("organisation_document_providers")
    .select("*")
    .eq("organisation_id", organisationId)
    .eq("provider", "egnyte")
    .eq("is_active", true)
    .order("is_default", { ascending: false })
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) throw error;

  if (!data?.access_token_encrypted) {
    throw new Error(
      "Egnyte is not connected. Connect and test Egnyte first."
    );
  }

  return data;
}

function encodeEgnytePath(path: string) {
  return String(path || "")
    .split("/")
    .filter(Boolean)
    .map((part) => encodeURIComponent(part))
    .join("/");
}

async function listFolders(provider: any, path: string) {
  const token = decryptPracticeCredential(
    provider.access_token_encrypted
  );

  const baseUrl = String(
    provider.provider_base_url ||
      `https://${provider.provider_domain}.egnyte.com`
  ).replace(/\/+$/, "");

  const response = await fetch(
    `${baseUrl}/pubapi/v1/fs/${encodeEgnytePath(path)}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
      },
      cache: "no-store",
    }
  );

  const text = await response.text();

  let json: any = null;

  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }

  if (!response.ok) {
    if (response.status === 401) {
      throw new Error(
        "Egnyte token is no longer valid. Reconnect Egnyte in Document Providers."
      );
    }

    throw new Error(
      json?.error_description ||
        json?.message ||
        `Could not read Egnyte folder ${path} (${response.status}).`
    );
  }

  const folders = Array.isArray(json?.folders) ? json.folders : [];

  return folders.map((folder: any) => ({
    id:
      folder?.folder_id ||
      folder?.id ||
      folder?.group_id ||
      null,
    name:
      String(
        folder?.name ||
          folder?.folder_name ||
          folder?.path?.split("/").pop() ||
          ""
      ).trim(),
    path:
      String(
        folder?.path ||
          `${path.replace(/\/+$/, "")}/${folder?.name || ""}`
      ).trim(),
  }));
}

export async function GET(request: Request) {
  try {
    const { profile, response } = await currentContext(request);
    if (response || !profile) return response;

    const organisationId = profile.organisation_id;
    const provider = await getProvider(organisationId);

    const [clientsResult, mappingsResult, entityFolders, individualFolders] =
      await Promise.all([
        admin
          .from("crm_clients")
          .select(
            "id,client_name,client_code,client_category,relationship_status"
          )
          .eq("organisation_id", organisationId)
          .order("client_name", { ascending: true }),

        admin
          .from("crm_client_document_locations")
          .select(
            "id,client_id,folder_id,folder_path,folder_name,is_primary,is_active"
          )
          .eq("organisation_id", organisationId)
          .eq("provider_id", provider.id)
          .eq("is_active", true)
          .eq("is_primary", true),

        listFolders(provider, "/Shared/Entities"),
        listFolders(provider, "/Shared/Individuals"),
      ]);

    if (clientsResult.error) throw clientsResult.error;
    if (mappingsResult.error) throw mappingsResult.error;

    const mappingByClient = new Map(
      (mappingsResult.data || []).map((mapping: any) => [
        String(mapping.client_id),
        {
          id: mapping.id,
          folder_id: mapping.folder_id,
          folder_path: mapping.folder_path,
          folder_name: mapping.folder_name,
        },
      ])
    );

    const clients = (clientsResult.data || []).map((client: any) => ({
      ...client,
      mapping: mappingByClient.get(String(client.id)) || null,
    }));

    const folders = [
      ...entityFolders.map((folder: any) => ({
        ...folder,
        branch: "Entities",
      })),
      ...individualFolders.map((folder: any) => ({
        ...folder,
        branch: "Individuals",
      })),
    ].sort((a, b) =>
      String(a.name || "").localeCompare(String(b.name || ""))
    );

    return NextResponse.json({
      success: true,
      provider: {
        id: provider.id,
        root_folder_path: provider.root_folder_path || "/Shared",
      },
      clients,
      folders,
    });
  } catch (error) {
    console.error("EGNYTE CLIENT FOLDER MAPPING GET ERROR:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Could not load Egnyte client folders.",
      },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const { profile, response } = await currentContext(request);
    if (response || !profile) return response;

    const organisationId = profile.organisation_id;
    const provider = await getProvider(organisationId);
    const body = await request.json();

    const clientId = String(body.clientId || "").trim();
    const folderId = body.folderId ? String(body.folderId) : null;
    const folderPath = String(body.folderPath || "").trim();
    const folderName = String(body.folderName || "").trim();

    if (!clientId || !folderPath) {
      return NextResponse.json(
        { error: "Client and Egnyte folder are required." },
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
        { error: "The selected client does not belong to this practice." },
        { status: 400 }
      );
    }

    const { data: current, error: currentError } = await admin
      .from("crm_client_document_locations")
      .select("id")
      .eq("organisation_id", organisationId)
      .eq("client_id", clientId)
      .eq("provider_id", provider.id)
      .eq("is_primary", true)
      .eq("is_active", true)
      .limit(1)
      .maybeSingle();

    if (currentError) throw currentError;

    let mapping: any = null;

    if (current?.id) {
      const { data, error } = await admin
        .from("crm_client_document_locations")
        .update({
          folder_id: folderId,
          folder_path: folderPath,
          folder_name: folderName || null,
          is_primary: true,
          is_active: true,
          last_sync_status: "linked",
          last_sync_message: "Client linked to Egnyte folder.",
          last_sync_at: new Date().toISOString(),
        })
        .eq("id", current.id)
        .eq("organisation_id", organisationId)
        .select("id,folder_id,folder_path,folder_name")
        .single();

      if (error) throw error;
      mapping = data;
    } else {
      const { data, error } = await admin
        .from("crm_client_document_locations")
        .insert({
          organisation_id: organisationId,
          client_id: clientId,
          provider_id: provider.id,
          folder_id: folderId,
          folder_path: folderPath,
          folder_name: folderName || null,
          is_primary: true,
          is_active: true,
          last_sync_status: "linked",
          last_sync_message: "Client linked to Egnyte folder.",
          last_sync_at: new Date().toISOString(),
        })
        .select("id,folder_id,folder_path,folder_name")
        .single();

      if (error) throw error;
      mapping = data;
    }

    return NextResponse.json({
      success: true,
      mapping,
    });
  } catch (error) {
    console.error("EGNYTE CLIENT FOLDER MAPPING SAVE ERROR:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Could not save the Egnyte client folder.",
      },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const { profile, response } = await currentContext(request);
    if (response || !profile) return response;

    const organisationId = profile.organisation_id;
    const provider = await getProvider(organisationId);
    const body = await request.json();

    const clientId = String(body.clientId || "").trim();

    if (!clientId) {
      return NextResponse.json(
        { error: "Client is required." },
        { status: 400 }
      );
    }

    const { error } = await admin
      .from("crm_client_document_locations")
      .update({
        is_active: false,
        is_primary: false,
        last_sync_status: "unlinked",
        last_sync_message: "Client folder link removed in PracticePilot.",
        last_sync_at: new Date().toISOString(),
      })
      .eq("organisation_id", organisationId)
      .eq("client_id", clientId)
      .eq("provider_id", provider.id)
      .eq("is_active", true);

    if (error) throw error;

    return NextResponse.json({
      success: true,
    });
  } catch (error) {
    console.error("EGNYTE CLIENT FOLDER MAPPING DELETE ERROR:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Could not remove the Egnyte client folder link.",
      },
      { status: 500 }
    );
  }
}
