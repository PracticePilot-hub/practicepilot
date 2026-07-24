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

function normaliseCode(value: string) {
  return clean(value).replace(/\s+/g, "").toUpperCase();
}

function numberOrZero(value: unknown) {
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

  const parsed = Number(cleaned);

  if (!Number.isFinite(parsed)) return 0;

  return negative ? -Math.abs(parsed) : parsed;
}

async function tryInsertTrialBalanceLine(
  supabase: any,
  payloads: Record<string, any>[],
) {
  let lastError: any = null;

  for (const payload of payloads) {
    const { data, error } = await supabase
      .from("afs_trial_balance_lines")
      .insert(payload)
      .select("*")
      .single();

    if (!error) return data;

    lastError = error;
  }

  throw lastError || new Error("Failed to create account.");
}

export async function POST(req: NextRequest, context: any) {
  try {
    const engagementId = await getIdFromContext(context);
    const body = await req.json();
    const supabase = getSupabaseServer();

    const accountCode = normaliseCode(
      body.account_code || body.accountCode,
    );

    const accountName = clean(
      body.account_name ||
        body.accountName ||
        body.name ||
        body.description,
    );

    const currentYearBalance = numberOrZero(
      body.current_year_balance ??
        body.currentYearBalance ??
        body.source_balance ??
        body.sourceBalance ??
        body.balance,
    );

    const priorYearBalance = numberOrZero(
      body.prior_year_balance ??
        body.priorYearBalance ??
        body.prior_balance ??
        body.priorBalance,
    );

    if (!accountCode || !accountName) {
      return NextResponse.json(
        {
          error: "Account code and account name are required.",
        },
        { status: 400 },
      );
    }

    const { data: existing, error: existingError } = await supabase
      .from("afs_trial_balance_lines")
      .select("*")
      .eq("engagement_id", engagementId)
      .eq("account_code", accountCode)
      .maybeSingle();

    if (existingError) throw existingError;

    if (existing) {
      return NextResponse.json(
        {
          error: `Account ${accountCode} already exists in this trial balance.`,
          line: existing,
          existing: true,
        },
        { status: 409 },
      );
    }

    const now = new Date().toISOString();

    const base = {
      engagement_id: engagementId,
      account_code: accountCode,
      account_name: accountName,
      account_type: null,

      mapping_category: null,
      mapping_code: null,
      mapping_leaf_id: null,
      mapping_label: null,
      mapping_statement: null,
      mapping_section: null,
      mapping_path: null,
      mapping_smart_rule: null,
      mapping_confidence: null,

      lead_schedule_number: null,
      lead_schedule_key: null,
      note_number: null,

      import_basis: "Yearly",
      amount_layout: "Single signed amount column",

      updated_at: now,
    };

    const payloads = [
      {
        ...base,

        debit: currentYearBalance,
        credit: priorYearBalance,

        opening_balance: 0,
        source_balance: currentYearBalance,
        current_year_balance: currentYearBalance,
        current_balance: currentYearBalance,
        final_balance: currentYearBalance,
        prior_year_balance: priorYearBalance,

        manual_adjustment: 0,
        adjustments: 0,
        reclassifications: 0,

        period_1: 0,
        period_2: 0,
        period_3: 0,
        period_4: 0,
        period_5: 0,
        period_6: 0,
        period_7: 0,
        period_8: 0,
        period_9: 0,
        period_10: 0,
        period_11: 0,
        period_12: 0,
      },
      {
        ...base,

        debit: currentYearBalance,
        credit: priorYearBalance,

        source_balance: currentYearBalance,
        current_year_balance: currentYearBalance,
        current_balance: currentYearBalance,
        final_balance: currentYearBalance,
        prior_year_balance: priorYearBalance,

        manual_adjustment: 0,
        adjustments: 0,
        reclassifications: 0,
      },
      {
        ...base,

        debit: currentYearBalance,
        credit: priorYearBalance,

        source_balance: currentYearBalance,
        final_balance: currentYearBalance,
        prior_year_balance: priorYearBalance,

        adjustments: 0,
        reclassifications: 0,
      },
      {
        ...base,

        debit: currentYearBalance,
        credit: priorYearBalance,
        prior_year_balance: priorYearBalance,
      },
      base,
    ];

    const line = await tryInsertTrialBalanceLine(
      supabase,
      payloads,
    );

    return NextResponse.json({
      success: true,
      line,
      existing: false,
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        error:
          error.message ||
          "Failed to create trial balance account.",
      },
      { status: 500 },
    );
  }
}