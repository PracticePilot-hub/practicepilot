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

function clean(value: unknown) {
  return String(value ?? "").trim();
}

function nullable(value: unknown) {
  const text = clean(value);
  return text || null;
}

function normaliseAccountCode(value: unknown) {
  return clean(value).replace(/\s+/g, "").toUpperCase();
}

function buildFullMappingPayload(body: any) {
  const mappingCode = nullable(body.mapping_code ?? body.mappingCode ?? body.selectedMappingCode ?? body.code);
  const mappingLabel = nullable(body.mapping_label ?? body.mappingLabel ?? body.selectedMappingLabel ?? body.label ?? body.title);
  const mappingLeafId = nullable(body.mapping_leaf_id ?? body.mappingLeafId ?? body.leafId ?? body.mappingLeafID);
  const mappingStatement = nullable(body.mapping_statement ?? body.mappingStatement ?? body.statement);
  const mappingSection = nullable(body.mapping_section ?? body.mappingSection ?? body.selectedMappingSection ?? body.section);
  const mappingPath = nullable(body.mapping_path ?? body.mappingPath ?? body.selectedMappingPath ?? body.path);
  const mappingSmartRule = nullable(body.mapping_smart_rule ?? body.mappingSmartRule ?? body.smartRule);
  const mappingConfidence = nullable(body.mapping_confidence ?? body.mappingConfidence ?? body.confidence);
  const leadScheduleNumber = nullable(
    body.lead_schedule_number ?? body.leadScheduleNumber ?? body.leadNumber ?? mappingCode
  );
  const leadScheduleKey = nullable(
    body.lead_schedule_key ?? body.leadScheduleKey ?? body.mapping_key ?? body.mappingKey ?? body.key
  );

  return {
    mapping_category: mappingLabel,
    mapping_leaf_id: mappingLeafId,
    mapping_label: mappingLabel,
    mapping_statement: mappingStatement,
    mapping_section: mappingSection,
    mapping_path: mappingPath,
    mapping_smart_rule: mappingSmartRule,
    mapping_confidence: mappingConfidence,
    mapping_code: mappingCode,
    lead_schedule_number: leadScheduleNumber,
    lead_schedule_key: leadScheduleKey,
    mapping_saved_at: new Date().toISOString(),
  };
}

function buildClearPayload() {
  return {
    mapping_category: null,
    mapping_leaf_id: null,
    mapping_label: null,
    mapping_statement: null,
    mapping_section: null,
    mapping_path: null,
    mapping_smart_rule: null,
    mapping_confidence: null,
    mapping_code: null,
    lead_schedule_number: null,
    lead_schedule_key: null,
    mapping_saved_at: null,
  };
}

function compactPayload(payload: Record<string, any>) {
  const next: Record<string, any> = {};
  for (const [key, value] of Object.entries(payload)) {
    if (value !== undefined) next[key] = value;
  }
  return next;
}

function payloadFallbacks(fullPayload: Record<string, any>) {
  return [
    compactPayload(fullPayload),
    compactPayload({
      mapping_category: fullPayload.mapping_category,
      mapping_leaf_id: fullPayload.mapping_leaf_id,
      mapping_label: fullPayload.mapping_label,
      mapping_statement: fullPayload.mapping_statement,
      mapping_section: fullPayload.mapping_section,
      mapping_path: fullPayload.mapping_path,
      mapping_code: fullPayload.mapping_code,
      lead_schedule_number: fullPayload.lead_schedule_number,
      lead_schedule_key: fullPayload.lead_schedule_key,
    }),
    compactPayload({
      mapping_category: fullPayload.mapping_category,
      mapping_label: fullPayload.mapping_label,
      mapping_section: fullPayload.mapping_section,
      mapping_code: fullPayload.mapping_code,
      lead_schedule_number: fullPayload.lead_schedule_number,
      lead_schedule_key: fullPayload.lead_schedule_key,
    }),
    compactPayload({
      mapping_code: fullPayload.mapping_code,
      lead_schedule_number: fullPayload.lead_schedule_number,
      lead_schedule_key: fullPayload.lead_schedule_key,
    }),
  ];
}

async function tryUpdate(
  supabase: any,
  engagementId: string,
  matcher: { lineId?: string; accountCode?: string },
  payload: Record<string, any>
) {
  let lastError: any = null;

  for (const candidate of payloadFallbacks(payload)) {
    let query = supabase
      .from("afs_trial_balance_lines")
      .update(candidate)
      .eq("engagement_id", engagementId);

    if (matcher.lineId) {
      query = query.eq("id", matcher.lineId);
    } else if (matcher.accountCode) {
      query = query.eq("account_code", matcher.accountCode);
    }

    const { data, error } = await query.select("*");

    if (!error) return data || [];
    lastError = error;
  }

  throw lastError || new Error("Failed to update trial balance mapping.");
}

async function updateLine(
  supabase: any,
  engagementId: string,
  lineId: string,
  accountCode: string,
  payload: Record<string, any>
) {
  let updated: any[] = [];

  if (lineId) {
    updated = await tryUpdate(supabase, engagementId, { lineId }, payload);
  }

  if ((!updated || updated.length === 0) && accountCode) {
    updated = await tryUpdate(supabase, engagementId, { accountCode }, payload);
  }

  return updated || [];
}

export async function PATCH(req: NextRequest, context: any) {
  try {
    const engagementId = await getIdFromContext(context);
    const body = await req.json();
    const supabase = getSupabaseServer();

    const lineId = clean(body.line_id ?? body.lineId ?? body.trial_balance_line_id ?? body.trialBalanceLineId ?? body.id);
    const accountCode = normaliseAccountCode(body.account_code ?? body.accountCode ?? body.account);
    const payload = buildFullMappingPayload(body);

    if (!lineId && !accountCode) {
      return NextResponse.json({ error: "Line ID or account code is required." }, { status: 400 });
    }

    if (!payload.mapping_code && !payload.lead_schedule_number) {
      return NextResponse.json({ error: "Mapping code is required." }, { status: 400 });
    }

    const updated = await updateLine(supabase, engagementId, lineId, accountCode, payload);

    if (!updated || updated.length === 0) {
      return NextResponse.json(
        { error: "No matching trial balance line found to map.", lineId, accountCode },
        { status: 404 }
      );
    }

    return NextResponse.json({ trialBalanceLine: updated[0], line: updated[0], lines: updated });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Failed to save trial balance mapping." },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest, context: any) {
  return PATCH(req, context);
}

export async function DELETE(req: NextRequest, context: any) {
  try {
    const engagementId = await getIdFromContext(context);
    const body = await req.json();
    const supabase = getSupabaseServer();

    const lineId = clean(body.line_id ?? body.lineId ?? body.trial_balance_line_id ?? body.trialBalanceLineId ?? body.id);
    const accountCode = normaliseAccountCode(body.account_code ?? body.accountCode ?? body.account);

    if (!lineId && !accountCode) {
      return NextResponse.json({ error: "Line ID or account code is required." }, { status: 400 });
    }

    const updated = await updateLine(supabase, engagementId, lineId, accountCode, buildClearPayload());

    if (!updated || updated.length === 0) {
      return NextResponse.json(
        { error: "No matching trial balance line found to clear.", lineId, accountCode },
        { status: 404 }
      );
    }

    return NextResponse.json({ trialBalanceLine: updated[0], line: updated[0], lines: updated });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Failed to clear trial balance mapping." },
      { status: 500 }
    );
  }
}
