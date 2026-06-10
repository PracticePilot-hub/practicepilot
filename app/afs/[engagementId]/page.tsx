"use client";

import { useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import { useParams, useRouter } from "next/navigation";
import ClientSetupPanel from "./ClientSetupPanel";
import TrialBalancePanel from "./TrialBalancePanel";

type AFSEngagement = {
  id: string;
  client_name: string;
  entity_type: string | null;
  financial_year_end: string;
  status: string;
  prepared_by: string | null;
  reviewed_by: string | null;
  notes: string | null;
};

type TrialBalanceLine = {
  id?: string;
  account_code: string | null;
  account_name: string;
  account_type: string | null;

  debit: number;
  credit: number;

  opening_balance?: number;
  current_year_balance?: number;
  prior_year_balance?: number;

  period_1?: number;
  period_2?: number;
  period_3?: number;
  period_4?: number;
  period_5?: number;
  period_6?: number;
  period_7?: number;
  period_8?: number;
  period_9?: number;
  period_10?: number;
  period_11?: number;
  period_12?: number;

  import_basis?: string;
  amount_layout?: string;

  mapping_category: string | null;
  note_number: string | null;
};

type AFSNote = {
  id: string;
  note_number: string;
  note_title: string;
  note_body: string | null;
  sort_order: number;
};

type WorkingPaper = {
  id: string;
  section: string;
  title: string;
  status: string;
  prepared_comment: string | null;
  review_comment: string | null;
};

type SectionKey =
  | "client-setup"
  | "trial-balance"
  | "mapping"
  | "lead-schedules"
  | "working-papers"
  | "financial-statements"
  | "minutes"
  | "compilation-report"
  | "xbrl"
  | "finalisation";

type MappingEndpoint = {
  id: string;
  label: string;
  presentation: "SFP" | "P/L";
  section: string;
  smartRule?: string;
};

type MappingSubgroup = {
  id: string;
  title: string;
  endpoints: MappingEndpoint[];
};

type MappingSection = {
  id: string;
  title: string;
  description: string;
  subgroups: MappingSubgroup[];
};

type MappingStatement = {
  id: string;
  title: string;
  description: string;
  sections: MappingSection[];
};

const sections: {
  key: SectionKey;
  number: string;
  title: string;
  description: string;
}[] = [
  {
    key: "client-setup",
    number: "01",
    title: "Client Setup",
    description: "Entity details, year end and engagement information.",
  },
  {
    key: "trial-balance",
    number: "02",
    title: "Trial Balance",
    description: "Import and review the trial balance.",
  },
  {
    key: "mapping",
    number: "03",
    title: "Mapping / Link Accounts",
    description: "Map accounts to AFS sections and notes.",
  },
  {
    key: "lead-schedules",
    number: "04",
    title: "Lead Schedules",
    description: "Prepare lead schedules for balances.",
  },
  {
    key: "working-papers",
    number: "05",
    title: "Working Papers",
    description: "Preparation and review working papers.",
  },
  {
    key: "financial-statements",
    number: "06",
    title: "Financial Statements",
    description: "Generate and review the AFS pack.",
  },
  {
    key: "minutes",
    number: "07",
    title: "Minutes / Resolutions",
    description: "Director and member approvals.",
  },
  {
    key: "compilation-report",
    number: "08",
    title: "Compilation Report",
    description: "Compilation sign-off and representation.",
  },
  {
    key: "xbrl",
    number: "09",
    title: "XBRL / iXBRL",
    description: "Submission preparation.",
  },
  {
    key: "finalisation",
    number: "10",
    title: "Finalisation",
    description: "Final review, lock file and export.",
  },
];

function numbered(prefix: string, count: number) {
  return Array.from({ length: count }, (_, index) => `${prefix} ${index + 1}`);
}

function makeEndpoints(
  presentation: "SFP" | "P/L",
  section: string,
  labels: string[],
  smartRule?: string
): MappingEndpoint[] {
  return labels.map((label) => ({
    id: `${presentation}-${section}-${label}`
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, ""),
    label,
    presentation,
    section,
    smartRule,
  }));
}

function partyEndpoints(
  presentation: "SFP" | "P/L",
  section: string,
  prefix: string,
  parties: string[],
  smartRule?: string
) {
  return makeEndpoints(
    presentation,
    section,
    parties.flatMap((party) =>
      numbered(`${prefix} - ${party}`, 10)
    ),
    smartRule
  );
}

const parties = [
  "Shareholder",
  "Director / Member",
  "Group company",
  "Related party",
  "Trust",
];

