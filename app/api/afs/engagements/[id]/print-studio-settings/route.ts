import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServer } from "../../../lib/supabaseServer";

async function getIdFromContext(context: any) {
  const params = await context?.params;
  const id = params?.id;

  if (!id || typeof id !== "string") {
    throw new Error("Missing AFS engagement id.");
  }

  return id;
}

function normaliseJson(value: any) {
  if (!value || typeof value !== "object") return {};
  return value;
}

export async function GET(req: NextRequest, context: any) {
  try {
    const engagementId = await getIdFromContext(context);
    const supabase = getSupabaseServer();

    const { data, error } = await supabase
      .from("afs_print_studio_settings")
      .select("*")
      .eq("engagement_id", engagementId)
      .maybeSingle();

    if (error) throw error;

    return NextResponse.json({
      settings: data || null,
      reportOptions: data?.report_options || {},
      directorsReportTexts: data?.directors_report_texts || {},
      accountingPolicyTexts: data?.accounting_policy_texts || {},
      noteTexts: data?.note_texts || {},
      coverSettings: data?.cover_settings || {},
      compilerReportSettings: data?.compiler_report_settings || {},
      statementOverrides: data?.statement_overrides || {},
      success: true,
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        error: error.message || "Failed to load Print Studio settings.",
        success: false,
      },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest, context: any) {
  try {
    const engagementId = await getIdFromContext(context);
    const body = await req.json();
    const supabase = getSupabaseServer();

    const updatePayload: Record<string, any> = {
      engagement_id: engagementId,
      updated_at: new Date().toISOString(),
    };

    if (body.reportOptions !== undefined) {
      updatePayload.report_options = normaliseJson(body.reportOptions);
    }

    if (body.directorsReportTexts !== undefined) {
      updatePayload.directors_report_texts = normaliseJson(
        body.directorsReportTexts
      );
    }

    if (body.accountingPolicyTexts !== undefined) {
      updatePayload.accounting_policy_texts = normaliseJson(
        body.accountingPolicyTexts
      );
    }

    if (body.noteTexts !== undefined) {
      updatePayload.note_texts = normaliseJson(body.noteTexts);
    }

    if (body.coverSettings !== undefined) {
      updatePayload.cover_settings = normaliseJson(body.coverSettings);
    }

    if (body.compilerReportSettings !== undefined) {
      updatePayload.compiler_report_settings = normaliseJson(
        body.compilerReportSettings
      );
    }

    if (body.statementOverrides !== undefined) {
      updatePayload.statement_overrides = normaliseJson(
        body.statementOverrides
      );
    }

    const { data, error } = await supabase
      .from("afs_print_studio_settings")
      .upsert(updatePayload, { onConflict: "engagement_id" })
      .select("*")
      .single();

    if (error) throw error;

    return NextResponse.json({
      settings: data,
      reportOptions: data?.report_options || {},
      directorsReportTexts: data?.directors_report_texts || {},
      accountingPolicyTexts: data?.accounting_policy_texts || {},
      noteTexts: data?.note_texts || {},
      coverSettings: data?.cover_settings || {},
      compilerReportSettings: data?.compiler_report_settings || {},
      statementOverrides: data?.statement_overrides || {},
      success: true,
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        error: error.message || "Failed to save Print Studio settings.",
        success: false,
      },
      { status: 500 }
    );
  }
}
