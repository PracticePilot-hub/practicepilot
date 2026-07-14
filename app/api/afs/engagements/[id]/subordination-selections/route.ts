import { NextResponse } from "next/server";
import { getSupabaseServer } from "../../../lib/supabaseServer";

async function getEngagementId(context: any) {
  const params = await context.params;
  return String(params.id || "");
}

function normaliseMoney(value: any) {
  const numberValue = Number(value || 0);
  return Number.isFinite(numberValue) ? numberValue : 0;
}

export async function GET(_req: Request, context: any) {
  try {
    const engagementId = await getEngagementId(context);

    if (!engagementId) {
      return NextResponse.json(
        { error: "Missing engagement id." },
        { status: 400 }
      );
    }

    const supabase = getSupabaseServer();

    const { data, error } = await supabase
      .from("afs_subordination_selections")
      .select("*")
      .eq("engagement_id", engagementId)
      .order("account_code", { ascending: true });

    if (error) {
      throw error;
    }

    return NextResponse.json({ selections: data || [] });
  } catch (error: any) {
    return NextResponse.json(
      {
        error:
          error?.message || "Failed to load subordination selections.",
      },
      { status: 500 }
    );
  }
}

export async function POST(req: Request, context: any) {
  try {
    const engagementId = await getEngagementId(context);

    if (!engagementId) {
      return NextResponse.json(
        { error: "Missing engagement id." },
        { status: 400 }
      );
    }

    const body = await req.json();
    const supabase = getSupabaseServer();

    const trialBalanceLineId = String(body.trialBalanceLineId || "").trim();

    if (!trialBalanceLineId) {
      return NextResponse.json(
        { error: "Missing trial balance line id." },
        { status: 400 }
      );
    }

    const payload = {
      engagement_id: engagementId,
      trial_balance_line_id: trialBalanceLineId,
      account_code: String(body.accountCode || "").trim() || null,
      account_name: String(body.accountName || "").trim() || null,
      creditor_name: String(body.creditorName || "").trim() || null,
      relationship: String(body.relationship || "").trim() || null,
      balance_current: normaliseMoney(body.balanceCurrent),
      balance_prior: normaliseMoney(body.balancePrior),
      include_in_agreement: Boolean(body.includeInAgreement),
      interest_terms: String(body.interestTerms || "").trim() || null,
      repayment_terms: String(body.repaymentTerms || "").trim() || null,
      security_terms: String(body.securityTerms || "").trim() || null,
      subordination_terms:
        String(body.subordinationTerms || "").trim() || null,
      company_signatory_person_id:
        String(body.companySignatoryPersonId || "").trim() || null,
      company_signatory_name:
        String(body.companySignatoryName || "").trim() || null,
      company_signatory_capacity:
        String(body.companySignatoryCapacity || "").trim() || null,
      agreement_status:
        String(body.agreementStatus || "Draft").trim() || "Draft",
      updated_at: new Date().toISOString(),
    };

    const { data: existingSelection, error: existingSelectionError } =
      await supabase
        .from("afs_subordination_selections")
        .select("id")
        .eq("engagement_id", engagementId)
        .eq("trial_balance_line_id", trialBalanceLineId)
        .maybeSingle();

    if (existingSelectionError) {
      throw existingSelectionError;
    }

    if (existingSelection?.id) {
      const { data, error } = await supabase
        .from("afs_subordination_selections")
        .update(payload)
        .eq("id", existingSelection.id)
        .select("*")
        .single();

      if (error) {
        throw error;
      }

      return NextResponse.json({ selection: data });
    }

    const { data, error } = await supabase
      .from("afs_subordination_selections")
      .insert(payload)
      .select("*")
      .single();

    if (error) {
      throw error;
    }

    return NextResponse.json({ selection: data });
  } catch (error: any) {
    return NextResponse.json(
      {
        error:
          error?.message || "Failed to save subordination selection.",
      },
      { status: 500 }
    );
  }
}