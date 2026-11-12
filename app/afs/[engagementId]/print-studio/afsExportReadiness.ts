import type { AfsFlightDeckIssue } from "./AfsFlightDeck";
type Destination = { title: string; target: string; targetLabel: string };
const unique = (values: readonly string[]) => [...new Set(values.filter(Boolean))];
/** Export gates and the red FlightDeck cards are projections of one blocker list. */
export function buildExportReadiness(base: readonly AfsFlightDeckIssue[], arithmetic: readonly string[], required: readonly string[], destinations: readonly Destination[] = []) {
  const issues = base.map(issue => ({...issue}));
  const destination = (message: string): Destination => {
    const note = destinations.find(item=>message.startsWith(item.title+":"));
    if (note) return note;
    if (/cash movements/i.test(message)) return {title:message,target:"cash-flow-work",targetLabel:"Cash Flow → Work"};
    if (/related.part|key.management|controlling party/i.test(message)) return {title:message,target:"notes-work",targetLabel:"Notes → Work"};
    if (/tax/i.test(message)) return {title:message,target:"tax-computation",targetLabel:"Tax computation"};
    if (/scope|framework|NCI|going.concern/i.test(message)) return {title:message,target:"standards-review",targetLabel:"Whole AFS review"};
    if (/equity/i.test(message)) return {title:message,target:"sce",targetLabel:"Members’ interest / equity"};
    if (/sfp|financial position/i.test(message)) return {title:message,target:"sfp",targetLabel:"Financial position"};
    return {title:message,target:"notes-work",targetLabel:"Notes → Work"};
  };
  for (const [index,message] of unique([...arithmetic,...required]).entries()) {
    const existing = issues.find(issue=>issue.title===message || issue.message===message || message.startsWith(issue.title+":") || message.startsWith(issue.title+" in "));
    if (existing) { existing.severity="critical"; if(existing.target==="notes") {existing.target="notes-work";existing.targetLabel="Notes → Work";} if(message!==existing.title && !existing.message.includes(message)) existing.message += " "+message; continue; }
    const target = destination(message);
    issues.push({id:`export-required-${index}`,severity:"critical",title:target.title,message,target:target.target,targetLabel:target.targetLabel});
  }
  return { flightDeckIssues:issues, arithmeticIssues:unique(arithmetic), finalisationIssues:unique(issues.filter(issue=>issue.severity==="critical").map(issue=>issue.message)) };
}
