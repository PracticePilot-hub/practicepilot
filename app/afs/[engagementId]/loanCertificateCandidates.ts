export function loanLinesFromMappings<T extends {mapping_code?:unknown; current_year_balance?:number|string|null; debit?:number|string|null; credit?:number|string|null; account_name?:string|null; description?:string|null}>(trialBalanceLines:T[]) {
  return (trialBalanceLines || []).filter((line) => {
    const code = String(line.mapping_code || "").trim();

    const isRelatedPartyLoan =
      ["340", "449", "547", "548"].some(prefix => (code === prefix || code.startsWith(`${prefix}.`)));

    if (!isRelatedPartyLoan) return false;

    const balance = line.current_year_balance != null ? Number(line.current_year_balance) : Number(line.debit || 0) - Number(line.credit || 0);
    if (!Number.isFinite(balance) || Math.abs(balance) < 0.005) return false;

    const name = String(line.account_name || line.description || "")
      .trim()
      .toLowerCase();

    const looksLikeMovementOnly =
      name.includes("repayment") ||
      name.includes("movement") ||
      name.includes("transfer") ||
      name.includes("journal");

    return !looksLikeMovementOnly;
  });
}

