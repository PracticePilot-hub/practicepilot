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

function cleanText(value: any) {
  if (value === null || value === undefined) return null;

  const text = String(value).trim();
  return text || null;
}

function cleanAccountCode(value: any) {
  return String(value ?? "").trim().replace(/\s+/g, "").toUpperCase() || null;
}

function numberOrZero(value: any) {
  if (value === null || value === undefined || value === "") return 0;

  if (typeof value === "number") {
    return Number.isFinite(value) ? value : 0;
  }

  const raw = String(value).trim();
  const negative = raw.startsWith("(") && raw.endsWith(")");

  const cleaned = raw
    .replace(/,/g, "")
    .replace(/\s/g, "")
    .replace(/[Rr]/g, "")
    .replace(/[()]/g, "");

  const numberValue = Number(cleaned);

  if (!Number.isFinite(numberValue)) return 0;
  return negative ? -Math.abs(numberValue) : numberValue;
}

function lineNumber(line: any, keys: string[]) {
  for (const key of keys) {
    const value = line?.[key];

    if (value !== undefined && value !== null && value !== "") {
      return numberOrZero(value);
    }
  }

  return 0;
}

function calculateFinalBalance(line: any) {
  const sourceBalance = lineNumber(line, [
    "source_balance",
    "imported_balance",
    "current_year_balance",
    "current_balance",
    "debit",
  ]);

  const manualAdjustment = lineNumber(line, [
    "manual_adjustment",
    "manualAdjustment",
    "working_adjustment",
    "workingAdjustment",
  ]);

  const journalAdjustment = lineNumber(line, [
    "journal_adjustment",
    "journalAdjustment",
    "adjustments",
    "adjustment",
    "journal_adjustments",
  ]);

  const reclassification = lineNumber(line, [
    "reclassification",
    "reclassifications",
  ]);

  return sourceBalance + manualAdjustment + journalAdjustment + reclassification;
}

function buildInsertPayload(line: any, engagementId: string) {
  const currentYearBalance = lineNumber(line, [
    "source_balance",
    "sourceBalance",
    "imported_balance",
    "importedBalance",
    "current_year_balance",
    "currentYearBalance",
    "debit",
  ]);

  const priorYearBalance = lineNumber(line, [
    "prior_year_balance",
    "priorYearBalance",
    "credit",
  ]);

  const openingBalance = lineNumber(line, [
    "opening_balance",
    "openingBalance",
  ]);

  const manualAdjustment = lineNumber(line, [
    "manual_adjustment",
    "manualAdjustment",
    "working_adjustment",
    "workingAdjustment",
  ]);

  const journalAdjustment = lineNumber(line, [
    "journal_adjustment",
    "journalAdjustment",
    "adjustments",
    "adjustment",
    "journal_adjustments",
  ]);

  const reclassification = lineNumber(line, [
    "reclassification",
    "reclassifications",
  ]);

  const finalBalance =
    currentYearBalance + manualAdjustment + journalAdjustment + reclassification;

  return {
    engagement_id: engagementId,

    account_code: cleanAccountCode(line.account_code ?? line.accountCode),
    account_name: cleanText(line.account_name ?? line.accountName),
    account_type: cleanText(line.account_type ?? line.accountType),

    // Keep old columns populated because the current statement engine already reads them.
    debit: currentYearBalance,
    credit: priorYearBalance,

    opening_balance: openingBalance,
    current_year_balance: currentYearBalance,
    current_balance: finalBalance,
    final_balance: finalBalance,
    prior_year_balance: priorYearBalance,

    source_balance: currentYearBalance,
    manual_adjustment: manualAdjustment,
    adjustments: journalAdjustment,
    reclassifications: reclassification,

    period_1: numberOrZero(line.period_1 ?? line.period1),
    period_2: numberOrZero(line.period_2 ?? line.period2),
    period_3: numberOrZero(line.period_3 ?? line.period3),
    period_4: numberOrZero(line.period_4 ?? line.period4),
    period_5: numberOrZero(line.period_5 ?? line.period5),
    period_6: numberOrZero(line.period_6 ?? line.period6),
    period_7: numberOrZero(line.period_7 ?? line.period7),
    period_8: numberOrZero(line.period_8 ?? line.period8),
    period_9: numberOrZero(line.period_9 ?? line.period9),
    period_10: numberOrZero(line.period_10 ?? line.period10),
    period_11: numberOrZero(line.period_11 ?? line.period11),
    period_12: numberOrZero(line.period_12 ?? line.period12),

    import_basis: cleanText(line.import_basis ?? line.importBasis) || "Yearly",
    amount_layout:
      cleanText(line.amount_layout ?? line.amountLayout) ||
      "Single signed amount column",

    mapping_category: cleanText(
      line.mapping_category ?? line.mappingCategory,
    ),
    mapping_leaf_id: cleanText(line.mapping_leaf_id ?? line.mappingLeafId),
    mapping_label: cleanText(line.mapping_label ?? line.mappingLabel),
    mapping_statement: cleanText(line.mapping_statement ?? line.mappingStatement),
    mapping_section: cleanText(line.mapping_section ?? line.mappingSection),
    mapping_path: cleanText(line.mapping_path ?? line.mappingPath),
    mapping_smart_rule: cleanText(line.mapping_smart_rule ?? line.mappingSmartRule),
    mapping_confidence: cleanText(line.mapping_confidence ?? line.mappingConfidence),
    mapping_code: cleanText(line.mapping_code ?? line.mappingCode),
    lead_schedule_number: cleanText(line.lead_schedule_number ?? line.leadScheduleNumber),
    lead_schedule_key: cleanText(line.lead_schedule_key ?? line.leadScheduleKey),
    note_number: cleanText(line.note_number ?? line.noteNumber),
    updated_at: new Date().toISOString(),
  };
}

