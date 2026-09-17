import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const LEGAL_TYPES = [
  "PTY LTD",
  "Close Corporation",
  "Individual",
  "Trust",
  "Non-Profit Company",
  "Partnership",
  "Sole Proprietor",
];

function getSupabaseAdmin() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Missing Supabase admin environment variables.");
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

async function getAuthenticatedProfile(req: Request) {
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
    .select(
      "id, organisation_id, access_enabled, is_practice_owner, can_manage_practice_users"
    )
    .eq("user_id", user.id)
    .maybeSingle();

  if (profileError) throw profileError;

  if (!profile?.organisation_id) {
    throw new Error("Your user profile is not linked to a practice.");
  }

  if (!profile.access_enabled) {
    throw new Error("Your PracticePilot access is disabled.");
  }

  if (!profile.is_practice_owner && !profile.can_manage_practice_users) {
    throw new Error(
      "Only the Primary Practice Admin or an authorised practice manager may change client numbering."
    );
  }

  return { supabase, profile };
}

function cleanText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export async function GET(req: Request) {
  try {
    const { supabase, profile } = await getAuthenticatedProfile(req);
    const organisationId = profile.organisation_id;

    const [
      { data: series, error: seriesError },
      { data: mappings, error: mappingsError },
    ] = await Promise.all([
      supabase
        .from("crm_client_numbering_series")
        .select(
          "id, series_name, prefix, separator, number_width, next_number, auto_assign, is_active"
        )
        .eq("organisation_id", organisationId)
        .eq("is_active", true)
        .order("series_name", { ascending: true }),
      supabase
        .from("crm_client_numbering_type_map")
        .select("id, legal_type, series_id")
        .eq("organisation_id", organisationId)
        .order("legal_type", { ascending: true }),
    ]);

    if (seriesError) throw seriesError;
    if (mappingsError) throw mappingsError;

    return NextResponse.json({
      success: true,
      legalTypes: LEGAL_TYPES,
      series: series || [],
      mappings: mappings || [],
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Could not load client numbering settings.";

    return NextResponse.json(
      { success: false, error: message },
      { status: message.includes("Only the Primary") ? 403 : 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const { supabase, profile } = await getAuthenticatedProfile(req);
    const organisationId = profile.organisation_id;
    const body = await req.json();

    const action = cleanText(body?.action);

    if (action === "create_series") {
      const seriesName = cleanText(body?.seriesName);
      const prefix = cleanText(body?.prefix);
      const separator =
        typeof body?.separator === "string" ? body.separator : "";
      const numberWidth = Number(body?.numberWidth || 4);
      const nextNumber = Number(body?.nextNumber || 1);
      const autoAssign = body?.autoAssign !== false;

      if (!seriesName) {
        return NextResponse.json(
          { success: false, error: "Series name is required." },
          { status: 400 }
        );
      }

      if (!Number.isInteger(numberWidth) || numberWidth < 1 || numberWidth > 12) {
        return NextResponse.json(
          { success: false, error: "Number length must be between 1 and 12." },
          { status: 400 }
        );
      }

      if (!Number.isInteger(nextNumber) || nextNumber < 1) {
        return NextResponse.json(
          { success: false, error: "Next number must be 1 or higher." },
          { status: 400 }
        );
      }

      const { data, error } = await supabase
        .from("crm_client_numbering_series")
        .insert({
          organisation_id: organisationId,
          series_name: seriesName,
          prefix,
          separator,
          number_width: numberWidth,
          next_number: nextNumber,
          auto_assign: autoAssign,
          is_active: true,
        })
        .select(
          "id, series_name, prefix, separator, number_width, next_number, auto_assign, is_active"
        )
        .single();

      if (error) throw error;

      return NextResponse.json({ success: true, series: data });
    }

    if (action === "update_series") {
      const seriesId = cleanText(body?.seriesId);
      const seriesName = cleanText(body?.seriesName);
      const prefix = cleanText(body?.prefix);
      const separator =
        typeof body?.separator === "string" ? body.separator : "";
      const numberWidth = Number(body?.numberWidth || 4);
      const nextNumber = Number(body?.nextNumber || 1);
      const autoAssign = body?.autoAssign !== false;

      if (!seriesId || !seriesName) {
        return NextResponse.json(
          { success: false, error: "Series and series name are required." },
          { status: 400 }
        );
      }

      const { error } = await supabase
        .from("crm_client_numbering_series")
        .update({
          series_name: seriesName,
          prefix,
          separator,
          number_width: numberWidth,
          next_number: nextNumber,
          auto_assign: autoAssign,
          updated_at: new Date().toISOString(),
        })
        .eq("id", seriesId)
        .eq("organisation_id", organisationId);

      if (error) throw error;

      return NextResponse.json({ success: true });
    }

    if (action === "archive_series") {
      const seriesId = cleanText(body?.seriesId);

      if (!seriesId) {
        return NextResponse.json(
          { success: false, error: "Series is required." },
          { status: 400 }
        );
      }

      const { count, error: mapCountError } = await supabase
        .from("crm_client_numbering_type_map")
        .select("id", { count: "exact", head: true })
        .eq("organisation_id", organisationId)
        .eq("series_id", seriesId);

      if (mapCountError) throw mapCountError;

      if ((count || 0) > 0) {
        return NextResponse.json(
          {
            success: false,
            error:
              "This series is still linked to one or more legal types. Remove those mappings first.",
          },
          { status: 409 }
        );
      }

      const { error } = await supabase
        .from("crm_client_numbering_series")
        .update({
          is_active: false,
          updated_at: new Date().toISOString(),
        })
        .eq("id", seriesId)
        .eq("organisation_id", organisationId);

      if (error) throw error;

      return NextResponse.json({ success: true });
    }

    if (action === "save_mapping") {
      const legalType = cleanText(body?.legalType);
      const seriesId = cleanText(body?.seriesId);

      if (!LEGAL_TYPES.includes(legalType)) {
        return NextResponse.json(
          { success: false, error: "Invalid legal type." },
          { status: 400 }
        );
      }

      if (!seriesId) {
        const { error } = await supabase
          .from("crm_client_numbering_type_map")
          .delete()
          .eq("organisation_id", organisationId)
          .eq("legal_type", legalType);

        if (error) throw error;

        return NextResponse.json({ success: true });
      }

      const { data: series, error: seriesError } = await supabase
        .from("crm_client_numbering_series")
        .select("id")
        .eq("id", seriesId)
        .eq("organisation_id", organisationId)
        .eq("is_active", true)
        .maybeSingle();

      if (seriesError) throw seriesError;

      if (!series) {
        return NextResponse.json(
          { success: false, error: "Numbering series not found." },
          { status: 404 }
        );
      }

      const { data: existing, error: existingError } = await supabase
        .from("crm_client_numbering_type_map")
        .select("id")
        .eq("organisation_id", organisationId)
        .eq("legal_type", legalType)
        .maybeSingle();

      if (existingError) throw existingError;

      if (existing?.id) {
        const { error } = await supabase
          .from("crm_client_numbering_type_map")
          .update({
            series_id: seriesId,
            updated_at: new Date().toISOString(),
          })
          .eq("id", existing.id)
          .eq("organisation_id", organisationId);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("crm_client_numbering_type_map")
          .insert({
            organisation_id: organisationId,
            legal_type: legalType,
            series_id: seriesId,
          });

        if (error) throw error;
      }

      return NextResponse.json({ success: true });
    }

    return NextResponse.json(
      { success: false, error: "Invalid client-numbering action." },
      { status: 400 }
    );
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Could not update client numbering settings.";

    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
