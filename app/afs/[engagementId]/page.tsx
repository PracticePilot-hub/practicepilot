"use client";

import { useEffect, useState } from "react";
import type { CSSProperties } from "react";
import { useParams, useRouter } from "next/navigation";
import ClientSetupPanel from "./ClientSetupPanel";
import TrialBalancePanel from "./TrialBalancePanel";
import MappingPanelNew from "./MappingPanel";
import LeadSchedulesPanel from "./LeadSchedulesPanel";
import type { LeadScheduleKey } from "./afsLeadScheduleCatalog";
import AdjustingJournalsPanel from "./AdjustingJournalsPanel";
import ReviewPanel from "./ReviewPanel";
import FinancialStatementsPanel from "./FinancialStatementsPanel";
import TaxCalculatorPanel from "./TaxCalculatorPanel";

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
  opening_balance?: number | null;
  current_year_balance?: number | null;
  prior_year_balance?: number | null;
  import_basis?: string | null;
  amount_layout?: string | null;
  mapping_category: string | null;
  note_number: string | null;
  mapping_leaf_id?: string | null;
  mapping_label?: string | null;
  mapping_statement?: string | null;
  mapping_section?: string | null;
  mapping_path?: string | null;
  mapping_smart_rule?: string | null;
  mapping_confidence?: string | null;
  mapping_code?: string | null;
  lead_schedule_number?: string | null;
  lead_schedule_key?: string | null;
};


type ClientSetupData = Record<string, any> & {
  registered_name?: string | null;
  registration_number?: string | null;
  entity_type?: string | null;
  financial_year_end?: string | null;
  trading_name?: string | null;
  country?: string | null;
  currency?: string | null;
  currency_symbol?: string | null;
  legal_framework?: string | null;
  nature_of_business?: string | null;
  basis_of_preparation?: string | null;
  type_of_engagement?: string | null;
  report_required?: string | null;
  practitioner_name?: string | null;
  practitioner_designation?: string | null;
  practice_name?: string | null;
  place_of_signature?: string | null;
  current_period_heading?: string | null;
  prior_period_heading?: string | null;
};

type ClientPerson = Record<string, any> & {
  id: string;
  person_type: string;
  full_name: string;
};

type SectionKey =
  | "client-setup"
  | "trial-balance"
  | "mapping"
  | "lead-schedules"
  | "adjusting-journals"
  | "tax-calculator"
  | "financial-statements"
  | "minutes"
  | "compilation-report"
  | "xbrl"
  | "finalisation"
  | "review";

type LeadScheduleItem = {
  key: LeadScheduleKey;
  number: string;
  title: string;
};

type LeadScheduleGroup = {
  key: string;
  number: string;
  title: string;
  schedules: LeadScheduleItem[];
};

type LeadScheduleStatement = {
  key: string;
  title: string;
  groups: LeadScheduleGroup[];
};

type LeadScheduleSubPage =
  | "lead-schedule"
  | "supporting-working-paper"
  | "review-notes";

const sections: { key: SectionKey; number: string; title: string; description: string }[] = [
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
    title: "Mapping",
    description: "Map accounts to AFS sections and notes.",
  },
  {
    key: "lead-schedules",
    number: "04",
    title: "Lead Schedules",
    description: "Prepare lead schedules and linked working papers.",
  },
  {
    key: "adjusting-journals",
    number: "05",
    title: "Adjusting Journals",
    description: "Post AFS adjusting journals and review journal effects.",
  },
  {
    key: "tax-calculator",
    number: "06",
    title: "Tax Calculator",
    description: "Calculate taxable income, normal tax and tax payable.",
  },
  {
    key: "financial-statements",
    number: "07",
    title: "Financial Statements",
    description: "Generate and review the full AFS pack.",
  },
  {
    key: "minutes",
    number: "08",
    title: "Minutes / Resolutions",
    description: "Director and member approvals.",
  },
  {
    key: "compilation-report",
    number: "09",
    title: "Compilation Report",
    description: "Compilation report and practitioner details.",
  },
  {
    key: "xbrl",
    number: "10",
    title: "XBRL / iXBRL",
    description: "XBRL tagging and submission pack.",
  },
  {
    key: "finalisation",
    number: "11",
    title: "Finalisation",
    description: "Final checks, sign-off and lock file.",
  },
  {
    key: "review",
    number: "12",
    title: "Review",
    description: "AFS review points and sign-off.",
  },
];

