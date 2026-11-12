import type { AfsFlightDeckIssue } from "./AfsFlightDeck";
type Destination = { title: string; target: string; targetLabel: string };
const unique = (values: readonly string[]) => [...new Set(values.filter(Boolean))];
/** Export gates and the red FlightDeck cards are projections of one blocker list. */
export function buildExportReadiness(base: readonly AfsFlightDeckIssue[], arithmetic: readonly string[], required: readonly string[], destinations: readonly Destination[] = []) {
  const issues = base.map(issue => ({...issue}));
  const destination = (message: string): Destination => {
    const note = destinations.find(item=>message.startsWith(item.title+":"));
    if (note) return note;
    if (/cash movements|cash flow|closing cash/i.test(message)) return {title:message,target:"cash-flow-work",targetLabel:"Cash Flow → Work"};
    if (/related.part|key.management|controlling party/i.test(message)) return {title:message,target:"notes-work",targetLabel:"Notes → Work"};
    if (/tax/i.test(message)) return {title:message,target:"tax-computation",targetLabel:"Tax computation"};
    if (/scope|framework|NCI|going.concern/i.test(message)) return {title:message,target:"standards-review",targetLabel:"Whole AFS review"};
    if (/equity/i.test(message)) return {title:message,target:"sce",targetLabel:"Members’ interest / equity"};
    if (/sfp|financial position/i.test(message)) return {title:message,target:"sfp",targetLabel:"Financial position"};
    return {title:message,target:"notes-work",targetLabel:"Notes → Work"};
  };
  for (const [index,message] of unique([...arithmetic,...required]).entries()) {
    const existing = issues.find(issue=>issue.title===message || issue.message===message || (!issue.id.startsWith("disclosure-") && message.startsWith(issue.title+":")) || message.startsWith(issue.title+" in "));
    if (existing) { const resolved=destination(message); if(resolved.target.startsWith("note:") || resolved.target.startsWith("policy:")) {existing.target=resolved.target;existing.targetLabel=resolved.targetLabel;} existing.severity="critical"; if(existing.target==="notes") {existing.target="notes-work";existing.targetLabel="Notes → Work";} if(message!==existing.title && !existing.message.includes(message)) existing.message += " "+message; continue; }
    const target = destination(message);
    issues.push({id:`export-required-${index}`,severity:"critical",title:target.title,message,target:target.target,targetLabel:target.targetLabel});
  }
  const related=issues.filter(issue=>issue.severity==="critical" && (issue.id.startsWith("related-party-") || /^Related parties(?::|$)/i.test(issue.title)));
  if(related.length>1){
    const relatedIds=new Set(related.map(issue=>issue.id));
    const first=issues.findIndex(issue=>relatedIds.has(issue.id));
    const grouped:AfsFlightDeckIssue={id:"related-party-required-review",severity:"critical",title:"Related parties — finish the review",message:[...new Set(related.map(issue=>issue.message))].map(message=>"• "+message).join("\n"),target:"notes-work",targetLabel:"Notes → Work"};
    for(let index=issues.length-1;index>=0;index--) if(relatedIds.has(issues[index].id))issues.splice(index,1);
    issues.splice(first,0,grouped);
  }
  return { flightDeckIssues:issues, arithmeticIssues:unique(arithmetic), finalisationIssues:unique(issues.filter(issue=>issue.severity==="critical").map(issue=>issue.message)) };
}

/** Whole-rand cash statements ignore sub-rand differences that display as zero.
 * Missing/non-finite values remain blockers; other arithmetic checks retain cents precision.
 */
export function statementArithmeticIssues(checks: Record<string, unknown>): string[] {
  const cashLabels: Record<string, string> = {
    cashFlowMovementDifference: "Cash flow movement differs from the balance sheet",
    cashFlowClosingDifference: "Current-year closing cash differs from the balance sheet",
    cashFlowPriorClosingDifference: "Prior-year closing cash differs from the balance sheet",
    cashDirectIndirectDifferenceCurrent: "Current-year direct and indirect cash flows differ",
    cashDirectIndirectDifferencePrior: "Prior-year direct and indirect cash flows differ",
  };
  return Object.entries(checks).flatMap(([key, value]) => {
    if (!/Difference|OpeningMissing/.test(key)) return [];
    if (key === "cashPriorOpeningMissing") return value === true ? ["Cash flow: prior-year opening cash has not been supplied"] : [];
    const label = cashLabels[key];
    if (typeof value !== "number") return value === true ? [key] : [];
    if (!Number.isFinite(value)) return [label ? `${label}: an amount is missing or invalid` : key];
    if (label) return Math.round(value) === 0 ? [] : [`${label}: difference R${value.toLocaleString("en-ZA", {minimumFractionDigits:2, maximumFractionDigits:2})}`];
    return Math.abs(value) > 0.005 ? [key] : [];
  });
}
