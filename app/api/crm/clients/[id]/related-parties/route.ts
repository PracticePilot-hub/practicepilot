import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getSupabaseAdmin() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Missing Supabase admin environment variables.");
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

async function getContext(req: Request, clientId: string) {
  const supabase = getSupabaseAdmin();
  const authorization = req.headers.get("authorization") || "";
  const token = authorization.replace(/^Bearer\s+/i, "").trim();

  if (!token) throw new Error("You are not signed in.");

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser(token);

  if (userError || !user) {
    throw new Error("Your login session is invalid or has expired.");
  }

  const { data: profile, error: profileError } = await supabase
    .from("user_profiles")
    .select("organisation_id, access_enabled, can_access_crm")
    .eq("user_id", user.id)
    .maybeSingle();

  if (profileError) throw profileError;

  if (!profile?.organisation_id) {
    throw new Error("Your user profile is not linked to an organisation.");
  }

  if (!profile.access_enabled || !profile.can_access_crm) {
    throw new Error("You do not have access to CRM.");
  }

  const { data: client, error: clientError } = await supabase
    .from("crm_clients")
    .select("id, organisation_id")
    .eq("id", clientId)
    .eq("organisation_id", profile.organisation_id)
    .maybeSingle();

  if (clientError) throw clientError;
  if (!client) throw new Error("Client not found.");

  return { supabase, profile, client };
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { supabase, profile } = await getContext(req, id);

    const [{ data: parties, error: partiesError }, { data: roles, error: rolesError }] =
      await Promise.all([
        supabase
          .from("crm_related_parties")
          .select(
            "id, party_type, display_name, id_registration_number, email, phone, mobile, linked_client_id"
          )
          .eq("organisation_id", profile.organisation_id)
          .eq("is_active", true)
          .order("display_name", { ascending: true }),
        supabase
          .from("crm_related_party_roles")
          .select(
            `
              id,
              related_party_id,
              client_id,
              role_type,
              role_label,
              is_active,
              crm_related_parties (
                id,
                party_type,
                display_name,
                id_registration_number,
                email,
                phone,
                mobile,
                linked_client_id
              )
            `
          )
          .eq("organisation_id", profile.organisation_id)
          .eq("client_id", id)
          .eq("is_active", true)
          .order("created_at", { ascending: true }),
      ]);

    if (partiesError) throw partiesError;
    if (rolesError) throw rolesError;

    return NextResponse.json({
      success: true,
      parties: parties || [],
      roles: roles || [],
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Could not load related parties.";

    return NextResponse.json(
      { success: false, error: message },
      { status: message.includes("not found") ? 404 : 500 }
    );
  }
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { supabase, profile } = await getContext(req, id);
    const body = await req.json();

    const action = String(body?.action || "").trim();
    const roleType = String(body?.roleType || "").trim();
    const roleLabel =
      typeof body?.roleLabel === "string" ? body.roleLabel.trim() || null : null;

    if (!roleType) {
      return NextResponse.json(
        { success: false, error: "Role is required." },
        { status: 400 }
      );
    }

    let relatedPartyId = "";

    if (action === "link_existing") {
      relatedPartyId = String(body?.relatedPartyId || "").trim();

      if (!relatedPartyId) {
        return NextResponse.json(
          { success: false, error: "Choose a related party." },
          { status: 400 }
        );
      }

      const { data: existingParty, error: partyError } = await supabase
        .from("crm_related_parties")
        .select("id")
        .eq("id", relatedPartyId)
        .eq("organisation_id", profile.organisation_id)
        .eq("is_active", true)
        .maybeSingle();

      if (partyError) throw partyError;

      if (!existingParty) {
        return NextResponse.json(
          { success: false, error: "Related party not found." },
          { status: 404 }
        );
      }
    } else if (action === "create_and_link") {
      const partyType = String(body?.partyType || "").trim();
      const displayName = String(body?.displayName || "").trim();

      if (!partyType || !displayName) {
        return NextResponse.json(
          { success: false, error: "Type and name are required." },
          { status: 400 }
        );
      }

      const row = {
        organisation_id: profile.organisation_id,
        party_type: partyType,
        display_name: displayName,
        id_registration_number:
          typeof body?.idRegistrationNumber === "string"
            ? body.idRegistrationNumber.trim() || null
            : null,
        email:
          typeof body?.email === "string" ? body.email.trim() || null : null,
        phone:
          typeof body?.phone === "string" ? body.phone.trim() || null : null,
        linked_client_id: null,
        is_active: true,
      };

      const { data: created, error: createError } = await supabase
        .from("crm_related_parties")
        .insert(row)
        .select("id")
        .single();

      if (createError || !created) {
        throw createError || new Error("Related party could not be created.");
      }

      relatedPartyId = created.id;
    } else {
      return NextResponse.json(
        { success: false, error: "Invalid related-party action." },
        { status: 400 }
      );
    }

    const { data: existingRole, error: existingRoleError } = await supabase
      .from("crm_related_party_roles")
      .select("id")
      .eq("organisation_id", profile.organisation_id)
      .eq("related_party_id", relatedPartyId)
      .eq("client_id", id)
      .eq("role_type", roleType)
      .eq("is_active", true)
      .maybeSingle();

    if (existingRoleError) throw existingRoleError;

    if (existingRole) {
      return NextResponse.json(
        { success: false, error: "That relationship already exists." },
        { status: 409 }
      );
    }

    const { error: roleError } = await supabase
      .from("crm_related_party_roles")
      .insert({
        organisation_id: profile.organisation_id,
        related_party_id: relatedPartyId,
        client_id: id,
        role_type: roleType,
        role_label: roleLabel,
        is_active: true,
      });

    if (roleError) throw roleError;

    return NextResponse.json({ success: true });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Could not save related party.";

    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { supabase, profile } = await getContext(req, id);
    const url = new URL(req.url);
    const roleId = String(url.searchParams.get("roleId") || "").trim();

    if (!roleId) {
      return NextResponse.json(
        { success: false, error: "Role ID is required." },
        { status: 400 }
      );
    }

    const { error } = await supabase
      .from("crm_related_party_roles")
      .update({
        is_active: false,
        effective_to: new Date().toISOString().slice(0, 10),
        updated_at: new Date().toISOString(),
      })
      .eq("id", roleId)
      .eq("organisation_id", profile.organisation_id)
      .eq("client_id", id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Could not remove related-party relationship.";

    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
