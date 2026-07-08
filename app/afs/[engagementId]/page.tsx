"use client";

import { useEffect, useState } from "react";
import type { CSSProperties } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
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
  description?: string | null;
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
  | "export-print"
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
    key: "export-print",
    number: "12",
    title: "Export / Print",
    description: "Print working-file schedules and supporting export documents.",
  },
  {
    key: "review",
    number: "13",
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
  const searchParams = useSearchParams();
  const engagementId = String(params.engagementId || "");
  const isAfsPdfMode = searchParams.get("afsPdf") === "1";

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

  useEffect(() => {
    if (isAfsPdfMode) {
      setActiveSection("financial-statements");
    }
  }, [isAfsPdfMode]);

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
        if (!target) return;

        window.history.replaceState(null, "", `#${targetId}`);

        const stickyOffset = 154;
        const targetTop = target.getBoundingClientRect().top + window.scrollY - stickyOffset;
        window.scrollTo({ top: Math.max(0, targetTop), behavior: "smooth" });
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

<button
  type="button"
  onClick={() => {
    if (!engagementId) return;
    window.open(`/afs/${String(engagementId)}/print-studio`, "_blank", "noopener,noreferrer");
  }}
  style={{
    fontSize: 12,
    fontWeight: 600,
    color: "#ffffff",
    background: "#111827",
    border: "1px solid #111827",
    padding: "7px 12px",
    textDecoration: "none",
    whiteSpace: "nowrap",
    cursor: engagementId ? "pointer" : "not-allowed",
    opacity: engagementId ? 1 : 0.55,
  }}
>
  Open Print Studio ↗
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

      {activeSection === "financial-statements" && (
        <div style={styles.financialQuickNavShell}>
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
        </div>
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
              engagementId={engagementId}
              trialBalanceLines={trialBalanceLines}
              engagement={engagement}
              clientSetup={clientSetup}
              people={clientPeople}
            />
          )}

          {activeSection === "export-print" && (
            <ExportPrintPanel
              engagement={engagement}
              clientSetup={clientSetup}
              trialBalanceLines={trialBalanceLines}
              leadScheduleStatements={leadScheduleStatements}
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


type ExportDocumentKey =
  | "final-tb-pilot-view"
  | "final-tb-passenger-view"
  | "final-trial-balance"
  | "journals-passed"
  | "lead-sheets-used"
  | "subordination-agreements";

type ExportPrintPanelProps = {
  engagement: AFSEngagement;
  clientSetup: ClientSetupData | null;
  trialBalanceLines: TrialBalanceLine[];
  leadScheduleStatements: LeadScheduleStatement[];
};

type PostedJournalLine = {
  id: string;
  account_code: string;
  account_name: string;
  debit: number;
  credit: number;
  note: string;
};

type PostedJournal = {
  id: string;
  reference: string;
  description: string;
  journal_date: string;
  posted_at: string;
  is_balanced: boolean;
  debit_total: number;
  credit_total: number;
  lines: PostedJournalLine[];
};

function cleanExportText(value: unknown) {
  return String(value ?? "").trim();
}

function postedJournalReference(rawJournal: Record<string, any>) {
  const explicit = cleanExportText(
    rawJournal.journal_reference ?? rawJournal.journalReference ?? rawJournal.reference,
  );

  if (explicit) return explicit;

  const numberValue = cleanExportText(rawJournal.journal_number ?? rawJournal.number);
  if (!numberValue) return "AJ";

  if (/^AJ/i.test(numberValue)) return numberValue.toUpperCase();

  return `AJ${String(Number(numberValue) || numberValue).padStart(3, "0")}`;
}

function mapPostedJournalForExport(rawJournal: Record<string, any>): PostedJournal {
  const lines = Array.isArray(rawJournal?.lines) ? rawJournal.lines : [];

  const mappedLines: PostedJournalLine[] = lines.map((line: Record<string, any>, index: number) => ({
    id: cleanExportText(line.id) || `${cleanExportText(rawJournal.id) || "journal"}-${index}`,
    account_code: cleanExportText(line.account_code ?? line.accountCode),
    account_name: cleanExportText(line.account_name ?? line.accountName),
    debit: safeNumber(line.debit),
    credit: safeNumber(line.credit),
    note: cleanExportText(line.note),
  }));

  const debitTotal =
    rawJournal.debit_total !== undefined && rawJournal.debit_total !== null
      ? safeNumber(rawJournal.debit_total)
      : mappedLines.reduce((sum, line) => sum + safeNumber(line.debit), 0);

  const creditTotal =
    rawJournal.credit_total !== undefined && rawJournal.credit_total !== null
      ? safeNumber(rawJournal.credit_total)
      : mappedLines.reduce((sum, line) => sum + safeNumber(line.credit), 0);

  return {
    id: cleanExportText(rawJournal.id) || `${postedJournalReference(rawJournal)}-${rawJournal.created_at || ""}`,
    reference: postedJournalReference(rawJournal),
    description: cleanExportText(rawJournal.description) || "Adjusting journal",
    journal_date: cleanExportText(rawJournal.journal_date ?? rawJournal.journalDate),
    posted_at: cleanExportText(rawJournal.posted_at ?? rawJournal.postedAt),
    is_balanced:
      rawJournal.is_balanced === false
        ? false
        : Math.abs(debitTotal - creditTotal) < 0.01,
    debit_total: debitTotal,
    credit_total: creditTotal,
    lines: mappedLines,
  };
}

function safeNumber(value: unknown) {
  const numberValue = Number(value || 0);
  return Number.isFinite(numberValue) ? numberValue : 0;
}

function finalTrialBalanceAmount(line: TrialBalanceLine) {
  const anyLine = line as any;

  if (anyLine.final_afs_balance !== undefined && anyLine.final_afs_balance !== null) {
    return safeNumber(anyLine.final_afs_balance);
  }

  const base =
    anyLine.current_year_balance !== undefined && anyLine.current_year_balance !== null
      ? safeNumber(anyLine.current_year_balance)
      : safeNumber(line.debit) - safeNumber(line.credit);

  return (
    base +
    safeNumber(anyLine.manual_adjustment) +
    safeNumber(anyLine.journal_adjustment) +
    safeNumber(anyLine.reclassification)
  );
}


function preliminaryTrialBalanceAmount(line: TrialBalanceLine) {
  const anyLine = line as any;

  if (anyLine.current_year_balance !== undefined && anyLine.current_year_balance !== null) {
    return safeNumber(anyLine.current_year_balance);
  }

  return safeNumber(line.debit) - safeNumber(line.credit);
}

function manualAdjustmentAmount(line: TrialBalanceLine) {
  const anyLine = line as any;
  return safeNumber(anyLine.manual_adjustment ?? anyLine.manual_adjustments ?? anyLine.manualAdj);
}

function journalAdjustmentAmount(line: TrialBalanceLine) {
  const anyLine = line as any;
  return safeNumber(anyLine.journal_adjustment ?? anyLine.journal_adjustments ?? anyLine.journalAdj);
}

function reclassificationAmount(line: TrialBalanceLine) {
  const anyLine = line as any;
  return safeNumber(anyLine.reclassification ?? anyLine.reclassification_adjustment ?? anyLine.reclass);
}

function reportAnnotationAmount(line: TrialBalanceLine) {
  return finalTrialBalanceAmount(line);
}

function percentageChangeAmount(current: number, prior: number) {
  const roundedPrior = Math.round(prior);
  const roundedCurrent = Math.round(current);

  if (roundedPrior === 0 && roundedCurrent === 0) return "";
  if (roundedPrior === 0) return "(100)";

  const percent = Math.round(((roundedCurrent - roundedPrior) / Math.abs(roundedPrior)) * 100);
  return `(${percent})`;
}

function leadScheduleReference(line: TrialBalanceLine) {
  const reference = String(line.lead_schedule_number || line.mapping_code || "").trim();
  return reference || "–";
}

function formatMoney(value: number) {
  const rounded = Math.round(value);

  if (rounded === 0) return "–";

  const absolute = Math.abs(rounded).toLocaleString("en-ZA", {
    maximumFractionDigits: 0,
  });

  return rounded < 0 ? `(${absolute})` : absolute;
}

function formatSignedMoney(value: number) {
  const rounded = Math.round(value);

  if (rounded === 0) return "–";

  return rounded.toLocaleString("en-ZA", {
    maximumFractionDigits: 0,
  });
}

function formatSignedMoneyCents(value: number) {
  if (Math.abs(value) < 0.005) return "–";

  return value.toLocaleString("en-ZA", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function roundedDisplayAmount(value: number) {
  return Math.round(value);
}

function presentationRoundingAdjustment(roundedTotal: number) {
  if (roundedTotal === 0) return 0;

  /*
    Whole-rand schedules can be R1 out because each row is rounded separately.
    This is a presentation line only. Larger differences must remain visible.
  */
  if (Math.abs(roundedTotal) <= 5) return -roundedTotal;

  return 0;
}

function leadScheduleTitleFromKey(
  leadScheduleStatements: LeadScheduleStatement[],
  scheduleKey: string | null | undefined,
) {
  if (!scheduleKey) return "";

  for (const statement of leadScheduleStatements) {
    for (const group of statement.groups) {
      const found = group.schedules.find((schedule) => schedule.key === scheduleKey);
      if (found) return `${found.number} · ${found.title}`;
    }
  }

  return String(scheduleKey);
}

function ExportPrintPanel({
  engagement,
  clientSetup,
  trialBalanceLines,
  leadScheduleStatements,
}: ExportPrintPanelProps) {
  const [selectedDocument, setSelectedDocument] =
    useState<ExportDocumentKey>("final-tb-pilot-view");
  const [postedJournals, setPostedJournals] = useState<PostedJournal[]>([]);
  const [loadingPostedJournals, setLoadingPostedJournals] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadPostedJournalsForExport() {
      if (!engagement?.id) return;

      try {
        setLoadingPostedJournals(true);

        const response = await fetch(
          `/api/afs/engagements/${engagement.id}/journal-post`,
          { cache: "no-store" },
        );

        const result = await response.json();

        if (!response.ok) {
          throw new Error(result?.error || "Failed to load posted journals.");
        }

        if (!cancelled) {
          const mapped = Array.isArray(result?.journals)
            ? result.journals.map(mapPostedJournalForExport)
            : [];

          setPostedJournals(mapped);
        }
      } catch (error) {
        console.error("Failed to load AFS posted journals for export", error);

        if (!cancelled) {
          setPostedJournals([]);
        }
      } finally {
        if (!cancelled) {
          setLoadingPostedJournals(false);
        }
      }
    }

    loadPostedJournalsForExport();

    return () => {
      cancelled = true;
    };
  }, [engagement?.id]);

  const displayClientName = clientSetup?.registered_name || engagement.client_name;
  const displayYearEnd = clientSetup?.financial_year_end || engagement.financial_year_end;

  const finalTrialBalanceRows = trialBalanceLines
    .map((line) => ({
      line,
      finalAmount: finalTrialBalanceAmount(line),
    }))
    .filter((row) => Math.round(row.finalAmount) !== 0)
    .sort((a, b) =>
      String(a.line.account_code || "").localeCompare(String(b.line.account_code || "")),
    );

  const usedLeadSchedules = trialBalanceLines
    .filter((line) => {
      const finalAmount = finalTrialBalanceAmount(line);
      return String(line.lead_schedule_key || "").trim() && Math.round(finalAmount) !== 0;
    })
    .reduce<Record<string, { title: string; amount: number; count: number }>>(
      (accumulator, line) => {
        const key = String(line.lead_schedule_key || "");
        const number = String(line.lead_schedule_number || "");
        const title =
          number && leadScheduleTitleFromKey(leadScheduleStatements, line.lead_schedule_key)
            ? leadScheduleTitleFromKey(leadScheduleStatements, line.lead_schedule_key)
            : leadScheduleTitleFromKey(leadScheduleStatements, line.lead_schedule_key);

        if (!accumulator[key]) {
          accumulator[key] = {
            title: title || key,
            amount: 0,
            count: 0,
          };
        }

        accumulator[key].amount += finalTrialBalanceAmount(line);
        accumulator[key].count += 1;

        return accumulator;
      },
      {},
    );

  const usedLeadScheduleRows = Object.entries(usedLeadSchedules)
    .map(([key, value]) => ({ key, ...value }))
    .sort((a, b) => a.title.localeCompare(b.title));

  const documents: { key: ExportDocumentKey; title: string; description: string }[] = [
    {
      key: "final-tb-pilot-view",
      title: "Final TB - Pilot View",
      description:
        "Full PracticePilot control TB with imported balance, journals, reclassifications, final balance, prior year and mapping.",
    },
    {
      key: "final-tb-passenger-view",
      title: "Final TB - Passenger View",
      description:
        "Clean client-facing TB with account, description, final current year and final prior year only.",
    },
    {
      key: "journals-passed",
      title: "Journals Passed",
      description: "Summary of accounts affected by posted AFS journals.",
    },
    {
      key: "lead-sheets-used",
      title: "Lead Sheets Used",
      description: "Only lead schedules linked to mapped accounts with balances.",
    },
    {
      key: "subordination-agreements",
      title: "Subordination Agreements",
      description: "Supporting agreements to be generated after the TB and journals.",
    },
  ];

  function selectedExportPdfUrl() {
    return `/api/afs/engagements/${engagement.id}/working-file-export?document=${selectedDocument}`;
  }

  function printSelectedDocument() {
    window.print();
  }

  return (
    <section style={styles.exportPanelShell}>
      <style>
        {`
          @media print {
            body * {
              visibility: hidden !important;
            }

            #afs-export-print-area,
            #afs-export-print-area * {
              visibility: visible !important;
            }

            #afs-export-print-area {
              position: absolute !important;
              left: 0 !important;
              top: 0 !important;
              width: 100% !important;
              background: #ffffff !important;
            }

            #afs-export-print-controls {
              display: none !important;
            }

            @page {
              size: ${selectedDocument === "final-tb-pilot-view" || selectedDocument === "final-trial-balance" ? "A4 landscape" : "A4 portrait"};
              margin: 10mm;
            }
          }
        `}
      </style>

      <div id="afs-export-print-controls" style={styles.exportToolbar}>
        <div>
          <h3 style={styles.exportTitle}>Export / Print</h3>
          <p style={styles.exportSubtitle}>
            Print working-file schedules for the file pack. Start with Final TB and
            Journals Passed.
          </p>
        </div>

        <div style={styles.exportToolbarActions}>
          <button type="button" style={styles.exportSecondaryButton} onClick={printSelectedDocument}>
            Print selected
          </button>
          <a
            href={selectedExportPdfUrl()}
            target="_blank"
            rel="noopener noreferrer"
            style={{ ...styles.exportPrimaryButton, textDecoration: "none", display: "inline-flex", alignItems: "center" }}
          >
            Export PDF
          </a>
        </div>
      </div>

      <div style={styles.exportDocumentGrid}>
        {documents.map((document) => {
          const isActive = selectedDocument === document.key;

          return (
            <button
              key={document.key}
              type="button"
              style={{
                ...styles.exportDocumentButton,
                ...(isActive ? styles.exportDocumentButtonActive : {}),
              }}
              onClick={() => setSelectedDocument(document.key)}
            >
              <strong>{document.title}</strong>
              <span>{document.description}</span>
            </button>
          );
        })}
      </div>

      <section id="afs-export-print-area" style={styles.exportPreviewPage}>
        <div style={styles.exportPrintHeader}>
          <strong>{displayClientName}</strong>
          <span>Financial year end {displayYearEnd}</span>
        </div>

        {(selectedDocument === "final-tb-pilot-view" ||
          selectedDocument === "final-trial-balance") && (
          <PrintableFinalTrialBalancePilotView rows={finalTrialBalanceRows} />
        )}

        {selectedDocument === "final-tb-passenger-view" && (
          <PrintableFinalTrialBalancePassengerView rows={finalTrialBalanceRows} />
        )}

        {selectedDocument === "journals-passed" && (
          <PrintableJournalsPassed journals={postedJournals} loading={loadingPostedJournals} />
        )}

        {selectedDocument === "lead-sheets-used" && (
          <PrintableLeadSheetsUsed rows={usedLeadScheduleRows} />
        )}

        {selectedDocument === "subordination-agreements" && (
          <PrintableSubordinationAgreements />
        )}
      </section>
    </section>
  );
}

function PrintableFinalTrialBalancePilotView({
  rows,
}: {
  rows: { line: TrialBalanceLine; finalAmount: number }[];
}) {
  const totals = rows.reduce(
    (sum, row) => ({
      imported: sum.imported + preliminaryTrialBalanceAmount(row.line),
      journals: sum.journals + journalAdjustmentAmount(row.line),
      reclass: sum.reclass + reclassificationAmount(row.line),
      final: sum.final + row.finalAmount,
      prior: sum.prior + safeNumber(row.line.prior_year_balance),
    }),
    { imported: 0, journals: 0, reclass: 0, final: 0, prior: 0 },
  );

  return (
    <>
      <h3 style={styles.exportPrintTitle}>Final TB - Pilot View</h3>

      <table style={styles.exportTableCompact}>
        <thead>
          <tr>
            <th style={{ ...styles.exportTh, width: "10%" }}>Account</th>
            <th style={{ ...styles.exportTh, width: "24%" }}>Description</th>
            <th style={{ ...styles.exportThRight, width: "12%" }}>Imported balance</th>
            <th style={{ ...styles.exportThRight, width: "10%" }}>Journal adj.</th>
            <th style={{ ...styles.exportThRight, width: "10%" }}>Reclass.</th>
            <th style={{ ...styles.exportThRight, width: "12%" }}>Final AFS balance</th>
            <th style={{ ...styles.exportThRight, width: "10%" }}>Prior year</th>
            <th style={{ ...styles.exportTh, width: "12%" }}>Mapping</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const imported = preliminaryTrialBalanceAmount(row.line);
            const journals = journalAdjustmentAmount(row.line);
            const reclass = reclassificationAmount(row.line);
            const prior = safeNumber(row.line.prior_year_balance);
            const description = row.line.account_name || row.line.description || "";
            const mapping =
              row.line.mapping_label ||
              row.line.mapping_code ||
              row.line.lead_schedule_number ||
              "Unmapped";

            return (
              <tr key={row.line.id || row.line.account_code || row.line.account_name}>
                <td style={styles.exportTd}>{row.line.account_code}</td>
                <td style={styles.exportTd}>{description}</td>
                <td style={styles.exportTdRight}>{formatSignedMoneyCents(imported)}</td>
                <td style={styles.exportTdRight}>{formatSignedMoneyCents(journals)}</td>
                <td style={styles.exportTdRight}>{formatSignedMoneyCents(reclass)}</td>
                <td style={styles.exportTdRight}>{formatSignedMoneyCents(row.finalAmount)}</td>
                <td style={styles.exportTdRight}>{formatSignedMoneyCents(prior)}</td>
                <td style={styles.exportTd}>{mapping}</td>
              </tr>
            );
          })}
          <tr>
            <td style={styles.exportTotalTd} colSpan={2}>Total</td>
            <td style={styles.exportTotalTdRight}>{formatSignedMoneyCents(totals.imported)}</td>
            <td style={styles.exportTotalTdRight}>{formatSignedMoneyCents(totals.journals)}</td>
            <td style={styles.exportTotalTdRight}>{formatSignedMoneyCents(totals.reclass)}</td>
            <td style={styles.exportTotalTdRight}>{formatSignedMoneyCents(totals.final)}</td>
            <td style={styles.exportTotalTdRight}>{formatSignedMoneyCents(totals.prior)}</td>
            <td style={styles.exportTotalTd}></td>
          </tr>
        </tbody>
      </table>
    </>
  );
}


