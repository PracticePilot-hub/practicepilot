import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

type AnyRow = Record<string, any>;

function getSupabaseAdmin() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey =
    process.env.SUPABASE_SECRET_KEY ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SERVICE_KEY;

  if (!supabaseUrl || !serviceKey) {
    throw new Error("Missing Supabase admin environment variables.");
  }

  return createClient(supabaseUrl, serviceKey) as any;
}

function firstFilled(row: AnyRow | null | undefined, keys: string[]) {
  if (!row) return "";

  for (const key of keys) {
    const value = row[key];
    if (value !== null && value !== undefined && String(value).trim() !== "") {
      return String(value).trim();
    }
  }

  return "";
}

function cleanSettingsRow(row: AnyRow | null | undefined) {
  const data = row || {};

  return {
    reportOptions: data.report_options || data.reportOptions || {},
    directorsReportTexts:
      data.directors_report_texts || data.directorsReportTexts || {},
    accountingPolicyTexts:
      data.accounting_policy_texts || data.accountingPolicyTexts || {},
    noteTexts: data.note_texts || data.noteTexts || {},
    statementOverrides: data.statement_overrides || data.statementOverrides || {},
  };
}

function cleanFirmSettings(row: AnyRow | null | undefined) {
  if (!row) return null;

  return {
    id: row.id || null,
    user_id: row.user_id || null,
    firm_name: row.firm_name || null,
    trading_name: row.trading_name || null,
    logo_url: row.logo_url || null,
    address_lines: row.address_lines || null,
    telephone: row.telephone || null,
    email: row.email || null,
    website: row.website || null,
    practitioner_name: row.practitioner_name || null,
    practitioner_designation: row.practitioner_designation || null,
    governing_body_name: row.governing_body_name || null,
    governing_body_registration_number:
      row.governing_body_registration_number || null,
    governing_body_logo_url: row.governing_body_logo_url || null,
    second_governing_body_name: row.second_governing_body_name || null,
    second_governing_body_registration_number:
      row.second_governing_body_registration_number || null,
    second_governing_body_logo_url:
      row.second_governing_body_logo_url || null,
    footer_text: row.footer_text || null,
    footer_logo_url: row.footer_logo_url || null,
  };
}

async function loadEngagement(supabase: any, engagementId: string) {
  const { data, error } = await supabase
    .from("afs_engagements")
    .select("*")
    .eq("id", engagementId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data || null;
}

async function loadPrintStudioSettings(supabase: any, engagementId: string) {
  const { data, error } = await supabase
    .from("afs_print_studio_settings")
    .select("*")
    .eq("engagement_id", engagementId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data || null;
}

async function loadFirmSettings(supabase: any, engagement: AnyRow | null) {
  const ownerUserId = firstFilled(engagement, [
    "owner_user_id",
    "user_id",
    "created_by_user_id",
    "created_by",
    "created_by_id",
  ]);

  if (ownerUserId) {
    const { data, error } = await supabase
      .from("afs_firm_settings")
      .select("*")
      .eq("user_id", ownerUserId)
      .maybeSingle();

    if (error) {
      console.error("Failed to load AFS firm settings by owner user id", error);
    } else if (data) {
      return data;
    }
  }

  /*
    Safety fallback for older/dev engagements that do not yet have an owner id.
    This prevents the PDF export from losing the letterhead for existing files.
  */
  const { data: fallbackData, error: fallbackError } = await supabase
    .from("afs_firm_settings")
    .select("*")
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (fallbackError) {
    console.error("Failed to load fallback AFS firm settings", fallbackError);
    return null;
  }

  return fallbackData || null;
}

export async function GET(_request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;

    if (!id) {
      return NextResponse.json(
        { success: false, error: "Missing engagement id." },
        { status: 400 },
      );
    }

    const supabase = getSupabaseAdmin();
    const engagement = await loadEngagement(supabase, id);
    const settingsRow = await loadPrintStudioSettings(supabase, id);
    const firmSettingsRow = await loadFirmSettings(supabase, engagement);
    const settings = cleanSettingsRow(settingsRow);

    return NextResponse.json({
      success: true,
      ...settings,
      firmSettings: cleanFirmSettings(firmSettingsRow),
      firm_settings: cleanFirmSettings(firmSettingsRow),
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        error: error?.message || "Failed to load Print Studio settings.",
      },
      { status: 500 },
    );
  }
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;

    if (!id) {
      return NextResponse.json(
        { success: false, error: "Missing engagement id." },
        { status: 400 },
      );
    }

    const payload = await request.json();
    const supabase = getSupabaseAdmin();
    const engagement = await loadEngagement(supabase, id);
    const existing = await loadPrintStudioSettings(supabase, id);

    const nextRow = {
      engagement_id: id,
      report_options:
        payload.reportOptions !== undefined
          ? payload.reportOptions
          : existing?.report_options || {},
      directors_report_texts:
        payload.directorsReportTexts !== undefined
          ? payload.directorsReportTexts
          : existing?.directors_report_texts || {},
      accounting_policy_texts:
        payload.accountingPolicyTexts !== undefined
          ? payload.accountingPolicyTexts
          : existing?.accounting_policy_texts || {},
      note_texts:
        payload.noteTexts !== undefined
          ? payload.noteTexts
          : existing?.note_texts || {},
      statement_overrides:
        payload.statementOverrides !== undefined
          ? payload.statementOverrides
          : existing?.statement_overrides || {},
      owner_user_id:
        existing?.owner_user_id ||
        firstFilled(engagement, [
          "owner_user_id",
          "user_id",
          "created_by_user_id",
          "created_by",
          "created_by_id",
        ]) ||
        null,
      updated_at: new Date().toISOString(),
    };

    let savedRow: AnyRow | null = null;

    if (existing?.id) {
      const { data, error } = await supabase
        .from("afs_print_studio_settings")
        .update(nextRow)
        .eq("id", existing.id)
        .select("*")
        .maybeSingle();

      if (error) throw new Error(error.message);
      savedRow = data || null;
    } else {
      const { data, error } = await supabase
        .from("afs_print_studio_settings")
        .insert({
          ...nextRow,
          created_at: new Date().toISOString(),
        })
        .select("*")
        .maybeSingle();

      if (error) throw new Error(error.message);
      savedRow = data || null;
    }

    const firmSettingsRow = await loadFirmSettings(supabase, engagement);
    const settings = cleanSettingsRow(savedRow);

    return NextResponse.json({
      success: true,
      ...settings,
      firmSettings: cleanFirmSettings(firmSettingsRow),
      firm_settings: cleanFirmSettings(firmSettingsRow),
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        error: error?.message || "Failed to save Print Studio settings.",
      },
      { status: 500 },
    );
  }
}
