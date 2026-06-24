import { NextResponse } from "next/server";
import { getSupabaseServer } from "../../../lib/supabaseServer";

function getId(context: any) {
  return String(context?.params?.id || "");
}

export async function GET(_request: Request, context: any) {
  try {
    const engagementId = getId(context);
    const supabase = getSupabaseServer();

    const [{ data: trialBalanceLines, error: tbError }, { data: journalEffects, error: journalError }, { data: overrides, error: overrideError }] = await Promise.all([
      supabase.from("afs_trial_balance_lines").select("*").eq("engagement_id", engagementId),
      supabase.from("afs_posted_journal_effects").select("*").eq("engagement_id", engagementId),
      supabase.from("afs_financial_statement_overrides").select("*").eq("engagement_id", engagementId),
    ]);

    if (tbError) throw tbError;
    if (journalError) throw journalError;
    if (overrideError) throw overrideError;

    return NextResponse.json({
      trialBalanceLines: trialBalanceLines || [],
      journalEffects: journalEffects || [],
      overrides: overrides || [],
    });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Failed to load financial statement data." }, { status: 500 });
  }
}
