import type { GLTransaction, GLAccount } from "@/app/lib/workpapers/gl";
type Cell = {
    value?: string;
    id?: string;
};
type Row = {
    type?: string;
    group?: string;
    ColData?: Cell[];
    Header?: {
        ColData?: Cell[];
    };
    Summary?: {ColData?:Cell[]};
    Rows?: {
        Row?: Row[];
    };
};
export type Report = {
    Header?: {
        ReportName?: string;
        ReportBasis?: string;
        StartPeriod?: string;
        EndPeriod?: string;
        Currency?: string;
        Option?: {
            Name: string;
            Value: string;
        }[];
    };
    Columns?: {
        Column?: {
            ColTitle?: string;
            ColType?: string;
            MetaData?: {
                Name: string;
                Value: string;
            }[];
        }[];
    };
    Rows?: {
        Row?: Row[];
    };
    Fault?: unknown;
};
export type Account = {
    Id: string;
    Name: string;
    FullyQualifiedName?: string;
    AcctNum?: string;
    AccountType?: string;
    Active?: boolean;
};
export function cents(value: unknown): number {
    const s = String(value ?? "").trim();
    if (!s)
        return 0;
    if (!/^-?(?:\d+(?:\.\d{1,2})?|\.\d{1,2})$/.test(s))
        throw new Error("QuickBooks returned an unsupported money value. No import has been applied.");
    const n = Number(s);
    if (!Number.isSafeInteger(Math.round(n * 100)))
        throw new Error("QuickBooks amount is too large.");
    return Math.round(n * 100);
}
export function date(value: string) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(Date.parse(value)) || new Date(value + "T00:00:00Z").toISOString().slice(0, 10) !== value)
        throw new Error("QuickBooks returned an invalid date.");
    return value;
}
export function dayBefore(value: string) { const d = new Date(date(value) + "T00:00:00Z"); d.setUTCDate(d.getUTCDate() - 1); return d.toISOString().slice(0, 10); }
export function periods(start: string, end: string) {
    date(start);
    date(end);
    if (start > end)
        throw new Error("Invalid reporting period.");
    const result: {
        start: string;
        end: string;
    }[] = [];
    let cursor = start;
    while (cursor <= end) {
        const d = new Date(cursor + "T00:00:00Z");
        const next = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1)).toISOString().slice(0, 10);
        const stop = dayBefore(next);
        result.push({ start: cursor, end: stop < end ? stop : end });
        cursor = next;
        if (result.length > 24)
            throw new Error("Import at most 24 months in one engagement.");
    }
    return result;
}
export function accountMap(accounts: Account[]) {
    const codes = new Set<string>(), ids = new Set<string>();
    return accounts.map(a => {
        if (!a.Id || ids.has(a.Id))
            throw new Error("QuickBooks account identity is missing or repeated.");
        ids.add(a.Id);
        // Explicit source-prefixed identifiers keep uncoded accounts stable without pretending they have a source account number.
        const code = String(a.AcctNum || `QBO-${a.Id}`).trim().replace(/\s+/g, "").toUpperCase();
        if (!code || code.length > 100 || codes.has(code))
            throw new Error("QuickBooks account numbers collide. Resolve the account numbers before importing.");
        codes.add(code);
        return { ...a, code, name: a.FullyQualifiedName || a.Name };
    });
}
export function verifyReport(r: Report, name: string, end: string, start?: string) {
    if (r.Fault || r.Header?.ReportName !== name || r.Header.ReportBasis !== "Accrual" || r.Header.EndPeriod !== end || (start && r.Header.StartPeriod !== start))
        throw new Error("QuickBooks report dates or accounting basis did not match the request.");
    if (!r.Columns?.Column?.length || !r.Rows || (!Array.isArray(r.Rows.Row) && !r.Header?.Option?.some(o=>o.Name==="NoReportData" && o.Value==="true")))
        throw new Error("QuickBooks report is incomplete or uses an unsupported format.");
}
function keys(r: Report) { return r.Columns!.Column!.map(c => (c.MetaData?.find(m => m.Name === "ColKey")?.Value || (c.ColType && !["money", "string", "date", "account"].includes(c.ColType.toLowerCase()) ? c.ColType : c.ColTitle) || "").toLowerCase().replace(/[^a-z0-9]/g, "")); }
function column(k: string[], ...names: string[]) { const i = k.findIndex(v => names.includes(v)); if (i < 0)
    throw new Error(`QuickBooks report is missing ${names[0]}. Request an unfiltered debit/credit report.`); return i; }
