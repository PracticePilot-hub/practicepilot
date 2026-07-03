// Path: app/api/paia/manuals/route.ts

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

type UserProfile = {
  id: string;
  user_id: string;
  email: string;
  role: string;
  organisation_id: string | null;
  access_enabled: boolean;
  can_access_paia?: boolean;
};

function getSupabaseAdmin() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

  const serviceRoleKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SECRET_KEY ||
    process.env.SUPABASE_SERVICE_KEY;

  if (!supabaseUrl) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL.");
  }

  if (!serviceRoleKey) {
    throw new Error(
      "Missing server Supabase key. Add SUPABASE_SERVICE_ROLE_KEY in Vercel and redeploy."
    );
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

function clean(value: unknown) {
  const text = String(value ?? "").trim();
  return text.length ? text : null;
}

function isGlobalAdmin(role: string) {
  return role === "Super Admin" || role === "Admin";
}

function getBearerToken(request: Request) {
  const authHeader = request.headers.get("authorization") || "";
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();
  return token || "";
}

async function getCurrentProfile(request: Request, supabase: ReturnType<typeof getSupabaseAdmin>) {
  const token = getBearerToken(request);

  if (!token) {
    return {
      profile: null as UserProfile | null,
      response: NextResponse.json({ error: "Not authenticated." }, { status: 401 }),
    };
  }

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser(token);

  if (userError || !user) {
    return {
      profile: null as UserProfile | null,
      response: NextResponse.json({ error: "Not authenticated." }, { status: 401 }),
    };
  }

  const { data: profile, error: profileError } = await supabase
    .from("user_profiles")
    .select("*")
    .eq("user_id", user.id)
    .single();

  if (profileError || !profile) {
    return {
      profile: null as UserProfile | null,
      response: NextResponse.json({ error: "Could not load user profile." }, { status: 403 }),
    };
  }

  const userProfile = profile as UserProfile;
  const globalAdmin = isGlobalAdmin(userProfile.role);

  if (!userProfile.access_enabled) {
    return {
      profile: null as UserProfile | null,
      response: NextResponse.json({ error: "User access is blocked." }, { status: 403 }),
    };
  }

  if (!globalAdmin && !userProfile.can_access_paia) {
    return {
      profile: null as UserProfile | null,
      response: NextResponse.json({ error: "No access to PAIA Manuals." }, { status: 403 }),
    };
  }

  return {
    profile: userProfile,
    response: null as NextResponse | null,
  };
}

async function getOrganisations(supabase: ReturnType<typeof getSupabaseAdmin>) {
  const { data, error } = await supabase
    .from("organisations")
    .select("id, name, status, access_enabled")
    .order("name", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return data ?? [];
}

async function getOrganisationById(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  organisationId: string | null
) {
  if (!organisationId) return null;

  const { data, error } = await supabase
    .from("organisations")
    .select("id, name, status, access_enabled")
    .eq("id", organisationId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data ?? null;
}

export async function GET(request: Request) {
  try {
    const supabase = getSupabaseAdmin();

    const { profile, response } = await getCurrentProfile(request, supabase);

    if (response || !profile) return response;

    const url = new URL(request.url);
    const requestedClientId = String(url.searchParams.get("clientId") || "").trim();

    const globalAdmin = isGlobalAdmin(profile.role);

    const organisations = globalAdmin ? await getOrganisations(supabase) : [];
    const currentOrganisation = globalAdmin
      ? null
      : await getOrganisationById(supabase, profile.organisation_id);

    let clientIdToUse = "";

    if (globalAdmin) {
      clientIdToUse = requestedClientId;
    } else {
      clientIdToUse = profile.organisation_id || "";
    }

    if (!clientIdToUse) {
      return NextResponse.json({
        manuals: [],
        organisations,
        currentOrganisation,
      });
    }

    const { data, error } = await supabase
      .from("paia_manuals")
      .select("*")
      .eq("client_id", clientIdToUse)
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      manuals: data ?? [],
      organisations,
      currentOrganisation,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message ?? "Failed to load PAIA manuals." },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const supabase = getSupabaseAdmin();

    const { profile, response } = await getCurrentProfile(request, supabase);

    if (response || !profile) return response;

    const globalAdmin = isGlobalAdmin(profile.role);

    const entityName = String(body.entity_name ?? "").trim();

    if (!entityName) {
      return NextResponse.json(
        { error: "Entity name is required." },
        { status: 400 }
      );
    }

    const requestedClientId = String(body.client_id || body.clientId || "").trim();

    const clientIdToUse = globalAdmin
      ? requestedClientId
      : profile.organisation_id || "";

    if (!clientIdToUse) {
      return NextResponse.json(
        { error: "A firm/client must be selected before creating a PAIA manual." },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from("paia_manuals")
      .insert({
        client_id: clientIdToUse,

        manual_name:
          String(body.manual_name ?? "").trim() || `${entityName} PAIA Manual`,
        entity_name: entityName,
        entity_registration_number: clean(body.entity_registration_number),
        vat_number: clean(body.vat_number),
        entity_type: clean(body.entity_type),
        industry: clean(body.industry),

        information_officer_name: clean(body.information_officer_name),
        information_officer_position: clean(body.information_officer_position),
        information_officer_email: clean(body.information_officer_email),
        information_officer_telephone: clean(
          body.information_officer_telephone
        ),

        physical_address: clean(body.physical_address),
        postal_address: clean(body.postal_address),
        telephone: clean(body.telephone),
        email: clean(body.email),
        website: clean(body.website),

        date_compiled:
          body.date_compiled || new Date().toISOString().slice(0, 10),
        next_review_date: body.next_review_date || null,
        version_number: "1.0",
        status: "draft",
      })
      .select("*")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ manual: data });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message ?? "Failed to create PAIA manual." },
      { status: 500 }
    );
  }
}