import { NextResponse } from "next/server";
import { getSupabaseServer } from "../../../lib/supabaseServer";

function getId(context: any) {
  return String(context?.params?.id || "");
}

function toNumber(value: any) {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : 0;
}

export async function GET(_request: Request, context: any) {
  try {
    const engagementId = getId(context);
    const supabase = getSupabaseServer();

    const { data: journals, error } = await supabase
      .from("afs_adjusting_journals")
      .select("*, lines:afs_adjusting_journal_lines(*)")
      .eq("engagement_id", engagementId)
      .order("created_at", { ascending: false });

    if (error) throw error;
    return NextResponse.json({ journals: journals || [] });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Failed to load journals." }, { status: 500 });
  }
}

export async function POST(request: Request, context: any) {
  try {
    const engagementId = getId(context);
    const body = await request.json();
    const supabase = getSupabaseServer();

    const lines = Array.isArray(body.lines) ? body.lines : [];
    const debitTotal = lines.reduce((sum: number, line: any) => sum + toNumber(line.debit), 0);
    const creditTotal = lines.reduce((sum: number, line: any) => sum + toNumber(line.credit), 0);
    const isBalanced = Math.abs(debitTotal - creditTotal) < 0.01;

    const { count } = await supabase
      .from("afs_adjusting_journals")
      .select("id", { count: "exact", head: true })
      .eq("engagement_id", engagementId);

    const nextNumber = `AJ${String((count || 0) + 1).padStart(3, "0")}`;

    const { data: journal, error: journalError } = await supabase
      .from("afs_adjusting_journals")
      .insert({
        engagement_id: engagementId,
        journal_number: nextNumber,
        journal_date: body.journalDate || new Date().toISOString().slice(0, 10),
        description: body.description || "Adjusting journal",
        status: body.status || "posted",
        is_balanced: isBalanced,
        posted_at: body.status === "draft" ? null : new Date().toISOString(),
      })
      .select("*")
      .single();

    if (journalError) throw journalError;

    if (lines.length > 0) {
      const payload = lines.map((line: any) => ({
        engagement_id: engagementId,
        journal_id: journal.id,
        trial_balance_line_id: line.trial_balance_line_id || null,
        account_code: line.account_code || null,
        account_name: line.account_name || "",
        debit: toNumber(line.debit),
        credit: toNumber(line.credit),
        note: line.note || null,
      }));

      const { error: lineError } = await supabase
        .from("afs_adjusting_journal_lines")
        .insert(payload);

      if (lineError) throw lineError;
    }

    const { data: savedJournal, error: readError } = await supabase
      .from("afs_adjusting_journals")
      .select("*, lines:afs_adjusting_journal_lines(*)")
      .eq("id", journal.id)
      .single();

    if (readError) throw readError;
    return NextResponse.json({ journal: savedJournal });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Failed to save journal." }, { status: 500 });
  }
}