const leadScheduleStatements: LeadScheduleStatement[] = [
  {
    key: "sfp",
    title: "Statement of Financial Position",
    groups: [
      {
        key: "sfp-non-current-assets",
        number: "300",
        title: "Non-current assets",
        schedules: [
          { key: "ppe", number: "305", title: "Property, plant and equipment" },
          { key: "right-of-use-assets", number: "306", title: "Right-of-use assets" },
          { key: "investment-property", number: "310", title: "Investment property" },
          { key: "intangibles", number: "320", title: "Intangible assets" },
          { key: "goodwill", number: "321", title: "Goodwill" },
          { key: "investments-subsidiaries", number: "326", title: "Investments in subsidiaries" },
          { key: "investments-associates", number: "327", title: "Investments in associates" },
          { key: "investments-joint-ventures", number: "328", title: "Investments in joint ventures" },
          { key: "loans-receivable", number: "340", title: "Long-term loans receivable" },
          { key: "deferred-tax-asset", number: "395", title: "Deferred tax asset" },
          { key: "other-non-current-assets", number: "390", title: "Other non-current assets" },
        ],
      },
      {
        key: "sfp-current-assets",
        number: "400",
        title: "Current assets",
        schedules: [
          { key: "inventory", number: "405", title: "Inventories" },
          { key: "cash", number: "420", title: "Cash and cash equivalents" },
          { key: "receivables", number: "430", title: "Trade and other receivables" },
          { key: "construction-contracts-receivable", number: "432", title: "Construction contracts and receivables" },
          { key: "directors-employee-loans", number: "449", title: "Loans to directors, managers and employees" },
          { key: "tax-controls", number: "490", title: "Tax / VAT / PAYE controls" },
          { key: "current-tax-receivable", number: "495", title: "Current tax receivable" },
          { key: "assets-held-for-sale", number: "499", title: "Assets held for sale" },
        ],
      },
      {
        key: "sfp-equity",
        number: "800",
        title: "Equity",
        schedules: [
          { key: "share-capital", number: "805", title: "Share capital / contributions" },
          { key: "retained-income", number: "810", title: "Retained income" },
          { key: "reserves", number: "820", title: "Reserves" },
        ],
      },
      {
        key: "sfp-non-current-liabilities",
        number: "500",
        title: "Non-current liabilities",
        schedules: [
          { key: "provisions", number: "515", title: "Long-term provisions" },
          { key: "deferred-income", number: "531", title: "Deferred income" },
          { key: "loans-group-companies-payable", number: "547", title: "Loans from group companies" },
          { key: "loans-stakeholders-payable", number: "548", title: "Loans from shareholders / directors / members" },
          { key: "financial-liabilities", number: "550", title: "Financial liabilities" },
          { key: "borrowings", number: "551", title: "Borrowings" },
          { key: "lease-liabilities", number: "555", title: "Lease liabilities" },
          { key: "other-non-current-liabilities", number: "590", title: "Other non-current liabilities" },
          { key: "deferred-tax-liability", number: "595", title: "Deferred tax liability" },
        ],
      },
      {
        key: "sfp-current-liabilities",
        number: "600",
        title: "Current liabilities",
        schedules: [
          { key: "bank-overdraft", number: "620", title: "Bank overdraft and credit facilities" },
          { key: "payables", number: "630", title: "Trade and other payables" },
          { key: "borrowings", number: "650", title: "Short-term borrowings and finance" },
          { key: "provisions", number: "660", title: "Current provisions" },
          { key: "dividend-payable", number: "688", title: "Dividend payable" },
          { key: "tax-controls", number: "690", title: "Tax and statutory payables" },
          { key: "current-tax-payable", number: "695", title: "Current tax payable" },
          { key: "liabilities-held-for-sale", number: "699", title: "Liabilities held for sale" },
        ],
      },
    ],
  },
  {
    key: "pl",
    title: "Income Statement",
    groups: [
      {
        key: "pl-revenue-income",
        number: "700",
        title: "Revenue and income",
        schedules: [
          { key: "revenue", number: "700", title: "Revenue" },
          { key: "operating-income", number: "730", title: "Other operating income" },
          { key: "investment-income", number: "770", title: "Investment income" },
          { key: "non-operating-income", number: "785", title: "Non-operating income" },
        ],
      },
      {
        key: "pl-expenses",
        number: "720",
        title: "Expenses",
        schedules: [
          { key: "cost-of-sales", number: "720", title: "Cost of sales" },
          { key: "operating-expenses", number: "750", title: "Operating expenses" },
          { key: "non-operating-expenses", number: "781", title: "Non-operating expenses" },
        ],
      },
      {
        key: "pl-finance-tax",
        number: "775",
        title: "Finance and taxation",
        schedules: [
          { key: "finance-costs", number: "775", title: "Finance costs" },
          { key: "taxation", number: "795", title: "Taxation" },
        ],
      },
      {
        key: "pl-other-performance",
        number: "780",
        title: "Other performance",
        schedules: [
          { key: "non-operating-gains-losses", number: "780", title: "Non-operating gains / losses" },
          { key: "other-comprehensive-income", number: "797", title: "Other comprehensive income" },
          { key: "discontinued-operations", number: "799", title: "Discontinued operations" },
        ],
      },
    ],
  },
  {
    key: "other",
    title: "Other",
    groups: [
      {
        key: "other-disclosures",
        number: "850",
        title: "Other disclosures",
        schedules: [
          { key: "related-parties", number: "850", title: "Related parties" },
          { key: "commitments-contingencies", number: "857", title: "Commitments and contingencies" },
          { key: "cash-flow", number: "880", title: "Statement of cash flows" },
          { key: "other-disclosures", number: "891", title: "Other disclosures" },
        ],
      },
    ],
  },
];

