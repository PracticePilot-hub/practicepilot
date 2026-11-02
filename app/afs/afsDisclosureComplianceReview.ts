/** Disclosure prompts are risk indicators, NOT automated IFRS compliance certification. */
export type DisclosureReviewItem = {
  id: string;
  title: string;
  standardsArea: string;
  scope: "SME-2015" | "SME-2025" | "both";
  codes: readonly string[];
  review: string;
  section: "notes" | "accounting-policies";
};

// Match only mapping codes. Do not infer from account names, descriptions or categories.
export const AFS_DISCLOSURE_REVIEW_RULES: readonly DisclosureReviewItem[] = [
  {id:"nci",title:"Non-controlling interests: confirm consolidation scope",standardsArea:"Section 9 / Section 6",scope:"both",codes:["830"],review:"NCI is a consolidated-equity component. A standalone or separate company file requires correction of the mapping or documented consolidation scope and subsidiary ownership evidence. Do not remove the balance merely to hide this review.",section:"notes"},
  {id:"other-equity",title:"Other equity: classify the instrument and movements",standardsArea:"Section 22 / Section 6",scope:"both",codes:["840"],review:"Support equity versus liability classification from contractual terms and reconcile contributions, distributions and transfers. Unclassified movements are not automatically cash flows.",section:"notes"},
  {id:"oci",title:"OCI: validate permitted category and equity allocation",standardsArea:"Section 5 / Section 6",scope:"both",codes:["797"],review:"Validate each OCI item under the elected SME edition, tax effect and any reclassification. Reconcile total comprehensive income to reserves and, for a group, attribute profit and OCI between parent owners and NCI using ownership evidence.",section:"notes"},
  {id:"ppe",title:"Property, plant and equipment",standardsArea:"PPE",scope:"both",codes:["305"],review:"Verify class reconciliation, useful lives, depreciation, impairment, pledged assets and commitments.",section:"notes"},
  {id:"rou",title:"Right-of-use / lease assets",standardsArea:"Leases",scope:"both",codes:["306","555"],review:"Check edition-specific lease classification, liabilities, payment commitments and policies. Do not assume full IFRS 16 applies to an SME.",section:"notes"},
  {id:"invprop",title:"Investment property",standardsArea:"Investment property",scope:"both",codes:["310"],review:"Confirm fair-value reliability, valuation methodology, restrictions, contractual commitments and movements.",section:"notes"},
  {id:"intang",title:"Intangible assets and goodwill",standardsArea:"Intangibles / combinations",scope:"both",codes:["320","321"],review:"Review amortisation, impairment, useful lives, business combination information and roll-forward.",section:"notes"},
  {id:"invest",title:"Subsidiaries, associates and joint ventures",standardsArea:"Investments / consolidation",scope:"both",codes:["326","327","328"],review:"Confirm consolidation exemption or measurement basis, ownership interests and financial information as applicable.",section:"notes"},
  {id:"loans",title:"Loans, financing and other financial instruments",standardsArea:"Financial instruments",scope:"both",codes:["340","449","547","548","550","551","590","620","630"],review:"Check counterparties, terms, security, defaults, maturities, impairment and applicable risk disclosures.",section:"notes"},
  {id:"biological",title:"Biological assets",standardsArea:"Specialised activities",scope:"both",codes:["330","410"],review:"Confirm fair-value or cost model by class, required movements, valuation methods and agricultural activity disclosures.",section:"notes"},
  {id:"inventory",title:"Inventory",standardsArea:"Inventories",scope:"both",codes:["405"],review:"Review measurement basis, expense recognised, write-downs/reversals and inventory pledged as security.",section:"notes"},
  {id:"receivables",title:"Trade and other receivables",standardsArea:"Financial instruments",scope:"both",codes:["430","432"],review:"Check classification, credit-loss/impairment basis, contractual assets and offsetting if applicable.",section:"notes"},
  {id:"cash",title:"Cash and cash equivalents",standardsArea:"Cash flows",scope:"both",codes:["420","620"],review:"Reconcile cash flow closing cash to bank and overdraft, restrictions and definition of cash equivalents.",section:"notes"},
  {id:"capital",title:"Share capital and reserves",standardsArea:"Equity",scope:"both",codes:["805","810","820"],review:"Confirm classes and rights of shares, restrictions, reserves and changes in equity.",section:"notes"},
  {id:"provision",title:"Provisions and employee benefits",standardsArea:"Provisions / employee benefits",scope:"both",codes:["515","660"],review:"Review obligations, movement reconciliations, timing, uncertainties and benefit-plan assumptions.",section:"notes"},
  {id:"grants",title:"Government grants and deferred income",standardsArea:"Government grants",scope:"both",codes:["531","640"],review:"Confirm grant conditions, recognition policy, unfulfilled obligations and movements.",section:"notes"},
  {id:"income",title:"Revenue and contract balances",standardsArea:"Revenue",scope:"SME-2025",codes:["700","730","432","640"],review:"Assess the revised Section 23 five-step revenue recognition model, significant judgments and contract balances.",section:"accounting-policies"},
  {id:"tax",title:"Income taxes",standardsArea:"Income taxes",scope:"both",codes:["395","495","595","695","795"],review:"Reconcile current/deferred tax, temporary differences, unrecognised tax losses and tax expense.",section:"notes"},
  {id:"contingent",title:"Held-for-sale / discontinued / other special items",standardsArea:"Presentation / classification",scope:"both",codes:["499","699","799"],review:"Confirm the selected SME edition permits the classification and presentation used; full-IFRS labels are not a substitute.",section:"notes"},
];

export function activeAfsDisclosureReviews(
  lines: readonly {mapping_code?: string | null; current_year_balance?: number | null; prior_year_balance?: number | null; debit?: number | null; credit?: number | null}[],
  edition: "2015" | "2025",
): DisclosureReviewItem[] {
  const codes=new Set(lines.filter(line=> {
    const current=line.current_year_balance == null ? Number(line.debit || 0)-Number(line.credit || 0) : Number(line.current_year_balance);
    return Math.abs(current)>0.005 || Math.abs(Number(line.prior_year_balance || 0))>0.005;
  }).map(line=>String(line.mapping_code || "").trim()).filter(Boolean));
  return AFS_DISCLOSURE_REVIEW_RULES.filter(item=>
    (item.scope==="both" || (edition==="2025" && item.scope==="SME-2025") || (edition==="2015" && item.scope==="SME-2015")) &&
    item.codes.some(prefix=> [...codes].some(code=>code===prefix || code.startsWith(prefix+".")))
  );
}
