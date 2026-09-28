import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { encryptPracticeCredential } from "@/app/lib/practiceCredentialCrypto";

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
  auth: { persistSession: false, autoRefreshToken: false },
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

  const { data: profile, error: profileError } = await admin
    .from("user_profiles")
    .select(
      "id,user_id,organisation_id,role,access_enabled,can_access_crm,can_manage_practice_users,is_practice_owner"
    )
    .eq("user_id", user.id)
    .maybeSingle();

  if (
    profileError ||
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

function cleanDomain(value: unknown) {
  return String(value || "")
    .trim()
    .replace(/^https?:\/\//i, "")
    .replace(/\.egnyte\.com\/?$/i, "")
    .replace(/\/+$/g, "");
}

function providerResponse(provider: any) {
  if (!provider) return null;

  return {
    id: provider.id,
    provider: provider.provider,
    display_name: provider.display_name || "Egnyte",
    provider_domain: provider.provider_domain || "",
    provider_base_url: provider.provider_base_url || "",
    root_folder_path: provider.root_folder_path || "/Shared",
    client_id: provider.client_id || "",
    is_active: provider.is_active !== false,
    is_default: provider.is_default === true,
    has_client_secret: Boolean(provider.client_secret_encrypted),
    has_access_token: Boolean(provider.access_token_encrypted),
    connection_status: provider.access_token_encrypted
      ? "Connected"
      : "Not connected",
    last_test_status: provider.last_test_status || null,
    last_test_message: provider.last_test_message || null,
    last_tested_at: provider.last_tested_at || null,
  };
}

export async function GET(request: Request) {
  try {
    const { profile, response } = await currentContext(request);
    if (response || !profile) return response;

    const { data: provider, error } = await admin
      .from("organisation_document_providers")
      .select("*")
      .eq("organisation_id", profile.organisation_id)
      .eq("provider", "egnyte")
      .eq("is_active", true)
      .order("is_default", { ascending: false })
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (error) throw error;

    return NextResponse.json({
      success: true,
      provider: providerResponse(provider),
    });
  } catch (error) {
    console.error("DOCUMENT PROVIDER GET ERROR:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Could not load document provider settings.",
      },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const { profile, response } = await currentContext(request);
    if (response || !profile) return response;

    const body = await request.json();

    const domain = cleanDomain(body.provider_domain);
    const clientId = String(body.client_id || "").trim();
    const clientSecret = String(body.client_secret || "");

    if (!domain) {
      return NextResponse.json(
        { error: "Egnyte domain is required." },
        { status: 400 }
      );
    }

    if (!clientId) {
      return NextResponse.json(
        { error: "Egnyte API Client ID is required." },
        { status: 400 }
      );
    }

    const baseUrl = `https://${domain}.egnyte.com`;

    const { data: existing, error: existingError } = await admin
      .from("organisation_document_providers")
      .select("*")
      .eq("organisation_id", profile.organisation_id)
      .eq("provider", "egnyte")
      .order("is_default", { ascending: false })
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (existingError) throw existingError;

    const payload: Record<string, unknown> = {
      organisation_id: profile.organisation_id,
      provider: "egnyte",
      display_name: String(body.display_name || "Egnyte").trim() || "Egnyte",
      provider_domain: domain,
      provider_base_url: baseUrl,
      root_folder_path:
        String(body.root_folder_path || "/Shared").trim() || "/Shared",
      auth_mode: "oauth",
      client_id: clientId,
      is_active: body.is_active !== false,
      is_default: true,
    };

    if (clientSecret.trim()) {
      payload.client_secret_encrypted =
        encryptPracticeCredential(clientSecret);
    }

    let saved: any = null;

    if (existing?.id) {
      const { data, error } = await admin
        .from("organisation_document_providers")
        .update(payload)
        .eq("id", existing.id)
        .eq("organisation_id", profile.organisation_id)
        .select("*")
        .single();

      if (error) throw error;
      saved = data;
    } else {
      if (!clientSecret.trim()) {
        return NextResponse.json(
          { error: "Egnyte Client Secret is required for the first setup." },
          { status: 400 }
        );
      }

      const { data, error } = await admin
        .from("organisation_document_providers")
        .insert(payload)
        .select("*")
        .single();

      if (error) throw error;
      saved = data;
    }

    return NextResponse.json({
      success: true,
      provider: providerResponse(saved),
    });
  } catch (error) {
    console.error("DOCUMENT PROVIDER SAVE ERROR:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Could not save document provider settings.",
      },
      { status: 500 }
    );
  }
}
