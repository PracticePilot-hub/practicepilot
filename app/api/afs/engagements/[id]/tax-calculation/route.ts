import { NextResponse } from "next/server";

import { getSupabaseServer } from "../../../lib/supabaseServer";

async function getId(context: any) {
  const params = await context?.params;
  return String(params?.id || "");
}

function numberValue(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normaliseTaxCalculation(row: any) {
  if (!row) return null;

  return {
    ...row,
    tax_year:
      String(row.calculation_name || "").match(/20\d{2}/)?.[0] || null,
    assessed_loss_bf: numberValue(row.assessed_loss_brought_forward),
    assessed_loss_carried_forward: numberValue(row.assessed_loss_carried_forward),
    current_tax: numberValue(row.normal_tax),
    provisional_tax_paid: numberValue(row.provisional_tax_paid),
    tax_payable: numberValue(row.tax_payable),
    deferred_tax_asset_potential: numberValue(row.deferred_tax_asset_potential),
    deferred_tax_asset_recognised: numberValue(row.deferred_tax_asset_recognised),
    recognise_deferred_tax_asset: Boolean(row.recognise_deferred_tax_asset),
    deferred_tax: numberValue(row.deferred_tax_asset_recognised),
  };
}

async function invalidateTaxCalculatorSignoff(
  supabase: ReturnType<typeof getSupabaseServer>,
  engagementId: string,
  reason: string,
) {
  const { data: existing, error: existingError } = await supabase
    .from("afs_section_signoffs")
    .select("id,prepared_at,reviewed_at,captain_cleared_at")
    .eq("engagement_id", engagementId)
    .eq("section_key", "tax-calculator")
    .maybeSingle();

  if (existingError) throw existingError;

  if (
    !existing?.id ||
    (!existing.prepared_at &&
      !existing.reviewed_at &&
      !existing.captain_cleared_at)
  ) {
    return false;
  }

  const now = new Date().toISOString();

  const { error: reopenError } = await supabase
    .from("afs_section_signoffs")
    .update({
      prepared_by: null,
      prepared_at: null,
      reviewed_by: null,
      reviewed_at: null,
      captain_cleared_by: null,
      captain_cleared_at: null,
      reopened_at: now,
      reopen_reason: reason,
      updated_at: now,
    })
    .eq("id", existing.id);

  if (reopenError) throw reopenError;

  return true;
}

export async function GET(_request: Request, context: any) {
  try {
    const engagementId = await getId(context);
    const supabase = getSupabaseServer();

    const { data, error } = await supabase
      .from("afs_tax_calculations")
      .select("*")
      .eq("engagement_id", engagementId)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw error;

    return NextResponse.json({
      taxCalculation: normaliseTaxCalculation(data),
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Failed to load tax calculation." },
      { status: 500 },
    );
  }
}

export async function POST(request: Request, context: any) {
  try {
    const engagementId = await getId(context);
    const body = await request.json();
    const supabase = getSupabaseServer();

    const taxYear = String(body.taxYear || "2026");
    const taxRegime = body.taxRegime === "sbc" ? "sbc" : "normal";

    const currentTax = Math.max(0, numberValue(body.currentTax));
    const provisionalTaxPaid = Math.max(
      0,
      numberValue(body.provisionalTaxPaid),
    );

    const payload = {
      engagement_id: engagementId,
      calculation_name: `Tax computation ${taxYear}`,
      accounting_profit: numberValue(body.accountingProfit),
      permanent_differences: numberValue(body.permanentDifferences),
      temporary_differences: numberValue(body.temporaryDifferences),
      assessed_loss_brought_forward: Math.max(
        0,
        numberValue(body.assessedLossBf),
      ),
      assessed_loss_carried_forward: Math.max(
        0,
        numberValue(body.assessedLossCarriedForward),
      ),
      taxable_income: Math.max(0, numberValue(body.taxableIncome)),
      tax_rate: Math.max(0, numberValue(body.taxRate, 0.27)),
      normal_tax: currentTax,
      provisional_tax_paid: provisionalTaxPaid,
      tax_payable: currentTax - provisionalTaxPaid,
      deferred_tax_asset_potential: Math.max(
        0,
        numberValue(body.deferredTaxAssetPotential),
      ),
      recognise_deferred_tax_asset: Boolean(body.recogniseDeferredTaxAsset),
      deferred_tax_asset_recognised: Math.max(
        0,
        numberValue(body.deferredTaxAssetRecognised),
      ),
      tax_regime: taxRegime,
      notes: String(body.notes || "").trim() || null,
      updated_at: new Date().toISOString(),
    };

    const { data: existing, error: existingError } = await supabase
      .from("afs_tax_calculations")
      .select("id")
      .eq("engagement_id", engagementId)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existingError) throw existingError;

    let saved;
    let saveError;

    if (existing?.id) {
      const result = await supabase
        .from("afs_tax_calculations")
        .update(payload)
        .eq("id", existing.id)
        .select("*")
        .single();

      saved = result.data;
      saveError = result.error;
    } else {
      const result = await supabase
        .from("afs_tax_calculations")
        .insert(payload)
        .select("*")
        .single();

      saved = result.data;
      saveError = result.error;
    }

    if (saveError) throw saveError;

    const signoffInvalidated = await invalidateTaxCalculatorSignoff(
      supabase,
      engagementId,
      `Tax Calculator changed after sign-off: tax calculation ${taxYear} was saved.`,
    );

    return NextResponse.json({
      taxCalculation: normaliseTaxCalculation(saved),
      signoffInvalidated,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Failed to save tax calculation." },
      { status: 500 },
    );
  }
}
