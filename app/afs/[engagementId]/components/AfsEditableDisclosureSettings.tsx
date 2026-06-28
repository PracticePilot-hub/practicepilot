"use client";

import { useMemo, useState } from "react";

export type EditableDisclosureText = {
  title: string;
  text: string;
};

export type EditableDisclosureTextMap = Record<string, EditableDisclosureText>;

export type EditableDisclosureSection = {
  key: string;
  optionKey: string;
  label: string;
  group?: string;
  groupLabel?: string;
  defaultOpen?: boolean;
  introText?: string;
};

type Props = {
  sections: EditableDisclosureSection[];
  reportOptions: Record<string, boolean>;
  toggleReportOption: (key: string, checked: boolean) => void;
  texts: EditableDisclosureTextMap;
  defaults: EditableDisclosureTextMap;
  onChangeTitle: (key: string, value: string) => void;
  onChangeText: (key: string, value: string) => void;
  onReset: (key: string) => void;
  onResetAll: () => void;
  tokenHelp?: string;
};

type GroupedSections = {
  groupKey: string;
  groupLabel: string;
  sections: EditableDisclosureSection[];
};

function normaliseGroup(section: EditableDisclosureSection) {
  return {
    groupKey: section.group || "other",
    groupLabel: section.groupLabel || section.group || "Other",
  };
}

export default function AfsEditableDisclosureSettings({
  sections,
  reportOptions,
  toggleReportOption,
  texts,
  defaults,
  onChangeTitle,
  onChangeText,
  onReset,
  onResetAll,
  tokenHelp,
}: Props) {
  const groupedSections = useMemo<GroupedSections[]>(() => {
    const map = new Map<string, GroupedSections>();

    sections.forEach((section) => {
      const group = normaliseGroup(section);

      if (!map.has(group.groupKey)) {
        map.set(group.groupKey, {
          groupKey: group.groupKey,
          groupLabel: group.groupLabel,
          sections: [],
        });
      }

      map.get(group.groupKey)?.sections.push(section);
    });

    return Array.from(map.values());
  }, [sections]);

  // Minimal view: every group starts collapsed.
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});
  const [openEditorKey, setOpenEditorKey] = useState<string | null>(null);

  function toggleGroup(groupKey: string) {
    setOpenGroups((current) => ({
      ...current,
      [groupKey]: !current[groupKey],
    }));
  }

  function confirmReset(sectionKey: string, sectionTitle: string) {
    const confirmed = window.confirm(
      `Reset "${sectionTitle}" to the PracticePilot default wording?\n\nThis will discard your custom title and wording for this section.`
    );

    if (confirmed) {
      onReset(sectionKey);
    }
  }

  function confirmResetAll() {
    const confirmed = window.confirm(
      "Reset ALL disclosures in this section to PracticePilot defaults?\n\nThis will discard all custom titles and wording for this section."
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
            Open a group, tick only what applies, and edit wording where needed.
          </div>

          <div
            style={{
              marginTop: 4,
              fontSize: 9,
              color: "#047857",
              fontWeight: 700,
            }}
          >
            Changes auto-save.
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

      {groupedSections.map((group) => {
        const isOpen = Boolean(openGroups[group.groupKey]);
        const selectedCount = group.sections.filter((section) =>
          Boolean(reportOptions[section.optionKey])
        ).length;

        return (
          <div
            key={group.groupKey}
            style={{
              border: "1px solid #dbe3ef",
              background: "#ffffff",
            }}
          >
            <button
              type="button"
              onClick={() => toggleGroup(group.groupKey)}
              style={{
                width: "100%",
                display: "grid",
                gridTemplateColumns: "16px minmax(0, 1fr) auto",
                gap: 6,
                alignItems: "center",
                border: 0,
                background: isOpen ? "#f8fafc" : "#ffffff",
                padding: "8px 7px",
                cursor: "pointer",
                textAlign: "left",
              }}
            >
              <span
                style={{
                  width: 14,
                  height: 14,
                  display: "inline-grid",
                  placeItems: "center",
                  border: "1px solid #cbd5e1",
                  fontSize: 9,
                  fontWeight: 900,
                  color: "#111827",
                  lineHeight: 1,
                }}
              >
                {isOpen ? "−" : "+"}
              </span>

              <span
                style={{
                  fontSize: 11,
                  fontWeight: 900,
                  color: "#111827",
                  lineHeight: 1.25,
                  minWidth: 0,
                }}
              >
                {group.groupLabel}
              </span>

              <span
                style={{
                  fontSize: 9,
                  fontWeight: 800,
                  color: selectedCount > 0 ? "#047857" : "#6b7280",
                  whiteSpace: "nowrap",
                }}
              >
                {selectedCount}/{group.sections.length}
              </span>
            </button>

            {isOpen ? (
              <div style={{ display: "grid", gap: 5, padding: 6 }}>
                {group.sections.map((section) => {
                  const checked = Boolean(reportOptions[section.optionKey]);
                  const current = texts[section.key] ||
                    defaults[section.key] || {
                      title: section.label,
                      text: "",
                    };
                  const defaultText = defaults[section.key] || {
                    title: section.label,
                    text: "",
                  };
                  const changed =
                    current.title !== defaultText.title ||
                    current.text !== defaultText.text;
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
                            toggleReportOption(
                              section.optionKey,
                              event.target.checked
                            )
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
                            placeholder="Title"
                            style={{
                              width: "100%",
                              height: 24,
                              border: "1px solid #cbd5e1",
                              padding: "3px 5px",
                              fontSize: 10,
                              background: "#ffffff",
                            }}
                          />

                          <textarea
                            value={current.text}
                            onChange={(event) =>
                              onChangeText(section.key, event.target.value)
                            }
                            placeholder="Wording"
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

                          <div
                            style={{
                              fontSize: 9,
                              color: "#6b7280",
                              lineHeight: 1.35,
                            }}
                          >
                            {tokenHelp ||
                              "Tokens available: {clientName}, {yearEnd}, {framework}, {currency}, {currentYear}, {priorYear}."}
                          </div>
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
  );
}
