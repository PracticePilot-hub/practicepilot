"use client";

import React, { useMemo, useState } from "react";
import type {
  DirectorsReportSectionKey,
  DirectorsReportTextOverrides,
} from "./AfsNarrativeBlocks";

type SectionRow = {
  key: DirectorsReportSectionKey;
  optionKey: string;
  label: string;
};

type Props = {
  reportOptions: Record<string, any>;
  toggleReportOption: (key: any, checked: boolean) => void;
  texts: DirectorsReportTextOverrides | Record<string, any> | null | undefined;
  defaults: DirectorsReportTextOverrides | Record<string, any> | null | undefined;
  onChangeTitle: (key: DirectorsReportSectionKey, value: string) => void;
  onChangeText: (key: DirectorsReportSectionKey, value: string) => void;
  onReset: (key: DirectorsReportSectionKey) => void;
  onResetAll: () => void;
  entityType?: string | null;
};

const allSections: SectionRow[] = [
  ["generalReview", "directorsReportGeneralReview", "General review"],
  ["incorporation", "directorsReportIncorporation", "Incorporation"],
  ["natureBusiness", "directorsReportNatureBusiness", "Nature of business"],
  ["reviewActivities", "directorsReportReviewActivities", "Review of activities"],
  ["financialResults", "directorsReportFinancialResults", "Financial results"],
  ["eventsAfter", "directorsReportEventsAfter", "Events after reporting date"],
  ["dividends", "directorsReportDividends", "Dividends"],
  ["shareCapital", "directorsReportShareCapital", "Share capital"],
  ["directors", "directorsReportDirectors", "Directors / members"],
  ["secretary", "directorsReportSecretary", "Secretary"],
  [
    "externalAccountant",
    "directorsReportExternalAccountant",
    "External accountant / compiler",
  ],
  ["interestContracts", "directorsReportInterestContracts", "Interests in contracts"],
  [
    "borrowingLimitations",
    "directorsReportBorrowingLimitations",
    "Borrowing limitations",
  ],
  ["shareholder", "directorsReportShareholder", "Shareholder matters"],
  ["goingConcern", "directorsReportGoingConcern", "Going concern"],
  ["liquiditySolvency", "directorsReportLiquiditySolvency", "Liquidity and solvency"],
  ["litigation", "directorsReportLitigation", "Litigation"],
  ["socialEthics", "directorsReportSocialEthics", "Social and ethics"],
  ["subsidiaries", "directorsReportSubsidiaries", "Subsidiaries"],
  ["associates", "directorsReportAssociates", "Associates"],
  ["jointVentures", "directorsReportJointVentures", "Joint ventures"],
  ["nonCurrentAssets", "directorsReportNonCurrentAssets", "Non-current assets"],
  ["authorisation", "directorsReportAuthorisation", "Authorisation"],
  ["other1", "directorsReportOther1", "Other disclosure 1"],
  ["other2", "directorsReportOther2", "Other disclosure 2"],
  ["other3", "directorsReportOther3", "Other disclosure 3"],
  ["other4", "directorsReportOther4", "Other disclosure 4"],
  ["other5", "directorsReportOther5", "Other disclosure 5"],
  ["other6", "directorsReportOther6", "Other disclosure 6"],
  ["other7", "directorsReportOther7", "Other disclosure 7"],
  ["other8", "directorsReportOther8", "Other disclosure 8"],
  ["other9", "directorsReportOther9", "Other disclosure 9"],
  ["other10", "directorsReportOther10", "Other disclosure 10"],
].map(([key, optionKey, label]) => ({
  key: key as DirectorsReportSectionKey,
  optionKey,
  label,
}));

function clean(value: unknown) {
  if (value === null || value === undefined) return "";
  return String(value);
}

function normaliseEntityType(value: unknown) {
  return String(value || "").trim().toLowerCase();
}

function isTrustEntity(value: unknown) {
  return normaliseEntityType(value).includes("trust");
}

