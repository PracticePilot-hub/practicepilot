/** Section review approves the saved periods and their recorded payment amounts.
 * This is an effective read projection: never rewrite the saved worksheet or
 * manufacture an approval for a draft, reopened section, or later calculation.
 */
export function withTaxSectionReview(saved: any, signoff: any) {
  if (!saved?.worksheet || signoff?.section_key !== "tax-calculator" || !signoff.reviewed_by || !signoff.reviewed_at || saved.engagement_id !== signoff.engagement_id) return saved;
  const reviewed = Date.parse(signoff.reviewed_at), changed = Date.parse(saved.updated_at || saved.created_at);
  if (!Number.isFinite(reviewed) || !Number.isFinite(changed) || reviewed < changed) return saved;
  const sectionReview = { reviewedAt: signoff.reviewed_at, reviewedBy: signoff.reviewed_by };
  return {...saved, sectionReview, worksheet:{...saved.worksheet, entities:saved.worksheet.entities.map((entity:any)=>({
    ...entity,
    // The signed section covers amounts actually recorded, including zero.
    // Missing amounts remain missing and cannot be confirmed by a sign-off.
    paymentsConfirmed: entity.paymentsConfirmed || ([entity.payments,entity.refunds].every(value=>value !== null && value !== undefined && value !== "" && Number.isFinite(Number(value))))
  }))}};
}
