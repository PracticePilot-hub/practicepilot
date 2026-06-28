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

async function tryInsertTrialBalanceLine(supabase: any, payloads: Record<string, any>[]) {
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

    const accountCode = normaliseCode(body.account_code || body.accountCode);
    const accountName = clean(body.account_name || body.accountName || body.name || body.description);

    if (!accountCode || !accountName) {
      return NextResponse.json(
        { error: "Account code and account name are required." },
        { status: 400 }
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
      return NextResponse.json({ line: existing, existing: true });
    }

    const base = {
      engagement_id: engagementId,
      account_code: accountCode,
      account_name: accountName,
      mapping_code: null,
      mapping_label: null,
      mapping_section: null,
      lead_schedule_number: null,
      lead_schedule_key: null,
    };

    const payloads = [
      {
        ...base,
        source_balance: 0,
        adjustments: 0,
        reclassifications: 0,
        final_balance: 0,
        current_year_balance: 0,
        prior_year_balance: 0,
      },
      {
        ...base,
        source_balance: 0,
        adjustments: 0,
        reclassifications: 0,
        final_balance: 0,
      },
      {
        ...base,
        current_year_balance: 0,
        prior_year_balance: 0,
      },
      {
        ...base,
        debit: 0,
        credit: 0,
        prior_year_balance: 0,
      },
      base,
    ];

    const line = await tryInsertTrialBalanceLine(supabase, payloads);

    return NextResponse.json({ line, existing: false });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Failed to create journal account." },
      { status: 500 }
    );
  }
}
