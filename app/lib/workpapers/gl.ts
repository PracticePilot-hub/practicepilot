export type GLTransaction = {
  date: string;
  accountCode: string;
  accountName: string;
  reference: string;
  description: string;
  debit: number;
  credit: number;
};
export type GLAccount = {
  code: string;
  name: string;
  opening: number;
  closing: number;
  debit: number;
  credit: number;
};
export const glCode = (value: unknown) =>
  String(value ?? "")
    .trim()
    .replace(/\s+/g, "")
    .toUpperCase();
export function validateGL(
  rows: unknown,
  openings: Record<string, number>,
  start: string,
  end: string,
) {
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(start) ||
    !/^\d{4}-\d{2}-\d{2}$/.test(end) ||
    start > end
  )
    throw new Error("Choose a valid GL period.");
  if (!Array.isArray(rows) || !rows.length || rows.length > 10000)
    throw new Error("Import between 1 and 10,000 transactions per file.");
  const accounts = new Map<string, GLAccount>();
  const transactions = rows.map((raw, i) => {
    const row = raw as GLTransaction,
      code = glCode(row.accountCode),
      date = String(row.date || "").slice(0, 10),
      debit = Number(row.debit),
      credit = Number(row.credit);
    if (!code || code.length > 100 || !row.accountName)
      throw new Error(`Row ${i + 1}: account code and name are required.`);
    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
      Number.isNaN(Date.parse(date)) ||
      new Date(date + "T00:00:00Z").toISOString().slice(0, 10) !== date ||
      date < start ||
      date > end
    )
      throw new Error(
        `Row ${i + 1}: transaction date is outside the selected period or invalid.`,
      );
    if (
      !Number.isFinite(debit) ||
      !Number.isFinite(credit) ||
      debit < 0 ||
      credit < 0 ||
      (debit > 0 && credit > 0) ||
      Math.abs(debit * 100 - Math.round(debit * 100)) > 0.00001 ||
      Math.abs(credit * 100 - Math.round(credit * 100)) > 0.00001
    )
      throw new Error(
        `Row ${i + 1}: use debit and credit amounts with at most two decimal places, with one side per row.`,
      );
    if (
      !Object.hasOwn(openings, code) ||
      !Number.isFinite(Number(openings[code]))
    )
      throw new Error(
        `Enter an explicit opening balance for account ${code}, including zero where applicable.`,
      );
    const account = accounts.get(code) || {
      code,
      name: String(row.accountName).slice(0, 250),
      opening: Number(openings[code]),
      closing: 0,
      debit: 0,
      credit: 0,
    };
    account.debit += Math.round(debit * 100);
    account.credit += Math.round(credit * 100);
    accounts.set(code, account);
    return {
      date,
      accountCode: code,
      accountName: account.name,
      reference: String(row.reference || "").slice(0, 250),
      description: String(row.description || "").slice(0, 2000),
      debit,
      credit,
    };
  });
  const summary = [...accounts.values()].map((a) => ({
    ...a,
    debit: a.debit / 100,
    credit: a.credit / 100,
    closing: Math.round(a.opening * 100 + a.debit - a.credit) / 100,
  }));
  if (transactions.every((row) => row.debit === 0 && row.credit === 0))
    throw new Error(
      "No non-zero GL movements were found. Check the debit and credit column mappings.",
    );
  const difference =
    Math.round(summary.reduce((sum, a) => sum + a.debit - a.credit, 0) * 100) /
    100;
  return {
    transactions,
    accounts: summary,
    difference,
    openingDifference:
      Math.round(summary.reduce((sum, a) => sum + a.opening, 0) * 100) / 100,
  };
}
export function yearStart(yearEnd: string) {
  const start = new Date(yearEnd + "T00:00:00Z");
  start.setUTCDate(start.getUTCDate() + 1);
  start.setUTCFullYear(start.getUTCFullYear() - 1);
  return start.toISOString().slice(0, 10);
}
