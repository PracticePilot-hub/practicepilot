import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  decryptPracticeCredential,
  encryptPracticeCredential,
} from "@/app/lib/practiceCredentialCrypto";

export const dynamic = "force-dynamic";

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL || "";

const serviceKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_SECRET_KEY ||
  process.env.SUPABASE_SERVICE_KEY ||
  "";

if (!supabaseUrl) {
  throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL");
}

if (!serviceKey) {
  throw new Error("Missing Supabase service-role key");
}

const admin = createClient(
  supabaseUrl,
  serviceKey,
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  }
);

function bearerToken(request: Request) {
  return (
    request.headers.get("authorization") || ""
  )
    .replace(/^Bearer\s+/i, "")
    .trim();
}

function canManage(profile: any) {
  return Boolean(
    profile?.is_practice_owner ||
      profile?.can_manage_practice_users ||
      [
        "Client Manager",
        "Admin",
        "Super Admin",
      ].includes(String(profile?.role || ""))
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

  const { data: profile, error } =
    await admin
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
        {
          error:
            "Practice manager CRM access is required.",
        },
        { status: 403 }
      ),
    };
  }

  return {
    profile,
    response: null,
  };
}

function encodeEgnytePath(path: string) {
  return String(path || "/Shared")
    .split("/")
    .filter(Boolean)
    .map((part) => encodeURIComponent(part))
    .join("/");
}

async function loadProvider(
  organisationId: string
) {
  const { data, error } = await admin
    .from("organisation_document_providers")
    .select("*")
    .eq("organisation_id", organisationId)
    .eq("provider", "egnyte")
    .eq("is_active", true)
    .order("is_default", {
      ascending: false,
    })
    .order("created_at", {
      ascending: true,
    })
    .limit(1)
    .maybeSingle();

  if (error) throw error;

  if (!data) {
    throw new Error(
      "Save the Egnyte settings first."
    );
  }

  return data;
}

async function readEgnyte(
  provider: any,
  accessToken: string
) {
  const baseUrl = String(
    provider.provider_base_url ||
      `https://${provider.provider_domain}.egnyte.com`
  ).replace(/\/+$/, "");

  const userResponse = await fetch(
    `${baseUrl}/pubapi/v1/userinfo`,
    {
      method: "GET",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json",
      },
      cache: "no-store",
    }
  );

  const userText =
    await userResponse.text();

  let userJson: any = null;

  try {
    userJson = userText
      ? JSON.parse(userText)
      : null;
  } catch {
    userJson = null;
  }

  if (!userResponse.ok) {
    throw new Error(
      userJson?.error_description ||
        userJson?.message ||
        `Egnyte user test failed (${userResponse.status}).`
    );
  }

  const rootPath =
    String(
      provider.root_folder_path ||
        "/Shared"
    ).trim() || "/Shared";

  const encodedPath =
    encodeEgnytePath(rootPath);

  const folderResponse = await fetch(
    `${baseUrl}/pubapi/v1/fs/${encodedPath}`,
    {
      method: "GET",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json",
      },
      cache: "no-store",
    }
  );

  const folderText =
    await folderResponse.text();

  let folderJson: any = null;

  try {
    folderJson = folderText
      ? JSON.parse(folderText)
      : null;
  } catch {
    folderJson = null;
  }

  if (!folderResponse.ok) {
    throw new Error(
      folderJson?.error_description ||
        folderJson?.message ||
        `Egnyte root-folder test failed (${folderResponse.status}).`
    );
  }

  const folders = Array.isArray(
    folderJson?.folders
  )
    ? folderJson.folders
    : [];

  const files = Array.isArray(
    folderJson?.files
  )
    ? folderJson.files
    : [];

  return {
    connected_user: {
      username:
        userJson?.username || null,
      email:
        userJson?.email || null,
      first_name:
        userJson?.first_name || null,
      last_name:
        userJson?.last_name || null,
      user_type:
        userJson?.user_type || null,
    },
    root: {
      path: rootPath,
      folder_count: folders.length,
      file_count: files.length,
    },
  };
}

async function markTest(
  providerId: string,
  organisationId: string,
  status: "passed" | "failed",
  message: string
) {
  await admin
    .from(
      "organisation_document_providers"
    )
    .update({
      last_test_status: status,
      last_test_message: message,
      last_tested_at:
        new Date().toISOString(),
    })
    .eq("id", providerId)
    .eq(
      "organisation_id",
      organisationId
    );
}