function formatSectionTitle(section: { number: string; title: string }) {
  return `${section.number} · ${section.title}`;
}

export default function AFSEngagementPage() {
  const router = useRouter();
  const params = useParams();
  const engagementId = String(params.engagementId || "");

  const [loading, setLoading] = useState(true);
  const [engagement, setEngagement] = useState<AFSEngagement | null>(null);
  const [clientSetup, setClientSetup] = useState<ClientSetupData | null>(null);
  const [clientPeople, setClientPeople] = useState<ClientPerson[]>([]);
  const [trialBalanceLines, setTrialBalanceLines] = useState<TrialBalanceLine[]>([]);
  const [activeSection, setActiveSection] = useState<SectionKey>("client-setup");
  const [activeLeadSchedule, setActiveLeadSchedule] = useState<LeadScheduleKey | null>(null);
  const [activeLeadSubPage, setActiveLeadSubPage] =
    useState<LeadScheduleSubPage>("lead-schedule");
  const [openLeadStatements, setOpenLeadStatements] = useState<Record<string, boolean>>({});
  const [openLeadGroups, setOpenLeadGroups] = useState<Record<string, boolean>>({});

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

      const setupRes = await fetch(
        `/api/afs/engagements/${engagementId}/client-setup`,
        { cache: "no-store" }
      );

      const setupData = await setupRes.json();

      if (setupRes.ok) {
        setClientSetup(setupData.setup || null);
        setClientPeople(setupData.people || []);

        if (setupData.engagement) {
          setEngagement(setupData.engagement);
        }
      }
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

  function toggleLeadStatement(statementKey: string) {
    setOpenLeadStatements((current) => ({
      ...current,
      [statementKey]: !current[statementKey],
    }));
  }

  function toggleLeadGroup(groupKey: string) {
    setOpenLeadGroups((current) => ({
      ...current,
      [groupKey]: !current[groupKey],
    }));
  }

  function openSection(sectionKey: SectionKey) {
    setActiveSection(sectionKey);

    if (sectionKey === "lead-schedules") {
      setActiveLeadSchedule(null);
      setActiveLeadSubPage("lead-schedule");
    }
  }

  function openLeadSchedule(scheduleKey: LeadScheduleKey, subPage: LeadScheduleSubPage) {
    setActiveSection("lead-schedules");
    setActiveLeadSchedule(scheduleKey);
    setActiveLeadSubPage(subPage);
  }

  function handleClientSetupSaved(payload: {
    setup: any;
    engagement?: {
      id?: string;
      client_name?: string | null;
      entity_type?: string | null;
      financial_year_end?: string | null;
      status?: string | null;
      prepared_by?: string | null;
      reviewed_by?: string | null;
      notes?: string | null;
    } | null;
    people?: any[];
  }) {
    setClientSetup(payload.setup || null);

    if (payload.people) {
      setClientPeople(payload.people);
    }

    if (payload.engagement) {
      setEngagement((current) => {
        if (!current) return current;

        return {
          ...current,
          client_name:
            payload.engagement?.client_name || current.client_name || "",
          entity_type:
            payload.engagement?.entity_type || current.entity_type || null,
          financial_year_end:
            payload.engagement?.financial_year_end ||
            current.financial_year_end ||
            "",
          status: payload.engagement?.status || current.status || "Draft",
          prepared_by:
            payload.engagement?.prepared_by || current.prepared_by || null,
          reviewed_by:
            payload.engagement?.reviewed_by || current.reviewed_by || null,
          notes: payload.engagement?.notes || current.notes || null,
        };
      });
    }
  }

  if (loading) {
    return <main style={styles.page}>Loading AFS engagement...</main>;
  }

  if (!engagement) {
    return (
      <main style={styles.page}>
        <button style={styles.secondaryButton} onClick={() => router.push("/afs")}>
          ← Back to AFS
        </button>
        <p>AFS engagement not found.</p>
      </main>
    );
  }

  const selectedSection = sections.find((section) => section.key === activeSection);
  const displayClientName = clientSetup?.registered_name || engagement.client_name;
  const displayEntityType = clientSetup?.entity_type || engagement.entity_type || "Company";
  const displayYearEnd = engagement.financial_year_end;
  const isMappingMode = activeSection === "mapping";

  const financialStatementQuickButtons = [
    { label: "Index", targetId: "afs-index" },
    { label: "Cover page", targetId: "afs-cover" },
    { label: "General information", targetId: "afs-general-info" },
    { label: "Directors' responsibilities", targetId: "afs-directors-responsibilities" },
    { label: "Directors' report", targetId: "afs-directors-report" },
    { label: "Compiler report", targetId: "afs-compilation-report" },
    { label: "Balance sheet", targetId: "afs-sfp" },
    { label: "Comprehensive income", targetId: "afs-sci" },
    { label: "Changes in equity", targetId: "afs-socie" },
    { label: "Cash flow", targetId: "afs-cash-flow" },
    { label: "Accounting policies", targetId: "afs-accounting-policies" },
    { label: "Notes", targetId: "afs-notes" },
    { label: "Detailed income statement", targetId: "afs-detailed-income" },
    { label: "Tax computation", targetId: "afs-tax-computation" },
  ];

  function jumpToFinancialStatementSection(targetId: string) {
    setActiveSection("financial-statements");

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const target = document.getElementById(targetId);
        if (target) {
          window.history.replaceState(null, "", `#${targetId}`);
          target.scrollIntoView({ behavior: "smooth", block: "start" });
        }
      });
    });
  }

  return (
    <main style={styles.page}>
      {!isMappingMode && (
        <section style={styles.topBar}>
          <button style={styles.backButton} onClick={() => router.push("/afs")}>
            ← Back to AFS
          </button>

          <div style={styles.fileHeaderLine}>
            <span style={styles.fileHeaderLabel}>AFS Working File</span>
            <span style={styles.fileHeaderDivider}>|</span>
            <strong style={styles.fileHeaderClient}>{displayClientName}</strong>
            <span style={styles.fileHeaderDivider}>|</span>
            <span style={styles.fileHeaderMeta}>
              {displayEntityType} · Financial year end {displayYearEnd}
            </span>
          </div>

          <span style={styles.status}>{engagement.status || "Draft"}</span>
        </section>
      )}

      <section style={styles.fileLayout}>
        <aside style={styles.sidebar}>
          <div style={styles.sidebarHeader}>
            <strong>AFS</strong>
          </div>

          <nav style={styles.sectionList}>
            {sections.map((section) => {
              const isActive = section.key === activeSection;

              return (
                <div key={section.key} style={styles.sidebarGroup}>
                  <button
                    type="button"
                    style={{
                      ...styles.sidebarSectionButton,
                      ...(isActive ? styles.sidebarSectionButtonActive : {}),
                    }}
                    onClick={() => openSection(section.key)}
                  >
                    {section.title}
                  </button>

                  {section.key === "lead-schedules" && isActive ? (
                    <div style={styles.leadScheduleTree}>
                      {leadScheduleStatements.map((statement) => {
                        const isStatementOpen = Boolean(openLeadStatements[statement.key]);

                        return (
                          <div key={statement.key} style={styles.leadStatementBlock}>
                            <button
                              type="button"
                              style={styles.leadStatementButton}
                              onClick={() => toggleLeadStatement(statement.key)}
                            >
                              <span>{statement.title}</span>
                              <span style={styles.leadToggle}>
                                {isStatementOpen ? "−" : "+"}
                              </span>
                            </button>

                            {isStatementOpen ? (
                              <div style={styles.leadGroupList}>
                                {statement.groups.map((group) => {
                                  const isGroupOpen = Boolean(openLeadGroups[group.key]);

                                  return (
                                    <div key={group.key} style={styles.leadGroupBlock}>
                                      <button
                                        type="button"
                                        style={styles.leadGroupButton}
                                        onClick={() => toggleLeadGroup(group.key)}
                                      >
                                        <span>{formatSectionTitle(group)}</span>
                                        <span style={styles.leadToggle}>
                                          {isGroupOpen ? "−" : "+"}
                                        </span>
                                      </button>

                                      {isGroupOpen ? (
                                        <div style={styles.leadLeafList}>
                                          {group.schedules.map((schedule) => {
                                            const isLeadActive =
                                              schedule.key === activeLeadSchedule;

                                            return (
                                              <div
                                                key={`${schedule.number}-${schedule.key}`}
                                                style={styles.leadWpGroup}
                                              >
                                                <button
                                                  type="button"
                                                  style={{
                                                    ...styles.leadLeafButton,
                                                    ...(isLeadActive
                                                      ? styles.leadLeafButtonActive
                                                      : {}),
                                                  }}
                                                  onClick={() =>
                                                    openLeadSchedule(
                                                      schedule.key,
                                                      "lead-schedule"
                                                    )
                                                  }
                                                >
                                                  {schedule.number} · {schedule.title}
                                                </button>

                                                {isLeadActive ? (
                                                  <div style={styles.leadSubList}>
                                                    <button
                                                      type="button"
                                                      style={{
                                                        ...styles.leadSubButton,
                                                        ...(activeLeadSubPage ===
                                                        "lead-schedule"
                                                          ? styles.leadSubButtonActive
                                                          : {}),
                                                      }}
                                                      onClick={() =>
                                                        openLeadSchedule(
                                                          schedule.key,
                                                          "lead-schedule"
                                                        )
                                                      }
                                                    >
                                                      {schedule.number}.000 · Lead schedule
                                                    </button>

                                                    <button
                                                      type="button"
                                                      style={{
                                                        ...styles.leadSubButton,
                                                        ...(activeLeadSubPage ===
                                                        "supporting-working-paper"
                                                          ? styles.leadSubButtonActive
                                                          : {}),
                                                      }}
                                                      onClick={() =>
                                                        openLeadSchedule(
                                                          schedule.key,
                                                          "supporting-working-paper"
                                                        )
                                                      }
                                                    >
                                                      {schedule.number}.001 · Supporting
                                                      working paper
                                                    </button>

                                                    <button
                                                      type="button"
                                                      style={{
                                                        ...styles.leadSubButton,
                                                        ...(activeLeadSubPage ===
                                                        "review-notes"
                                                          ? styles.leadSubButtonActive
                                                          : {}),
                                                      }}
                                                      onClick={() =>
                                                        openLeadSchedule(
                                                          schedule.key,
                                                          "review-notes"
                                                        )
                                                      }
                                                    >
                                                      {schedule.number}.002 · Review notes
                                                    </button>
                                                  </div>
                                                ) : null}
                                              </div>
                                            );
                                          })}
                                        </div>
                                      ) : null}
                                    </div>
                                  );
                                })}
                              </div>
                            ) : null}
                          </div>
                        );
                      })}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </nav>
        </aside>

        <section
          style={{
            ...styles.workArea,
            ...(isMappingMode ? styles.workAreaMapping : {}),
          }}
        >
          {!isMappingMode && (
            <div style={styles.workHeader}>
              <p style={styles.kicker}>{selectedSection?.number}</p>
              <h2 style={styles.workTitle}>{selectedSection?.title}</h2>
              <p style={styles.subtitle}>{selectedSection?.description}</p>
            </div>
          )}

          {activeSection === "financial-statements" && (
            <div style={styles.financialQuickNav}>
              {financialStatementQuickButtons.map((button) => (
                <button
                  key={button.targetId}
                  type="button"
                  style={styles.financialQuickButton}
                  onClick={() => jumpToFinancialStatementSection(button.targetId)}
                >
                  {button.label}
                </button>
              ))}
            </div>
          )}

          {activeSection === "client-setup" && (
            <ClientSetupPanel
              engagementId={engagementId}
              clientName={engagement.client_name}
              entityType={engagement.entity_type}
              financialYearEnd={engagement.financial_year_end}
              preparedBy={engagement.prepared_by}
              onSaved={handleClientSetupSaved}
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
            <MappingPanelNew
              trialBalanceLines={trialBalanceLines}
              onTrialBalanceLinesChanged={(lines) => setTrialBalanceLines(lines)}
              onDataChanged={loadEngagement}
            />
          )}

          {activeSection === "lead-schedules" && activeLeadSchedule === null && (
            <PlaceholderCard
              title="Lead Schedules"
              text="Select a lead schedule from the working paper index on the left."
            />
          )}

          {activeSection === "lead-schedules" && activeLeadSchedule !== null && (
  <>
    
    <LeadSchedulesPanel
      trialBalanceLines={trialBalanceLines}
      activeLeadSchedule={activeLeadSchedule}
      activeLeadSubPage={activeLeadSubPage}
    />
  </>
)}

          {activeSection === "adjusting-journals" && (
            <AdjustingJournalsPanel
              engagementId={engagementId}
              trialBalanceLines={trialBalanceLines}
              onAccountCreated={(line) => {
                setTrialBalanceLines((current) => {
                  const code = String(line?.account_code || "").trim();
                  if (!code) return current;
                  const exists = current.some((item) => String(item.account_code || "").trim() === code);
                  return exists ? current.map((item) => String(item.account_code || "").trim() === code ? { ...item, ...line } : item) : [...current, line as any];
                });
                loadEngagement();
              }}
              onTrialBalanceLinesChanged={(lines) => setTrialBalanceLines(lines as any)}
              onDataChanged={loadEngagement}
            />
          )}

          {activeSection === "tax-calculator" && <TaxCalculatorPanel />}

          {activeSection === "financial-statements" && (
            <FinancialStatementsPanel
              trialBalanceLines={trialBalanceLines}
              engagement={engagement}
              clientSetup={clientSetup}
              people={clientPeople}
            />
          )}

          {activeSection === "review" && <ReviewPanel />}

          {activeSection === "minutes" && (
            <PlaceholderCard
              title="Minutes / Resolutions"
              text="Director, member and shareholder approval documents will be generated here."
            />
          )}

          {activeSection === "compilation-report" && (
            <PlaceholderCard
              title="Compilation Report"
              text="Compilation report settings and final practitioner wording will be managed here."
            />
          )}

          {activeSection === "xbrl" && (
            <PlaceholderCard
              title="XBRL / iXBRL"
              text="XBRL tagging and submission workflow will be added here."
            />
          )}

          {activeSection === "finalisation" && (
            <PlaceholderCard
              title="Finalisation"
              text="Final checks, sign-off, lock file and export history will be managed here."
            />
          )}
        </section>
      </section>
    </main>
  );
}

function PlaceholderCard({ title, text }: { title: string; text: string }) {
  return (
    <section style={styles.card}>
      <h3 style={styles.cardTitle}>{title}</h3>
      <p style={styles.emptyText}>{text}</p>
    </section>
  );
}

const styles: Record<string, CSSProperties> = {
  page: {
    minHeight: "100vh",
    background: "#eef4fb",
    padding: "8px 12px 16px",
    color: "#0f172a",
    fontFamily:
      'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    fontSize: "12px",
  },
  topBar: {
    background: "#ffffff",
    border: "1px solid #cfd8e6",
    borderRadius: "8px",
    padding: "6px 10px",
    marginBottom: "8px",
    minHeight: "34px",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "10px",
    boxShadow: "none",
  },
  backButton: {
    border: "1px solid #cbd5e1",
    borderRadius: "6px",
    padding: "5px 8px",
    background: "#ffffff",
    color: "#0f172a",
    fontSize: "11px",
    fontWeight: 750,
    cursor: "pointer",
    whiteSpace: "nowrap",
  },
  fileHeaderLine: {
    flex: 1,
    minWidth: 0,
    display: "flex",
    alignItems: "center",
    gap: "8px",
    fontSize: "12px",
    whiteSpace: "nowrap",
    overflow: "hidden",
  },
  fileHeaderLabel: {
    color: "#1d4ed8",
    fontWeight: 850,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    fontSize: "10px",
    whiteSpace: "nowrap",
  },
  fileHeaderDivider: {
    color: "#94a3b8",
    fontWeight: 700,
    fontSize: "11px",
  },
  fileHeaderClient: {
    color: "#0f172a",
    fontSize: "12px",
    fontWeight: 850,
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },
  fileHeaderMeta: {
    color: "#475569",
    fontSize: "11px",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },
  status: {
    borderRadius: "999px",
    background: "#eff6ff",
    color: "#1d4ed8",
    padding: "3px 7px",
    fontSize: "10px",
    fontWeight: 800,
    whiteSpace: "nowrap",
  },
  fileLayout: {
    display: "grid",
    gridTemplateColumns: "200px minmax(0, 1fr)",
    gap: "10px",
    alignItems: "start",
  },
  sidebar: {
    background: "transparent",
    borderRight: "1px solid #d8e1ef",
    padding: "8px 8px 8px 0",
    position: "sticky",
    top: "62px",
    maxHeight: "calc(100vh - 70px)",
    overflow: "auto",
  },
  sidebarHeader: {
    color: "#475569",
    fontSize: "10px",
    letterSpacing: "0.2em",
    margin: "0 0 7px 5px",
    textTransform: "uppercase",
  },
  sectionList: {
    display: "grid",
    gap: "5px",
  },
  sidebarGroup: {
    display: "grid",
    gap: "3px",
  },
  sidebarSectionButton: {
    width: "100%",
    border: "1px solid #d7e0ec",
    borderRadius: "7px",
    background: "#ffffff",
    padding: "7px 9px",
    color: "#082f49",
    fontSize: "12px",
    fontWeight: 800,
    cursor: "pointer",
    textAlign: "left",
    boxShadow: "none",
    lineHeight: 1.15,
  },
  sidebarSectionButtonActive: {
    background: "#1464b3",
    border: "1px solid #1464b3",
    color: "#ffffff",
  },
  leadScheduleTree: {
    display: "grid",
    gap: "2px",
    padding: "1px 0 3px",
  },
  leadStatementBlock: {
    display: "grid",
    gap: "1px",
  },
  leadStatementButton: {
    width: "100%",
    border: "0",
    background: "transparent",
    color: "#0f172a",
    padding: "4px 5px",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "6px",
    textAlign: "left",
    textTransform: "uppercase",
    letterSpacing: "0.07em",
    fontSize: "9.5px",
    fontWeight: 850,
    cursor: "pointer",
    lineHeight: 1.12,
  },
  leadGroupList: {
    display: "grid",
    gap: "1px",
  },
  leadGroupBlock: {
    display: "grid",
    gap: "1px",
  },
  leadGroupButton: {
    width: "100%",
    border: "0",
    background: "transparent",
    color: "#0f172a",
    padding: "4px 5px 4px 14px",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "6px",
    textAlign: "left",
    fontSize: "10.5px",
    fontWeight: 850,
    cursor: "pointer",
    lineHeight: 1.14,
  },
  leadLeafList: {
    display: "grid",
    gap: "1px",
    paddingLeft: "24px",
  },
  leadWpGroup: {
    display: "grid",
    gap: "1px",
  },
  leadLeafButton: {
    width: "100%",
    border: "0",
    borderRadius: "5px",
    background: "transparent",
    color: "#334155",
    padding: "3px 5px",
    textAlign: "left",
    fontSize: "10.5px",
    fontWeight: 600,
    cursor: "pointer",
    lineHeight: 1.16,
  },
  leadLeafButtonActive: {
    background: "#2563eb",
    color: "#ffffff",
    fontWeight: 850,
  },
  leadSubList: {
    display: "grid",
    gap: "1px",
    padding: "2px 0 2px 16px",
  },
  leadSubButton: {
    border: "0",
    background: "transparent",
    color: "#334155",
    padding: "3px 5px",
    textAlign: "left",
    fontSize: "11px",
    fontWeight: 750,
    cursor: "pointer",
    lineHeight: 1.15,
  },
  leadSubButtonActive: {
    color: "#0f172a",
    fontWeight: 900,
    textDecoration: "underline",
  },
  leadToggle: {
    color: "#64748b",
    fontWeight: 850,
    fontSize: "10px",
  },
  workArea: {
    minWidth: 0,
    display: "grid",
    gap: "8px",
  },
  workAreaMapping: {
    gap: "0px",
  },
  workHeader: {
    background: "#ffffff",
    border: "1px solid #dbe3ef",
    borderRadius: "8px",
    padding: "7px 10px",
    boxShadow: "none",
  },
  kicker: {
    margin: "0 0 2px",
    color: "#2563eb",
    fontSize: "9.5px",
    fontWeight: 850,
    letterSpacing: "0.06em",
    textTransform: "uppercase",
  },
  workTitle: {
    margin: 0,
    color: "#0f172a",
    fontSize: "14px",
    lineHeight: 1.15,
    fontWeight: 850,
  },
  subtitle: {
    margin: "3px 0 0",
    color: "#475569",
    fontSize: "11px",
    lineHeight: 1.25,
  },

  financialQuickNav: {
    position: "sticky",
    top: "0px",
    zIndex: 40,
    display: "flex",
    flexWrap: "wrap",
    gap: "5px",
    alignItems: "center",
    border: "1px solid #cbd5e1",
    background: "#f8fafc",
    padding: "6px",
    marginBottom: "10px",
  },
  financialQuickButton: {
    border: "1px solid #cbd5e1",
    background: "#ffffff",
    color: "#0f172a",
    padding: "4px 8px",
    fontSize: "12px",
    fontWeight: 850,
    cursor: "pointer",
    borderRadius: "5px",
  },
  card: {
    background: "#ffffff",
    border: "1px solid #dbe3ef",
    borderRadius: "8px",
    padding: "10px",
    boxShadow: "none",
  },
  cardTitle: {
    margin: 0,
    fontSize: "14px",
    color: "#0f172a",
    fontWeight: 850,
  },
  emptyText: {
    margin: "5px 0 0",
    color: "#64748b",
    fontSize: "11px",
    lineHeight: 1.25,
  },
  secondaryButton: {
    border: "1px solid #d1d5db",
    borderRadius: "7px",
    padding: "6px 9px",
    background: "#ffffff",
    color: "#0f172a",
    fontSize: "11px",
    fontWeight: 800,
    cursor: "pointer",
  },
};
