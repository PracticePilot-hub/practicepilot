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
  const parsed = Number(raw.replace(/[R\s]/g, "").replace(/,/g, ".").replace(/[()]/g, ""));
  if (!Number.isFinite(parsed)) return 0;
  return negative ? -Math.abs(parsed) : parsed;
}

function firstNumber(line: any, keys: string[]) {
  for (const key of keys) {
    const value = line?.[key];
    if (value !== undefined && value !== null && value !== "") return toNumber(value);
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
  const existingAdjustment = firstNumber(existing, ["adjustments", "adjustment", "journal_adjustments"]);
  const nextAdjustment = existingAdjustment + movement;

  const sourceBalance = firstNumber(existing, [
    "source_balance",
    "source_current_balance",
    "imported_balance",
    "debit",
  ]) - firstNumber(existing, ["credit"]);

  const fallbackCurrent = firstNumber(existing, ["current_year_balance", "current_balance", "final_balance"]);
  const currentBase = Math.abs(sourceBalance) >= 0.005 ? sourceBalance : fallbackCurrent;
  const reclassifications = firstNumber(existing, ["reclassifications", "reclassification"]);
  const finalBalance = currentBase + movement + reclassifications;

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

async function updateLineByCode(supabase: any, engagementId: string, accountCode: string, movement: number) {
  const { data: existingLines, error: selectError } = await supabase
    .from("afs_trial_balance_lines")
    .select("*")
    .eq("engagement_id", engagementId)
    .eq("account_code", accountCode)
    .limit(1);

  if (selectError) throw selectError;

  const existing = existingLines?.[0];
  if (!existing) {
    throw new Error(`Account ${accountCode} was not found in the trial balance lines.`);
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

export async function POST(req: NextRequest, context: any) {
  try {
    const engagementId = await getIdFromContext(context);
    const body = await req.json();
    const supabase = getSupabaseServer();

    const rawLines = Array.isArray(body?.lines) ? body.lines : [];
    if (rawLines.length < 2) {
      return NextResponse.json({ error: "A journal needs at least two lines." }, { status: 400 });
    }

    const movements = new Map<string, number>();

    for (const rawLine of rawLines) {
      const accountCode = normaliseAccountCode(rawLine.account_code ?? rawLine.accountCode);
      if (!accountCode) continue;

      const debit = Math.max(0, toNumber(rawLine.debit));
      const credit = Math.max(0, toNumber(rawLine.credit));
      const movement = debit - credit;

      movements.set(accountCode, (movements.get(accountCode) || 0) + movement);
    }

    if (movements.size === 0) {
      return NextResponse.json({ error: "No valid journal account lines were supplied." }, { status: 400 });
    }

    const updatedLines = [];

    for (const [accountCode, movement] of movements.entries()) {
      if (Math.abs(movement) < 0.005) continue;
      const updated = await updateLineByCode(supabase, engagementId, accountCode, movement);
      if (updated) updatedLines.push(updated);
    }

    return NextResponse.json({ trialBalanceLines: updatedLines, lines: updatedLines });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Failed to post journal." },
      { status: 500 }
    );
  }
}
