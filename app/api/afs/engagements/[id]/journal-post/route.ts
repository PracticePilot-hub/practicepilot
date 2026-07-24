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


type JournalPeriod =
  | "current_year"
  | "prior_year"
  | "opening_balance";

function normaliseJournalPeriod(value: unknown): JournalPeriod {
  const period = clean(value);

  if (period === "prior_year") return "prior_year";
  if (period === "opening_balance") return "opening_balance";
  return "current_year";
}

function priorFinancialYearEnd(value: unknown) {
  const raw = clean(value);
  const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);

  if (!match) {
    throw new Error("The engagement financial year end is invalid.");
  }

  const year = Number(match[1]) - 1;
  const month = Number(match[2]);
  const day = Number(match[3]);
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();

  return `${String(year).padStart(4, "0")}-${String(month).padStart(
    2,
    "0",
  )}-${String(Math.min(day, lastDay)).padStart(2, "0")}`;
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


async function getEngagementFinancialYearEnd(
  supabase: any,
  engagementId: string,
) {
  const { data, error } = await supabase
    .from("afs_engagements")
    .select("financial_year_end")
    .eq("id", engagementId)
    .single();

  if (error) throw error;

  if (!data?.financial_year_end) {
    throw new Error("The engagement financial year end is missing.");
  }

  return String(data.financial_year_end);
}

async function updatePriorYearByCode(
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

  const nextPrior =
    firstNumber(existing, ["prior_year_balance", "credit"]) + movement;

  const { data: updatedLines, error: updateError } = await supabase
    .from("afs_trial_balance_lines")
    .update({
      prior_year_balance: nextPrior,
      credit: nextPrior,
      updated_at: new Date().toISOString(),
    })
    .eq("engagement_id", engagementId)
    .eq("account_code", accountCode)
    .select("*");

  if (updateError) throw updateError;

  const financialYearEnd = await getEngagementFinancialYearEnd(
    supabase,
    engagementId,
  );
  const historyYearEnd = priorFinancialYearEnd(financialYearEnd);
  const historyYear = historyYearEnd.slice(0, 4);

  const { data: existingHistory, error: historySelectError } = await supabase
    .from("afs_trial_balance_history")
    .select("*")
    .eq("engagement_id", engagementId)
    .eq("account_code", accountCode)
    .gte("financial_year_end", `${historyYear}-01-01`)
    .lte("financial_year_end", `${historyYear}-12-31`)
    .order("financial_year_end", { ascending: false })
    .limit(1);

  if (historySelectError) throw historySelectError;

  const historyRow = existingHistory?.[0];

  if (historyRow) {
    const { error: historyUpdateError } = await supabase
      .from("afs_trial_balance_history")
      .update({
        closing_balance:
          firstNumber(historyRow, ["closing_balance"]) + movement,
        updated_at: new Date().toISOString(),
      })
      .eq("id", historyRow.id);

    if (historyUpdateError) throw historyUpdateError;
  } else {
    const { error: historyInsertError } = await supabase
      .from("afs_trial_balance_history")
      .insert({
        organisation_id: existing.organisation_id || null,
        engagement_id: engagementId,
        source_engagement_id: engagementId,
        trial_balance_line_id: existing.id || null,
        financial_year_end: historyYearEnd,
        account_code: accountCode,
        account_name: clean(existing.account_name),
        closing_balance: nextPrior,
        mapping_code: clean(existing.mapping_code) || null,
        mapping_label: clean(existing.mapping_label) || null,
        mapping_statement: clean(existing.mapping_statement) || null,
        mapping_section: clean(existing.mapping_section) || null,
        mapping_path: clean(existing.mapping_path) || null,
        lead_schedule_number:
          clean(existing.lead_schedule_number) || null,
        lead_schedule_key: clean(existing.lead_schedule_key) || null,
        updated_at: new Date().toISOString(),
      });

    if (historyInsertError) throw historyInsertError;
  }

  return updatedLines?.[0] || null;
}