function PrintableFinalTrialBalancePassengerView({
  rows,
}: {
  rows: { line: TrialBalanceLine; finalAmount: number }[];
}) {
  const totals = rows.reduce(
    (sum, row) => ({
      final: sum.final + row.finalAmount,
      prior: sum.prior + safeNumber(row.line.prior_year_balance),
    }),
    { final: 0, prior: 0 },
  );

  return (
    <>
      <h3 style={styles.exportPrintTitle}>Final TB - Passenger View</h3>

      <table style={styles.exportTable}>
        <thead>
          <tr>
            <th style={{ ...styles.exportTh, width: "14%" }}>Account</th>
            <th style={{ ...styles.exportTh, width: "46%" }}>Description</th>
            <th style={{ ...styles.exportThRight, width: "20%" }}>
              Final current year
            </th>
            <th style={{ ...styles.exportThRight, width: "20%" }}>
              Final prior year
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const prior = safeNumber(row.line.prior_year_balance);
            const description = row.line.account_name || row.line.description || "";

            return (
              <tr key={row.line.id || row.line.account_code || row.line.account_name}>
                <td style={styles.exportTd}>{row.line.account_code}</td>
                <td style={styles.exportTd}>{description}</td>
                <td style={styles.exportTdRight}>
                  {formatSignedMoneyCents(row.finalAmount)}
                </td>
                <td style={styles.exportTdRight}>
                  {formatSignedMoneyCents(prior)}
                </td>
              </tr>
            );
          })}
          <tr>
            <td style={styles.exportTotalTd} colSpan={2}>
              Total
            </td>
            <td style={styles.exportTotalTdRight}>
              {formatSignedMoneyCents(totals.final)}
            </td>
            <td style={styles.exportTotalTdRight}>
              {formatSignedMoneyCents(totals.prior)}
            </td>
          </tr>
        </tbody>
      </table>
    </>
  );
}

