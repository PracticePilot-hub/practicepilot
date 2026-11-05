/** Related-party disclosure annotations never change financial-statement mappings. */
export const RELATED_PARTY_CATEGORIES = [
  ["parent", "Parent"], ["influence", "Joint control / significant influence"],
  ["subsidiary", "Subsidiary"], ["associate", "Associate"], ["jointVenture", "Joint venture"],
  ["keyManagement", "Key management personnel"], ["other", "Other related party"],
] as const;
export type RelatedPartyAccountLink = {
  accountKey: string; name: string; relationship: string; category: string;
  accountCode?:string;
  kind: "receivable" | "payable" | "transaction"; wholeAccount: boolean;
  eliminated?:boolean; eliminationReason?:string;
  terms?:string;interest?:string;security?:string;commitments?:string;impairment?:string;badDebtExpense?:string;
};
export function relatedPartyAccountKey(line: any): string {
  const code=String(line.account_code||"").trim().toUpperCase();
  return code ? `account:${code}` : String(line.id||"").trim();
}
export function normaliseRelatedPartyAccountLinks(links:readonly RelatedPartyAccountLink[],lines:readonly any[]) {
  return links.map(link=>{
    const line=lines.find(line=>relatedPartyAccountKey(line)===link.accountKey || (line.id && String(line.id)===link.accountKey) || (link.accountCode && String(line.account_code||"").trim().toUpperCase()===link.accountCode.trim().toUpperCase()));
    return line ? {...link,accountKey:relatedPartyAccountKey(line),accountCode:String(line.account_code||"").trim().toUpperCase()} : link;
  });
}
export function relatedPartyCandidates(lines: readonly any[]) {
  // Suggestions from explicit relationship mappings only, never names or a
  // blanket assumption that all shareholders, employees or customers qualify.
  const prefixes = ["340.10", "340.11", "340.12", "340.13", "340.14", "340.20", "340.40", "449.10", "449.30", "547", "548", "610.50"];
  return lines.filter(line => prefixes.some(p => String(line.mapping_code || "") === p || String(line.mapping_code || "").startsWith(p + ".")));
}
export function relatedPartyDisclosureRows(manualRows: any[], links: RelatedPartyAccountLink[], lines: readonly any[]) {
  const normalisedManual=manualRows.map(row=>{
    const source=lines.find(line=>line.id && String(line.id)===row.sourceAccountKey);
    return source?{...row,sourceAccountKey:relatedPartyAccountKey(source)}:row;
  });
  const imported = normaliseRelatedPartyAccountLinks(links,lines).flatMap(link => {
    if (link.eliminated || !link.name.trim() || !link.relationship.trim() || !link.wholeAccount || link.kind === "transaction") return [];
    const line = lines.find(item => relatedPartyAccountKey(item) === link.accountKey);
    if (!line) return [];
    const factor = link.kind === "payable" ? -1 : 1;
    const current = factor * Number(line.current_year_balance ?? (Number(line.debit || 0) - Number(line.credit || 0)));
    const prior = factor * Number(line.prior_year_balance || 0);
    return [{ ...link, name: link.name, relationship: link.relationship, category: link.category,
      transaction: link.kind === "payable" ? "Amount payable" : "Amount receivable",
      current: Number.isFinite(current) ? current : null, prior: Number.isFinite(prior) ? prior : null,
      amountKind: "balance", sourceAccountKey: link.accountKey, sourceAccountCode: String(line.account_code || ""),
    }];
  });
  // A manually documented row can replace the same linked account's balance,
  // while separate transaction rows remain distinct (no accidental netting).
  return [...normalisedManual, ...imported.filter(row => !normalisedManual.some(manual => manual.sourceAccountKey === row.sourceAccountKey && manual.amountKind === "balance"))];
}
/** Combine genuinely identical disclosures, retaining each underlying account. */
export function aggregateRelatedPartyDisclosureRows(rows:readonly any[]) {
  const fields=["name","relationship","category","amountKind","transaction","terms","interest","security","commitments","impairment","badDebtExpense"];
  const groups=new Map<string,any>();
  for(const row of rows){
    const key=JSON.stringify(fields.map(field=>String(row[field]??"").trim()));
    const current=row.current==null||String(row.current).trim()===""?null:Number(row.current);
    const prior=row.prior==null||String(row.prior).trim()===""?null:Number(row.prior);
    const existing=groups.get(key);
    const sourceAccountKeys=[...(row.sourceAccountKeys||[]),...(row.sourceAccountKey?[row.sourceAccountKey]:[])];
    const sourceAccountCodes=[...(row.sourceAccountCodes||[]),...(row.sourceAccountCode?[row.sourceAccountCode]:[])];
    if(!existing){groups.set(key,{...row,current:Number.isFinite(current)?current:null,prior:Number.isFinite(prior)?prior:null,sourceAccountKeys,sourceAccountCodes});continue;}
    existing.current=existing.current===null||current===null||!Number.isFinite(current)?null:existing.current+current;
    existing.prior=existing.prior===null||prior===null||!Number.isFinite(prior)?null:existing.prior+prior;
    existing.sourceAccountKeys=[...new Set([...existing.sourceAccountKeys,...sourceAccountKeys])];
    existing.sourceAccountCodes=[...new Set([...existing.sourceAccountCodes,...sourceAccountCodes])];
  }
  return [...groups.values()];
}
/** An SME total can be derived from a complete captured breakdown; missing data is never zero-filled. */
export function completeRelatedPartyKmp(meta:Record<string,any>):Record<string,any>{
 const keys=["shortTerm","postEmployment","otherLongTerm","termination","shareBased"],kmp={...(meta.kmp||{})};
 if(keys.every(key=>["current","prior"].every(side=>String(kmp[key]?.[side]??"").trim()!==""&&Number.isFinite(Number(kmp[key][side]))))){
  const total={...(kmp.total||{})};for(const side of ["current","prior"])if(String(total[side]??"").trim()==="")total[side]=keys.reduce((n,key)=>n+Number(kmp[key][side]),0);kmp.total=total;
 }
 return {...meta,kmp};
}
export function relatedPartyReviewIssues(state: Record<string, any>, lines: readonly any[], framework: "smes" | "full") {
  const links = normaliseRelatedPartyAccountLinks(state.relatedPartyAccounts || [],lines);
  const manual = Array.isArray(state.relatedPartyRows) ? state.relatedPartyRows : [];
  const meta = completeRelatedPartyKmp(state.relatedPartyDisclosure || {});
  const issues: string[] = [];
  if(links.some(link=>lines.filter(line=>relatedPartyAccountKey(line)===link.accountKey).length>1))issues.push("A related-party account code occurs more than once in the TB; consolidate or distinguish those accounts before linking a whole balance.");
  if (relatedPartyCandidates(lines).some(line => !links.some(link => link.accountKey === relatedPartyAccountKey(line))))
    issues.push("Related-party mapping candidates have not all been assessed and linked. Loans alone do not establish the complete related-party population.");
  if (links.some(link=>link.eliminated && (state.presentationReview?.scope!=="consolidated" || !String(link.eliminationReason||"").trim()))) issues.push("An eliminated related-party account requires consolidated scope and its elimination explanation.");
  if (links.some(link => !link.name?.trim() || !link.relationship?.trim())) issues.push("Complete the counterparty and relationship for every ticked account.");
  if (links.some(link => !lines.some(line => relatedPartyAccountKey(line) === link.accountKey))) issues.push("A linked TB account is missing after re-import; relink it before relying on its disclosure.");
  if (links.some(link => !link.wholeAccount || link.kind === "transaction")) issues.push("Mixed accounts and annual transactions need a manually supported allocation; closing balances cannot supply transaction amounts.");
  if (meta.controlReviewed && !String(meta.controlText || "").trim()) issues.push("Record the control relationship conclusion; a review tick alone does not supply the disclosure.");
  if (links.some(link => link.wholeAccount && link.kind !== "transaction" && (!String(link.terms || "").trim() || !String(link.security || "").trim()))) issues.push("Complete terms and security for linked closing balances; use a supported explicit statement if no security or special terms exist.");
  if (manual.some(row => row.amountKind === "balance" && links.some(link => link.wholeAccount && link.name === row.name) && !row.sourceAccountKey)) issues.push("A manual balance may duplicate a linked account; identify its source or use a supported split without duplicating amounts.");
  if (!meta.controlReviewed) issues.push("Assess and record the parent / ultimate controlling party, including where there were no transactions.");
  if (!meta.kmpReviewed) issues.push("Assess key-management compensation and management-entity service fees.");
  const kmpFields = framework === "full" ? ["shortTerm", "postEmployment", "otherLongTerm", "termination", "shareBased"] : ["total"];
  if (meta.kmpReviewed && kmpFields.some(key => ["current", "prior"].some(side => String(meta.kmp?.[key]?.[side] ?? "").trim() === "")))
    issues.push("Enter supported key-management amounts for both periods (including an explicit zero when applicable).");
  if (manual.some(row => (row.name || row.relationship) && !row.amountKind)) issues.push("Classify legacy Current/Prior entries as transactions, balances or commitments before finalisation.");
  if ((links.length || manual.length) && !meta.termsReviewed) issues.push("Review terms, security, guarantees, commitments, impairment allowances and bad-debt expense; no arm's-length assertion is assumed.");
  if (!meta.populationReviewed) issues.push("Confirm the complete related-party population, including parties without separate TB accounts and transactions at no charge.");
  return issues;
}