async function updateOpeningBalanceByCode(
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

  const existingOpening = firstNumber(existing, ["opening_balance"]);
  const existingSource = firstNumber(existing, [
    "source_balance",
    "source_current_balance",
    "imported_balance",
    "current_year_balance",
    "debit",
  ]);
  const existingFinal = firstNumber(existing, [
    "final_balance",
    "current_year_balance",
  ]);

  const nextOpening = existingOpening + movement;
  const nextSource = existingSource + movement;
  const nextFinal = existingFinal + movement;

  const { data, error } = await supabase
    .from("afs_trial_balance_lines")
    .update({
      opening_balance: nextOpening,
      source_balance: nextSource,
      final_balance: nextFinal,
      current_year_balance: nextFinal,
      debit: nextFinal,
      updated_at: new Date().toISOString(),
    })
    .eq("engagement_id", engagementId)
    .eq("account_code", accountCode)
    .select("*");

  if (error) throw error;

  return data?.[0] || null;
}

async function applyMovementByPeriod(
  supabase: any,
  engagementId: string,
  accountCode: string,
  movement: number,
  journalPeriod: JournalPeriod,
) {
  if (journalPeriod === "prior_year") {
    return updatePriorYearByCode(
      supabase,
      engagementId,
      accountCode,
      movement,
    );
  }

  if (journalPeriod === "opening_balance") {
    return updateOpeningBalanceByCode(
      supabase,
      engagementId,
      accountCode,
      movement,
    );
  }

  return updateLineByCode(
    supabase,
    engagementId,
    accountCode,
    movement,
  );
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
  journalPeriod,
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
  journalPeriod: JournalPeriod;
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
    journal_period: journalPeriod,
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



async function reverseJournalMovements(
  supabase: any,
  engagementId: string,
  journalId: string,
  journalPeriod: JournalPeriod,
) {
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

    const updated = await applyMovementByPeriod(
      supabase,
      engagementId,
      accountCode,
      reverseMovement,
      journalPeriod,
    );

    if (updated) updatedLines.push(updated);
  }

  return updatedLines;
}

async function applyRawJournalMovements(
  supabase: any,
  engagementId: string,
  rawLines: any[],
  journalPeriod: JournalPeriod,
) {
  const movements = new Map<string, number>();

  for (const rawLine of rawLines) {
    const accountCode = normaliseAccountCode(rawLine.account_code ?? rawLine.accountCode);
    if (!accountCode) continue;

    const debit = Math.max(0, toNumber(rawLine.debit));
    const credit = Math.max(0, toNumber(rawLine.credit));
    const movement = debit - credit;

    movements.set(accountCode, (movements.get(accountCode) || 0) + movement);
  }

  const updatedLines = [];

  for (const [accountCode, movement] of movements.entries()) {
    if (Math.abs(movement) < 0.005) continue;

    const updated = await applyMovementByPeriod(
      supabase,
      engagementId,
      accountCode,
      movement,
      journalPeriod,
    );

    if (updated) updatedLines.push(updated);
  }

  return updatedLines;
}

function buildLinePayloads(rawLines: any[], engagementId: string, journalId: string) {
  return rawLines.map((line, index) => {
    const accountCode = normaliseAccountCode(line.account_code ?? line.accountCode);
    const debit = Math.max(0, toNumber(line.debit));
    const credit = Math.max(0, toNumber(line.credit));

    return {
      journal_id: journalId,
      engagement_id: engagementId,
      line_number: index + 1,
      account_code: accountCode,
      account_name: clean(line.account_name ?? line.accountName),
      debit,
      credit,
      note: clean(line.note),
    };
  });
}

