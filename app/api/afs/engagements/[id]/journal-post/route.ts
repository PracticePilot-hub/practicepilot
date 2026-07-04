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

function normaliseAccountCode(value: unknown) {
  return clean(value).replace(/\s+/g, "").toUpperCase();
}

function toNumber(value: unknown) {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;

  const raw = clean(value);
  if (!raw) return 0;

  const negative = raw.startsWith("(") && raw.endsWith(")");
  const parsed = Number(
    raw.replace(/[R\s]/g, "").replace(/,/g, ".").replace(/[()]/g, ""),
  );

  if (!Number.isFinite(parsed)) return 0;
  return negative ? -Math.abs(parsed) : parsed;
}

function firstNumber(line: any, keys: string[]) {
  for (const key of keys) {
    const value = line?.[key];
    if (value !== undefined && value !== null && value !== "") {
      return toNumber(value);
    }
  }

  return 0;
}

function compactPayload(payload: Record<string, any>) {
  const next: Record<string, any> = {};

  for (const [key, value] of Object.entries(payload)) {
    if (value !== undefined) next[key] = value;
  }

  return next;
}

function buildUpdatePayload(existing: any, movement: number) {
  const existingAdjustment = firstNumber(existing, [
    "adjustments",
    "adjustment",
    "journal_adjustments",
  ]);

  const nextAdjustment = existingAdjustment + movement;

  const sourceBalance =
    firstNumber(existing, [
      "source_balance",
      "source_current_balance",
      "imported_balance",
      "debit",
    ]) - firstNumber(existing, ["credit"]);

  const fallbackCurrent = firstNumber(existing, [
    "current_year_balance",
    "current_balance",
    "final_balance",
  ]);

  const currentBase =
    Math.abs(sourceBalance) >= 0.005 ? sourceBalance : fallbackCurrent;

  const reclassifications = firstNumber(existing, [
    "reclassifications",
    "reclassification",
  ]);

  const finalBalance = currentBase + nextAdjustment + reclassifications;

  return {
    adjustments: nextAdjustment,
    final_balance: finalBalance,
    current_year_balance: finalBalance,
    current_balance: finalBalance,
    updated_at: new Date().toISOString(),
  };
}

function payloadFallbacks(payload: Record<string, any>) {
  return [
    compactPayload(payload),
    compactPayload({
      adjustments: payload.adjustments,
      final_balance: payload.final_balance,
      current_year_balance: payload.current_year_balance,
    }),
    compactPayload({
      adjustments: payload.adjustments,
      final_balance: payload.final_balance,
    }),
    compactPayload({
      current_year_balance: payload.current_year_balance,
    }),
    compactPayload({
      debit: Math.max(0, payload.current_year_balance),
      credit: Math.max(0, -payload.current_year_balance),
    }),
  ];
}

async function updateLineByCode(
  supabase: any,
  engagementId: string,
  accountCode: string,
  movement: number,
) {
  const { data: existingLines, error: selectError } = await supabase
    .from("afs_trial_balance_lines")
    .select("*")
    .eq("engagement_id", engagementId)
    .eq("account_code", accountCode)
    .limit(1);

  if (selectError) throw selectError;

  const existing = existingLines?.[0];

  if (!existing) {
    throw new Error(
      `Account ${accountCode} was not found in the trial balance lines.`,
    );
  }

  const fullPayload = buildUpdatePayload(existing, movement);
  let lastError: any = null;

  for (const payload of payloadFallbacks(fullPayload)) {
    const { data, error } = await supabase
      .from("afs_trial_balance_lines")
      .update(payload)
      .eq("engagement_id", engagementId)
      .eq("account_code", accountCode)
      .select("*");

    if (!error) return data?.[0] || null;
    lastError = error;
  }

  throw lastError || new Error(`Failed to update account ${accountCode}.`);
}

async function getNextJournalNumber(supabase: any, engagementId: string) {
  const { data, error } = await supabase
    .from("afs_adjusting_journals")
    .select("journal_number")
    .eq("engagement_id", engagementId)
    .order("journal_number", { ascending: false })
    .limit(1);

  if (error) throw error;

  const lastNumber = Number(data?.[0]?.journal_number || 0);
  return Number.isFinite(lastNumber) ? lastNumber + 1 : 1;
}

