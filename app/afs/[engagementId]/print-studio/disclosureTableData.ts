/** Captured disclosure data. No amounts or accounting assumptions are inferred here. */
export type DisclosureTable = { title: string; columns: string[]; rows: { label: string; cells: (string | number | null)[]; total?: boolean }[]; reference?: string };
export function disclosureTableComplete(value: unknown): value is DisclosureTable {
 const t=value as DisclosureTable;
 return !!t && typeof t.title==='string' && !!t.title.trim() && Array.isArray(t.columns) && t.columns.length>0 && t.columns.length<=6 && t.columns.every(c=>typeof c==='string'&&!!c.trim()) && Array.isArray(t.rows) && t.rows.length>0 && t.rows.every(r=>typeof r.label==='string'&&!!r.label.trim()&&Array.isArray(r.cells)&&r.cells.length===t.columns.length&&r.cells.every(v=>typeof v==='string'?!!v.trim():typeof v==='number'&&Number.isFinite(v)));
}
export function disclosureCell(value: unknown): string {
 if(typeof value!=='number')return value==null?'Not provided':String(value);
 const rounded=Math.round(value);if(!rounded)return '–';
 const n=Math.abs(rounded).toLocaleString('en-ZA');return rounded<0?`(${n})`:n;
}
