import {withTaxSectionReview} from "../../../../../afs/[engagementId]/tax/taxSectionReview";
import {bindTrustWorkpaper,trustTaxRegime,specialTrustTax} from "../../../../../afs/[engagementId]/tax/taxEntityRates";
import { calculateTax, taxWorkbookIssues, priorTaxYearEnd, decodeTaxNotes, encodeTaxNotes, mapped, taxDifferences } from "../../../../../afs/[engagementId]/tax/taxWorkpaper";
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

function normaliseTaxCalculation(row: any, setup?: any) {
  if (!row) return null;

  return {
    ...row,
    ...decodeTaxNotes(row.notes),
    ...(decodeTaxNotes(row.notes).worksheet ? {worksheet:bindTrustWorkpaper(decodeTaxNotes(row.notes).worksheet!,setup)} : {}),
    tax_year:
      String(row.calculation_name || "").match(/20\d{2}/)?.[0] || null,
    assessed_loss_bf: numberValue(row.assessed_loss_brought_forward),
    assessed_loss_carried_forward: numberValue(row.assessed_loss_carried_forward),
    current_tax: /trust/i.test(String(setup?.entity_type || "")) && !decodeTaxNotes(row.notes).worksheet ? (trustTaxRegime(setup)==="special-trust" ? specialTrustTax(numberValue(row.taxable_income),`${String(row.calculation_name).match(/20\d{2}/)?.[0]}-02-28`) : Math.round(numberValue(row.taxable_income)*0.45)) : numberValue(row.normal_tax),
    tax_rate: /trust/i.test(String(setup?.entity_type || "")) && !decodeTaxNotes(row.notes).worksheet ? 0.45 : row.tax_rate,
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
  sectionKey = "tax-calculator",
) {
  const { data: existing, error: existingError } = await supabase
    .from("afs_section_signoffs")
    .select("id,prepared_at,reviewed_at,captain_cleared_at")
    .eq("engagement_id", engagementId)
    .eq("section_key", sectionKey)
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

export async function GET(request: Request, context: any) {
  try {
    const engagementId = await getId(context);
    const supabase = getSupabaseServer();

    const {data:setup,error:setupError}=await supabase.from("afs_client_setup").select("entity_type").eq("engagement_id",engagementId).maybeSingle();
    if(setupError)throw setupError;
    const requestedYear=new URL(request.url).searchParams.get("taxYear");
    const {data:engagement,error:engagementError}=await supabase.from("afs_engagements").select("financial_year_end").eq("id",engagementId).single();
    if(engagementError)throw engagementError;
    const year=requestedYear||String(engagement.financial_year_end).slice(0,4);
    if(!/^\d{4}$/.test(year))return NextResponse.json({error:"Invalid tax year."},{status:400});
    const { data, error } = await supabase
      .from("afs_tax_calculations")
      .select("*")
      .eq("engagement_id", engagementId)
      .eq("calculation_name", `Tax computation ${year}`)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw error;

    const {data:prior,error:priorError}=await supabase.from("afs_tax_calculations").select("*").eq("engagement_id",engagementId).eq("calculation_name",`Tax computation ${Number(year)-1}`).order("updated_at",{ascending:false}).limit(1).maybeSingle();
    if(priorError)throw priorError;
    const {data:signoff,error:signoffError}=await supabase.from("afs_section_signoffs").select("engagement_id,section_key,reviewed_by,reviewed_at").eq("engagement_id",engagementId).eq("section_key","tax-calculator").maybeSingle();
    if(signoffError)throw signoffError;
    return NextResponse.json({
      priorTaxCalculation:withTaxSectionReview(normaliseTaxCalculation(prior,setup),signoff),
      taxCalculation:withTaxSectionReview(normaliseTaxCalculation(data,setup),signoff),
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

    const {data:setup,error:setupError}=await supabase.from("afs_client_setup").select("entity_type").eq("engagement_id",engagementId).maybeSingle();
    if(setupError)throw setupError;
    let workbook=body.worksheet ? bindTrustWorkpaper(body.worksheet,setup) : undefined;
    const taxYear = String(workbook?.yearEnd?.slice(0,4)||body.taxYear||"");
    if(!/^\d{4}$/.test(taxYear))return NextResponse.json({error:"A valid tax year is required."},{status:400});
    let calculation:ReturnType<typeof calculateTax>|null=null;
    if(workbook){
      const [{data:tb,error:tbError},{data:settings,error:settingsError},{data:engagement,error:engagementError}]=await Promise.all([
        supabase.from("afs_trial_balance_lines").select("*").eq("engagement_id",engagementId),
        supabase.from("afs_print_studio_settings").select("structured_notes_state").eq("engagement_id",engagementId).maybeSingle(),
        supabase.from("afs_engagements").select("financial_year_end").eq("id",engagementId).single(),
      ]);
      if(tbError||settingsError||engagementError)throw tbError||settingsError||engagementError;
      const currentYear=String(engagement.financial_year_end).slice(0,4);
      if(![currentYear,String(Number(currentYear)-1)].includes(taxYear))return NextResponse.json({error:"Use the engagement current or comparative tax year."},{status:400});
      if(![String(engagement.financial_year_end),priorTaxYearEnd(String(engagement.financial_year_end))].includes(workbook.yearEnd))return NextResponse.json({error:"The workpaper period must match the engagement or its comparative."},{status:400});
      const comparative=taxYear!==currentYear;
      const periodLines=(tb||[]).map(row=>comparative?{...row,current_year_balance:row.prior_year_balance,prior_year_balance:0}:row);
      try{calculation=calculateTax(workbook,periodLines,settings?.structured_notes_state?.presentationReview?.scope==="consolidated");}catch(error){return NextResponse.json({error:(error as Error).message},{status:400});}
      if(workbook.reviewed&&(taxWorkbookIssues({worksheet:workbook},periodLines,settings?.structured_notes_state?.presentationReview?.scope==="consolidated").length))return NextResponse.json({error:"Resolve the tax workpaper issues and post/reconcile the tax adjustment before marking it reviewed."},{status:422});
      body.accountingProfit=calculation.profit;body.permanentDifferences=calculation.permanent;body.temporaryDifferences=calculation.temporary;body.assessedLossBf=calculation.lossBf;body.assessedLossCarriedForward=calculation.lossCf;body.taxableIncome=calculation.taxable;body.currentTax=calculation.current;body.provisionalTaxPaid=calculation.payments-calculation.refunds;body.taxRate=calculation.entities[0]?.rate;body.deferredTaxAssetPotential=calculation.entities.reduce((n,row)=>n+row.lossPotential,0);body.deferredTaxAssetRecognised=calculation.dta;body.recogniseDeferredTaxAsset=calculation.dta>0;body.notes=encodeTaxNotes(workbook);
    }
    if(!workbook && /trust/i.test(String(setup?.entity_type || ""))) return NextResponse.json({error:"Open the trust tax workpaper and save the 45% ordinary-trust calculation or supported special-trust calculation."},{status:422});
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
      tax_rate: Math.max(0, (/trust/i.test(String(setup?.entity_type || "")) && !workbook) ? 0.45 : numberValue(body.taxRate, 0.27)),
      normal_tax: currentTax,
      provisional_tax_paid: provisionalTaxPaid,
      tax_payable: calculation ? calculation.currentPayable-calculation.currentReceivable : numberValue(body.openingTaxBalance)+currentTax-provisionalTaxPaid,
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
      .eq("calculation_name", `Tax computation ${taxYear}`)
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

    await invalidateTaxCalculatorSignoff(supabase, engagementId, `Tax computation ${taxYear} changed after sign-off.`, "financial-statements");

    return NextResponse.json({
      taxCalculation: normaliseTaxCalculation(saved),
      calculation,
      signoffInvalidated,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Failed to save tax calculation." },
      { status: 500 },
    );
  }
}