export function trialBalance(r: Report, accounts: ReturnType<typeof accountMap>) {
    if(r.Header?.Option?.some(o=>o.Name==="NoReportData"&&o.Value==="true") && !(r.Rows?.Row?.length))return {};
    const k = keys(r), debit = column(k, "debtamt", "debit"), credit = column(k, "creditamt", "credit");
    const balances: Record<string, number> = {};
    const known = new Set(accounts.map(a => a.Id));
    function walk(rows: Row[]) { for (const row of rows) {
        if (row.Rows)
            walk(row.Rows.Row || []);
        else if (row.ColData && !row.Summary && (!row.type || row.type === "Data")) {
            const id = row.ColData?.[0]?.id;
            if (!id || !known.has(id) || Object.hasOwn(balances, id))
                throw new Error("Trial balance account identity is missing, unknown or repeated.");
            balances[id] = cents(row.ColData?.[debit]?.value) - cents(row.ColData?.[credit]?.value);
        }
    } }
    walk(r.Rows?.Row || []);
    const total=(r.Rows?.Row||[]).find(row=>row.group==="GrandTotal")?.Summary?.ColData;
    if(total){const debitTotal=Object.values(balances).reduce((sum,v)=>sum+Math.max(v,0),0),creditTotal=Object.values(balances).reduce((sum,v)=>sum+Math.max(-v,0),0);if(cents(total[debit]?.value)!==debitTotal||cents(total[credit]?.value)!==creditTotal)throw new Error("QuickBooks trial balance detail differs from its published totals.");}
    if (Object.values(balances).reduce((a, b) => a + b, 0) !== 0)
        throw new Error("Source trial balance does not balance.");
    return balances;
}
export function ledger(r: Report, accounts: ReturnType<typeof accountMap>, start: string, end: string, homeCurrencyOnly = false): GLTransaction[] {
    if(r.Header?.Option?.some(o=>o.Name==="NoReportData"&&o.Value==="true") && !(r.Rows?.Row?.length))return [];
    const k = keys(r), di = column(k, "txdate", "date"), db = homeCurrencyOnly ? column(k, "debthomeamt", "debithome", "debithomecurrency") : column(k, "debtamt", "debit"), cr = homeCurrencyOnly ? column(k, "credithomeamt", "credithome", "credithomecurrency") : column(k, "creditamt", "credit"), ai = k.findIndex(v => ["accountname", "account"].includes(v)), ref = k.findIndex(v => ["docnum", "num"].includes(v)), memo = k.findIndex(v => ["memo", "description"].includes(v));
    const out: GLTransaction[] = [];
    const byId = new Map(accounts.map(a => [a.Id, a]));
    function walk(rows: Row[], inherited?: string) {
        for (const row of rows) {
            const headerId = row.Header?.ColData?.[0]?.id;
            const section = headerId && byId.has(headerId) ? headerId : inherited;
            if (row.Rows) {
                const first=out.length;
                walk(row.Rows.Row || [], section);
                const total=row.Summary?.ColData;
                if(total){const included=out.slice(first);const debit=included.reduce((sum,p)=>sum+cents(p.debit),0),credit=included.reduce((sum,p)=>sum+cents(p.credit),0);if(debit!==cents(total[db]?.value)||credit!==cents(total[cr]?.value))throw new Error("QuickBooks ledger detail differs from its account totals. No partial ledger can be imported.");}
                continue;
            }
            if (!row.ColData || row.Summary || (row.type && row.type !== "Data"))
                continue;
            const cells = row.ColData || [], rawDate = cells[di]?.value || "";
            if (/^beginning balance$/i.test(rawDate.trim()) && cents(cells[db]?.value)===0 && cents(cells[cr]?.value)===0) continue;
            if (!rawDate) {
                if (cents(cells[db]?.value) === 0 && cents(cells[cr]?.value) === 0 && cells.some(c => /^beginning balance$/i.test(c.value?.trim() || "")))
                    continue;
                if (cells.some(c => c.value?.trim()))
                    throw new Error("An undated ledger row needs review. Use a complete transaction report without opening-balance rows.");
                continue;
            }
            const postingDate = date(rawDate);
            if (postingDate < start || postingDate > end)
                throw new Error("Ledger includes transactions outside its requested period.");
            const direct = ai >= 0 ? cells[ai]?.id : undefined;
            const account = byId.get(direct || section || "");
            const debit = cents(cells[db]?.value), credit = cents(cells[cr]?.value);
            // QBO emits zero-value linking rows under Not Specified; these are not GL postings.
            if (!account && debit===0 && credit===0) continue;
            if (!account)
                throw new Error("A ledger posting has no known distribution account ID.");
            if (debit < 0 || credit < 0 || (debit > 0 && credit > 0))
                throw new Error("Unexpected debit/credit convention in QuickBooks ledger.");
            out.push({ date: postingDate, accountCode: account.code, accountName: account.name, reference: ref >= 0 ? cells[ref]?.value || "" : "", description: memo >= 0 ? cells[memo]?.value || "" : "", debit: debit / 100, credit: credit / 100 });
        }
    }
    walk(r.Rows?.Row || []);
    return out;
}
export function reconcile(accounts: ReturnType<typeof accountMap>, opening: Record<string, number>, closing: Record<string, number>, rows: GLTransaction[]) {
    const sums = new Map<string, {
        debit: number;
        credit: number;
    }>();
    for (const row of rows) {
        const a = sums.get(row.accountCode) || { debit: 0, credit: 0 };
        a.debit += cents(row.debit);
        a.credit += cents(row.credit);
        sums.set(row.accountCode, a);
    }
    const issues: string[] = [];
    const summary: GLAccount[] = accounts.map(a => { const movement = sums.get(a.code) || { debit: 0, credit: 0 }, before = opening[a.Id] || 0, after = closing[a.Id] || 0; const difference = before + movement.debit - movement.credit - after; if (difference)
        issues.push(`${a.code} ${a.name}: ledger differs from source TB by ${(difference / 100).toFixed(2)}`); return { code: a.code, name: a.name, opening: before / 100, closing: after / 100, debit: movement.debit / 100, credit: movement.credit / 100 }; });
    if (rows.reduce((s, r) => s + cents(r.debit) - cents(r.credit), 0) !== 0)
        issues.push("Ledger movements do not balance.");
    return { accounts: summary, issues };
}

