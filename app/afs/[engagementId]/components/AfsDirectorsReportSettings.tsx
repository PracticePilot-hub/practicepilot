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
};

const sections: SectionRow[] = [
  { key: "generalReview", optionKey: "directorsReportGeneralReview", label: "General review" },
  { key: "incorporation", optionKey: "directorsReportIncorporation", label: "Incorporation" },
  { key: "natureBusiness", optionKey: "directorsReportNatureBusiness", label: "Nature of business" },
  { key: "reviewActivities", optionKey: "directorsReportReviewActivities", label: "Review of activities" },
  { key: "financialResults", optionKey: "directorsReportFinancialResults", label: "Financial results" },
  { key: "eventsAfter", optionKey: "directorsReportEventsAfter", label: "Events after reporting date" },
  { key: "dividends", optionKey: "directorsReportDividends", label: "Dividends" },
  { key: "shareCapital", optionKey: "directorsReportShareCapital", label: "Share capital" },
  { key: "directors", optionKey: "directorsReportDirectors", label: "Directors / members" },
  { key: "secretary", optionKey: "directorsReportSecretary", label: "Secretary" },
  { key: "externalAccountant", optionKey: "directorsReportExternalAccountant", label: "External accountant / compiler" },
  { key: "interestContracts", optionKey: "directorsReportInterestContracts", label: "Interests in contracts" },
  { key: "borrowingLimitations", optionKey: "directorsReportBorrowingLimitations", label: "Borrowing limitations" },
  { key: "shareholder", optionKey: "directorsReportShareholder", label: "Shareholder matters" },
  { key: "goingConcern", optionKey: "directorsReportGoingConcern", label: "Going concern" },
  { key: "liquiditySolvency", optionKey: "directorsReportLiquiditySolvency", label: "Liquidity and solvency" },
  { key: "litigation", optionKey: "directorsReportLitigation", label: "Litigation" },
  { key: "socialEthics", optionKey: "directorsReportSocialEthics", label: "Social and ethics" },
  { key: "subsidiaries", optionKey: "directorsReportSubsidiaries", label: "Subsidiaries" },
  { key: "associates", optionKey: "directorsReportAssociates", label: "Associates" },
  { key: "jointVentures", optionKey: "directorsReportJointVentures", label: "Joint ventures" },
  { key: "nonCurrentAssets", optionKey: "directorsReportNonCurrentAssets", label: "Non-current assets" },
  { key: "authorisation", optionKey: "directorsReportAuthorisation", label: "Authorisation" },
  { key: "other1", optionKey: "directorsReportOther1", label: "Other disclosure 1" },
  { key: "other2", optionKey: "directorsReportOther2", label: "Other disclosure 2" },
  { key: "other3", optionKey: "directorsReportOther3", label: "Other disclosure 3" },
  { key: "other4", optionKey: "directorsReportOther4", label: "Other disclosure 4" },
  { key: "other5", optionKey: "directorsReportOther5", label: "Other disclosure 5" },
  { key: "other6", optionKey: "directorsReportOther6", label: "Other disclosure 6" },
  { key: "other7", optionKey: "directorsReportOther7", label: "Other disclosure 7" },
  { key: "other8", optionKey: "directorsReportOther8", label: "Other disclosure 8" },
  { key: "other9", optionKey: "directorsReportOther9", label: "Other disclosure 9" },
  { key: "other10", optionKey: "directorsReportOther10", label: "Other disclosure 10" },
];

function clean(value: unknown) {
  if (value === null || value === undefined) return "";
  return String(value);
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
}: Props) {
  const [openKey, setOpenKey] = useState<DirectorsReportSectionKey | null>(null);

  const enabledCount = useMemo(
    () => sections.filter((section) => Boolean(reportOptions?.[section.optionKey])).length,
    [reportOptions]
  );

  function itemTitle(key: DirectorsReportSectionKey) {
    const current = (texts as any)?.[key]?.title;
    const fallback = (defaults as any)?.[key]?.title;
    return clean(current || fallback);
  }

  function itemText(key: DirectorsReportSectionKey) {
    const current = (texts as any)?.[key]?.text;
    const fallback = (defaults as any)?.[key]?.text;
    return clean(current || fallback);
  }

  return (
    <div style={styles.wrap}>
      <div style={styles.headerRow}>
        <div>
          <strong>Directors’ Report sections</strong>
          <div style={styles.small}>Switch sections on/off and edit wording where needed.</div>
        </div>
        <button type="button" onClick={onResetAll} style={styles.smallButton}>
          Defaults
        </button>
      </div>

      <div style={styles.counter}>{enabledCount}/{sections.length} switched on</div>

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
                  onChange={(event) => toggleReportOption(section.optionKey, event.target.checked)}
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
                <button type="button" onClick={() => onReset(section.key)} style={styles.smallButton}>
                  Default
                </button>
              </div>
            </div>

            {isOpen ? (
              <div style={styles.editor}>
                <input
                  value={itemTitle(section.key)}
                  onChange={(event) => onChangeTitle(section.key, event.target.value)}
                  style={styles.input}
                />
                <textarea
                  value={itemText(section.key)}
                  onChange={(event) => onChangeText(section.key, event.target.value)}
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
  headerRow: { display: "flex", justifyContent: "space-between", gap: 8, alignItems: "start" },
  small: { fontSize: 10, color: "#64748b", lineHeight: 1.35, marginTop: 2 },
  counter: { fontSize: 10, color: "#047857", fontWeight: 800, textAlign: "right" },
  sectionRow: { border: "1px solid #e5e7eb", background: "#ffffff", padding: 6 },
  lineRow: { display: "flex", justifyContent: "space-between", gap: 6, alignItems: "center" },
  checkLabel: { display: "flex", alignItems: "center", gap: 6, fontWeight: 800, color: "#111827" },
  actions: { display: "flex", gap: 4 },
  smallButton: { border: "1px solid #cbd5e1", background: "#ffffff", padding: "3px 6px", fontSize: 10, fontWeight: 800, cursor: "pointer" },
  editor: { display: "grid", gap: 5, marginTop: 6 },
  input: { width: "100%", border: "1px solid #cbd5e1", padding: "5px 6px", fontSize: 11 },
  textarea: { width: "100%", border: "1px solid #cbd5e1", padding: "6px", fontSize: 11, lineHeight: 1.35, resize: "vertical", fontFamily: "inherit" },
};