function fallbackJournalReference(journalNumber: number) {
  return `AJ${String(journalNumber).padStart(3, "0")}`;
}

async function makeUniqueJournalReference(
  supabase: any,
  engagementId: string,
  requestedReference: string,
  journalNumber: number,
) {
  const baseReference = clean(requestedReference) || fallbackJournalReference(journalNumber);

  const { data, error } = await supabase
    .from("afs_adjusting_journals")
    .select("id,journal_reference")
    .eq("engagement_id", engagementId)
    .eq("journal_reference", baseReference)
    .limit(1);

  if (error) throw error;

  if (!data?.length) return baseReference;

  throw new Error(`Journal reference ${baseReference} already exists for this AFS file.`);
}

async function saveJournalHistory({
  supabase,
  engagementId,
  journalReference,
  description,
  rawLines,
  debitTotal,
  creditTotal,
  difference,
  balanced,
}: {
  supabase: any;
  engagementId: string;
  journalReference: string;
  description: string;
  rawLines: any[];
  debitTotal: number;
  creditTotal: number;
  difference: number;
  balanced: boolean;
}) {
  const journalNumber = await getNextJournalNumber(supabase, engagementId);
  const finalJournalReference = await makeUniqueJournalReference(
    supabase,
    engagementId,
    journalReference,
    journalNumber,
  );

  const journalPayload = {
    engagement_id: engagementId,
    journal_number: journalNumber,
    journal_reference: finalJournalReference,
    description,
    status: balanced ? "Balanced" : "Unbalanced",
    debit_total: debitTotal,
    credit_total: creditTotal,
    difference,
    posted_at: new Date().toISOString(),
  };

  const { data: journal, error: journalError } = await supabase
    .from("afs_adjusting_journals")
    .insert(journalPayload)
    .select("*")
    .single();

  if (journalError) throw journalError;

  const linePayloads = rawLines.map((line, index) => {
    const accountCode = normaliseAccountCode(line.account_code ?? line.accountCode);
    const debit = Math.max(0, toNumber(line.debit));
    const credit = Math.max(0, toNumber(line.credit));

    return {
      journal_id: journal.id,
      engagement_id: engagementId,
      line_number: index + 1,
      account_code: accountCode,
      account_name: clean(line.account_name ?? line.accountName),
      debit,
      credit,
      note: clean(line.note),
    };
  });

  const { data: journalLines, error: linesError } = await supabase
    .from("afs_adjusting_journal_lines")
    .insert(linePayloads)
    .select("*");

  if (linesError) throw linesError;

  return {
    ...journal,
    lines: journalLines || [],
  };
}

export async function GET(req: NextRequest, context: any) {
  try {
    const engagementId = await getIdFromContext(context);
    const supabase = getSupabaseServer();

    const { data: journals, error: journalsError } = await supabase
      .from("afs_adjusting_journals")
      .select("*")
      .eq("engagement_id", engagementId)
      .order("journal_number", { ascending: false });

    if (journalsError) throw journalsError;

    const journalIds = (journals || []).map((journal: any) => journal.id);

    let journalLines: any[] = [];

    if (journalIds.length) {
      const { data: lines, error: linesError } = await supabase
        .from("afs_adjusting_journal_lines")
        .select("*")
        .in("journal_id", journalIds)
        .order("line_number", { ascending: true });

      if (linesError) throw linesError;
      journalLines = lines || [];
    }

    const linesByJournal = new Map<string, any[]>();

    for (const line of journalLines) {
      const journalId = String(line.journal_id || "");
      if (!linesByJournal.has(journalId)) linesByJournal.set(journalId, []);
      linesByJournal.get(journalId)?.push(line);
    }

    const result = (journals || []).map((journal: any) => ({
      ...journal,
      lines: linesByJournal.get(String(journal.id)) || [],
    }));

    return NextResponse.json({ journals: result });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Failed to load journals." },
      { status: 500 },
    );
  }
}