function PrintableJournalsPassed({
  journals,
  loading,
}: {
  journals: PostedJournal[];
  loading: boolean;
}) {
  const sortedJournals = [...journals].sort((a, b) => {
    const dateCompare = String(a.journal_date || a.posted_at).localeCompare(
      String(b.journal_date || b.posted_at),
    );

    if (dateCompare !== 0) return dateCompare;
    return a.reference.localeCompare(b.reference);
  });

  return (
    <>
      <h3 style={styles.exportPrintTitle}>Journals Passed</h3>

      {loading ? (
        <p style={styles.exportEmpty}>Loading posted journals...</p>
      ) : sortedJournals.length === 0 ? (
        <p style={styles.exportEmpty}>No posted journals were found in the journal register.</p>
      ) : (
        <div style={styles.exportJournalList}>
          {sortedJournals.map((journal) => (
            <section key={journal.id} style={styles.exportJournalBlock}>
              <div style={styles.exportJournalHeader}>
                <div>
                  <strong>{journal.reference}</strong>
                  <span>{journal.description}</span>
                </div>
                <div style={styles.exportJournalMeta}>
                  <span>{journal.journal_date || journal.posted_at?.slice(0, 10) || ""}</span>
                  <strong>{journal.is_balanced ? "Balanced" : "Unbalanced"}</strong>
                </div>
              </div>

              <table style={styles.exportTableCompact}>
                <thead>
                  <tr>
                    <th style={styles.exportTh}>Account</th>
                    <th style={styles.exportTh}>Description</th>
                    <th style={styles.exportTh}>Note</th>
                    <th style={styles.exportThRight}>Debit</th>
                    <th style={styles.exportThRight}>Credit</th>
                  </tr>
                </thead>
                <tbody>
                  {journal.lines.map((line) => (
                    <tr key={line.id}>
                      <td style={styles.exportTd}>{line.account_code}</td>
                      <td style={styles.exportTd}>{line.account_name}</td>
                      <td style={styles.exportTd}>{line.note}</td>
                      <td style={styles.exportTdRight}>{formatMoney(line.debit)}</td>
                      <td style={styles.exportTdRight}>{formatMoney(line.credit)}</td>
                    </tr>
                  ))}
                  <tr>
                    <td style={styles.exportTotalTd} colSpan={3}>
                      Total
                    </td>
                    <td style={styles.exportTotalTdRight}>{formatMoney(journal.debit_total)}</td>
                    <td style={styles.exportTotalTdRight}>{formatMoney(journal.credit_total)}</td>
                  </tr>
                </tbody>
              </table>
            </section>
          ))}
        </div>
      )}
    </>
  );
}

