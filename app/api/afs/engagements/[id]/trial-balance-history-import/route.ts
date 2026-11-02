import { NextRequest, NextResponse } from "next/server";
import { validHistoricalMapping } from "../../../../../afs/[engagementId]/historicalTbImport";
import { getSupabaseServer } from "../../../lib/supabaseServer";

function clean(value: unknown) { return String(value ?? "").trim(); }
function signed(value: unknown) { const n = Number(value); return Number.isFinite(n) ? n : NaN; }

export async function POST(req: NextRequest, context: any) {
  try {
    const { id: engagementId } = await context.params;
    if (!engagementId) return NextResponse.json({ error: "Missing engagement." }, { status: 400 });
    const token = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "").trim();
    if (!token) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
    const supabase = getSupabaseServer();
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) return NextResponse.json({ error: "Invalid session." }, { status: 401 });
    const { data: profile, error: profileError } = await supabase.from("user_profiles")
      .select("organisation_id,access_enabled,can_access_afs")
      .eq("user_id", user.id).single();
    if (profileError || !profile?.access_enabled || profile.can_access_afs === false)
      return NextResponse.json({ error: "AFS access denied." }, { status: 403 });
    const { data: engagement, error: engagementError } = await supabase.from("afs_engagements")
      .select("id,organisation_id,financial_year_end,status").eq("id", engagementId).single();
    if (engagementError || !engagement || !profile.organisation_id ||
        engagement.organisation_id !== profile.organisation_id)
      return NextResponse.json({ error: "Engagement access denied." }, { status: 403 });
    if (String(engagement.status || "").toLowerCase() === "final")
      return NextResponse.json({ error: "Reopen the finalised AFS engagement before changing history." }, { status: 409 });

    const body = await req.json();
    const financialYearEnd = clean(body.financialYearEnd);
    if (!/^20\d{2}-\d{2}-\d{2}$/.test(financialYearEnd) ||
        Number.isNaN(Date.parse(financialYearEnd)) ||
        financialYearEnd >= clean(engagement.financial_year_end).slice(0, 10))
      return NextResponse.json({ error: "Choose a historical year end before the current engagement year." }, { status: 400 });
    const lines = body.lines;
    if (!Array.isArray(lines) || !lines.length || lines.length > 10000)
      return NextResponse.json({ error: "History import must contain between 1 and 10,000 accounts." }, { status: 400 });

    const seen = new Set<string>();
    let sum = 0;
    const now = new Date().toISOString();
    const records = lines.map((line: any, index: number) => {
      const accountCode = clean(line.account_code).replace(/\s+/g, "").toUpperCase();
      const amount = signed(line.closing_balance);
      const mappingCode = clean(line.mapping_code);
      if (!accountCode || !clean(line.account_name) || !Number.isFinite(amount) ||
          !validHistoricalMapping(mappingCode) || seen.has(accountCode)) {
        throw new Error(`Invalid or duplicate account at Excel row ${index + 2}.`);
      }
      seen.add(accountCode);
      sum += amount;
      return {
        organisation_id: engagement.organisation_id,
        engagement_id: engagementId,
        source_engagement_id: engagementId,
        financial_year_end: financialYearEnd,
        account_code: accountCode,
        account_name: clean(line.account_name),
        closing_balance: amount,
        mapping_code: mappingCode || null,
        mapping_label: clean(line.mapping_label) || null,
        mapping_statement: clean(line.mapping_statement) || null,
        mapping_section: clean(line.mapping_section) || null,
        mapping_path: clean(line.mapping_path) || null,
        lead_schedule_number: clean(line.lead_schedule_number) || null,
        lead_schedule_key: clean(line.lead_schedule_key) || null,
        updated_at: now,
      };
    });
    if (Math.abs(sum) > 0.01)
      return NextResponse.json({ error: `Historical signed TB does not balance: ${sum.toFixed(2)}.` }, { status: 400 });

    // Capture an original snapshot so a failed insert cannot leave a year missing.
    const { data: original, error: readError } = await supabase.from("afs_trial_balance_history")
      .select("*").eq("engagement_id", engagementId).eq("financial_year_end", financialYearEnd);
    if (readError) throw readError;
    const { error: deleteError } = await supabase.from("afs_trial_balance_history")
      .delete().eq("engagement_id", engagementId).eq("financial_year_end", financialYearEnd);
    if (deleteError) throw deleteError;
    // Send chunks to avoid large PostgREST bodies.
    let inserted = 0;
    try {
      for (let index = 0; index < records.length; index += 400) {
        const chunk = records.slice(index, index + 400);
        const { error } = await supabase.from("afs_trial_balance_history").insert(chunk);
        if (error) throw error;
        inserted += chunk.length;
      }
    } catch (error) {
      await supabase.from("afs_trial_balance_history").delete()
        .eq("engagement_id", engagementId).eq("financial_year_end", financialYearEnd);
      if (original?.length) {
        await supabase.from("afs_trial_balance_history").insert(original);
      }
      throw error;
    }
    return NextResponse.json({ success: true, inserted, financialYearEnd });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Historical TB import failed." }, { status: 500 });
  }
}