/** Accept explicit ISO codes and known reporting-currency names; never infer from a dollar symbol. */
export function reportingCurrency(value: unknown): string {
    const text = typeof value === "string" ? value.trim().toUpperCase().replace(/\s+/g, " ") : "";
    const aliases: Record<string,string> = { RAND:"ZAR", "SOUTH AFRICAN RAND":"ZAR", R:"ZAR", "US DOLLAR":"USD", "US DOLLARS":"USD", EURO:"EUR", EUROS:"EUR", "POUND STERLING":"GBP", "BRITISH POUND":"GBP" };
    if (aliases[text]) return aliases[text];
    if (/^[A-Z]{3}$/.test(text)) return text;
    throw new Error("Set an unambiguous reporting currency in Client Information before importing QuickBooks.");
}
export function checkReportingCurrency(source: unknown, expected: unknown) {
    const code = reportingCurrency(source), target = reportingCurrency(expected);
    if (code !== target) throw new Error(`QuickBooks reports are in ${code}, but this AFS file uses ${target}. Currency conversion is not supported by this import.`);
    return code;
}

/** Multicurrency GL amounts must come from Intuit's explicit home-currency columns. */
export function ledgerColumns(multicurrency: boolean) {
    return `tx_date,txn_type,doc_num,name,memo,account_name,${multicurrency ? "debt_home_amt,credit_home_amt" : "debt_amt,credit_amt"}`;
}
export function importCurrencyPlan(preferences: { CurrencyPrefs?: { MultiCurrencyEnabled?: boolean; HomeCurrency?: { value?: string } } }, expected: unknown) {
    const multicurrency = preferences.CurrencyPrefs?.MultiCurrencyEnabled === true;
    const home = preferences.CurrencyPrefs?.HomeCurrency?.value;
    if (multicurrency && !home) throw new Error("QuickBooks home currency could not be verified. No figures have been imported.");
    return { multicurrency, currency: home ? checkReportingCurrency(home, expected) : reportingCurrency(expected) };
}
