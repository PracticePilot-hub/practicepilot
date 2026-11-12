export type WorkpaperScope = "afs" | "crm";
export type EvidenceLink = {
  name: string;
  path: string;
  provider: string;
  sourceDate?: string;
  sha256?: string;
};
export type InternalSupport = {key:string;label:string;fingerprint:string};
export type PartyReconciliation = {id:string;name:string;ledger:number|null;statement:number|null;adjustment?:number;note:string};
export type SupportingRow = { id: string; description: string; amount: number };
export type LeadWork = {
  internalSupport?: InternalSupport[];
  partyReconciliations?: PartyReconciliation[];
  procedures?: {
    code: string;
    label: string;
    note: string;
    evidencePath?: string;
    performedAt: string;
  }[];
  reference?: string;
  comparison: number | null;
  sourceDate: string;
  explanation: string;
  conclusion: string;
  evidence: EvidenceLink[];
  reconcilingItems: SupportingRow[];
  movement: SupportingRow[];
  opening: number | null;
};
export type WorkpaperRecord<T = Record<string, unknown>> = {
  id: string;
  resource_key: string;
  payload: T;
  version: number;
  updated_at: string;
  updated_by: string;
};
export const procedureOptions = [
  { code: "BS", label: "Checked to bank statement" },
  { code: "TB", label: "Agreed to adjusted trial balance" },
  { code: "GL", label: "Agreed to general ledger" },
  { code: "AFS", label: "Agreed to financial statements" },
  { code: "BR", label: "Bank reconciliation reviewed" },
  { code: "PY", label: "Agreed to prior year" },
  { code: "SD", label: "Supporting document inspected" },
];
export function validLeadProcedures(
  work: Pick<LeadWork, "procedures" | "reference" | "evidence">,
) {
  if (
    work.reference !== undefined &&
    (typeof work.reference !== "string" || work.reference.length > 2000)
  )
    return false;
  if (work.procedures === undefined) return true;
  return (
    Array.isArray(work.procedures) &&
    work.procedures.length <= procedureOptions.length &&
    new Set(work.procedures.map((p) => p?.code)).size ===
      work.procedures.length &&
    work.procedures.every(
      (p) =>
        p &&
        procedureOptions.some(
          (o) => o.code === p.code && o.label === p.label,
        ) &&
        typeof p.note === "string" &&
        p.note.length <= 10000 &&
        typeof p.performedAt === "string" &&
        Number.isFinite(Date.parse(p.performedAt)) &&
        (!p.evidencePath ||
          work.evidence.some((e) => e.path === p.evidencePath)),
    )
  );
}
export const emptyLeadWork = (): LeadWork => ({
  comparison: null,
  sourceDate: "",
  explanation: "",
  conclusion: "",
  evidence: [],
  reconcilingItems: [],
  movement: [],
  opening: null,
});
export function withAccountEvidence(
  work: LeadWork,
  evidence: EvidenceLink,
): LeadWork {
  return {
    ...work,
    evidence: [
      ...work.evidence.filter((item) => item.path !== evidence.path),
      evidence,
    ],
  };
}
export function comparisonDifference(balance: number, work: LeadWork) {
  if (work.comparison === null) return null;
  return (
    Math.round(
      (work.comparison +
        work.reconcilingItems.reduce((sum, row) => sum + row.amount, 0) -
        balance) *
        100,
    ) / 100
  );
}
export function comparisonStatus(balance: number, work: LeadWork) {
  const difference = comparisonDifference(balance, work);
  if (difference === null) return "Not checked";
  if (Math.abs(difference) >= 0.005) return "Difference";
  return work.evidence.length || work.internalSupport?.length ? "Agrees" : "Evidence needed";
}
export function leadSupportStatus(
  method: string,
  balance: number,
  work: LeadWork,
) {
  const parties = work.partyReconciliations || [];
  if (parties.length) {
    if (parties.some(row=>!row.name.trim() || row.ledger===null || row.statement===null || (!!row.adjustment && !row.note.trim()))) return "Party checks incomplete";
    if (parties.some(row=>Math.abs(Number(row.statement)+Number(row.adjustment||0)-Number(row.ledger))>=0.005) || work.comparison===null || Math.abs(parties.reduce((sum,row)=>sum+Number(row.ledger),0)-work.comparison)>=0.005) return "Party difference";
  }
  if (
    ["analysis", "disclosure", "cross-statement-section"].includes(method) &&
    work.comparison === null
  )
    return work.conclusion.trim() ||
      work.explanation.trim() ||
      work.evidence.length || work.internalSupport?.length
      ? "Prepared"
      : "Needs support";
  return comparisonStatus(balance, work);
}
export function leadWorkComplete(
  method: string,
  balance: number,
  work: LeadWork,
) {
  if (work.partyReconciliations?.some(row=>!row.name.trim() || row.ledger===null || row.statement===null || Math.abs(row.statement+Number(row.adjustment||0)-row.ledger)>=0.005)) return false;
  const state = leadSupportStatus(method, balance, work);
  return state === "Agrees" || state === "Prepared";
}
export function normaliseDocumentPath(value: string) {
  if (
    !value.startsWith("/") ||
    value.includes("\\") ||
    /[\u0000-\u001f]/.test(value)
  )
    throw new Error("Invalid document path.");
  let decoded: string;
  try {
    decoded = decodeURIComponent(value);
  } catch {
    throw new Error("Invalid document path encoding.");
  }
  if (
    decoded.includes("\\") ||
    decoded.split("/").some((part) => part === "." || part === "..") ||
    /%2f|%5c|%2e/i.test(decoded)
  )
    throw new Error("Document path traversal is not allowed.");
  return "/" + decoded.split("/").filter(Boolean).join("/");
}
export function isWithinDocumentRoot(root: string, path: string) {
  const base = normaliseDocumentPath(root),
    target = normaliseDocumentPath(path);
  return target === base || target.startsWith(base === "/" ? "/" : base + "/");
}
export type Mark = {
  id: string;
  page: number;
  kind: "pen" | "highlight" | "tick" | "text";
  points: { x: number; y: number }[];
  text?: string;
  color: string;
  author?: string;
  createdAt?: string;
};
export type DocumentMarkup = {
  sha256: string;
  renderKey: string;
  marks: Mark[];
};
export function validMarks(value: unknown): value is Mark[] {
  return (
    Array.isArray(value) &&
    value.length <= 2000 &&
    value.every(
      (mark) =>
        mark &&
        typeof mark.id === "string" &&
        ["pen", "highlight", "tick", "text"].includes(mark.kind) &&
        Number.isInteger(mark.page) &&
        mark.page >= 1 &&
        mark.page <= 10000 &&
        /^#[0-9a-f]{6}$/i.test(mark.color) &&
        (!mark.text ||
          (typeof mark.text === "string" && mark.text.length <= 2000)) &&
        Array.isArray(mark.points) &&
        mark.points.length > 0 &&
        mark.points.length <= 4000 &&
        mark.points.every(
          (p: { x: number; y: number }) =>
            Number.isFinite(p.x) &&
            Number.isFinite(p.y) &&
            p.x >= 0 &&
            p.x <= 1 &&
            p.y >= 0 &&
            p.y <= 1,
        ),
    ) &&
    new Set(value.map((mark) => mark.id)).size === value.length
  );
}

export function reviewItemCounts(points:{resource_key?:string|null;status:string}[]){
  const byAccount:Record<string,number>={};let total=0;
  for(const point of points)if(point.status!=="cleared"){total++;if(point.resource_key)byAccount[point.resource_key]=(byAccount[point.resource_key]||0)+1;}
  return {byAccount,total};
}
