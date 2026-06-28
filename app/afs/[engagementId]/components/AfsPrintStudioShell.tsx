"use client";

import styles from "./AfsPrintStudioShell.module.css";

export type AfsStudioSection = {
  id: string;
  label: string;
  shortLabel?: string;
  group: "report" | "settings";
  hidden?: boolean;
};

export type AfsReportOption = {
  id: string;
  label: string;
  description?: string;
  checked: boolean;
  disabled?: boolean;
  onChange?: (checked: boolean) => void;
};

type Props = {
  engagementName: string;
  yearEndLabel: string;
  activeSectionId: string;
  sections: AfsStudioSection[];
  onSectionChange: (sectionId: string) => void;
  children: React.ReactNode;
  reportOptions?: AfsReportOption[];
  reportOptionsTitle?: string;
  reportOptionsDescription?: string;
  emptyOptionsMessage?: string;
  reportOptionsContent?: React.ReactNode;
  exportDisabled?: boolean;
};

export default function AfsPrintStudioShell({
  engagementName,
  yearEndLabel,
  activeSectionId,
  sections,
  onSectionChange,
  children,
  reportOptions = [],
  reportOptionsTitle = "AFS report options",
  reportOptionsDescription = "Visible in-app; not floating over report content.",
  emptyOptionsMessage = "No contextual options for this page yet.",
  reportOptionsContent,
  exportDisabled = true,
}: Props) {
  const reportSections = sections.filter(
    (section) => section.group === "report" && !section.hidden
  );

  const settingsSections = sections.filter(
    (section) => section.group === "settings" && !section.hidden
  );

  return (
    <div className={styles.shell}>
      <aside className={styles.leftRail}>
        <div className={styles.brandBlock}>
          <div className={styles.brandTitle}>PracticePilot AFS</div>
          <div className={styles.brandSubTitle}>Print Studio</div>
        </div>

        <nav className={styles.sideNav}>
          <div className={styles.navGroup}>
            <div className={styles.navGroupTitle}>AFS Report</div>

            {reportSections.map((section) => (
              <button
                key={section.id}
                type="button"
                className={
                  activeSectionId === section.id
                    ? styles.navButtonActive
                    : styles.navButton
                }
                onClick={() => onSectionChange(section.id)}
              >
                {section.label}
              </button>
            ))}
          </div>

          <div className={styles.navGroup}>
            <div className={styles.navGroupTitle}>Settings</div>

            {settingsSections.map((section) => (
              <button
                key={section.id}
                type="button"
                className={
                  activeSectionId === section.id
                    ? styles.navButtonActive
                    : styles.navButton
                }
                onClick={() => onSectionChange(section.id)}
              >
                {section.label}
              </button>
            ))}
          </div>
        </nav>
      </aside>

      <main className={styles.mainArea}>
        <header className={styles.headerBar}>
          <div className={styles.headerIdentity}>
            <div className={styles.clientName}>{engagementName}</div>
            <div className={styles.yearEnd}>{yearEndLabel}</div>
          </div>

          <div className={styles.headerActions}>
            <button
              type="button"
              className={styles.secondaryButton}
              onClick={() => window.location.reload()}
            >
              Refresh
            </button>

            <button type="button" className={styles.secondaryButton}>
              Hide report options
            </button>

            <select className={styles.zoomSelect} defaultValue="fit">
              <option value="fit">Fit page</option>
              <option value="100">100%</option>
              <option value="110">110%</option>
            </select>

            <button
              type="button"
              className={styles.primaryButton}
              disabled={exportDisabled}
            >
              Export PDF
            </button>
          </div>
        </header>

        <div className={styles.quickBar}>
          {reportSections.map((section) => (
            <button
              key={section.id}
              type="button"
              className={
                activeSectionId === section.id
                  ? styles.quickButtonActive
                  : styles.quickButton
              }
              onClick={() => onSectionChange(section.id)}
            >
              {section.shortLabel || section.label}
            </button>
          ))}

          {settingsSections.map((section) => (
            <button
              key={section.id}
              type="button"
              className={
                activeSectionId === section.id
                  ? styles.quickButtonActive
                  : styles.quickButton
              }
              onClick={() => onSectionChange(section.id)}
            >
              {section.shortLabel || section.label}
            </button>
          ))}
        </div>

        <section className={styles.workspace}>
          <aside className={styles.optionsPanel}>
            <div className={styles.optionsHeader}>{reportOptionsTitle}</div>
            <div className={styles.optionsSubHeader}>
              {reportOptionsDescription}
            </div>

            {reportOptionsContent ? (
              <div className={styles.optionList}>{reportOptionsContent}</div>
            ) : reportOptions.length ? (
              <div className={styles.optionList}>
                {reportOptions.map((option) => (
                  <label
                    key={option.id}
                    className={
                      option.disabled
                        ? styles.optionRowDisabled
                        : styles.optionRow
                    }
                  >
                    <input
                      type="checkbox"
                      checked={option.checked}
                      disabled={option.disabled}
                      onChange={(event) =>
                        option.onChange?.(event.target.checked)
                      }
                    />

                    <span>
                      <span className={styles.optionLabel}>{option.label}</span>

                      {option.description ? (
                        <span className={styles.optionDescription}>
                          {option.description}
                        </span>
                      ) : null}
                    </span>
                  </label>
                ))}
              </div>
            ) : (
              <div className={styles.emptyOptions}>{emptyOptionsMessage}</div>
            )}
          </aside>

          <section className={styles.canvasHost}>
            <div className={styles.canvasToolbar}>
              <span>A4 print-aware canvas</span>
              <span className={styles.statusPill}>Not signed off yet</span>
            </div>

            <div className={styles.scrollArea}>
              <div className={styles.pageStackFit}>{children}</div>
            </div>
          </section>
        </section>
      </main>
    </div>
  );
}