function cleanPatchPayload(body: any) {
  const manualAdjustment = numberOrZero(
    body.manual_adjustment ?? body.manualAdjustment ?? 0,
  );

  const existingLine = body.existingLine || body.line || {};
  const sourceBalance = lineNumber(existingLine, [
    "source_balance",
    "imported_balance",
    "current_year_balance",
    "current_balance",
    "debit",
  ]);
  const journalAdjustment = lineNumber(existingLine, [
    "journal_adjustment",
    "adjustments",
    "adjustment",
    "journal_adjustments",
  ]);
  const reclassification = lineNumber(existingLine, [
    "reclassification",
    "reclassifications",
  ]);

  const finalBalance = sourceBalance + manualAdjustment + journalAdjustment + reclassification;

  return {
    manual_adjustment: manualAdjustment,
    final_balance: finalBalance,
    current_balance: finalBalance,
    current_year_balance: finalBalance,
    updated_at: new Date().toISOString(),
  };
}

export async function GET(req: NextRequest, context: any) {
  try {
    const engagementId = await getIdFromContext(context);
    const supabase = getSupabaseServer();

    const { data, error } = await supabase
      .from("afs_trial_balance_lines")
      .select("*")
      .eq("engagement_id", engagementId)
      .order("account_code", { ascending: true });

    if (error) throw error;

    return NextResponse.json({ lines: data || [] });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Failed to load trial balance." },
      { status: 500 },
    );
  }
}

function buildExistingMappingMap(existingLines: any[]) {
  const existingByCode = new Map<string, any>();

  for (const line of existingLines || []) {
    const accountCode = cleanAccountCode(line.account_code);
    if (!accountCode) continue;

    existingByCode.set(accountCode, {
      mapping_category: cleanText(line.mapping_category),
      mapping_leaf_id: cleanText(line.mapping_leaf_id),
      mapping_label: cleanText(line.mapping_label),
      mapping_statement: cleanText(line.mapping_statement),
      mapping_section: cleanText(line.mapping_section),
      mapping_path: cleanText(line.mapping_path),
      mapping_smart_rule: cleanText(line.mapping_smart_rule),
      mapping_confidence: cleanText(line.mapping_confidence),
      mapping_code: cleanText(line.mapping_code),
      lead_schedule_number: cleanText(line.lead_schedule_number),
      lead_schedule_key: cleanText(line.lead_schedule_key),
      note_number: cleanText(line.note_number),
    });
  }

  return existingByCode;
}

function applyExistingMapping(line: any, existingByCode: Map<string, any>) {
  const accountCode = cleanAccountCode(line.account_code);
  if (!accountCode) return line;

  const existing = existingByCode.get(accountCode);
  if (!existing) return line;

  return {
    ...line,
    mapping_category: line.mapping_category || existing.mapping_category,
    mapping_leaf_id: line.mapping_leaf_id || existing.mapping_leaf_id,
    mapping_label: line.mapping_label || existing.mapping_label,
    mapping_statement: line.mapping_statement || existing.mapping_statement,
    mapping_section: line.mapping_section || existing.mapping_section,
    mapping_path: line.mapping_path || existing.mapping_path,
    mapping_smart_rule: line.mapping_smart_rule || existing.mapping_smart_rule,
    mapping_confidence: line.mapping_confidence || existing.mapping_confidence,
    mapping_code: line.mapping_code || existing.mapping_code,
    lead_schedule_number: line.lead_schedule_number || existing.lead_schedule_number,
    lead_schedule_key: line.lead_schedule_key || existing.lead_schedule_key,
    note_number: line.note_number || existing.note_number,
  };
}

