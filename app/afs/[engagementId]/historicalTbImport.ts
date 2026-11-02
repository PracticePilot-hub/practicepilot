type MappedAccount = { account_code: string | null; mapping_code?: string | null };
const accountKey = (value: unknown) => String(value ?? '').trim().replace(/\s+/g, '').toUpperCase();
/** Only an explicit mapping header is auto-selected; a balance column is never a fallback. */
export function historicalMappingColumn(header: readonly unknown[]) {
  return header.findIndex(value => /^(?:pp\s+|practicepilot\s+)?mapping[ _]+code(?:\s*\([^)]*\))?$/i.test(String(value ?? '').trim()));
}
/** With no mapping column, classification comes from the same account in the current TB. */
export function historicalMappingCode(account: unknown, supplied: unknown, mappingColumn: number, current: readonly MappedAccount[]) {
  if (mappingColumn >= 0) return String(supplied ?? '').trim();
  const codes = [...new Set(current.filter(line => accountKey(line.account_code) === accountKey(account))
    .map(line => String(line.mapping_code ?? '').trim()).filter(Boolean))];
  return codes.length === 1 ? codes[0] : '';
}
const mappingFields = ['mapping_code','mapping_label','mapping_statement','mapping_section','mapping_path','mapping_leaf_id','lead_schedule_number','lead_schedule_key'] as const;
/** An unmapped historical row follows later current-account mapping; explicit historical classifications stay intact. */
export function resolveHistoricalMappings<T extends Record<string, any>>(history: readonly T[], current: readonly Record<string, any>[]): T[] {
  return history.map(row => {
    if (String(row.mapping_code ?? '').trim()) return row;
    const matches = current.filter(line => accountKey(line.account_code) === accountKey(row.account_code) && String(line.mapping_code ?? '').trim());
    if (!matches.length || new Set(matches.map(line => line.mapping_code)).size !== 1) return row;
    const inherited = Object.fromEntries(mappingFields.map(key => [key, matches[0][key] ?? null]));
    return {...row, ...inherited};
  });
}
export function validHistoricalMapping(code: unknown) {
  return !String(code ?? '').trim() || /^\d{3}(?:\.\d+)*$/.test(String(code).trim());
}