function isCloseCorporationEntity(value: unknown) {
  const entity = normaliseEntityType(value);
  return (
    entity === "cc" ||
    entity.includes("close corporation") ||
    entity.includes("close-corporation")
  );
}

function hasOwnValue(
  source: any,
  key: DirectorsReportSectionKey,
  field: "title" | "text",
) {
  return Boolean(
    source &&
      source[key] &&
      Object.prototype.hasOwnProperty.call(source[key], field),
  );
}

const entityReportAllowedKeys = new Set<DirectorsReportSectionKey>([
  "generalReview",
  "incorporation",
  "natureBusiness",
  "reviewActivities",
  "financialResults",
  "eventsAfter",
  "dividends",
  "shareCapital",
  "directors",
  "externalAccountant",
  "interestContracts",
  "borrowingLimitations",
  "goingConcern",
  "liquiditySolvency",
  "litigation",
  "nonCurrentAssets",
  "authorisation",
  "other1",
  "other2",
  "other3",
  "other4",
  "other5",
  "other6",
  "other7",
  "other8",
  "other9",
  "other10",
]);

function entitySections(entityType: unknown) {
  const isTrust = isTrustEntity(entityType);
  const isCc = isCloseCorporationEntity(entityType);

  if (!isTrust && !isCc) return allSections;

  return allSections
    .filter((section) => entityReportAllowedKeys.has(section.key))
    .map((section) => {
      if (isCc) {
        if (section.key === "incorporation") {
          return { ...section, label: "Registration" };
        }
        if (section.key === "natureBusiness") {
          return { ...section, label: "Nature of the close corporation and its activities" };
        }
        if (section.key === "dividends") {
          return { ...section, label: "Distributions" };
        }
        if (section.key === "shareCapital") {
          return { ...section, label: "Member's contribution" };
        }
        if (section.key === "directors") {
          return { ...section, label: "Members" };
        }
        if (section.key === "externalAccountant") {
          return { ...section, label: "Accounting officer / compiler" };
        }
        if (section.key === "interestContracts") {
          return { ...section, label: "Members’ interests / related matters" };
        }
        if (section.key === "authorisation") {
          return { ...section, label: "Approval and authorisation" };
        }
      }

      if (isTrust) {
        if (section.key === "incorporation") {
          return { ...section, label: "Trust registration" };
        }
        if (section.key === "natureBusiness") {
          return { ...section, label: "Nature of the trust and its activities" };
        }
        if (section.key === "reviewActivities") {
          return { ...section, label: "Review of trust activities" };
        }
        if (section.key === "dividends") {
          return { ...section, label: "Distributions to beneficiaries" };
        }
        if (section.key === "shareCapital") {
          return { ...section, label: "Trust capital and accumulated funds" };
        }
        if (section.key === "directors") {
          return { ...section, label: "Trustees" };
        }
        if (section.key === "interestContracts") {
          return { ...section, label: "Trustee interests / related matters" };
        }
        if (section.key === "authorisation") {
          return { ...section, label: "Approval and authorisation" };
        }
      }

      return section;
    });
}

