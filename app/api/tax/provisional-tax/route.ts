import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getSupabaseAdmin() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Missing Supabase admin environment variables.");
  }

  return createClient(supabaseUrl, serviceRoleKey);
}

function money(value: unknown) {
  const amount = Number(value ?? 0);
  return Number.isFinite(amount) ? amount : 0;
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const clientId = url.searchParams.get("clientId");
    const taxYear = Number(url.searchParams.get("taxYear") || 2027);
    const provisionalPeriod = url.searchParams.get("period") || "first";

    if (!clientId) {
      return NextResponse.json(
        { success: false, error: "clientId is required." },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdmin();

    const { data: client, error: clientError } = await supabase
      .from("crm_clients")
      .select("id, organisation_id, client_name, registration_number")
      .eq("id", clientId)
      .maybeSingle();

    if (clientError) throw clientError;
    if (!client) {
      return NextResponse.json(
        { success: false, error: "Client not found." },
        { status: 404 }
      );
    }

    const { data: workbench, error: workbenchError } = await supabase
      .from("crm_provisional_tax_workbenches")
      .select("*")
      .eq("client_id", clientId)
      .eq("tax_year", taxYear)
      .eq("provisional_period", provisionalPeriod)
      .maybeSingle();

    if (workbenchError) throw workbenchError;

    return NextResponse.json({
      success: true,
      client,
      workbench: workbench || null,
    });
  } catch (error: any) {
    console.error("LOAD PROVISIONAL TAX WORKBENCH ERROR:", error);

    return NextResponse.json(
      {
        success: false,
        error: error?.message || "Unable to load provisional tax workbench.",
      },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const {
      clientId,
      taxYear = 2027,
      provisionalPeriod = "first",
      dueDate,
      basicAssessmentYear,
      basicAssessmentDate,
      basicTaxableIncome,
      basicCapitalGainComponent,
      basicUpliftPercent,
      basicAmount,
      ytdPeriodStart,
      ytdPeriodEnd,
      ytdMonths,
      ytdAccountingProfit,
      projectedAccountingProfit,
      nonDeductibleExpenses,
      donations,
      accountingDepreciation,
      taxCapitalAllowances,
      otherTaxAdjustments,
      currentTaxableIncome,
      projectedTaxableIncome,
      customTaxableIncome,
      recommendedBasis,
      recommendedTaxableIncome,
      payeCredits,
      foreignTaxCredits,
      firstProvisionalPaid,
      otherTaxCredits,
      estimatedFullYearTax,
      recommendedProvisionalPayment,
      adviserNote,
      status = "draft",
      clientApprovalStatus = "pending",
      clientApprovedByName,
      clientApprovedAt,
      clientApprovalMethod,
      clientApprovalNote,
      irp6PreparedAt,
      irp6SubmittedAt,
      irp6SubmissionReference,
      paymentStatus = "not_paid",
      paymentDate,
      paymentReference,
    } = body;

    if (!clientId) {
      return NextResponse.json(
        { success: false, error: "Please select a client." },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdmin();

    const { data: client, error: clientError } = await supabase
      .from("crm_clients")
      .select("id, organisation_id")
      .eq("id", clientId)
      .maybeSingle();

    if (clientError) throw clientError;
    if (!client?.organisation_id) {
      return NextResponse.json(
        { success: false, error: "Client or organisation not found." },
        { status: 404 }
      );
    }

    const payload = {
      organisation_id: client.organisation_id,
      client_id: clientId,
      tax_year: Number(taxYear),
      provisional_period: provisionalPeriod,
      due_date: dueDate || null,
      company_tax_rate: 0.27,

      basic_assessment_year: basicAssessmentYear
        ? Number(basicAssessmentYear)
        : null,
      basic_assessment_date: basicAssessmentDate || null,
      basic_taxable_income: money(basicTaxableIncome),
      basic_capital_gain_component: money(basicCapitalGainComponent),
      basic_uplift_percent: money(basicUpliftPercent),
      basic_amount: money(basicAmount),

      ytd_period_start: ytdPeriodStart || null,
      ytd_period_end: ytdPeriodEnd || null,
      ytd_months: money(ytdMonths),
      ytd_accounting_profit: money(ytdAccountingProfit),

      projected_accounting_profit: money(projectedAccountingProfit),
      non_deductible_expenses: money(nonDeductibleExpenses),
      donations: money(donations),
      accounting_depreciation: money(accountingDepreciation),
      tax_capital_allowances: money(taxCapitalAllowances),
      other_tax_adjustments: money(otherTaxAdjustments),

      current_taxable_income: money(currentTaxableIncome),
      projected_taxable_income: money(projectedTaxableIncome),
      custom_taxable_income:
        recommendedBasis === "custom" ? money(customTaxableIncome) : null,

      recommended_basis: recommendedBasis || "projected",
      recommended_taxable_income: money(recommendedTaxableIncome),

      paye_credits: money(payeCredits),
      foreign_tax_credits: money(foreignTaxCredits),
      first_provisional_paid: money(firstProvisionalPaid),
      other_tax_credits: money(otherTaxCredits),

      estimated_full_year_tax: money(estimatedFullYearTax),
      recommended_provisional_payment: money(recommendedProvisionalPayment),

      adviser_note: adviserNote || null,
      status,
      client_approval_status: clientApprovalStatus || "pending",
      client_approved_by_name: clientApprovedByName || null,
      client_approved_at: clientApprovedAt || null,
      client_approval_method: clientApprovalMethod || null,
      client_approval_note: clientApprovalNote || null,

      irp6_prepared_at: irp6PreparedAt || null,
      irp6_submitted_at: irp6SubmittedAt || null,
      irp6_submission_reference: irp6SubmissionReference || null,
      payment_status: paymentStatus || "not_paid",
      payment_date: paymentDate || null,
      payment_reference: paymentReference || null,

      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from("crm_provisional_tax_workbenches")
      .upsert(payload, {
        onConflict: "client_id,tax_year,provisional_period",
      })
      .select("*")
      .single();

    if (error) throw error;

    return NextResponse.json({
      success: true,
      workbench: data,
    });
  } catch (error: any) {
    console.error("SAVE PROVISIONAL TAX WORKBENCH ERROR:", error);

    return NextResponse.json(
      {
        success: false,
        error: error?.message || "Unable to save provisional tax workbench.",
      },
      { status: 500 }
    );
  }
}
