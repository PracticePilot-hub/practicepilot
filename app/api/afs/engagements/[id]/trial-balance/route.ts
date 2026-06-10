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

export async function POST(req: NextRequest, context: any) {
  try {
    const engagementId = await getIdFromContext(context);
    const body = await req.json();

    const lines = Array.isArray(body.lines) ? body.lines : [];

    if (lines.length === 0) {
      return NextResponse.json(
        { error: "No trial balance lines were provided." },
        { status: 400 }
      );
    }

    const supabase = getSupabaseServer();

    const cleanLines = lines
      .map((line: any) => {
        const openingBalance = numberOrZero(
          line.opening_balance ?? line.openingBalance
        );

        const currentYearBalance = numberOrZero(
          line.current_year_balance ??
            line.currentYearBalance ??
            line.source_balance ??
            line.sourceBalance ??
            line.debit
        );

        const priorYearBalance = numberOrZero(
          line.prior_year_balance ?? line.priorYearBalance ?? line.credit
        );

        return {
          engagement_id: engagementId,

          account_code: cleanText(line.account_code ?? line.accountCode),
          account_name: cleanText(line.account_name ?? line.accountName),
          account_type: cleanText(line.account_type ?? line.accountType),

          debit: currentYearBalance,
          credit: priorYearBalance,

          opening_balance: openingBalance,
          current_year_balance: currentYearBalance,
          prior_year_balance: priorYearBalance,

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
            "Current and prior year final balances",

          mapping_category: cleanText(
            line.mapping_category ?? line.mappingCategory
          ),
          note_number: cleanText(line.note_number ?? line.noteNumber),
        };
      })
      .filter((line: any) => line.account_name);

    if (cleanLines.length === 0) {
      return NextResponse.json(
        { error: "No valid trial balance lines were provided." },
        { status: 400 }
      );
    }

    const { error: deleteError } = await supabase
      .from("afs_trial_balance_lines")
      .delete()
      .eq("engagement_id", engagementId);

    if (deleteError) {
      throw deleteError;
    }

    const { data, error: insertError } = await supabase
      .from("afs_trial_balance_lines")
      .insert(cleanLines)
      .select("*")
      .order("account_code", { ascending: true });

    if (insertError) {
      throw insertError;
    }

    return NextResponse.json({
      success: true,
      lines: data || [],
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Failed to import trial balance." },
      { status: 500 }
    );
  }
}

function cleanText(value: any) {
  if (value === null || value === undefined) return null;

  const text = String(value).trim();

  return text || null;
}

function numberOrZero(value: any) {
  if (value === null || value === undefined || value === "") return 0;

  if (typeof value === "number") {
    return Number.isFinite(value) ? value : 0;
  }

  const cleaned = String(value)
    .replace(/,/g, "")
    .replace(/\s/g, "")
    .replace(/[Rr]/g, "")
    .replace(/\((.*?)\)/, "-$1");

  const numberValue = Number(cleaned);

  return Number.isFinite(numberValue) ? numberValue : 0;
}