const mappingLibrary: MappingStatement[] = [
  {
    id: "sfp",
    title: "Statement of Financial Position",
    description: "Balance sheet accounts grouped by AFS presentation section.",
    sections: [
      {
        id: "non-current-assets",
        title: "Non-current assets",
        description: "Long-term assets and long-term receivables.",
        subgroups: [
          {
            id: "ppe",
            title: "Property, plant and equipment",
            endpoints: makeEndpoints("SFP", "Non-current assets", [
              "Land and buildings",
              "Plant and machinery",
              "Furniture and fittings",
              "Motor vehicles",
              "Office equipment",
              "Computer equipment",
              "Leasehold improvements",
              "Capital work in progress",
              "Other property, plant and equipment",
              "Accumulated depreciation - PPE",
              "Accumulated impairment - PPE",
            ]),
          },
          {
            id: "investment-property",
            title: "Investment property",
            endpoints: makeEndpoints("SFP", "Non-current assets", [
              "Investment property at fair value",
              "Investment property at cost",
              "Investment property under construction",
            ]),
          },
          {
            id: "intangible-assets",
            title: "Intangible assets",
            endpoints: makeEndpoints("SFP", "Non-current assets", [
              "Goodwill",
              "Computer software capitalised",
              "Licences and franchises",
              "Trademarks",
              "Patents",
              "Other intangible assets",
              "Accumulated amortisation - intangible assets",
              "Accumulated impairment - intangible assets",
            ]),
          },
          {
            id: "long-term-investments",
            title: "Long-term investments",
            endpoints: makeEndpoints("SFP", "Non-current assets", [
              "Investments in subsidiaries",
              "Investments in associates",
              "Investments in joint ventures",
              "Unlisted investments",
              "Listed investments",
              "Unit trusts",
              "Other financial assets - non-current",
            ]),
          },
          {
            id: "long-term-loans-receivable",
            title: "Long-term loans and receivables",
            endpoints: [
              ...partyEndpoints(
                "SFP",
                "Non-current assets",
                "Loan receivable - non-current",
                parties,
                "Debit balance presents as asset. Credit balance can be reviewed for liability presentation."
              ),
              ...makeEndpoints("SFP", "Non-current assets", [
                "Finance lease receivable - non-current",
                "Other loan receivable - non-current",
              ]),
            ],
          },
          {
            id: "deferred-tax-asset",
            title: "Deferred tax and other non-current assets",
            endpoints: makeEndpoints("SFP", "Non-current assets", [
              "Deferred tax asset",
              "Operating lease asset - non-current",
              "Retirement benefit asset",
              "Other non-current asset 1",
              "Other non-current asset 2",
              "Other non-current asset 3",
            ]),
          },
        ],
      },
      {
        id: "current-assets",
        title: "Current assets",
        description:
          "Short-term assets, receivables, bank balances and tax control accounts.",
        subgroups: [
          {
            id: "inventory",
            title: "Inventory",
            endpoints: makeEndpoints("SFP", "Current assets", [
              "Inventory - raw materials",
              "Inventory - work in progress",
              "Inventory - finished goods",
              "Inventory - merchandise",
              "Inventory - consumable stores",
              "Inventory - other",
              "Inventory impairment",
              "Inventory write-down reversal",
            ]),
          },
          {
            id: "trade-receivables",
            title: "Trade and other receivables",
            endpoints: makeEndpoints("SFP", "Current assets", [
              "Trade debtors",
              "Sundry debtors",
              "Accrued income",
              "Deposits paid",
              "Prepayments",
              "Staff loans receivable",
              "Other receivable 1",
              "Other receivable 2",
              "Other receivable 3",
            ]),
          },
          {
            id: "tax-controls",
            title: "Tax and statutory control accounts",
            endpoints: makeEndpoints(
              "SFP",
              "Current assets",
              [
                "VAT control",
                "Income tax control",
                "PAYE / UIF / SDL control",
                "Dividend withholding tax control",
                "Other SARS / statutory control account",
              ],
              "System will present debit balances as current assets and credit balances as current liabilities."
            ),
          },
          {
            id: "cash-bank",
            title: "Cash and bank",
            endpoints: makeEndpoints(
              "SFP",
              "Current assets",
              [
                "Cash on hand",
                "Current bank account",
                "Savings account",
                "Call account",
                "Credit card / bank control",
              ],
              "System will present debit balances as cash and credit balances as bank overdraft/current liability."
            ),
          },
          {
            id: "current-loans-receivable",
            title: "Current loans and related party balances",
            endpoints: [
              ...partyEndpoints(
                "SFP",
                "Current assets",
                "Loan receivable - current",
                parties,
                "Debit balance presents as asset. Credit balance can be reviewed for liability presentation."
              ),
              ...makeEndpoints("SFP", "Current assets", [
                "Finance lease receivable - current",
                "Other loan receivable - current",
              ]),
            ],
          },
          {
            id: "other-current-assets",
            title: "Other current assets",
            endpoints: makeEndpoints("SFP", "Current assets", [
              "Asset held for sale",
              "Other current asset 1",
              "Other current asset 2",
              "Other current asset 3",
              "Other current asset 4",
            ]),
          },
        ],
      },
      {
        id: "equity",
        title: "Equity",
        description: "Capital, reserves and retained income.",
        subgroups: [
          {
            id: "capital",
            title: "Capital",
            endpoints: makeEndpoints("SFP", "Equity", [
              "Share capital",
              "Members contribution",
              "Owners capital",
              "Trust capital",
              "Treasury shares",
            ]),
          },
          {
            id: "reserves",
            title: "Reserves",
            endpoints: makeEndpoints("SFP", "Equity", [
              "Revaluation reserve",
              "Fair value reserve",
              "Foreign currency translation reserve",
              "Other reserve 1",
              "Other reserve 2",
              "Other reserve 3",
            ]),
          },
          {
            id: "retained-income",
            title: "Retained income",
            endpoints: makeEndpoints("SFP", "Equity", [
              "Retained income",
              "Accumulated profit / loss",
              "Current year profit / loss control",
              "Prior year adjustment",
              "Non-controlling interest",
            ]),
          },
          {
            id: "owner-member-beneficiary",
            title: "Owners / members / beneficiaries",
            endpoints: makeEndpoints("SFP", "Equity", [
              ...numbered("Owner capital - Owner", 20),
              ...numbered("Member contribution - Member", 20),
              ...numbered("Beneficiary capital - Beneficiary", 20),
            ]),
          },
        ],
      },
      {
        id: "non-current-liabilities",
        title: "Non-current liabilities",
        description: "Long-term obligations and non-current provisions.",
        subgroups: [
          {
            id: "long-term-borrowings",
            title: "Long-term borrowings",
            endpoints: [
              ...partyEndpoints(
                "SFP",
                "Non-current liabilities",
                "Loan payable - non-current",
                parties
              ),
              ...makeEndpoints("SFP", "Non-current liabilities", [
                "Bank loan - non-current",
                "Mortgage bond - non-current",
                "Vehicle finance - non-current",
                "Finance lease liability - non-current",
                "Other financial liability - non-current",
              ]),
            ],
          },
          {
            id: "non-current-provisions",
            title: "Non-current provisions",
            endpoints: makeEndpoints("SFP", "Non-current liabilities", [
              "Provision - non-current",
              "Retirement benefit obligation",
              "Deferred income - non-current",
              "Other non-current liability 1",
              "Other non-current liability 2",
              "Other non-current liability 3",
            ]),
          },
          {
            id: "deferred-tax-liability",
            title: "Deferred tax",
            endpoints: makeEndpoints("SFP", "Non-current liabilities", [
              "Deferred tax liability",
            ]),
          },
        ],
      },
      {
        id: "current-liabilities",
        title: "Current liabilities",
        description: "Short-term liabilities, payables, overdrafts and tax controls.",
        subgroups: [
          {
            id: "trade-payables",
            title: "Trade and other payables",
            endpoints: makeEndpoints("SFP", "Current liabilities", [
              "Trade creditors",
              "Sundry creditors",
              "Accruals",
              "Income received in advance",
              "Deposits received",
              "Other payable 1",
              "Other payable 2",
              "Other payable 3",
            ]),
          },
          {
            id: "current-borrowings",
            title: "Current loans and related party balances",
            endpoints: [
              ...partyEndpoints(
                "SFP",
                "Current liabilities",
                "Loan payable - current",
                parties
              ),
              ...makeEndpoints("SFP", "Current liabilities", [
                "Bank overdraft",
                "Bank loan - current portion",
                "Mortgage bond - current portion",
                "Vehicle finance - current portion",
                "Finance lease liability - current portion",
                "Other financial liability - current",
              ]),
            ],
          },
          {
            id: "tax-control-liabilities",
            title: "Tax and statutory control accounts",
            endpoints: makeEndpoints(
              "SFP",
              "Current liabilities",
              [
                "VAT control",
                "Income tax control",
                "PAYE / UIF / SDL control",
                "Dividend withholding tax control",
                "Other SARS / statutory control account",
              ],
              "System will present debit balances as current assets and credit balances as current liabilities."
            ),
          },
          {
            id: "current-provisions",
            title: "Current provisions",
            endpoints: makeEndpoints("SFP", "Current liabilities", [
              "Provision - current",
              "Leave pay provision",
              "Bonus provision",
              "Warranties provision",
              "Other current provision",
            ]),
          },
        ],
      },
    ],
  },
  {
    id: "pl",
    title: "Statement of Profit or Loss",
    description: "Income statement accounts grouped by AFS presentation section.",
    sections: [
      {
        id: "revenue",
        title: "Revenue",
        description: "Primary trading revenue.",
        subgroups: [
          {
            id: "trading-revenue",
            title: "Trading revenue",
            endpoints: makeEndpoints("P/L", "Revenue", [
              "Sale of goods",
              "Rendering of services",
              "Construction revenue",
              "Rental income - trading",
              "Commission income - trading",
              "Revenue 1",
              "Revenue 2",
              "Revenue 3",
              "Revenue 4",
              "Revenue 5",
            ]),
          },
        ],
      },
      {
        id: "other-income",
        title: "Other income",
        description: "Non-trading income and gains.",
        subgroups: [
          {
            id: "other-income-general",
            title: "Other income",
            endpoints: makeEndpoints("P/L", "Other income", [
              "Interest received",
              "Dividend income",
              "Profit on sale of asset",
              "Foreign exchange gain",
              "Fair value gain",
              "Bad debts recovered",
              "Government grants",
              "Sundry income",
              "Other income 1",
              "Other income 2",
              "Other income 3",
            ]),
          },
        ],
      },
      {
        id: "cost-of-sales",
        title: "Cost of sales",
        description: "Direct cost of sales and inventory movements.",
        subgroups: [
          {
            id: "cost-of-sales-general",
            title: "Cost of sales",
            endpoints: makeEndpoints("P/L", "Cost of sales", [
              "Opening inventory",
              "Purchases",
              "Direct materials",
              "Direct labour",
              "Manufacturing overheads",
              "Subcontractors",
              "Import costs",
              "Closing inventory",
              "Inventory adjustment",
              "Cost of sales - other",
            ]),
          },
        ],
      },
      {
        id: "operating-expenses",
        title: "Operating expenses",
        description: "General operating expenses.",
        subgroups: [
          {
            id: "administration",
            title: "Administration",
            endpoints: makeEndpoints("P/L", "Operating expenses", [
              "Accounting fees",
              "Audit / independent review fees",
              "Bank charges",
              "Computer expenses",
              "Consulting and professional fees",
              "Courier and postage",
              "Depreciation",
              "Amortisation",
              "Insurance",
              "Legal fees",
              "Printing and stationery",
              "Software subscriptions",
              "Telephone and internet",
              "Training",
              "Travel - local",
              "Travel - overseas",
              "Other expenses - deductible",
              "Other expenses - non-deductible",
            ]),
          },
          {
            id: "premises",
            title: "Premises",
            endpoints: makeEndpoints("P/L", "Operating expenses", [
              "Rent paid",
              "Rates and taxes",
              "Electricity and water",
              "Repairs and maintenance",
              "Cleaning",
              "Security",
              "Garden and landscaping",
              "Property management fees",
            ]),
          },
          {
            id: "selling-marketing",
            title: "Selling and marketing",
            endpoints: makeEndpoints("P/L", "Operating expenses", [
              "Advertising",
              "Marketing",
              "Commission paid",
              "Entertainment",
              "Gifts",
              "Website and online advertising",
            ]),
          },
          {
            id: "impairments-losses",
            title: "Impairments and losses",
            endpoints: makeEndpoints("P/L", "Operating expenses", [
              "Bad debts",
              "Impairment loss",
              "Loss on sale of asset",
              "Foreign exchange loss",
              "Fair value loss",
              "Fines and penalties",
            ]),
          },
        ],
      },
      {
        id: "employee-costs",
        title: "Employee costs",
        description: "Staff and payroll costs.",
        subgroups: [
          {
            id: "payroll",
            title: "Payroll",
            endpoints: makeEndpoints("P/L", "Employee costs", [
              "Salaries and wages",
              "Directors remuneration",
              "Bonuses",
              "Commission - staff",
              "Leave pay",
              "Medical aid company contributions",
              "Pension / provident fund contributions",
              "UIF",
              "SDL",
              "WCA",
              "Other employee costs",
            ]),
          },
        ],
      },
      {
        id: "finance-costs",
        title: "Finance costs",
        description: "Interest and finance charges.",
        subgroups: [
          {
            id: "finance-costs-general",
            title: "Finance costs",
            endpoints: makeEndpoints("P/L", "Finance costs", [
              "Interest paid",
              "Bank interest",
              "Finance lease interest",
              "Loan interest",
              "Other finance costs",
            ]),
          },
        ],
      },
      {
        id: "taxation",
        title: "Taxation",
        description: "Income tax expense items.",
        subgroups: [
          {
            id: "tax-expense",
            title: "Tax expense",
            endpoints: makeEndpoints("P/L", "Taxation", [
              "Current tax expense",
              "Deferred tax expense",
              "Prior year tax under / over provision",
              "Withholding tax",
              "Other taxation",
            ]),
          },
        ],
      },
    ],
  },
];

