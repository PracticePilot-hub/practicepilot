"use client";

import { useState } from "react";
import {
  DirectorsReportSectionKey,
  DirectorsReportTextOverrides,
} from "./AfsNarrativeBlocks";

type ReportOptionsLike = Record<string, boolean>;

type Props = {
  reportOptions: ReportOptionsLike;
  toggleReportOption: (key: string, checked: boolean) => void;
  texts: DirectorsReportTextOverrides;
  defaults: DirectorsReportTextOverrides;
  onChangeTitle: (key: DirectorsReportSectionKey, value: string) => void;
  onChangeText: (key: DirectorsReportSectionKey, value: string) => void;
  onReset: (key: DirectorsReportSectionKey) => void;
  onResetAll: () => void;
};

type SectionConfig = {
  key: DirectorsReportSectionKey;
  optionKey: string;
  label: string;
  textEditable?: boolean;
};

const sections: SectionConfig[] = [
  { key: "generalReview", optionKey: "directorsReportGeneralReview", label: "General review" },
  { key: "incorporation", optionKey: "directorsReportIncorporation", label: "Incorporation" },
  { key: "natureBusiness", optionKey: "directorsReportNatureBusiness", label: "Nature of business" },
  { key: "reviewActivities", optionKey: "directorsReportReviewActivities", label: "Review of activities" },
  { key: "financialResults", optionKey: "directorsReportFinancialResults", label: "Financial results" },
  { key: "eventsAfter", optionKey: "directorsReportEventsAfter", label: "Events after reporting date" },
  { key: "dividends", optionKey: "directorsReportDividends", label: "Dividends" },
  { key: "shareCapital", optionKey: "directorsReportShareCapital", label: "Share capital" },
  { key: "directors", optionKey: "directorsReportDirectors", label: "Directors / members / trustees", textEditable: false },
  { key: "secretary", optionKey: "directorsReportSecretary", label: "Secretary" },
  { key: "externalAccountant", optionKey: "directorsReportExternalAccountant", label: "External accountant / compiler" },
  { key: "interestContracts", optionKey: "directorsReportInterestContracts", label: "Interest in contracts" },
  { key: "borrowingLimitations", optionKey: "directorsReportBorrowingLimitations", label: "Borrowing limitations" },
  { key: "shareholder", optionKey: "directorsReportShareholder", label: "Shareholder" },
  { key: "goingConcern", optionKey: "directorsReportGoingConcern", label: "Going concern" },
  { key: "liquiditySolvency", optionKey: "directorsReportLiquiditySolvency", label: "Liquidity and solvency" },
  { key: "litigation", optionKey: "directorsReportLitigation", label: "Litigation" },
  { key: "socialEthics", optionKey: "directorsReportSocialEthics", label: "Social and ethics committee" },
  { key: "subsidiaries", optionKey: "directorsReportSubsidiaries", label: "Interest in subsidiaries" },
  { key: "associates", optionKey: "directorsReportAssociates", label: "Interest in associates" },
  { key: "jointVentures", optionKey: "directorsReportJointVentures", label: "Joint ventures" },
  { key: "nonCurrentAssets", optionKey: "directorsReportNonCurrentAssets", label: "Non-current assets" },
  { key: "authorisation", optionKey: "directorsReportAuthorisation", label: "Authorisation" },
  { key: "other1", optionKey: "directorsReportOther1", label: "Other matter 1" },
  { key: "other2", optionKey: "directorsReportOther2", label: "Other matter 2" },
  { key: "other3", optionKey: "directorsReportOther3", label: "Other matter 3" },
  { key: "other4", optionKey: "directorsReportOther4", label: "Other matter 4" },
  { key: "other5", optionKey: "directorsReportOther5", label: "Other matter 5" },
  { key: "other6", optionKey: "directorsReportOther6", label: "Other matter 6" },
  { key: "other7", optionKey: "directorsReportOther7", label: "Other matter 7" },
  { key: "other8", optionKey: "directorsReportOther8", label: "Other matter 8" },
  { key: "other9", optionKey: "directorsReportOther9", label: "Other matter 9" },
  { key: "other10", optionKey: "directorsReportOther10", label: "Other matter 10" },
];

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
  const [openEditorKey, setOpenEditorKey] =
    useState<DirectorsReportSectionKey | null>(null);

  function confirmReset(sectionKey: DirectorsReportSectionKey, sectionTitle: string) {
    const confirmed = window.confirm(
      `Reset "${sectionTitle}" to the PracticePilot default wording?\n\nThis will discard your custom title and wording for this section.`
    );

    if (confirmed) {
      onReset(sectionKey);
    }
  }

  function confirmResetAll() {
    const confirmed = window.confirm(
      "Reset ALL Directors’ Report sections to PracticePilot defaults?\n\nThis will discard all custom Directors’ Report titles and wording."
    );

    if (confirmed) {
      onResetAll();
    }
  }

  return (
    <div style={{ display: "grid", gap: 7 }}>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0, 1fr) auto",
          gap: 8,
          alignItems: "start",
          paddingBottom: 8,
          borderBottom: "1px solid #e5e7eb",
        }}
      >
        <div>
          <div style={{ fontSize: 10, color: "#6b7280", lineHeight: 1.35 }}>
            Tick to include a section. Click Edit only when wording needs to change.
          </div>

          <div
            style={{
              marginTop: 4,
              fontSize: 9,
              color: "#047857",
              fontWeight: 700,
            }}
          >
            Changes auto-save while editing.
          </div>
        </div>

        <button
          type="button"
          onClick={confirmResetAll}
          style={{
            height: 24,
            border: "1px solid #cbd5e1",
            background: "#ffffff",
            fontSize: 10,
            fontWeight: 700,
            padding: "0 7px",
            cursor: "pointer",
            whiteSpace: "nowrap",
          }}
        >
          Defaults
        </button>
      </div>

      {sections.map((section) => {
        const checked = Boolean(reportOptions[section.optionKey]);
        const current = texts[section.key] || defaults[section.key];
        const defaultText = defaults[section.key];
        const changed =
          current.title !== defaultText.title || current.text !== defaultText.text;
        const editorOpen = openEditorKey === section.key;
        const visibleTitle = current.title || section.label;

        return (
          <div
            key={section.key}
            style={{
              border: "1px solid #e5e7eb",
              background: checked ? "#ffffff" : "#f9fafb",
              padding: 7,
            }}
          >
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "16px minmax(0, 1fr) auto auto",
                gap: 6,
                alignItems: "center",
              }}
            >
              <input
                type="checkbox"
                checked={checked}
                onChange={(event) =>
                  toggleReportOption(section.optionKey, event.target.checked)
                }
              />

              <div
                style={{
                  fontSize: 11,
                  lineHeight: "14px",
                  fontWeight: 800,
                  color: checked ? "#111827" : "#6b7280",
                  minWidth: 0,
                }}
              >
                {visibleTitle}

                {changed ? (
                  <span
                    style={{
                      marginLeft: 6,
                      fontSize: 9,
                      color: "#92400e",
                      fontWeight: 800,
                    }}
                  >
                    Edited
                  </span>
                ) : null}
              </div>

              <button
                type="button"
                onClick={() =>
                  setOpenEditorKey(editorOpen ? null : section.key)
                }
                style={{
                  height: 22,
                  border: "1px solid #cbd5e1",
                  background: editorOpen ? "#111827" : "#ffffff",
                  color: editorOpen ? "#ffffff" : "#111827",
                  fontSize: 9,
                  fontWeight: 700,
                  padding: "0 6px",
                  cursor: "pointer",
                }}
              >
                {editorOpen ? "Close" : "Edit"}
              </button>

              <button
                type="button"
                onClick={() => confirmReset(section.key, visibleTitle)}
                title="Reset this section to PracticePilot default wording"
                style={{
                  height: 22,
                  border: "1px solid #cbd5e1",
                  background: "#ffffff",
                  fontSize: 9,
                  fontWeight: 700,
                  padding: "0 6px",
                  cursor: "pointer",
                }}
              >
                Default
              </button>
            </div>

            {editorOpen ? (
              <div style={{ marginTop: 7, display: "grid", gap: 5 }}>
                <input
                  value={current.title}
                  onChange={(event) =>
                    onChangeTitle(section.key, event.target.value)
                  }
                  placeholder="Section title"
                  style={{
                    width: "100%",
                    height: 24,
                    border: "1px solid #cbd5e1",
                    padding: "3px 5px",
                    fontSize: 10,
                    background: "#ffffff",
                  }}
                />

                {section.textEditable === false ? (
                  <div
                    style={{
                      fontSize: 10,
                      lineHeight: 1.35,
                      color: "#6b7280",
                      padding: "4px 0",
                    }}
                  >
                    This section pulls its table from Client Setup people/directors.
                    You can edit the title, but the table is populated from setup data.
                  </div>
                ) : (
                  <textarea
                    value={current.text}
                    onChange={(event) =>
                      onChangeText(section.key, event.target.value)
                    }
                    placeholder="Section wording"
                    rows={5}
                    style={{
                      width: "100%",
                      border: "1px solid #cbd5e1",
                      padding: 5,
                      fontSize: 10,
                      lineHeight: 1.35,
                      resize: "vertical",
                      background: "#ffffff",
                    }}
                  />
                )}

                <div
                  style={{
                    fontSize: 9,
                    color: "#6b7280",
                    lineHeight: 1.35,
                  }}
                >
                  Tokens available: {"{clientName}"}, {"{yearEnd}"},{" "}
                  {"{bodyLabel}"}, {"{framework}"}, {"{country}"},{" "}
                  {"{natureOfBusiness}"}, {"{approvalDate}"}.
                </div>
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}