export default function AfsDirectorsReportSettings({
  reportOptions,
  toggleReportOption,
  texts,
  defaults,
  onChangeTitle,
  onChangeText,
  onReset,
  onResetAll,
  entityType = null,
}: Props) {
  const [openKey, setOpenKey] =
    useState<DirectorsReportSectionKey | null>(null);

  const isTrust = isTrustEntity(entityType);
  const isCc = isCloseCorporationEntity(entityType);

  const sections = useMemo(
    () => entitySections(entityType),
    [entityType],
  );

  const enabledCount = useMemo(
    () =>
      sections.filter((section) =>
        Boolean(reportOptions?.[section.optionKey]),
      ).length,
    [reportOptions, sections],
  );

  function itemTitle(key: DirectorsReportSectionKey) {
    return clean(
      hasOwnValue(texts, key, "title")
        ? (texts as any)?.[key]?.title
        : (defaults as any)?.[key]?.title,
    );
  }

  function itemText(key: DirectorsReportSectionKey) {
    return clean(
      hasOwnValue(texts, key, "text")
        ? (texts as any)?.[key]?.text
        : (defaults as any)?.[key]?.text,
    );
  }

  const reportName = isCc
    ? "Members’ Report"
    : isTrust
      ? "Trustees’ Report"
      : "Directors’ Report";

  return (
    <div style={styles.wrap}>
      <div style={styles.headerRow}>
        <div>
          <strong>{reportName} sections</strong>
          <div style={styles.small}>
            Switch sections on/off and edit wording where needed.
          </div>
        </div>

        <button type="button" onClick={onResetAll} style={styles.smallButton}>
          Defaults
        </button>
      </div>

      <div style={styles.counter}>
        {enabledCount}/{sections.length} switched on
      </div>

      {sections.map((section) => {
        const enabled = Boolean(reportOptions?.[section.optionKey]);
        const isOpen = openKey === section.key;

        return (
          <div key={section.key} style={styles.sectionRow}>
            <div style={styles.lineRow}>
              <label style={styles.checkLabel}>
                <input
                  type="checkbox"
                  checked={enabled}
                  onChange={(event) =>
                    toggleReportOption(section.optionKey, event.target.checked)
                  }
                />
                <span>{section.label}</span>
              </label>

              <div style={styles.actions}>
                <button
                  type="button"
                  onClick={() => setOpenKey(isOpen ? null : section.key)}
                  style={styles.smallButton}
                >
                  {isOpen ? "Close" : "Edit"}
                </button>

                <button
                  type="button"
                  onClick={() => onReset(section.key)}
                  style={styles.smallButton}
                >
                  Default
                </button>
              </div>
            </div>

            {isOpen ? (
              <div style={styles.editor}>
                <input
                  value={itemTitle(section.key)}
                  onChange={(event) =>
                    onChangeTitle(section.key, event.target.value)
                  }
                  style={styles.input}
                />

                <textarea
                  value={itemText(section.key)}
                  onChange={(event) =>
                    onChangeText(section.key, event.target.value)
                  }
                  rows={5}
                  style={styles.textarea}
                />

                <div style={styles.small}>
                  Disabled sections are hidden completely in the final AFS.
                </div>
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  wrap: { display: "grid", gap: 8, fontSize: 12 },
  headerRow: {
    display: "flex",
    justifyContent: "space-between",
    gap: 8,
    alignItems: "start",
  },
  small: {
    fontSize: 10,
    color: "#64748b",
    lineHeight: 1.35,
    marginTop: 2,
  },
  counter: {
    fontSize: 10,
    color: "#047857",
    fontWeight: 800,
    textAlign: "right",
  },
  sectionRow: {
    border: "1px solid #e5e7eb",
    background: "#ffffff",
    padding: 6,
  },
  lineRow: {
    display: "flex",
    justifyContent: "space-between",
    gap: 6,
    alignItems: "center",
  },
  checkLabel: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    fontWeight: 800,
    color: "#111827",
  },
  actions: { display: "flex", gap: 4 },
  smallButton: {
    border: "1px solid #cbd5e1",
    background: "#ffffff",
    padding: "3px 6px",
    fontSize: 10,
    fontWeight: 800,
    cursor: "pointer",
  },
  editor: { display: "grid", gap: 5, marginTop: 6 },
  input: {
    width: "100%",
    border: "1px solid #7A9FC8",
    background: "#EAF3FF",
    color: "#111827",
    padding: "5px 6px",
    fontSize: 11,
    outlineColor: "#2563EB",
  },
  textarea: {
    width: "100%",
    border: "1px solid #7A9FC8",
    background: "#EAF3FF",
    color: "#111827",
    padding: 6,
    fontSize: 11,
    lineHeight: 1.35,
    resize: "vertical",
    fontFamily: "inherit",
    outlineColor: "#2563EB",
  },
};
