export function isOwnerTaxEntity(setup:any){return /^(sole (proprietor|trader|proprietorship)|partnership)$/i.test(String(setup?.entity_type||'').trim());}
/** SARS ordinary-trust rate. Special trusts use progressive tables, without individual rebates. */
export function isTrustTaxEntity(setup: any) {
  return /trust/i.test(String(setup?.entity_type || ''));
}
export function trustTaxRegime(setup: any): 'trust' | 'special-trust' {
  return /special/i.test([setup?.entity_type, setup?.trust_type, setup?.type_of_trust].join(' ')) ? 'special-trust' : 'trust';
}
export function reportingTaxRate(setup: any, side: 'current' | 'prior' = 'current'): number {
  if (isOwnerTaxEntity(setup)) return 0;
  if (isTrustTaxEntity(setup)) return 45;
  const keys = [side === 'current' ? 'tax_rate_current_year' : 'tax_rate_prior_year', 'tax_rate', 'income_tax_rate', 'company_tax_rate', 'taxRate', 'incomeTaxRate', 'companyTaxRate'];
  const supplied = keys.map(key => setup?.[key]).find(value => value != null && String(value).trim() !== '');
  const rate = Number(supplied ?? 27);
  return rate > 0 && rate < 1 ? rate * 100 : rate;
}
export function specialTrustTax(income: number, yearEnd: string): number {
  if (yearEnd < '2024-03-01' || yearEnd > '2027-02-28') throw Error('Special-trust rate table unavailable for this period; obtain the enacted table.');
  const limits = yearEnd >= '2026-03-01' ? [245100,383100,530200,695800,887000,1878600] : [237100,370500,512800,673000,857900,1817000];
  const rates = [.18,.26,.31,.36,.39,.41,.45];
  let lower = 0, tax = 0;
  for (let i = 0; i < rates.length; i++) {
    const upper = limits[i] ?? Infinity;
    tax += Math.max(0, Math.min(income, upper) - lower) * rates[i];
    lower = upper;
  }
  return Math.round(tax);
}
/** Reopen legacy company-rate trust workpapers, preserving payments and supporting inputs. */
export function bindTrustWorkpaper<T extends { entities: any[]; reviewed: boolean }>(workbook: T, setup: any): T {
  if (isOwnerTaxEntity(setup)) {
    const next=structuredClone(workbook);const parent=next.entities.find(row=>row.id==='parent')||next.entities[0];
    if(parent){if(parent.regime!=='owner-tax')next.reviewed=false;parent.regime='owner-tax';parent.rate=0;}
    return next;
  }
  if (!isTrustTaxEntity(setup)) return workbook;
  const next = structuredClone(workbook);
  const parent = next.entities.find(row => row.id === 'parent') || next.entities[0];
  if (!parent || parent.jurisdiction !== 'ZA') return workbook;
  const regime = parent.regime === 'special-trust' ? 'special-trust' : trustTaxRegime(setup);
  if (parent.regime !== regime || Number(parent.rate) !== 45) next.reviewed = false;
  parent.regime = regime;
  parent.rate = 45;
  if (regime === 'trust' && Number(parent.lossDtaRate) === 27) {
    parent.lossDtaRate = 45;
    next.reviewed = false;
  }
  return next;
}