export async function DELETE(req: NextRequest, context: any) {
  try {
    const engagementId = await getIdFromContext(context);
    const body = await req.json();
    const supabase = getSupabaseServer();

    const journalId = clean(body?.journalId ?? body?.id);

    if (!journalId) {
      return NextResponse.json(
        { error: "Missing journal id." },
        { status: 400 },
      );
    }

    const { data: journal, error: journalError } = await supabase
      .from("afs_adjusting_journals")
      .select("*")
      .eq("engagement_id", engagementId)
      .eq("id", journalId)
      .single();

    if (journalError) throw journalError;

    if (!journal) {
      return NextResponse.json(
        { error: "Journal was not found." },
        { status: 404 },
      );
    }

    const { data: journalLines, error: linesError } = await supabase
      .from("afs_adjusting_journal_lines")
      .select("*")
      .eq("engagement_id", engagementId)
      .eq("journal_id", journalId)
      .order("line_number", { ascending: true });

    if (linesError) throw linesError;

    const movements = new Map<string, number>();

    for (const rawLine of journalLines || []) {
      const accountCode = normaliseAccountCode(rawLine.account_code);
      if (!accountCode) continue;

      const debit = Math.max(0, toNumber(rawLine.debit));
      const credit = Math.max(0, toNumber(rawLine.credit));
      const movement = debit - credit;

      movements.set(accountCode, (movements.get(accountCode) || 0) - movement);
    }

    const updatedLines = [];

    for (const [accountCode, reverseMovement] of movements.entries()) {
      if (Math.abs(reverseMovement) < 0.005) continue;

      const updated = await updateLineByCode(
        supabase,
        engagementId,
        accountCode,
        reverseMovement,
      );

      if (updated) updatedLines.push(updated);
    }

    const { error: deleteError } = await supabase
      .from("afs_adjusting_journals")
      .delete()
      .eq("engagement_id", engagementId)
      .eq("id", journalId);

    if (deleteError) throw deleteError;

    return NextResponse.json({
      success: true,
      deletedJournalId: journalId,
      trialBalanceLines: updatedLines,
      lines: updatedLines,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Failed to delete journal." },
      { status: 500 },
    );
  }
}

export async function POST(req: NextRequest, context: any) {
  try {
    const engagementId = await getIdFromContext(context);
    const body = await req.json();
    const supabase = getSupabaseServer();

    const description = clean(body?.description);
    const journalReference = clean(body?.journal_reference ?? body?.journalReference);

    if (!description) {
      return NextResponse.json(
        { error: "Add a journal description first." },
        { status: 400 },
      );
    }

    const rawLines = Array.isArray(body?.lines) ? body.lines : [];

    if (rawLines.length < 2) {
      return NextResponse.json(
        { error: "A journal needs at least two lines." },
        { status: 400 },
      );
    }

    const movements = new Map<string, number>();

    let debitTotal = 0;
    let creditTotal = 0;

    for (const rawLine of rawLines) {
      const accountCode = normaliseAccountCode(
        rawLine.account_code ?? rawLine.accountCode,
      );

      if (!accountCode) continue;

      const debit = Math.max(0, toNumber(rawLine.debit));
      const credit = Math.max(0, toNumber(rawLine.credit));
      const movement = debit - credit;

      debitTotal += debit;
      creditTotal += credit;

      movements.set(accountCode, (movements.get(accountCode) || 0) + movement);
    }

    if (movements.size === 0) {
      return NextResponse.json(
        { error: "No valid journal account lines were supplied." },
        { status: 400 },
      );
    }

    const difference = debitTotal - creditTotal;
    const balanced = Math.abs(difference) < 0.005;

    const savedJournal = await saveJournalHistory({
      supabase,
      engagementId,
      journalReference,
      description,
      rawLines,
      debitTotal,
      creditTotal,
      difference,
      balanced,
    });

    const updatedLines = [];

    for (const [accountCode, movement] of movements.entries()) {
      if (Math.abs(movement) < 0.005) continue;

      const updated = await updateLineByCode(
        supabase,
        engagementId,
        accountCode,
        movement,
      );

      if (updated) updatedLines.push(updated);
    }

    return NextResponse.json({
      journal: savedJournal,
      trialBalanceLines: updatedLines,
      lines: updatedLines,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Failed to post journal." },
      { status: 500 },
    );
  }
}