function PrintableLeadSheetsUsed({
  rows,
}: {
  rows: { key: string; title: string; amount: number; count: number }[];
}) {
  return (
    <>
      <h3 style={styles.exportPrintTitle}>Lead Sheets Used</h3>

      {rows.length === 0 ? (
        <p style={styles.exportEmpty}>No lead schedules are currently linked to balances.</p>
      ) : (
        <table style={styles.exportTable}>
          <thead>
            <tr>
              <th style={styles.exportTh}>Lead sheet</th>
              <th style={styles.exportThRight}>Accounts</th>
              <th style={styles.exportThRight}>Balance</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.key}>
                <td style={styles.exportTd}>{row.title}</td>
                <td style={styles.exportTdRight}>{row.count}</td>
                <td style={styles.exportTdRight}>{formatMoney(row.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  );
}

function PrintableSubordinationAgreements() {
  return (
    <>
      <h3 style={styles.exportPrintTitle}>Subordination Agreements</h3>
      <p style={styles.exportEmpty}>
        Subordination agreement generation will be added after the Final Trial Balance
        and Journals Passed export pages are signed off.
      </p>
    </>
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
    position: "sticky",
    top: "54px",
    zIndex: 1500,
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
    top: "118px",
    maxHeight: "calc(100vh - 126px)",
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

  financialQuickNavShell: {
    position: "sticky",
    top: "96px",
    zIndex: 1450,
    background: "#eef4fb",
    borderBottom: "1px solid #cbd5e1",
    padding: "6px 8px 7px",
    margin: "0 -12px 8px",
  },
  financialQuickNav: {
    display: "flex",
    flexWrap: "wrap",
    gap: "5px",
    alignItems: "center",
    border: "1px solid #cbd5e1",
    background: "#f8fafc",
    padding: "6px",
    boxShadow: "0 2px 6px rgba(15, 23, 42, 0.08)",
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

  exportPanelShell: {
    display: "grid",
    gap: "10px",
  },
  exportToolbar: {
    background: "#ffffff",
    border: "1px solid #dbe3ef",
    borderRadius: "8px",
    padding: "10px",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "10px",
  },
  exportTitle: {
    margin: 0,
    color: "#0f172a",
    fontSize: "15px",
    fontWeight: 900,
  },
  exportSubtitle: {
    margin: "3px 0 0",
    color: "#64748b",
    fontSize: "11px",
  },
  exportPrimaryButton: {
    border: "1px solid #111827",
    background: "#111827",
    color: "#ffffff",
    padding: "7px 12px",
    fontSize: "12px",
    fontWeight: 850,
    cursor: "pointer",
    borderRadius: "6px",
    whiteSpace: "nowrap",
  },
  exportToolbarActions: {
    display: "flex",
    gap: "8px",
    alignItems: "center",
  },
  exportSecondaryButton: {
    border: "1px solid #cbd5e1",
    background: "#ffffff",
    color: "#0f172a",
    padding: "9px 13px",
    fontSize: "13px",
    fontWeight: 900,
    cursor: "pointer",
  },
  exportJournalList: {
    display: "grid",
    gap: "14px",
  },
  exportJournalBlock: {
    breakInside: "avoid",
    pageBreakInside: "avoid",
  },
  exportJournalHeader: {
    display: "flex",
    justifyContent: "space-between",
    gap: "12px",
    borderBottom: "1px solid #cbd5e1",
    paddingBottom: "7px",
    marginBottom: "7px",
    fontSize: "12px",
  },
  exportJournalMeta: {
    display: "grid",
    gap: "3px",
    textAlign: "right",
    color: "#334155",
  },
  exportTableCompact: {
    width: "100%",
    borderCollapse: "collapse",
    tableLayout: "fixed",
    fontSize: "10.25px",
    lineHeight: 1.18,
    marginBottom: "10px",
  },
  exportDocumentGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
    gap: "8px",
  },
  exportDocumentButton: {
    border: "1px solid #dbe3ef",
    background: "#ffffff",
    borderRadius: "8px",
    padding: "9px",
    textAlign: "left",
    cursor: "pointer",
    display: "grid",
    gap: "4px",
    color: "#0f172a",
  },
  exportDocumentButtonActive: {
    borderColor: "#1464b3",
    background: "#eff6ff",
  },
  exportPreviewPage: {
    width: "100%",
    maxWidth: "1180px",
    minHeight: "auto",
    background: "#ffffff",
    border: "1px solid #dbe3ef",
    boxShadow: "0 10px 30px rgba(15, 23, 42, 0.08)",
    padding: "28px 36px",
    boxSizing: "border-box",
    color: "#0f172a",
    fontSize: "11px",
    lineHeight: 1.28,
    overflowX: "auto",
  },
  exportPrintHeader: {
    borderBottom: "1px solid #0f172a",
    paddingBottom: "6px",
    marginBottom: "12px",
    display: "grid",
    gap: "2px",
  },
  exportPrintTitle: {
    margin: "0 0 10px",
    fontSize: "18px",
    color: "#0f172a",
    fontWeight: 900,
  },
  exportTable: {
    width: "100%",
    borderCollapse: "collapse",
    fontSize: "10.5px",
  },
  exportTh: {
    borderBottom: "1px solid #0f172a",
    padding: "4px 3px",
    textAlign: "left",
    fontWeight: 900,
    verticalAlign: "bottom",
  },
  exportThRight: {
    borderBottom: "1px solid #0f172a",
    padding: "4px 3px",
    textAlign: "right",
    fontWeight: 900,
    verticalAlign: "bottom",
  },
  exportTd: {
    borderBottom: "1px solid #e5e7eb",
    padding: "3px",
    verticalAlign: "top",
    overflowWrap: "anywhere",
  },
  exportTdRight: {
    borderBottom: "1px solid #e5e7eb",
    padding: "3px",
    textAlign: "right",
    verticalAlign: "top",
    whiteSpace: "nowrap",
    fontVariantNumeric: "tabular-nums",
  },
  exportRoundingTd: {
    borderTop: "1px solid #cbd5e1",
    background: "#f8fafc",
    color: "#334155",
    padding: "4px 3px",
    fontSize: "10px",
    fontStyle: "italic",
    verticalAlign: "top",
  },
  exportRoundingTdRight: {
    borderTop: "1px solid #cbd5e1",
    background: "#f8fafc",
    color: "#334155",
    padding: "4px 3px",
    fontSize: "10px",
    fontStyle: "italic",
    textAlign: "right",
    whiteSpace: "nowrap",
    fontVariantNumeric: "tabular-nums",
    verticalAlign: "top",
  },
  exportTotalTd: {
    borderTop: "1.5px solid #0f172a",
    padding: "5px 4px",
    fontWeight: 900,
  },
  exportTotalTdRight: {
    borderTop: "1.5px solid #0f172a",
    padding: "5px 4px",
    textAlign: "right",
    fontWeight: 900,
    whiteSpace: "nowrap",
  },
  exportEmpty: {
    color: "#475569",
    fontSize: "12px",
    margin: "0",
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