export default function AFSEngagementPage() {
  const router = useRouter();
  const params = useParams();
  const engagementId = String(params.engagementId || "");

  const [loading, setLoading] = useState(true);
  const [engagement, setEngagement] = useState<AFSEngagement | null>(null);
  const [trialBalanceLines, setTrialBalanceLines] = useState<TrialBalanceLine[]>(
    []
  );
  const [notes, setNotes] = useState<AFSNote[]>([]);
  const [workingPapers, setWorkingPapers] = useState<WorkingPaper[]>([]);
  const [activeSection, setActiveSection] =
    useState<SectionKey>("client-setup");

  async function loadEngagement() {
    setLoading(true);

    try {
      const res = await fetch(`/api/afs/engagements/${engagementId}`, {
        cache: "no-store",
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to load AFS engagement.");
      }

      setEngagement(data.engagement);
      setTrialBalanceLines(data.trialBalanceLines || []);
      setNotes(data.notes || []);
      setWorkingPapers(data.workingPapers || []);
    } catch (error: any) {
      alert(error.message || "Failed to load AFS engagement.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (engagementId) {
      loadEngagement();
    }
  }, [engagementId]);

  if (loading) {
    return <main style={styles.page}>Loading AFS engagement...</main>;
  }

  if (!engagement) {
    return (
      <main style={styles.page}>
        <button
          style={styles.secondaryButton}
          onClick={() => router.push("/afs")}
        >
          Back to AFS
        </button>
        <p>AFS engagement not found.</p>
      </main>
    );
  }

  const selectedSection = sections.find(
    (section) => section.key === activeSection
  );

  return (
    <main style={styles.page}>
      <section style={styles.topBar}>
        <button
          style={styles.secondaryButton}
          onClick={() => router.push("/afs")}
        >
          ← Back to AFS
        </button>

        <div style={styles.topTitleBlock}>
          <p style={styles.kicker}>AFS Working File</p>
          <h1 style={styles.title}>{engagement.client_name}</h1>
          <p style={styles.subtitle}>
            {engagement.entity_type || "Entity"} · Financial year end{" "}
            {engagement.financial_year_end}
          </p>
        </div>

        <span style={styles.status}>{engagement.status}</span>
      </section>

      <section style={styles.fileLayout}>
        <aside style={styles.sidebar}>
          <div style={styles.sidebarHeader}>
            <strong>Working file</strong>
            <span>{sections.length} sections</span>
          </div>

          <nav style={styles.sectionList}>
            {sections.map((section) => {
              const isActive = section.key === activeSection;

              return (
                <button
                  key={section.key}
                  type="button"
                  style={{
                    ...styles.sidebarSectionButton,
                    ...(isActive ? styles.sidebarSectionButtonActive : {}),
                  }}
                  onClick={() => setActiveSection(section.key)}
                >
                  <span
                    style={{
                      ...styles.sectionNumber,
                      ...(isActive ? styles.sectionNumberActive : {}),
                    }}
                  >
                    {section.number}
                  </span>

                  <span style={styles.sectionText}>
                    <strong>{section.title}</strong>
                    <small>{section.description}</small>
                  </span>
                </button>
              );
            })}
          </nav>
        </aside>

        <section style={styles.workArea}>
          <div style={styles.workHeader}>
            <div>
              <p style={styles.kicker}>{selectedSection?.number}</p>
              <h2 style={styles.workTitle}>{selectedSection?.title}</h2>
              <p style={styles.subtitle}>{selectedSection?.description}</p>
            </div>
          </div>

          {activeSection === "client-setup" && (
            <ClientSetupPanel
              engagementId={engagementId}
              clientName={engagement.client_name}
              entityType={engagement.entity_type}
              financialYearEnd={engagement.financial_year_end}
              preparedBy={engagement.prepared_by}
            />
          )}

          {activeSection === "trial-balance" && (
            <TrialBalancePanel
              engagementId={engagementId}
              trialBalanceLines={trialBalanceLines}
              onImported={(lines) => setTrialBalanceLines(lines)}
            />
          )}

          {activeSection === "mapping" && (
            <MappingPanel trialBalanceLines={trialBalanceLines} />
          )}

          {activeSection === "lead-schedules" && (
            <Placeholder
              title="Lead Schedules"
              text="This is where current assets, non-current assets, liabilities, equity and income statement schedules will be prepared."
            />
          )}

          {activeSection === "working-papers" && (
            <section style={styles.card}>
              <h3 style={styles.cardTitle}>Working papers</h3>

              {workingPapers.length === 0 ? (
                <p style={styles.emptyText}>No working papers created yet.</p>
              ) : (
                <div style={styles.stack}>
                  {workingPapers.map((paper) => (
                    <div key={paper.id} style={styles.smallItem}>
                      <strong>{paper.title}</strong>
                      <p style={styles.smallText}>
                        {paper.section} · {paper.status}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </section>
          )}

          {activeSection === "financial-statements" && (
            <section style={styles.card}>
              <h3 style={styles.cardTitle}>Financial Statements</h3>

              {notes.length === 0 ? (
                <p style={styles.emptyText}>
                  No AFS notes created yet. Notes will be generated from mapped TB
                  balances.
                </p>
              ) : (
                <div style={styles.stack}>
                  {notes.map((note) => (
                    <div key={note.id} style={styles.smallItem}>
                      <strong>
                        {note.note_number}. {note.note_title}
                      </strong>
                      <p style={styles.smallText}>{note.note_body || ""}</p>
                    </div>
                  ))}
                </div>
              )}
            </section>
          )}

          {activeSection === "minutes" && (
            <Placeholder
              title="Minutes / Resolutions"
              text="This is where approval minutes and director/member resolutions will be generated."
            />
          )}

          {activeSection === "compilation-report" && (
            <Placeholder
              title="Compilation Report"
              text="This is where the compilation report, practitioner sign-off and representation letter will sit."
            />
          )}

          {activeSection === "xbrl" && (
            <Placeholder
              title="XBRL / iXBRL"
              text="This is where XBRL preparation and submission checks will be handled later."
            />
          )}

          {activeSection === "finalisation" && (
            <Placeholder
              title="Finalisation"
              text="This is where final review, file lock, PDF export and completion status will be handled."
            />
          )}
        </section>
      </section>
    </main>
  );
}

function MappingPanel({
  trialBalanceLines,
}: {
  trialBalanceLines: TrialBalanceLine[];
}) {
  const [selectedLineKey, setSelectedLineKey] = useState("");
  const [selectedEndpoint, setSelectedEndpoint] =
    useState<MappingEndpoint | null>(null);

  const [searchText, setSearchText] = useState("");
  const [accountFilter, setAccountFilter] = useState("Unmapped");

  const [openStatements, setOpenStatements] = useState<Record<string, boolean>>(
    {}
  );
  const [openMappingSections, setOpenMappingSections] = useState<
    Record<string, boolean>
  >({});
  const [openSubgroups, setOpenSubgroups] = useState<Record<string, boolean>>(
    {}
  );

  const enrichedLines = useMemo(() => {
    return trialBalanceLines.map((line, index) => ({
      ...line,
      lineKey: getLineKey(line, index),
      current: currentBalance(line),
      prior: priorBalance(line),
      suggested: suggestMapping(line),
    }));
  }, [trialBalanceLines]);

  const selectedLine =
    enrichedLines.find((line) => line.lineKey === selectedLineKey) || null;

  const filteredLines = useMemo(() => {
    const q = searchText.trim().toLowerCase();

    return enrichedLines.filter((line) => {
      const mapped = Boolean(line.mapping_category);

      if (accountFilter === "Mapped" && !mapped) return false;
      if (accountFilter === "Unmapped" && mapped) return false;

      if (!q) return true;

      return (
        String(line.account_code || "").toLowerCase().includes(q) ||
        String(line.account_name || "").toLowerCase().includes(q) ||
        String(line.suggested || "").toLowerCase().includes(q)
      );
    });
  }, [enrichedLines, searchText, accountFilter]);

  const mappedCount = trialBalanceLines.filter((line) =>
    Boolean(line.mapping_category)
  ).length;

  function toggleStatement(id: string) {
    setOpenStatements((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  function toggleMappingSection(id: string) {
    setOpenMappingSections((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  function toggleSubgroup(id: string) {
    setOpenSubgroups((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  function assignMapping() {
    if (!selectedLine || !selectedEndpoint) {
      alert("Select one account on the left and one mapping destination on the right.");
      return;
    }

    alert(
      `Next step will save: ${selectedLine.account_name || "Selected account"} → ${
        selectedEndpoint.label
      }`
    );
  }

  return (
    <section style={styles.mappingWrapper}>
      <div style={styles.mappingHeaderRow}>
        <div>
          <h3 style={styles.cardTitle}>Mapping / Link Accounts</h3>
          <p style={styles.emptyText}>
            Select one account on the left and assign it to a clean AFS
            destination. Detail schedules will come later.
          </p>
        </div>

        <div style={styles.mappingStatsRow}>
          <Stat label="Total lines" value={trialBalanceLines.length} />
          <Stat label="Mapped" value={mappedCount} />
          <Stat label="Unmapped" value={trialBalanceLines.length - mappedCount} />
        </div>
      </div>

      <div style={styles.mappingGrid}>
        <section style={styles.mapperPane}>
          <div style={styles.panelHeader}>
            <strong>Trial balance accounts</strong>

            <select
              style={styles.smallSelect}
              value={accountFilter}
              onChange={(e) => setAccountFilter(e.target.value)}
            >
              <option>Unmapped</option>
              <option>Mapped</option>
              <option>All</option>
            </select>
          </div>

          <div style={styles.searchWrap}>
            <input
              style={styles.searchInput}
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              placeholder="Search account number, name or suggestion..."
            />
          </div>

          <div style={styles.tableWrap}>
            <table style={styles.mappingTable}>
              <thead>
                <tr>
                  <th style={styles.th}>Account</th>
                  <th style={styles.th}>Description</th>
                  <th style={styles.thRight}>Current</th>
                  <th style={styles.thRight}>Prior</th>
                  <th style={styles.th}>Suggested</th>
                </tr>
              </thead>

              <tbody>
                {filteredLines.length === 0 ? (
                  <tr>
                    <td style={styles.td} colSpan={5}>
                      No accounts found.
                    </td>
                  </tr>
                ) : (
                  filteredLines.map((line) => {
                    const isSelected = selectedLineKey === line.lineKey;

                    return (
                      <tr
                        key={line.lineKey}
                        onClick={() => setSelectedLineKey(line.lineKey)}
                        style={{
                          ...styles.tr,
                          ...(isSelected ? styles.selectedRow : {}),
                        }}
                      >
                        <td style={styles.tdCode}>{line.account_code || ""}</td>
                        <td style={styles.td}>{line.account_name || ""}</td>
                        <td style={styles.tdRight}>{formatMoney(line.current)}</td>
                        <td style={styles.tdRight}>{formatMoney(line.prior)}</td>
                        <td style={styles.tdMuted}>{line.suggested}</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section style={styles.assignPane}>
          <div style={styles.selectionBox}>
            <strong>Selected account</strong>

            {selectedLine ? (
              <div style={styles.selectedPlainBox}>
                <span>{selectedLine.account_code}</span>
                <strong>{selectedLine.account_name}</strong>
              </div>
            ) : (
              <p style={styles.emptyText}>No account selected.</p>
            )}
          </div>

          <div style={styles.selectionBox}>
            <strong>Selected destination</strong>

            {selectedEndpoint ? (
              <div style={styles.selectedDestination}>
                <strong>{selectedEndpoint.label}</strong>
                <span>
                  {selectedEndpoint.presentation} · {selectedEndpoint.section}
                </span>
                {selectedEndpoint.smartRule ? (
                  <small>{selectedEndpoint.smartRule}</small>
                ) : null}
              </div>
            ) : (
              <p style={styles.emptyText}>No mapping selected.</p>
            )}

            <button
              type="button"
              style={{
                ...styles.primaryButton,
                opacity: selectedLine && selectedEndpoint ? 1 : 0.5,
              }}
              disabled={!selectedLine || !selectedEndpoint}
              onClick={assignMapping}
            >
              Assign mapping
            </button>
          </div>
        </section>

        <section style={styles.libraryPane}>
          <div style={styles.panelHeader}>
            <div>
              <strong>Mapping Library</strong>
              <p style={styles.libraryHint}>
                Open the statement, then the section, then the subgroup.
              </p>
            </div>
          </div>

          <div style={styles.libraryScroll}>
            {mappingLibrary.map((statement) => {
              const statementOpen = Boolean(openStatements[statement.id]);

              return (
                <div key={statement.id} style={styles.statementBlock}>
                  <button
                    type="button"
                    style={{
                      ...styles.statementButton,
                      ...(statementOpen ? styles.statementButtonOpen : {}),
                    }}
                    onClick={() => toggleStatement(statement.id)}
                  >
                    <span>{statementOpen ? "−" : "+"}</span>
                    <strong>{statement.title}</strong>
                  </button>

                  {statementOpen && (
                    <div style={styles.statementBody}>
                      <p style={styles.statementDescription}>
                        {statement.description}
                      </p>

                      {statement.sections.map((mappingSection) => {
                        const sectionOpen = Boolean(
                          openMappingSections[mappingSection.id]
                        );

                        return (
                          <div
                            key={mappingSection.id}
                            style={styles.mappingSectionBlock}
                          >
                            <button
                              type="button"
                              style={{
                                ...styles.mappingSectionButton,
                                ...(sectionOpen
                                  ? styles.mappingSectionButtonOpen
                                  : {}),
                              }}
                              onClick={() =>
                                toggleMappingSection(mappingSection.id)
                              }
                            >
                              <span>{sectionOpen ? "−" : "+"}</span>
                              <strong>{mappingSection.title}</strong>
                              <em>
                                {mappingSection.subgroups.reduce(
                                  (total, subgroup) =>
                                    total + subgroup.endpoints.length,
                                  0
                                )}
                              </em>
                            </button>

                            {sectionOpen && (
                              <div style={styles.mappingSectionBody}>
                                <p style={styles.statementDescription}>
                                  {mappingSection.description}
                                </p>

                                {mappingSection.subgroups.map((subgroup) => {
                                  const subgroupOpen = Boolean(
                                    openSubgroups[subgroup.id]
                                  );

                                  return (
                                    <div
                                      key={subgroup.id}
                                      style={styles.subgroupBlock}
                                    >
                                      <button
                                        type="button"
                                        style={{
                                          ...styles.subgroupButton,
                                          ...(subgroupOpen
                                            ? styles.subgroupButtonOpen
                                            : {}),
                                        }}
                                        onClick={() =>
                                          toggleSubgroup(subgroup.id)
                                        }
                                      >
                                        <span>{subgroupOpen ? "−" : "+"}</span>
                                        <strong>{subgroup.title}</strong>
                                        <em>{subgroup.endpoints.length}</em>
                                      </button>

                                      {subgroupOpen && (
                                        <div style={styles.endpointList}>
                                          {subgroup.endpoints.map((endpoint) => {
                                            const isSelected =
                                              selectedEndpoint?.id === endpoint.id;

                                            return (
                                              <button
                                                key={endpoint.id}
                                                type="button"
                                                style={{
                                                  ...styles.endpointButton,
                                                  ...(isSelected
                                                    ? styles.endpointButtonSelected
                                                    : {}),
                                                }}
                                                onClick={() =>
                                                  setSelectedEndpoint(endpoint)
                                                }
                                              >
                                                <span>{endpoint.label}</span>
                                                {endpoint.smartRule ? (
                                                  <small>Smart presentation</small>
                                                ) : null}
                                              </button>
                                            );
                                          })}
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </section>
  );
}

function Placeholder({ title, text }: { title: string; text: string }) {
  return (
    <section style={styles.card}>
      <h3 style={styles.cardTitle}>{title}</h3>
      <p style={styles.emptyText}>{text}</p>
    </section>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div style={styles.statBox}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function getLineKey(line: TrialBalanceLine, index: number) {
  return line.id || `${line.account_code || "line"}-${index}`;
}

function toNumber(value: any) {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : 0;
}

function currentBalance(line: TrialBalanceLine) {
  return (
    toNumber(line.opening_balance) +
    toNumber(line.current_year_balance ?? line.debit ?? 0)
  );
}

function priorBalance(line: TrialBalanceLine) {
  return toNumber(line.prior_year_balance ?? line.credit ?? 0);
}

function suggestMapping(line: TrialBalanceLine) {
  const code = String(line.account_code || "").toLowerCase();
  const name = String(line.account_name || "").toLowerCase();
  const balance = currentBalance(line);

  if (name.includes("bank") || name.includes("nedbank") || name.includes("cash")) {
    return "Cash and bank";
  }

  if (
    name.includes("vat") ||
    name.includes("paye") ||
    name.includes("uif") ||
    name.includes("sdl") ||
    name.includes("income tax") ||
    name.includes("sars")
  ) {
    return "Tax and statutory control accounts";
  }

  if (
    name.includes("shareholder") ||
    name.includes("director") ||
    name.includes("member") ||
    name.includes("loan")
  ) {
    return balance < 0 ? "Loan payable" : "Loan receivable";
  }

  if (
    name.includes("capital") ||
    name.includes("retained") ||
    name.includes("reserve") ||
    code.startsWith("5")
  ) {
    return "Equity";
  }

  if (
    name.includes("stock") ||
    name.includes("inventory") ||
    name.includes("raw material")
  ) {
    return "Inventory / cost of sales";
  }

  if (
    name.includes("sales") ||
    name.includes("revenue") ||
    name.includes("income")
  ) {
    return "Revenue / income";
  }

  if (balance < 0) {
    return "Liability / income";
  }

  return "Expenses";
}

function formatMoney(value: number) {
  return new Intl.NumberFormat("en-ZA", {
    style: "currency",
    currency: "ZAR",
  }).format(Number(value || 0));
}

const styles: Record<string, CSSProperties> = {
  page: {
    minHeight: "100vh",
    background: "#eef2f7",
    padding: "22px",
    color: "#111827",
  },
  topBar: {
    background: "white",
    border: "1px solid #dbe3ef",
    borderRadius: "16px",
    padding: "18px",
    marginBottom: "18px",
    display: "grid",
    gridTemplateColumns: "auto 1fr auto",
    gap: "18px",
    alignItems: "center",
    boxShadow: "0 8px 22px rgba(15, 23, 42, 0.05)",
  },
  topTitleBlock: {
    minWidth: 0,
  },
  kicker: {
    margin: "0 0 5px",
    fontSize: "12px",
    fontWeight: 800,
    color: "#2563eb",
    textTransform: "uppercase",
    letterSpacing: "0.08em",
  },
  title: {
    margin: 0,
    fontSize: "25px",
    lineHeight: 1.2,
  },
  subtitle: {
    margin: "6px 0 0",
    color: "#64748b",
    fontSize: "13px",
  },
  status: {
    borderRadius: "999px",
    background: "#eff6ff",
    color: "#1d4ed8",
    padding: "8px 12px",
    fontSize: "12px",
    fontWeight: 800,
    whiteSpace: "nowrap",
  },
  fileLayout: {
    display: "grid",
    gridTemplateColumns: "360px 1fr",
    gap: "18px",
    alignItems: "start",
  },
  sidebar: {
    background: "#ffffff",
    border: "1px solid #dbe3ef",
    borderRadius: "16px",
    padding: "14px",
    boxShadow: "0 8px 22px rgba(15, 23, 42, 0.05)",
    position: "sticky",
    top: "90px",
  },
  sidebarHeader: {
    display: "flex",
    justifyContent: "space-between",
    gap: "10px",
    padding: "8px 8px 14px",
    borderBottom: "1px solid #e5e7eb",
    marginBottom: "10px",
    color: "#111827",
    fontSize: "13px",
  },
  sectionList: {
    display: "grid",
    gap: "8px",
  },
  sidebarSectionButton: {
    width: "100%",
    border: "1px solid #e5e7eb",
    borderRadius: "12px",
    background: "#ffffff",
    padding: "10px",
    cursor: "pointer",
    display: "grid",
    gridTemplateColumns: "42px 1fr",
    gap: "10px",
    alignItems: "start",
    textAlign: "left",
  },
  sidebarSectionButtonActive: {
    borderColor: "#2563eb",
    background: "#eff6ff",
  },
  sectionNumber: {
    width: "32px",
    height: "32px",
    borderRadius: "10px",
    border: "1px solid #d1d5db",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "#64748b",
    fontWeight: 900,
    fontSize: "12px",
    background: "#f8fafc",
  },
  sectionNumberActive: {
    borderColor: "#2563eb",
    background: "#2563eb",
    color: "white",
  },
  sectionText: {
    display: "grid",
    gap: "3px",
  },
  workArea: {
    minWidth: 0,
  },
  workHeader: {
    background: "white",
    border: "1px solid #dbe3ef",
    borderRadius: "16px",
    padding: "18px",
    marginBottom: "14px",
    boxShadow: "0 8px 22px rgba(15, 23, 42, 0.05)",
  },
  workTitle: {
    margin: 0,
    fontSize: "23px",
  },
  card: {
    background: "white",
    border: "1px solid #dbe3ef",
    borderRadius: "16px",
    padding: "18px",
    boxShadow: "0 8px 22px rgba(15, 23, 42, 0.05)",
  },
  cardTitle: {
    margin: 0,
    fontSize: "18px",
  },
  secondaryButton: {
    border: "1px solid #d1d5db",
    borderRadius: "12px",
    padding: "10px 14px",
    background: "white",
    color: "#111827",
    fontWeight: 800,
    fontSize: "14px",
    cursor: "pointer",
  },
  primaryButton: {
    border: "none",
    borderRadius: "10px",
    padding: "10px 12px",
    background: "#2563eb",
    color: "white",
    fontWeight: 900,
    fontSize: "13px",
    cursor: "pointer",
  },
  emptyText: {
    margin: "6px 0 0",
    color: "#64748b",
    fontSize: "14px",
  },
  stack: {
    display: "grid",
    gap: "10px",
  },
  smallItem: {
    border: "1px solid #e5e7eb",
    borderRadius: "12px",
    padding: "12px",
  },
  smallText: {
    margin: "6px 0 0",
    color: "#64748b",
    fontSize: "13px",
  },

  mappingWrapper: {
    background: "white",
    border: "1px solid #dbe3ef",
    borderRadius: "16px",
    padding: "18px",
    boxShadow: "0 8px 22px rgba(15, 23, 42, 0.05)",
  },
  mappingHeaderRow: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: "16px",
    marginBottom: "16px",
  },
  mappingStatsRow: {
    display: "grid",
    gridTemplateColumns: "repeat(3, 100px)",
    gap: "10px",
  },
  statBox: {
    border: "1px solid #dbe3ef",
    borderRadius: "10px",
    padding: "10px 12px",
    background: "#f8fafc",
    display: "grid",
    gap: "4px",
    fontSize: "12px",
  },
  mappingGrid: {
    display: "grid",
    gridTemplateColumns: "1.25fr 220px 1fr",
    gap: "12px",
    alignItems: "start",
  },
  mapperPane: {
    border: "1px solid #cfd9e8",
    borderRadius: "12px",
    overflow: "hidden",
    background: "white",
  },
  panelHeader: {
    minHeight: "44px",
    padding: "10px 12px",
    background: "#f8fafc",
    borderBottom: "1px solid #dbe3ef",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "10px",
    fontSize: "13px",
  },
  smallSelect: {
    border: "1px solid #b9c7d8",
    borderRadius: "8px",
    padding: "7px 10px",
    background: "white",
    fontSize: "12px",
    fontWeight: 700,
    color: "#0f172a",
  },
  searchWrap: {
    padding: "10px",
    borderBottom: "1px solid #e5eaf2",
  },
  searchInput: {
    width: "100%",
    border: "1px solid #c8d4e3",
    borderRadius: "8px",
    padding: "9px 10px",
    fontSize: "13px",
    outline: "none",
    boxSizing: "border-box",
  },
  tableWrap: {
    maxHeight: "520px",
    overflow: "auto",
  },
  mappingTable: {
    width: "100%",
    borderCollapse: "collapse",
    fontSize: "12px",
  },
  th: {
    padding: "8px 9px",
    background: "#f8fafc",
    borderBottom: "1px solid #dbe3ef",
    color: "#48617f",
    textAlign: "left",
    fontSize: "11px",
    whiteSpace: "nowrap",
  },
  thRight: {
    padding: "8px 9px",
    background: "#f8fafc",
    borderBottom: "1px solid #dbe3ef",
    color: "#48617f",
    textAlign: "right",
    fontSize: "11px",
    whiteSpace: "nowrap",
  },
  tr: {
    cursor: "pointer",
  },
  selectedRow: {
    background: "#eaf2ff",
    outline: "1px solid #2563eb",
    outlineOffset: "-1px",
  },
  td: {
    padding: "8px 9px",
    borderBottom: "1px solid #edf1f7",
    color: "#0f172a",
    whiteSpace: "nowrap",
  },
  tdCode: {
    padding: "8px 9px",
    borderBottom: "1px solid #edf1f7",
    color: "#0f172a",
    whiteSpace: "nowrap",
    fontWeight: 800,
  },
  tdRight: {
    padding: "8px 9px",
    borderBottom: "1px solid #edf1f7",
    color: "#0f172a",
    whiteSpace: "nowrap",
    textAlign: "right",
  },
  tdMuted: {
    padding: "8px 9px",
    borderBottom: "1px solid #edf1f7",
    color: "#48617f",
    whiteSpace: "nowrap",
  },
  assignPane: {
    border: "1px solid #cfd9e8",
    borderRadius: "12px",
    background: "#f8fafc",
    padding: "10px",
    display: "grid",
    gap: "12px",
    fontSize: "13px",
  },
  selectionBox: {
    display: "grid",
    gap: "8px",
  },
  selectedPlainBox: {
    border: "1px solid #c8d4e3",
    borderRadius: "9px",
    background: "white",
    padding: "10px",
    display: "grid",
    gap: "4px",
  },
  selectedDestination: {
    border: "1px solid #93b4f8",
    borderRadius: "9px",
    background: "#eff6ff",
    padding: "10px",
    display: "grid",
    gap: "6px",
    color: "#0f3fb8",
  },
  libraryPane: {
    border: "1px solid #cfd9e8",
    borderRadius: "12px",
    overflow: "hidden",
    background: "white",
  },
  libraryHint: {
    margin: "4px 0 0",
    color: "#48617f",
    fontSize: "12px",
  },
  libraryScroll: {
    maxHeight: "620px",
    overflow: "auto",
    padding: "10px",
  },
  statementBlock: {
    marginBottom: "8px",
  },
  statementButton: {
    width: "100%",
    border: "1px solid #0f172a",
    borderRadius: "8px",
    background: "white",
    color: "#0f172a",
    padding: "10px 12px",
    display: "flex",
    alignItems: "center",
    gap: "10px",
    cursor: "pointer",
    textAlign: "left",
  },
  statementButtonOpen: {
    background: "#0f172a",
    color: "white",
  },
  statementBody: {
    border: "1px solid #dbe3ef",
    borderTop: "none",
    borderRadius: "0 0 8px 8px",
    padding: "8px",
  },
  statementDescription: {
    margin: "4px 2px 10px",
    color: "#48617f",
    fontSize: "12px",
  },
  mappingSectionBlock: {
    marginBottom: "8px",
  },
  mappingSectionButton: {
    width: "100%",
    border: "1px solid #dbe3ef",
    borderRadius: "8px",
    background: "#f8fafc",
    padding: "9px 10px",
    color: "#0f172a",
    display: "grid",
    gridTemplateColumns: "18px 1fr 30px",
    alignItems: "center",
    gap: "8px",
    cursor: "pointer",
    textAlign: "left",
  },
  mappingSectionButtonOpen: {
    background: "#eaf2ff",
    color: "#0f3fb8",
  },
  mappingSectionBody: {
    padding: "8px 0 0 12px",
  },
  subgroupBlock: {
    marginBottom: "6px",
  },
  subgroupButton: {
    width: "100%",
    border: "1px solid #dbe3ef",
    borderRadius: "7px",
    background: "white",
    padding: "8px 10px",
    color: "#0f172a",
    display: "grid",
    gridTemplateColumns: "18px 1fr 28px",
    alignItems: "center",
    gap: "8px",
    cursor: "pointer",
    textAlign: "left",
    fontSize: "12px",
  },
  subgroupButtonOpen: {
    background: "#f1f5f9",
    color: "#0f3fb8",
  },
  endpointList: {
    padding: "6px 0 8px 26px",
    display: "grid",
    gap: "2px",
  },
  endpointButton: {
    width: "100%",
    border: "none",
    background: "transparent",
    borderRadius: "6px",
    padding: "7px 8px",
    textAlign: "left",
    color: "#0f172a",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "8px",
    fontSize: "12px",
  },
  endpointButtonSelected: {
    background: "#2563eb",
    color: "white",
    fontWeight: 800,
  },
};