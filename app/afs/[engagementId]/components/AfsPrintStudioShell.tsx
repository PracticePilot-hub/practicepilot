"use client";

import React, { ReactNode, useEffect, useMemo, useState } from "react";

export type AfsStudioSection = {
  id: string;
  label: string;
  shortLabel?: string;
  group?: "report" | "settings" | string;
  hidden?: boolean;
};

export type AfsReportOption = {
  id: string;
  label: string;
  description?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
};

type AfsPrintStudioShellProps = {
  engagementName: string;
  yearEndLabel: string;
  activeSectionId: string;
  sections: AfsStudioSection[];
  onSectionChange: (sectionId: string) => void;
  exportDisabled?: boolean;
  reportOptions?: AfsReportOption[];
  reportOptionsTitle?: string;
  reportOptionsDescription?: string;
  emptyOptionsMessage?: string;
  reportOptionsContent?: ReactNode;
  flightDeckContent?: ReactNode;
  children: ReactNode;
};

function safeDownloadName(value: string) {
  return value
    .trim()
    .replace(/[^\w\s().-]+/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 110);
}

function getFilenameFromContentDisposition(header: string | null) {
  if (!header) return "";

  const utf8Match = header.match(/filename\*=UTF-8''([^;]+)/i);
  if (utf8Match?.[1]) {
    try {
      return decodeURIComponent(utf8Match[1].replace(/"/g, ""));
    } catch {
      return utf8Match[1].replace(/"/g, "");
    }
  }

  const normalMatch = header.match(/filename="?([^";]+)"?/i);
  return normalMatch?.[1]?.trim() || "";
}

export default function AfsPrintStudioShell({
  engagementName,
  yearEndLabel,
  activeSectionId,
  sections,
  onSectionChange,
  exportDisabled = false,
  reportOptions = [],
  reportOptionsTitle = "Section settings",
  reportOptionsDescription = "Turn report sections on or off.",
  emptyOptionsMessage = "No options available.",
  reportOptionsContent,
  flightDeckContent,
  children,
}: AfsPrintStudioShellProps) {
  const [showOptions, setShowOptions] = useState(true);
  const [zoom, setZoom] = useState("fit");
  const [isExporting, setIsExporting] = useState(false);
  const [exportAsDraft, setExportAsDraft] = useState(false);

  const visibleSections = useMemo(
    () => sections.filter((section) => !section.hidden),
    [sections],
  );

  const reportSections = visibleSections.filter(
    (section) => section.group !== "settings",
  );
  const settingSections = visibleSections.filter(
    (section) => section.group === "settings",
  );

  const zoomClass =
    zoom === "85"
      ? "afsZoom85"
      : zoom === "90"
        ? "afsZoom90"
        : zoom === "100"
          ? "afsZoom100"
          : zoom === "110"
            ? "afsZoom110"
            : zoom === "125"
              ? "afsZoom125"
              : zoom === "150"
                ? "afsZoom150"
                : "afsZoomFit";

  useEffect(() => {
    const clearExportMode = () => {
      document.body.classList.remove("afsPdfExportMode");
      window.dispatchEvent(
        new CustomEvent("afs-print-export-mode", { detail: false }),
      );
    };

    window.addEventListener("afterprint", clearExportMode);
    return () => window.removeEventListener("afterprint", clearExportMode);
  }, []);

  function refreshPage() {
    window.location.reload();
  }

  async function exportPdf() {
    if (exportDisabled || isExporting) return;

    const idMatch = window.location.pathname.match(/\/afs\/([^/]+)(?:\/|$)/);
    const engagementId = idMatch?.[1];

    if (!engagementId) {
      window.alert("Could not determine the AFS engagement ID for export.");
      return;
    }

    setIsExporting(true);

    try {
      const draftQuery = exportAsDraft ? "?draft=1" : "";
      const response = await fetch(
        `/api/afs/engagements/${encodeURIComponent(
          engagementId,
        )}/export-pdf${draftQuery}`,
        {
          method: "GET",
          cache: "no-store",
        },
      );

      if (!response.ok) {
        let message = `PDF export failed with status ${response.status}.`;

        try {
          const payload = await response.json();
          if (payload?.error) message = payload.error;
        } catch {
          const text = await response.text();
          if (text) message = text.slice(0, 500);
        }

        throw new Error(message);
      }

      const blob = await response.blob();
      const headerFilename = getFilenameFromContentDisposition(
        response.headers.get("Content-Disposition"),
      );

      const clientName = safeDownloadName(engagementName) || "AFS";
      const yearEnd =
        safeDownloadName(yearEndLabel.replace(/^.*year end\s*/i, "")) ||
        "year-end";
      const draftPart = exportAsDraft ? "-draft" : "";
      const fallbackFilename = `${clientName}-${yearEnd}-annual-financial-statements${draftPart}.pdf`;
      const filename = headerFilename || fallbackFilename;

      const objectUrl = window.URL.createObjectURL(blob);
      const link = document.createElement("a");

      link.href = objectUrl;
      link.download = filename;
      link.style.display = "none";

      document.body.appendChild(link);
      link.click();
      link.remove();

      window.setTimeout(() => window.URL.revokeObjectURL(objectUrl), 2000);
    } catch (error: any) {
      console.error("AFS PDF export failed", error);
      window.alert(error?.message || "AFS PDF export failed.");
    } finally {
      setIsExporting(false);
    }
  }

  return (
    <main className="afsStudioRoot" style={styles.root}>
      <aside className="afsStudioLeftNav" style={styles.leftNav}>
        <div style={styles.leftHeader}>
          <div style={styles.leftTitle}>PracticePilot AFS</div>
          <div style={styles.leftSubtitle}>Print Studio</div>
        </div>

        <div style={styles.leftScroll}>
          <div style={styles.leftSectionTitle}>AFS REPORT</div>
          {reportSections.map((section) => (
            <button
              key={section.id}
              type="button"
              onClick={() => onSectionChange(section.id)}
              style={{
                ...styles.leftNavButton,
                ...(activeSectionId === section.id
                  ? styles.leftNavButtonActive
                  : null),
              }}
            >
              {section.label}
            </button>
          ))}

          {settingSections.length ? (
            <>
              <div style={styles.leftSectionTitle}>SETTINGS</div>
              {settingSections.map((section) => (
                <button
                  key={section.id}
                  type="button"
                  onClick={() => onSectionChange(section.id)}
                  style={{
                    ...styles.leftNavButton,
                    ...(activeSectionId === section.id
                      ? styles.leftNavButtonActive
                      : null),
                  }}
                >
                  {section.label}
                </button>
              ))}
            </>
          ) : null}
        </div>
      </aside>

      <section className="afsStudioMainArea" style={styles.mainArea}>
        <section className="afsStudioFileHeader" style={styles.fileHeader}>
          <div style={styles.fileInfo}>
            <strong style={styles.fileClient}>{engagementName}</strong>
            <span style={styles.fileMeta}>{yearEndLabel}</span>
          </div>

          <div style={styles.actions}>
            <button type="button" style={styles.actionButton} onClick={refreshPage}>
              Refresh
            </button>

            <button
              type="button"
              style={styles.actionButton}
              onClick={() => setShowOptions((current) => !current)}
            >
              {showOptions ? "Hide report options" : "Show report options"}
            </button>

           

            <select
              value={zoom}
              onChange={(event) => setZoom(event.target.value)}
              style={styles.select}
            >
              <option value="fit">Fit page</option>
              <option value="85">85%</option>
              <option value="90">90%</option>
              <option value="100">100%</option>
              <option value="110">110%</option>
              <option value="125">125%</option>
              <option value="150">150%</option>
            </select>

 <label style={styles.draftToggle}>
              <input
                type="checkbox"
                checked={exportAsDraft}
                onChange={(event) => setExportAsDraft(event.target.checked)}
              />
              <span>Draft PDF</span>
            </label>


            <button
              type="button"
              disabled={exportDisabled || isExporting}
              onClick={exportPdf}
              style={{
                ...styles.exportButton,
                opacity: exportDisabled || isExporting ? 0.55 : 1,
                cursor: exportDisabled || isExporting ? "not-allowed" : "pointer",
              }}
            >
              {isExporting
                ? "Exporting..."
                : exportAsDraft
                  ? "Export Draft PDF"
                  : "Export PDF"}
            </button>
          </div>
        </section>

        <section className="afsStudioQuickButtons" style={styles.quickButtons}>
          {reportSections.map((section) => (
            <button
              key={section.id}
              type="button"
              onClick={() => onSectionChange(section.id)}
              style={{
                ...styles.quickButton,
                ...(activeSectionId === section.id
                  ? styles.quickButtonActive
                  : null),
              }}
            >
              {section.shortLabel || section.label}
            </button>
          ))}
        </section>

        {flightDeckContent ? (
          <section className="afsStudioFlightDeckSlot" style={styles.flightDeckSlot}>
            {flightDeckContent}
          </section>
        ) : null}

        <section className="afsStudioWorkArea" style={styles.workArea}>
          <section className="afsStudioSignOffRow" style={styles.signOffRow}>
            <span style={styles.notSigned}>Not signed off yet</span>
          </section>

          <section
            className="afsStudioBodyGrid"
            style={{
              ...styles.bodyGrid,
              gridTemplateColumns: showOptions
                ? "260px minmax(0, 1fr)"
                : "minmax(0, 1fr)",
            }}
          >
            {showOptions ? (
              <aside className="afsStudioOptionsPanel" style={styles.optionsPanel}>
                <h2 style={styles.optionsTitle}>{reportOptionsTitle}</h2>
                <p style={styles.optionsDescription}>{reportOptionsDescription}</p>

                {reportOptionsContent ? (
                  reportOptionsContent
                ) : reportOptions.length ? (
                  <div style={styles.optionList}>
                    {reportOptions.map((option) => (
                      <label key={option.id} style={styles.optionRow}>
                        <input
                          type="checkbox"
                          checked={option.checked}
                          onChange={(event) =>
                            option.onChange(event.target.checked)
                          }
                        />
                        <span>
                          <strong>{option.label}</strong>
                          {option.description ? (
                            <small style={styles.optionDescription}>
                              {option.description}
                            </small>
                          ) : null}
                        </span>
                      </label>
                    ))}
                  </div>
                ) : (
                  <p style={styles.emptyOptions}>{emptyOptionsMessage}</p>
                )}
              </aside>
            ) : null}

            <section className="afsStudioCanvasColumn" style={styles.canvasColumn}>
              <div className="afsStudioCanvasLabel" style={styles.canvasLabel}>
                A4 print-aware canvas
              </div>
              <div
                style={styles.canvasViewport}
                className={`${zoomClass} afsPrintableReport`}
              >
                {children}
              </div>
            </section>
          </section>
        </section>
      </section>

      <style jsx global>{`
        .afsZoomFit > * {
          transform: scale(0.96);
          transform-origin: top center;
        }
        .afsZoom85 > * {
          transform: scale(0.85);
          transform-origin: top center;
        }
        .afsZoom90 > * {
          transform: scale(0.9);
          transform-origin: top center;
        }
        .afsZoom100 > * {
          transform: scale(1);
          transform-origin: top center;
        }
        .afsZoom110 > * {
          transform: scale(1.1);
          transform-origin: top center;
        }
        .afsZoom125 > * {
          transform: scale(1.25);
          transform-origin: top center;
        }
        .afsZoom150 > * {
          transform: scale(1.5);
          transform-origin: top center;
        }

        @media print {
          @page {
            size: A4;
            margin: 0;
          }

          html,
          body {
            width: 210mm !important;
            margin: 0 !important;
            padding: 0 !important;
            background: #ffffff !important;
            overflow: visible !important;
          }

          body.afsPdfExportMode .afsStudioLeftNav,
          body.afsPdfExportMode .afsStudioFileHeader,
          body.afsPdfExportMode .afsStudioQuickButtons,
          body.afsPdfExportMode .afsStudioFlightDeckSlot,
          body.afsPdfExportMode .afsStudioSignOffRow,
          body.afsPdfExportMode .afsStudioOptionsPanel,
          body.afsPdfExportMode .afsStudioCanvasLabel {
            display: none !important;
          }

          body.afsPdfExportMode .afsStudioRoot,
          body.afsPdfExportMode .afsStudioMainArea,
          body.afsPdfExportMode .afsStudioWorkArea,
          body.afsPdfExportMode .afsStudioBodyGrid,
          body.afsPdfExportMode .afsStudioCanvasColumn,
          body.afsPdfExportMode .afsStudioCanvasColumn > *,
          body.afsPdfExportMode .afsPrintableReport {
            display: block !important;
            position: static !important;
            width: 210mm !important;
            min-width: 210mm !important;
            max-width: 210mm !important;
            height: auto !important;
            min-height: 0 !important;
            margin: 0 !important;
            padding: 0 !important;
            overflow: visible !important;
            background: #ffffff !important;
            box-shadow: none !important;
            gap: 0 !important;
            transform: none !important;
          }

          body.afsPdfExportMode .afsPrintableReport,
          body.afsPdfExportMode .afsPrintableReport * {
            visibility: visible !important;
            box-sizing: border-box !important;
            writing-mode: horizontal-tb !important;
            text-orientation: mixed !important;
          }

          body.afsPdfExportMode .afsPrintableReport > * {
            transform: none !important;
            box-shadow: none !important;
            margin: 0 !important;
            break-after: page;
            page-break-after: always;
          }

          body.afsPdfExportMode .afsPrintableReport > *:last-child {
            break-after: auto;
            page-break-after: auto;
          }

          body.afsPdfExportMode .afsPrintableReport [id^="print-"],
          body.afsPdfExportMode .afsPrintableReport .afs-export-fixed-width {
            display: block !important;
            width: 100% !important;
            min-width: 0 !important;
            max-width: 100% !important;
            overflow: visible !important;
          }

          body.afsPdfExportMode .afsPrintableReport table {
            width: 100% !important;
            max-width: 100% !important;
            border-collapse: collapse !important;
            table-layout: auto !important;
            break-inside: auto;
            page-break-inside: auto;
          }

          body.afsPdfExportMode .afsPrintableReport thead,
          body.afsPdfExportMode .afsPrintableReport tr {
            break-inside: avoid-page;
            page-break-inside: avoid;
          }

          body.afsPdfExportMode .afsPrintableReport button,
          body.afsPdfExportMode .afsPrintableReport input,
          body.afsPdfExportMode .afsPrintableReport select,
          body.afsPdfExportMode .afsPrintableReport textarea,
          body.afsPdfExportMode .afsPrintableReport [data-work-only="true"],
          body.afsPdfExportMode .afsPrintableReport .afs-screen-only {
            display: none !important;
          }

          body.afsPdfExportMode .afsPrintableReport [contenteditable="true"] {
            outline: none !important;
            border: 0 !important;
            background: transparent !important;
          }

          body.afsPdfExportMode .afsPrintableReport h1,
          body.afsPdfExportMode .afsPrintableReport h2,
          body.afsPdfExportMode .afsPrintableReport h3,
          body.afsPdfExportMode .afsPrintableReport h4,
          body.afsPdfExportMode .afsPrintableReport strong {
            break-after: avoid-page;
            page-break-after: avoid;
          }

          body.afsPdfExportMode .afsPrintableReport p {
            orphans: 2;
            widows: 2;
          }

          body.afsPdfExportMode
            .afsPrintableReport
            [data-keep-together="true"] {
            break-inside: avoid-page;
            page-break-inside: avoid;
          }

          body.afsPdfExportMode .afsPrintableReport .afs-notes-screen-content {
            display: none !important;
          }

          body.afsPdfExportMode .afsPrintableReport .afs-notes-print-content {
            display: block !important;
          }

          body.afsPdfExportMode .afsPrintableReport [data-note-active="false"] {
            display: none !important;
          }

          body.afsPdfExportMode .afsPrintableReport .afs-export-nowrap {
            white-space: nowrap !important;
          }
        }
      `}</style>
    </main>
  );
}

const styles: Record<string, React.CSSProperties> = {
  root: {
    height: "calc(100vh - 72px)",
    minHeight: 640,
    display: "grid",
    gridTemplateColumns: "150px 1fr",
    overflow: "hidden",
    background: "#e8eef6",
    color: "#111827",
    fontFamily:
      "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  },
  leftNav: {
    background: "#0f1a2b",
    color: "#ffffff",
    minHeight: 0,
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
  },
  leftHeader: {
    flexShrink: 0,
    padding: "10px 8px 11px",
    borderBottom: "1px solid rgba(255,255,255,0.12)",
  },
  leftTitle: { fontSize: 13, fontWeight: 900, lineHeight: 1.1 },
  leftSubtitle: { fontSize: 10, opacity: 0.8, marginTop: 3 },
  leftScroll: { overflow: "auto", paddingBottom: 14 },
  leftSectionTitle: {
    fontSize: 10,
    color: "#8ea0b8",
    letterSpacing: "0.08em",
    margin: "16px 8px 7px",
    fontWeight: 800,
  },
  leftNavButton: {
    width: "100%",
    display: "block",
    textAlign: "left",
    border: 0,
    background: "transparent",
    color: "#ffffff",
    padding: "6px 8px",
    fontSize: 11,
    lineHeight: 1.2,
    fontWeight: 700,
    cursor: "pointer",
  },
  leftNavButtonActive: {
    background: "#ffffff",
    color: "#0f1a2b",
  },
  mainArea: {
    minWidth: 0,
    minHeight: 0,
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
  },
  fileHeader: {
    flexShrink: 0,
    minHeight: 36,
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    padding: "5px 10px",
    background: "#ffffff",
    borderBottom: "1px solid #d7dde7",
  },
  fileInfo: { display: "flex", flexDirection: "column", gap: 1, minWidth: 0 },
  fileClient: { fontSize: 13, fontWeight: 900, lineHeight: 1.1 },
  fileMeta: { fontSize: 10.5, color: "#475569" },
  actions: { display: "flex", gap: 6, alignItems: "center", flexShrink: 0 },
  actionButton: {
    border: "1px solid #94a3b8",
    background: "#ffffff",
    padding: "5px 9px",
    fontSize: 11,
    fontWeight: 700,
  },
  draftToggle: {
    height: 28,
    display: "inline-flex",
    alignItems: "center",
    gap: 5,
    border: "1px solid #94a3b8",
    background: "#ffffff",
    padding: "0 8px",
    fontSize: 11,
    fontWeight: 800,
    color: "#111827",
    cursor: "pointer",
    userSelect: "none",
  },
  select: {
    border: "1px solid #94a3b8",
    background: "#ffffff",
    padding: "5px 7px",
    fontSize: 11,
    fontWeight: 700,
  },
  exportButton: {
    border: "1px solid #64748b",
    background: "#64748b",
    color: "#ffffff",
    padding: "5px 10px",
    fontSize: 11,
    fontWeight: 900,
  },
  quickButtons: {
    flexShrink: 0,
    display: "flex",
    flexWrap: "wrap",
    gap: 4,
    padding: "5px 10px",
    background: "#f8fafc",
    borderBottom: "1px solid #d7dde7",
  },
  quickButton: {
    border: "1px solid #cbd5e1",
    background: "#ffffff",
    padding: "4px 8px",
    fontSize: 10.5,
    fontWeight: 800,
    cursor: "pointer",
  },
  quickButtonActive: {
    background: "#111827",
    borderColor: "#111827",
    color: "#ffffff",
  },
  flightDeckSlot: {
    flexShrink: 0,
    background: "#e8eef6",
    borderBottom: "1px solid #cbd5e1",
    padding: "4px 10px",
  },
  workArea: {
    minHeight: 0,
    flex: 1,
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
  },
  signOffRow: {
    flexShrink: 0,
    display: "flex",
    justifyContent: "flex-end",
    padding: "4px 10px 0",
  },
  notSigned: {
    border: "1px solid #f59e0b",
    color: "#92400e",
    background: "#fff7ed",
    padding: "2px 6px",
    fontSize: 10.5,
    fontWeight: 900,
  },
  bodyGrid: {
    minHeight: 0,
    flex: 1,
    display: "grid",
    overflow: "hidden",
  },
  optionsPanel: {
    minHeight: 0,
    background: "#ffffff",
    borderRight: "1px solid #cbd5e1",
    padding: 10,
    overflow: "auto",
  },
  optionsTitle: { fontSize: 12.5, margin: "0 0 4px", fontWeight: 900 },
  optionsDescription: { fontSize: 10.5, margin: "0 0 10px", color: "#475569" },
  optionList: { display: "grid", gap: 6 },
  optionRow: {
    display: "grid",
    gridTemplateColumns: "16px 1fr",
    gap: 5,
    alignItems: "start",
    fontSize: 11,
    lineHeight: 1.22,
  },
  optionDescription: {
    display: "block",
    fontSize: 9.5,
    color: "#64748b",
    marginTop: 2,
  },
  emptyOptions: { fontSize: 10.5, color: "#64748b" },
  canvasColumn: {
    minWidth: 0,
    minHeight: 0,
    overflow: "auto",
    padding: "0 10px 28px",
  },
  canvasLabel: { fontSize: 10.5, color: "#475569", margin: "7px 0" },
  canvasViewport: {
    minHeight: "100%",
    display: "grid",
    justifyItems: "center",
    alignContent: "start",
    gap: 16,
  },
};