export async function POST(req: NextRequest, context: any) {
  try {
    const engagementId = await getIdFromContext(context);
    const body = await req.json();

    const lines = Array.isArray(body.lines) ? body.lines : [];

    if (lines.length === 0) {
      return NextResponse.json(
        { error: "No trial balance lines were provided." },
        { status: 400 },
      );
    }

    const supabase = getSupabaseServer();

    const { data: existingLines, error: existingError } = await supabase
      .from("afs_trial_balance_lines")
      .select(
        "account_code,mapping_category,mapping_leaf_id,mapping_label,mapping_statement,mapping_section,mapping_path,mapping_smart_rule,mapping_confidence,mapping_code,lead_schedule_number,lead_schedule_key,note_number",
      )
      .eq("engagement_id", engagementId);

    if (existingError) throw existingError;

    const existingByCode = buildExistingMappingMap(existingLines || []);

    const cleanLines = lines
      .map((line: any) => buildInsertPayload(line, engagementId))
      .map((line: any) => applyExistingMapping(line, existingByCode))
      .filter((line: any) => line.account_name);

    if (cleanLines.length === 0) {
      return NextResponse.json(
        { error: "No valid trial balance lines were provided." },
        { status: 400 },
      );
    }

    const { error: deleteError } = await supabase
      .from("afs_trial_balance_lines")
      .delete()
      .eq("engagement_id", engagementId);

    if (deleteError) throw deleteError;

    const { data, error: insertError } = await supabase
      .from("afs_trial_balance_lines")
      .insert(cleanLines)
      .select("*")
      .order("account_code", { ascending: true });

    if (insertError) throw insertError;

    return NextResponse.json({
      success: true,
      lines: data || [],
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Failed to import trial balance." },
      { status: 500 },
    );
  }
}

export async function PATCH(req: NextRequest, context: any) {
  try {
    const engagementId = await getIdFromContext(context);
    const body = await req.json();

    const lineId = cleanText(body.id ?? body.line_id ?? body.lineId);
    const accountCode = cleanAccountCode(body.account_code ?? body.accountCode);

    if (!lineId && !accountCode) {
      return NextResponse.json(
        { error: "Missing trial balance line id or account code." },
        { status: 400 },
      );
    }

    const supabase = getSupabaseServer();

    let query = supabase
      .from("afs_trial_balance_lines")
      .select("*")
      .eq("engagement_id", engagementId)
      .limit(1);

    if (lineId) {
      query = query.eq("id", lineId);
    } else {
      query = query.eq("account_code", accountCode);
    }

    const { data: existingRows, error: selectError } = await query;

    if (selectError) throw selectError;

    const existingLine = existingRows?.[0];

    if (!existingLine) {
      return NextResponse.json(
        { error: "Trial balance line was not found." },
        { status: 404 },
      );
    }

    const sourceBalance = lineNumber(existingLine, [
      "source_balance",
      "imported_balance",
      "debit",
    ]);

    const journalAdjustment = lineNumber(existingLine, [
      "adjustments",
      "adjustment",
      "journal_adjustments",
      "journal_adjustment",
    ]);

    const reclassification = lineNumber(existingLine, [
      "reclassifications",
      "reclassification",
    ]);

    const manualAdjustment = numberOrZero(
      body.manual_adjustment ?? body.manualAdjustment ?? 0,
    );

    const finalBalance =
      sourceBalance + manualAdjustment + journalAdjustment + reclassification;

    const updatePayload = {
      manual_adjustment: manualAdjustment,
      final_balance: finalBalance,
      current_balance: finalBalance,
      current_year_balance: finalBalance,
      updated_at: new Date().toISOString(),
    };

    const { data, error: updateError } = await supabase
      .from("afs_trial_balance_lines")
      .update(updatePayload)
      .eq("engagement_id", engagementId)
      .eq("id", existingLine.id)
      .select("*")
      .single();

    if (updateError) throw updateError;

    return NextResponse.json({ line: data });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Failed to update trial balance line." },
      { status: 500 },
    );
  }
}