export async function PUT(req: NextRequest, context: any) {
  try {
    const engagementId = await getIdFromContext(context);
    const body = await req.json();
    const supabase = getSupabaseServer();

    const journalId = clean(body?.journalId ?? body?.id);
    const description = clean(body?.description);
    const journalReference = clean(body?.journal_reference ?? body?.journalReference);
    const journalPeriod = normaliseJournalPeriod(
      body?.journal_period ?? body?.journalPeriod,
    );
    const rawLines = Array.isArray(body?.lines) ? body.lines : [];

    if (!journalId) {
      return NextResponse.json({ error: "Missing journal id." }, { status: 400 });
    }

    if (!description) {
      return NextResponse.json(
        { error: "Add a journal description first." },
        { status: 400 },
      );
    }

    if (rawLines.length < 2) {
      return NextResponse.json(
        { error: "A journal needs at least two lines." },
        { status: 400 },
      );
    }

    const debitTotal = rawLines.reduce(
      (sum: number, line: any) => sum + Math.max(0, toNumber(line.debit)),
      0,
    );
    const creditTotal = rawLines.reduce(
      (sum: number, line: any) => sum + Math.max(0, toNumber(line.credit)),
      0,
    );
    const difference = debitTotal - creditTotal;
    const balanced = Math.abs(difference) < 0.005;

    const { data: existingJournal, error: existingError } = await supabase
      .from("afs_adjusting_journals")
      .select("*")
      .eq("engagement_id", engagementId)
      .eq("id", journalId)
      .single();

    if (existingError) throw existingError;
    if (!existingJournal) {
      return NextResponse.json({ error: "Journal was not found." }, { status: 404 });
    }

    const finalJournalReference =
      journalReference || clean(existingJournal.journal_reference) || fallbackJournalReference(Number(existingJournal.journal_number || 0));

    const { data: duplicateReference, error: duplicateError } = await supabase
      .from("afs_adjusting_journals")
      .select("id")
      .eq("engagement_id", engagementId)
      .eq("journal_reference", finalJournalReference)
      .neq("id", journalId)
      .limit(1);

    if (duplicateError) throw duplicateError;

    if (duplicateReference?.length) {
      throw new Error(`Journal reference ${finalJournalReference} already exists for this AFS file.`);
    }

    const existingJournalPeriod = normaliseJournalPeriod(
      existingJournal.journal_period,
    );

    const reversedLines = await reverseJournalMovements(
      supabase,
      engagementId,
      journalId,
      existingJournalPeriod,
    );

    const appliedLines = await applyRawJournalMovements(
      supabase,
      engagementId,
      rawLines,
      journalPeriod,
    );

    const { data: journal, error: updateError } = await supabase
      .from("afs_adjusting_journals")
      .update({
        journal_reference: finalJournalReference,
        description,
        journal_period: journalPeriod,
        status: balanced ? "Balanced" : "Unbalanced",
        debit_total: debitTotal,
        credit_total: creditTotal,
        difference,
        updated_at: new Date().toISOString(),
      })
      .eq("engagement_id", engagementId)
      .eq("id", journalId)
      .select("*")
      .single();

    if (updateError) throw updateError;

    const { error: deleteLinesError } = await supabase
      .from("afs_adjusting_journal_lines")
      .delete()
      .eq("engagement_id", engagementId)
      .eq("journal_id", journalId);

    if (deleteLinesError) throw deleteLinesError;

    const { data: journalLines, error: insertLinesError } = await supabase
      .from("afs_adjusting_journal_lines")
      .insert(buildLinePayloads(rawLines, engagementId, journalId))
      .select("*");

    if (insertLinesError) throw insertLinesError;

    return NextResponse.json({
      journal: {
        ...journal,
        lines: journalLines || [],
      },
      trialBalanceLines: [...reversedLines, ...appliedLines],
      lines: [...reversedLines, ...appliedLines],
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Failed to update journal." },
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

      const updated = await applyMovementByPeriod(
        supabase,
        engagementId,
        accountCode,
        reverseMovement,
        normaliseJournalPeriod(journal.journal_period),
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
    const journalPeriod = normaliseJournalPeriod(
      body?.journal_period ?? body?.journalPeriod,
    );

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
      journalPeriod,
      rawLines,
      debitTotal,
      creditTotal,
      difference,
      balanced,
    });

    const updatedLines = [];

    for (const [accountCode, movement] of movements.entries()) {
      if (Math.abs(movement) < 0.005) continue;

      const updated = await applyMovementByPeriod(
        supabase,
        engagementId,
        accountCode,
        movement,
        journalPeriod,
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
