"use client";

import { type CSSProperties, useEffect, useMemo, useState } from "react";
import {
  EditableDisclosureSection,
  EditableDisclosureTextMap,
} from "./AfsPolicyNoteDefaults";

type ToggleReportOption = (key: string, checked: boolean) => void;

type Props = {
  sections: EditableDisclosureSection[];
  reportOptions: Record<string, boolean>;
  toggleReportOption: ToggleReportOption;
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


const styles: Record<string, CSSProperties> = {
  notesModeBar: {
    position: "sticky",
    top: 0,
    zIndex: 20,
    display: "grid",
    gridTemplateColumns: "1fr auto auto",
    gap: 4,
    alignItems: "center",
    margin: "0 0 2px",
    padding: "6px",
    border: "1px solid #cbd5e1",
    background: "#f8fafc",
    boxShadow: "0 1px 2px rgba(15, 23, 42, 0.08)",
  },
  notesModeLabel: {
    fontSize: 10,
    fontWeight: 900,
    color: "#334155",
  },
  notesModeButton: {
    border: "1px solid #cbd5e1",
    background: "#ffffff",
    color: "#111827",
    fontSize: 10,
    fontWeight: 800,
    padding: "4px 8px",
    cursor: "pointer",
  },
  notesModeActive: {
    border: "1px solid #111827",
    background: "#111827",
    color: "#ffffff",
    fontSize: 10,
    fontWeight: 900,
    padding: "4px 8px",
    cursor: "pointer",
  },
};


function normaliseGroup(section: EditableDisclosureSection) {
  return {
    groupKey: section.group || "other",
    groupLabel: section.groupLabel || section.group || "Other",
  };
}

function sectionLabel(section: EditableDisclosureSection) {
  return section.title || section.defaultTitle || section.label || section.key;
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

  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});
  const [editing, setEditing] = useState<Record<string, boolean>>({});
  const [notesMode, setNotesMode] = useState<"review" | "edit">("review");
  const isNotesMode = sections.some((section) => String(section.key || "").startsWith("notes"));

  useEffect(() => {
    if (!isNotesMode) {
      return;
    }

    try {
      const savedMode = window.localStorage.getItem("afs-notes-mode-global");
      if (savedMode === "review" || savedMode === "edit") {
        setNotesMode(savedMode);
      }
    } catch {
      // ignore localStorage failures
    }
  }, [isNotesMode]);

  function changeNotesMode(nextMode: "review" | "edit") {
    setNotesMode(nextMode);

    try {
      window.localStorage.setItem("afs-notes-mode-global", nextMode);
      window.dispatchEvent(new CustomEvent("afs-notes-mode-change", { detail: nextMode }));
    } catch {
      window.dispatchEvent(new CustomEvent("afs-notes-mode-change", { detail: nextMode }));
    }
  }

  return (
    <div style={{ display: "grid", gap: 8 }}>
      {isNotesMode ? (
        <div style={styles.notesModeBar}>
          <span style={styles.notesModeLabel}>Notes view</span>
          <button
            type="button"
            onClick={() => changeNotesMode("review")}
            style={notesMode === "review" ? styles.notesModeActive : styles.notesModeButton}
          >
            AFS
          </button>
          <button
            type="button"
            onClick={() => changeNotesMode("edit")}
            style={notesMode === "edit" ? styles.notesModeActive : styles.notesModeButton}
          >
            Work
          </button>
        </div>
      ) : null}

      <button
        type="button"
        onClick={onResetAll}
        style={{
          justifySelf: "end",
          fontSize: 10,
          border: "1px solid #cbd5e1",
          background: "#ffffff",
          padding: "4px 8px",
          cursor: "pointer",
        }}
      >
        Defaults
      </button>

      {groupedSections.map((group) => {
        const selectedCount = group.sections.filter(
          (section) => Boolean(reportOptions[section.optionKey])
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
              onClick={() =>
                setOpenGroups((current) => ({
                  ...current,
                  [group.groupKey]: !current[group.groupKey],
                }))
              }
              style={{
                width: "100%",
                border: 0,
                background: "#f8fafc",
                padding: "7px 8px",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                fontSize: 11,
                fontWeight: 800,
                cursor: "pointer",
                color: "#111827",
              }}
            >
              <span>
                {openGroups[group.groupKey] ? "−" : "+"} {group.groupLabel}
              </span>
              <span style={{ color: "#047857" }}>
                {selectedCount}/{group.sections.length}
              </span>
            </button>

            {openGroups[group.groupKey] ? (
              <div style={{ display: "grid", gap: 6, padding: 8 }}>
                {group.sections.map((section) => {
                  const isChecked = Boolean(reportOptions[section.optionKey]);
                  const current = texts[section.key] ||
                    defaults[section.key] || {
                      title: sectionLabel(section),
                      text: section.defaultText || "",
                    };
                  const isEditing = Boolean(editing[section.key]);

                  return (
                    <div
                      key={section.key}
                      style={{
                        borderTop: "1px solid #edf2f7",
                        paddingTop: 6,
                      }}
                    >
                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns: "18px 1fr auto auto",
                          gap: 6,
                          alignItems: "center",
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(event) =>
                            toggleReportOption(
                              section.optionKey,
                              event.target.checked
                            )
                          }
                        />
                        <strong style={{ fontSize: 11 }}>
                          {current.title || sectionLabel(section)}
                        </strong>
                        <button
                          type="button"
                          onClick={() =>
                            setEditing((state) => ({
                              ...state,
                              [section.key]: !isEditing,
                            }))
                          }
                          style={{
                            fontSize: 10,
                            border: "1px solid #cbd5e1",
                            background: isEditing ? "#111827" : "#ffffff",
                            color: isEditing ? "#ffffff" : "#111827",
                            padding: "3px 6px",
                            cursor: "pointer",
                          }}
                        >
                          {isEditing ? "Close" : isNotesMode ? "Heading" : "Edit"}
                        </button>
                        <button
                          type="button"
                          onClick={() => onReset(section.key)}
                          style={{
                            fontSize: 10,
                            border: "1px solid #cbd5e1",
                            background: "#ffffff",
                            padding: "3px 6px",
                            cursor: "pointer",
                          }}
                        >
                          Default
                        </button>
                      </div>

                      {isEditing ? (
                        <div style={{ display: "grid", gap: 5, marginTop: 6 }}>
                          <input
                            value={current.title}
                            onChange={(event) =>
                              onChangeTitle(section.key, event.target.value)
                            }
                            style={{
                              fontSize: 10,
                              padding: 5,
                              border: "1px solid #cbd5e1",
                            }}
                          />
                          {!isNotesMode ? (
                            <textarea
                              value={current.text}
                              onChange={(event) =>
                                onChangeText(section.key, event.target.value)
                              }
                              rows={5}
                              style={{
                                fontSize: 10,
                                padding: 5,
                                border: "1px solid #cbd5e1",
                                resize: "vertical",
                              }}
                            />
                          ) : (
                            <div
                              style={{
                                fontSize: 10,
                                color: "#64748b",
                                lineHeight: 1.35,
                                border: "1px solid #e5e7eb",
                                background: "#f8fafc",
                                padding: 6,
                              }}
                            >
                              Structured note content is edited directly inside the note in Work mode. This panel only controls the note heading and whether the note is included.
                            </div>
                          )}
                          {tokenHelp && !isNotesMode ? (
                            <div
                              style={{
                                fontSize: 9,
                                color: "#64748b",
                                lineHeight: 1.35,
                              }}
                            >
                              {tokenHelp}
                            </div>
                          ) : null}
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
