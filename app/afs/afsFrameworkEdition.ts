/** PracticePilot AFS — edition selection and transition guard.
 * This module deliberately does NOT represent adoption as complete merely because
 * a dropdown selection has changed. Client-specific recognition, measurement and
 * comparative adjustments must be reviewed before an IFRS-compliant claim.
 */
export type AfsReportingFramework = "ifrs_smes" | "full_ifrs";
export type SmesEdition = "2015" | "2025";

export type AfsFrameworkSelection = {
  framework: AfsReportingFramework;
  smesEdition: SmesEdition | null;
  periodStart: string; // ISO yyyy-mm-dd
  earlyAdoptionConfirmed: boolean;
  transitionAssessmentCompleted: boolean;
  comparativesAssessed: boolean;
};

export type FrameworkValidation = {
  valid: boolean;
  blockers: string[];
  needsTransitionAssessment: boolean;
  earlyAdoption: boolean;
  noteDisclosure: string | null;
};

const THIRD_EDITION_EFFECTIVE = "2027-01-01";
function validDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const time = Date.parse(`${value}T00:00:00Z`);
  return Number.isFinite(time) && new Date(time).toISOString().slice(0, 10) === value;
}

export function validateFrameworkSelection(x: AfsFrameworkSelection): FrameworkValidation {
  const blockers: string[] = [];
  if (!validDate(x.periodStart)) blockers.push("A valid reporting-period start date is required.");
  if (x.framework === "full_ifrs") {
    if (x.smesEdition !== null) blockers.push("A full IFRS engagement cannot select an IFRS for SMEs edition.");
    return { valid: blockers.length === 0, blockers, needsTransitionAssessment: false, earlyAdoption: false, noteDisclosure: null };
  }
  if (x.smesEdition !== "2015" && x.smesEdition !== "2025") blockers.push("Select an IFRS for SMEs edition.");
  const earlyAdoption = validDate(x.periodStart) && x.periodStart < THIRD_EDITION_EFFECTIVE && x.smesEdition === "2025";
  if (validDate(x.periodStart) && x.periodStart >= THIRD_EDITION_EFFECTIVE && x.smesEdition === "2015") {
    blockers.push("The 2015 edition is not permitted for annual periods beginning on or after 1 January 2027.");
  }
  if (earlyAdoption && !x.earlyAdoptionConfirmed) blockers.push("Confirm the entity's election to early apply the complete 2025 Third Edition.");
  const needsTransitionAssessment = x.smesEdition === "2025";
  if (needsTransitionAssessment && !x.transitionAssessmentCompleted) blockers.push("Complete Appendix A transition assessment (including relevant exceptions and exemptions).");
  if (needsTransitionAssessment && !x.comparativesAssessed) blockers.push("Review comparative information and any required retrospective adjustments.");
  return {
    valid: blockers.length === 0,
    blockers,
    needsTransitionAssessment,
    earlyAdoption: Boolean(earlyAdoption),
    noteDisclosure: earlyAdoption
      ? "The entity has early applied the 2025 Third Edition of the IFRS for SMEs Accounting Standard for the reporting period. The transition provisions in Appendix A have been considered in preparing these annual financial statements."
      : null,
  };
}

export function defaultSmesEdition(periodStart: string): SmesEdition {
  return validDate(periodStart) && periodStart >= THIRD_EDITION_EFFECTIVE ? "2025" : "2015";
}
