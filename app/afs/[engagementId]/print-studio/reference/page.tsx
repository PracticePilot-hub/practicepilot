"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import {
  buildSharedOtherFinancialLiabilityRows,
  buildSharedShareholderLoanRows,
} from "../AfsSharedStructuredNoteData";
import styles from "./AfsReferenceDocument.module.css";

type Engagement = {
  id: string;
  client_name?: string | null;
  financial_year_end?: string | null;
};

type TrialBalanceLine = Record<string, any>;
type StructuredState = Record<string, any>;

const indexRows = [
  ["Director's Responsibilities and Approval", "3"],
  ["Director's Report", "4"],
  ["Practitioner's Compilation Report", "5"],
  ["Statement of Financial Position", "6"],
  ["Statement of Comprehensive Income", "7"],
  ["Statement of Changes in Equity", "8"],
  ["Statement of Cash Flows", "9"],
  ["Accounting Policies", "10 - 11"],
  ["Notes to the Financial Statements", "12 - 14"],
  ["Detailed Income Statement", "15"],
];

function clean(value: unknown) {
  return String(value || "").trim();
}

function numberValue(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatAmount(value: unknown) {
  const amount = Math.round(numberValue(value));
  const absolute = Math.abs(amount).toLocaleString("en-ZA").replace(/,/g, " ");
  return amount < 0 ? `(${absolute})` : absolute;
}

function formatLongDate(value: unknown) {
  const raw = clean(value);
  if (!raw) return "";

  const date = new Date(`${raw}T00:00:00`);
  if (Number.isNaN(date.getTime())) return raw;

  return new Intl.DateTimeFormat("en-ZA", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(date);
}

function yearFromDate(value: unknown) {
  const raw = clean(value);
  const match = raw.match(/^(\d{4})/);
  return match?.[1] || "";
}

function splitLines(value: unknown) {
  return clean(value)
    .split(/\r?\n|,\s*/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function Page({
  children,
  number,
  className = "",
}: {
  children: React.ReactNode;
  number: number;
  className?: string;
}) {
  return (
    <article className={`${styles.page} ${className}`}>
      {children}
      <footer className={styles.footer}>
        <span>{number}</span>
      </footer>
    </article>
  );
}

function Title({ children }: { children: React.ReactNode }) {
  return <h1 className={styles.pageTitle}>{children}</h1>;
}

function Amount({ children }: { children: React.ReactNode }) {
  return <td className={styles.amount}>{children}</td>;
}

export default function AfsReferencePage() {
  const params = useParams<{ engagementId: string }>();
  const engagementId = String(params?.engagementId || "");

  const [loading, setLoading] = useState(true);
  const [engagement, setEngagement] = useState<Engagement | null>(null);
  const [clientSetup, setClientSetup] = useState<Record<string, any>>({});
  const [trialBalanceLines, setTrialBalanceLines] = useState<TrialBalanceLine[]>([]);
  const [people, setPeople] = useState<Record<string, any>[]>([]);
  const [structuredNotesState, setStructuredNotesState] =
    useState<StructuredState>({});
  const [firmSettings, setFirmSettings] = useState<Record<string, any>>({});

  useEffect(() => {
    if (!engagementId) return;

    let cancelled = false;

    async function load() {
      setLoading(true);

      try {
        const [engagementResponse, setupResponse, settingsResponse] =
          await Promise.all([
            fetch(`/api/afs/engagements/${engagementId}`, {
              cache: "no-store",
            }),
            fetch(`/api/afs/engagements/${engagementId}/client-setup`, {
              cache: "no-store",
            }),
            fetch(
              `/api/afs/engagements/${engagementId}/print-studio-settings`,
              {
                cache: "no-store",
              },
            ),
          ]);

        const engagementData = await engagementResponse.json();
        const setupData = await setupResponse.json();
        const settingsData = await settingsResponse.json();

        if (cancelled) return;

        setEngagement(
          setupData.engagement ||
            engagementData.engagement ||
            engagementData.data ||
            null,
        );

        setClientSetup(
          setupData.setup ||
            setupData.clientSetup ||
            setupData.client_setup ||
            {},
        );

        setTrialBalanceLines(
          engagementData.trialBalanceLines ||
            engagementData.trial_balance_lines ||
            engagementData.lines ||
            [],
        );

        setPeople(
          setupData.people ||
            setupData.clientPeople ||
            setupData.client_people ||
            setupData.directors ||
            [],
        );

        setStructuredNotesState(
          settingsData.structuredNotesState ||
            settingsData.structured_notes_state ||
            settingsData.settings?.structuredNotesState ||
            settingsData.settings?.structured_notes_state ||
            {},
        );

        setFirmSettings(
          settingsData.firmSettings ||
            settingsData.firm_settings ||
            {},
        );
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, [engagementId]);

  const clientName =
    clean(engagement?.client_name) ||
    clean(clientSetup.client_name) ||
    clean(clientSetup.registered_name) ||
    "Client";

  const registrationNumber =
    clean(clientSetup.registration_number) ||
    clean(clientSetup.company_registration_number);

  const yearEndRaw =
    clean(engagement?.financial_year_end) ||
    clean(clientSetup.financial_year_end);

  const yearEndLong = formatLongDate(yearEndRaw);
  const currentYear = yearFromDate(yearEndRaw) || "Current";
  const priorYear = currentYear
    ? String(Number(currentYear) - 1)
    : "Prior";

  const directors = people
    .filter((person) => {
      const role = [
        person.role,
        person.type,
        person.person_type,
        person.capacity,
        person.designation,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return role.includes("director") || role.includes("member");
    })
    .map(
      (person) =>
        clean(person.full_name) ||
        clean(person.person_name) ||
        clean(person.name),
    )
    .filter(Boolean);

  const shareholderRows = useMemo(
    () => buildSharedShareholderLoanRows(trialBalanceLines, []),
    [trialBalanceLines],
  );

  const otherLiabilityRows = useMemo(
    () => buildSharedOtherFinancialLiabilityRows(trialBalanceLines, []),
    [trialBalanceLines],
  );

  const shareholderRowsWithText = shareholderRows.map((row, index) => {
    const key = String(row.id || row.label || index);
    const saved = structuredNotesState.shareholderLoans?.[key] || {};

    return {
      ...row,
      displayLabel: clean(saved.label) || row.label,
      terms:
        clean(saved.terms) ||
        "The loan is unsecured, bears no interest and has no fixed repayment terms.",
    };
  });

  const otherRowsWithText = otherLiabilityRows.map((row, index) => {
    const key = String(row.id || row.label || index);
    const saved = structuredNotesState.otherFinancialLiabilities?.[key] || {};

    return {
      ...row,
      displayLabel: clean(saved.label) || row.label,
      terms:
        clean(saved.terms) ||
        "The liability is unsecured, bears no interest and has no fixed repayment terms.",
    };
  });

  const shareholderCurrent = shareholderRowsWithText.reduce(
    (sum, row) => sum + numberValue(row.current),
    0,
  );
  const shareholderPrior = shareholderRowsWithText.reduce(
    (sum, row) => sum + numberValue(row.prior),
    0,
  );
  const otherCurrent = otherRowsWithText.reduce(
    (sum, row) => sum + numberValue(row.current),
    0,
  );
  const otherPrior = otherRowsWithText.reduce(
    (sum, row) => sum + numberValue(row.prior),
    0,
  );

  const authorisedShares =
    numberValue(structuredNotesState.shareCapital?.authorisedShares) ||
    numberValue(clientSetup.authorised_ordinary_shares) ||
    100;

  const authorisedPar =
    numberValue(structuredNotesState.shareCapital?.authorisedPar) ||
    numberValue(clientSetup.authorised_ordinary_share_par_value) ||
    1;

  const issuedShares =
    numberValue(structuredNotesState.shareCapital?.issuedShares) ||
    numberValue(clientSetup.issued_ordinary_shares) ||
    100;

  const issuedPar =
    numberValue(structuredNotesState.shareCapital?.issuedPar) ||
    numberValue(clientSetup.issued_ordinary_share_par_value) ||
    1;

  const shareRights =
    clean(structuredNotesState.shareCapital?.rightsText) ||
    "The shares rank equally with regard to voting rights and dividends.";

  function RunningHeader() {
    return (
      <header className={styles.runningHeader}>
        <div className={styles.entityName}>{clientName}</div>
        {registrationNumber ? (
          <div>Registration number: {registrationNumber}</div>
        ) : null}
        {yearEndLong ? (
          <div>
            Annual financial statements for the year ended {yearEndLong}
          </div>
        ) : null}
      </header>
    );
  }

  if (loading) {
    return <main className={styles.document}>Loading reference document…</main>;
  }

  return (
    <main className={styles.document}>
      <Page number={1} className={styles.cover}>
        <section className={styles.coverBlock}>
          <div className={styles.coverEntity}>{clientName.toUpperCase()}</div>
          <div className={styles.coverRule} />
          <div className={styles.coverTitle}>ANNUAL FINANCIAL STATEMENTS</div>
          <div className={styles.coverYear}>
            for the year ended {yearEndLong}
          </div>
          <div className={styles.coverSmall}>
            These annual financial statements are unaudited.
          </div>
          {registrationNumber ? (
            <div className={styles.coverRegistration}>
              Registration number: {registrationNumber}
            </div>
          ) : null}
        </section>
      </Page>

      <Page number={2}>
        <RunningHeader />
        <Title>Index</Title>
        <p className={styles.indexIntro}>
          The reports and statements set out below comprise the annual financial
          statements presented to the shareholders:
        </p>
        <div className={styles.indexPageHeading}>Page</div>
        <table className={styles.indexTable}>
          <tbody>
            {indexRows.map(([label, page]) => (
              <tr key={label}>
                <td>{label}</td>
                <td>{page}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Page>

      <Page number={3}>
        <RunningHeader />
        <Title>General Information</Title>
        <table className={styles.infoTable}>
          <tbody>
            <tr>
              <th>Country of incorporation and domicile</th>
              <td>{clean(clientSetup.country) || "South Africa"}</td>
            </tr>
            <tr>
              <th>Nature of business and principal activities</th>
              <td>
                {clean(clientSetup.nature_of_business) ||
                  clean(clientSetup.principal_activities)}
              </td>
            </tr>
            <tr>
              <th>Directors</th>
              <td>
                {(directors.length ? directors : ["—"]).map((name) => (
                  <div key={name}>{name}</div>
                ))}
              </td>
            </tr>
            <tr>
              <th>Registered office</th>
              <td>
                {splitLines(
                  clientSetup.registered_address ||
                    clientSetup.registered_office,
                ).map((line) => (
                  <div key={line}>{line}</div>
                ))}
              </td>
            </tr>
            <tr>
              <th>Business address</th>
              <td>
                {splitLines(
                  clientSetup.business_address ||
                    clientSetup.physical_address,
                ).map((line) => (
                  <div key={line}>{line}</div>
                ))}
              </td>
            </tr>
            <tr>
              <th>Tax reference number</th>
              <td>
                {clean(clientSetup.income_tax_reference_number) ||
                  clean(clientSetup.tax_reference_number)}
              </td>
            </tr>
            <tr>
              <th>Currency</th>
              <td>{clean(clientSetup.currency) || "Rand"}</td>
            </tr>
            <tr>
              <th>Financial reporting framework</th>
              <td>
                {clean(clientSetup.financial_reporting_framework) ||
                  "IFRS for SMEs"}
              </td>
            </tr>
            <tr>
              <th>Level of assurance</th>
              <td>{clean(clientSetup.level_of_assurance) || "Compilation"}</td>
            </tr>
            <tr>
              <th>Practitioners</th>
              <td>
                <div>{clean(firmSettings.firm_name)}</div>
                <div>{clean(firmSettings.practitioner_designation)}</div>
                {splitLines(firmSettings.address_lines).map((line) => (
                  <div key={line}>{line}</div>
                ))}
              </td>
            </tr>
          </tbody>
        </table>
      </Page>

      <Page number={12}>
        <RunningHeader />
        <Title>Notes to the Financial Statements</Title>
        <div className={styles.figureLine}>
          Figures in Rand
          <span>
            {currentYear}&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;
            {priorYear}
          </span>
        </div>

        <section className={styles.noteSection}>
          <h2>4. Share capital</h2>

          <h3>Authorised</h3>
          <table className={styles.noteTable}>
            <tbody>
              <tr>
                <td>
                  {authorisedShares} ordinary shares of R{authorisedPar} each
                </td>
                <Amount>{formatAmount(authorisedShares * authorisedPar)}</Amount>
                <Amount>{formatAmount(authorisedShares * authorisedPar)}</Amount>
              </tr>
            </tbody>
          </table>

          <h3>Issued</h3>
          <table className={styles.noteTable}>
            <tbody>
              <tr>
                <td>Ordinary shares at end of year</td>
                <Amount>{formatAmount(issuedShares * issuedPar)}</Amount>
                <Amount>{formatAmount(issuedShares * issuedPar)}</Amount>
              </tr>
            </tbody>
          </table>

          <p>{shareRights}</p>
        </section>

        <section className={styles.noteSection}>
          <h2>5. Shareholders&apos; loans</h2>
          <table className={styles.noteTable}>
            <tbody>
              {shareholderRowsWithText.map((row) => (
                <Fragment key={String(row.id || row.displayLabel)}>
                  <tr key={`${row.id}-amount`}>
                    <td>{row.displayLabel}</td>
                    <Amount>{formatAmount(row.current)}</Amount>
                    <Amount>{formatAmount(row.prior)}</Amount>
                  </tr>
                  <tr key={`${row.id}-terms`}>
                    <td colSpan={3}>{row.terms}</td>
                  </tr>
                </Fragment>
              ))}
              <tr className={styles.noteTotal}>
                <td>Net loans from shareholders</td>
                <Amount>{formatAmount(shareholderCurrent)}</Amount>
                <Amount>{formatAmount(shareholderPrior)}</Amount>
              </tr>
            </tbody>
          </table>
        </section>

        <section className={styles.noteSection}>
          <h2>6. Other financial liabilities</h2>
          <table className={styles.noteTable}>
            <tbody>
              {otherRowsWithText.map((row) => (
                <Fragment key={String(row.id || row.displayLabel)}>
                  <tr key={`${row.id}-amount`}>
                    <td>{row.displayLabel}</td>
                    <Amount>{formatAmount(row.current)}</Amount>
                    <Amount>{formatAmount(row.prior)}</Amount>
                  </tr>
                  <tr key={`${row.id}-terms`}>
                    <td colSpan={3}>{row.terms}</td>
                  </tr>
                </Fragment>
              ))}
              <tr className={styles.noteTotal}>
                <td>Total other financial liabilities</td>
                <Amount>{formatAmount(otherCurrent)}</Amount>
                <Amount>{formatAmount(otherPrior)}</Amount>
              </tr>
            </tbody>
          </table>
        </section>
      </Page>
    </main>
  );
}
