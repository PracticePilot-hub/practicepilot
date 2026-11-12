import type { StandardsContext } from "./afsStandardsCoverage";
export const goingConcernContext = (context: StandardsContext) => context.framework === "full" ? "full" : `${context.framework}:${context.edition}`;
/** An explicit, supported assessment is distinct from a printed disclosure. */
export function goingConcernReview(state: Record<string, any>, context: StandardsContext) {
  const value = state.goingConcernAssessment || {};
  const validContext = value.assessmentContext === goingConcernContext(context);
  const status = validContext ? value.assessmentStatus : "";
  const assessed = ["no-disclosure", "material-uncertainty", "significant-judgement", "alternative-basis"].includes(status);
  const basis = String(value.assessmentEvidence || "").trim();
  const supported = basis.length >= 12 && !/^(?:n\/?a|none|nil|pending|not applicable)$/i.test(basis);
  const complete = assessed && (status === "no-disclosure" || supported);
  const issues: string[] = [];
  if (!assessed) issues.push("Record the going-concern assessment outcome; a separate note is required only where the assessment identifies a disclosure requirement.");
  else if (!complete) issues.push("Going-concern assessment: add a brief explanation of what supports your answers (Work only; no separate note wording is required for a no-disclosure outcome).");
  return { assessed, complete, status, omitNote: assessed && status === "no-disclosure", disclosureRequired: assessed && status !== "no-disclosure", issues };
}
