import { NextResponse } from "next/server";
import { getSupabaseServer } from "../../../lib/supabaseServer";

function getId(context: any) {
  return String(context?.params?.id || "");
}

export async function GET(request: Request, context: any) {
  try {
    const engagementId = getId(context);
    const taxYear = new URL(request.url).searchParams.get("taxYear") || "2026";
    const supabase = getSupabaseServer();
    const { data, error } = await supabase
      .from("afs_tax_calculations")
      .select("*")
      .eq("engagement_id", engagementId)
      .eq("tax_year", taxYear)
      .maybeSingle();
    if (error) throw error;
    return NextResponse.json({ taxCalculation: data || null });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Failed to load tax calculation." }, { status: 500 });
  }
}

export async function POST(request: Request, context: any) {
  try {
    const engagementId = getId(context);
    const body = await request.json();
    const supabase = getSupabaseServer();
    const payload = {
      engagement_id: engagementId,
      tax_year: body.taxYear || "2026",
      accounting_profit: Number(body.accountingProfit) || 0,
      permanent_differences: Number(body.permanentDifferences) || 0,
      temporary_differences: Number(body.temporaryDifferences) || 0,
      assessed_loss_bf: Number(body.assessedLossBf) || 0,
      taxable_income: Number(body.taxableIncome) || 0,
      tax_rate: Number(body.taxRate) || 0.27,
      current_tax: Number(body.currentTax) || 0,
      deferred_tax: Number(body.deferredTax) || 0,
      notes: body.notes || null,
      updated_at: new Date().toISOString(),
    };
    const { data, error } = await supabase
      .from("afs_tax_calculations")
      .upsert(payload, { onConflict: "engagement_id,tax_year" })
      .select("*")
      .single();
    if (error) throw error;
    return NextResponse.json({ taxCalculation: data });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Failed to save tax calculation." }, { status: 500 });
  }
}
