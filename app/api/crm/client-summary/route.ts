import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

type UserProfile = {
  user_id: string;
  organisation_id: string | null;
  role: string;
  access_enabled: boolean;
};

function adminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SECRET_KEY ||
    process.env.SUPABASE_SERVICE_KEY;

  if (!url) throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL.");
  if (!key) throw new Error("Missing Supabase service-role key.");

  return createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

function bearerToken(request: Request) {
  return (request.headers.get("authorization") || "")
    .replace(/^Bearer\s+/i, "")
    .trim();
}

function isGlobalAdmin(role: string) {
  return role === "Super Admin" || role === "Admin";
}

export async function GET(request: Request) {
  try {
    const supabase = adminClient();
    const token = bearerToken(request);

    if (!token) {
      return NextResponse.json(
        { error: "Not authenticated." },
        { status: 401 },
      );
    }

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return NextResponse.json(
        { error: "Not authenticated." },
        { status: 401 },
      );
    }

    const { data: profileData, error: profileError } = await supabase
      .from("user_profiles")
      .select("user_id,organisation_id,role,access_enabled")
      .eq("user_id", user.id)
      .single();

    if (profileError || !profileData || !profileData.access_enabled) {
      return NextResponse.json(
        { error: "Profile access denied." },
        { status: 403 },
      );
    }

    const profile = profileData as UserProfile;

    if (!profile.organisation_id && !isGlobalAdmin(profile.role)) {
      return NextResponse.json(
        { error: "Your user is not linked to a practice." },
        { status: 400 },
      );
    }

    let clientsQuery = supabase
      .from("crm_clients")
      .select(
        "id,client_name,registration_number,id_passport_number,entity_type,status,organisation_id",
      )
      .order("client_name", { ascending: true });

    if (!isGlobalAdmin(profile.role)) {
      clientsQuery = clientsQuery.eq(
        "organisation_id",
        profile.organisation_id as string,
      );
    }

    const { data: clientsData, error: clientsError } = await clientsQuery;

    if (clientsError) throw clientsError;

    const clients = (clientsData || []).filter((client: any) =>
      String(client.client_name || "").trim(),
    );

    const clientIds = clients.map((client: any) => String(client.id));

    if (clientIds.length === 0) {
      return NextResponse.json({
        success: true,
        clients: [],
        matters: [],
        certificates: [],
        shareholders: [],
      });
    }

    const [
      mattersResult,
      certificatesResult,
      shareholdersResult,
    ] = await Promise.all([
      supabase
        .from("secretarial_share_matters")
        .select("client_id,matter_status")
        .in("client_id", clientIds)
        .neq("matter_status", "cancelled"),

      supabase
        .from("secretarial_share_certificates")
        .select("client_id,certificate_status")
        .in("client_id", clientIds),

      supabase
        .from("secretarial_shareholders")
        .select("client_id,is_active")
        .in("client_id", clientIds),
    ]);

    if (mattersResult.error) throw mattersResult.error;
    if (certificatesResult.error) throw certificatesResult.error;
    if (shareholdersResult.error) throw shareholdersResult.error;

    // Older records can have is_active = null. Treat only explicit false as inactive.
    const shareholders = (shareholdersResult.data || []).filter(
      (row: any) => row.is_active !== false,
    );

    return NextResponse.json({
      success: true,
      clients: clients.map(({ organisation_id, ...client }: any) => client),
      matters: mattersResult.data || [],
      certificates: certificatesResult.data || [],
      shareholders,
    });
  } catch (error: any) {
    console.error("SECRETARIAL CLIENT SUMMARY ERROR:", error);

    return NextResponse.json(
      {
        error:
          error?.message ||
          "Could not load the Secretarial client summary.",
      },
      { status: 500 },
    );
  }
}