export async function POST(
  request: Request
) {
  try {
    const { profile, response } =
      await currentContext(request);

    if (response || !profile) {
      return response;
    }

    const organisationId =
      profile.organisation_id;

    const body = await request.json();

    const action = String(
      body.action || "test"
    )
      .trim()
      .toLowerCase();

    const provider =
      await loadProvider(
        organisationId
      );

    if (action === "connect") {
      const username = String(
        body.username || ""
      ).trim();

      const password = String(
        body.password || ""
      );

      if (!username) {
        return NextResponse.json(
          {
            error:
              "Egnyte username / email is required.",
          },
          { status: 400 }
        );
      }

      if (!password) {
        return NextResponse.json(
          {
            error:
              "Egnyte password is required.",
          },
          { status: 400 }
        );
      }

      if (!provider.client_id) {
        return NextResponse.json(
          {
            error:
              "The Egnyte API Client ID is not saved.",
          },
          { status: 400 }
        );
      }

      if (
        !provider.client_secret_encrypted
      ) {
        return NextResponse.json(
          {
            error:
              "The Egnyte Client Secret is not saved.",
          },
          { status: 400 }
        );
      }

      const clientSecret =
        decryptPracticeCredential(
          provider.client_secret_encrypted
        );

      const baseUrl = String(
        provider.provider_base_url ||
          `https://${provider.provider_domain}.egnyte.com`
      ).replace(/\/+$/, "");

      const tokenBody =
        new URLSearchParams();

      tokenBody.set(
        "client_id",
        String(provider.client_id)
      );

      tokenBody.set(
        "client_secret",
        clientSecret
      );

      tokenBody.set(
        "username",
        username
      );

      tokenBody.set(
        "password",
        password
      );

      tokenBody.set(
        "grant_type",
        "password"
      );

      const tokenResponse =
        await fetch(
          `${baseUrl}/puboauth/token`,
          {
            method: "POST",
            headers: {
              "Content-Type":
                "application/x-www-form-urlencoded",
              Accept:
                "application/json",
            },
            body: tokenBody.toString(),
            cache: "no-store",
          }
        );

      const tokenText =
        await tokenResponse.text();

      let tokenJson: any = null;

      try {
        tokenJson = tokenText
          ? JSON.parse(tokenText)
          : null;
      } catch {
        tokenJson = null;
      }

      if (
        !tokenResponse.ok ||
        !tokenJson?.access_token
      ) {
        const detail =
          tokenJson?.error_description ||
          tokenJson?.error ||
          tokenJson?.message ||
          tokenText ||
          `HTTP ${tokenResponse.status}`;

        await markTest(
          provider.id,
          organisationId,
          "failed",
          `Egnyte authentication failed: ${detail}`
        );

        throw new Error(
          `Egnyte authentication failed: ${detail}`
        );
      }

      const accessToken = String(
        tokenJson.access_token
      );

      const refreshToken =
        tokenJson.refresh_token
          ? String(
              tokenJson.refresh_token
            )
          : null;

      const expiresIn =
        Number(
          tokenJson.expires_in || 0
        ) || 0;

      const tokenExpiresAt =
        expiresIn > 0
          ? new Date(
              Date.now() +
                expiresIn * 1000
            ).toISOString()
          : null;

      const testResult =
        await readEgnyte(
          provider,
          accessToken
        );

      const updatePayload: Record<
        string,
        unknown
      > = {
        access_token_encrypted:
          encryptPracticeCredential(
            accessToken
          ),
        token_expires_at:
          tokenExpiresAt,
        last_test_status: "passed",
        last_test_message:
          `Connected as ${
            testResult.connected_user
              ?.email ||
            testResult.connected_user
              ?.username ||
            "Egnyte user"
          }. Root folder accessible.`,
        last_tested_at:
          new Date().toISOString(),
      };

      if (refreshToken) {
        updatePayload.refresh_token_encrypted =
          encryptPracticeCredential(
            refreshToken
          );
      }

      const { error: updateError } =
        await admin
          .from(
            "organisation_document_providers"
          )
          .update(updatePayload)
          .eq("id", provider.id)
          .eq(
            "organisation_id",
            organisationId
          );

      if (updateError) {
        throw updateError;
      }

      return NextResponse.json({
        success: true,
        connected: true,
        ...testResult,
      });
    }

    if (
      !provider.access_token_encrypted
    ) {
      return NextResponse.json(
        {
          error:
            "Egnyte has not been connected yet.",
        },
        { status: 400 }
      );
    }

    const accessToken =
      decryptPracticeCredential(
        provider.access_token_encrypted
      );

    try {
      const testResult =
        await readEgnyte(
          provider,
          accessToken
        );

      await markTest(
        provider.id,
        organisationId,
        "passed",
        `Connection test passed as ${
          testResult.connected_user
            ?.email ||
          testResult.connected_user
            ?.username ||
          "Egnyte user"
        }.`
      );

      return NextResponse.json({
        success: true,
        connected: true,
        ...testResult,
      });
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Egnyte connection test failed.";

      await markTest(
        provider.id,
        organisationId,
        "failed",
        message
      );

      throw error;
    }
  } catch (error) {
    console.error(
      "EGNYTE CONNECT / TEST ERROR:",
      error
    );

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Could not connect to Egnyte.",
      },
      { status: 500 }
    );
  }
}
