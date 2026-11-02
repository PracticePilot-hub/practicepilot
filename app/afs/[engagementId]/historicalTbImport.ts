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
