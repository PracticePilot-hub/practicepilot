"use client";

import { ReactNode } from "react";
import styles from "./AfsA4Page.module.css";

type AfsA4PageProps = {
  children: ReactNode;
  clientName?: string;
  registrationNumber?: string | null;
  yearEndLabel?: string;
  showReportHeader?: boolean;
};

export default function AfsA4Page({
  children,
  clientName,
  registrationNumber,
  yearEndLabel,
  showReportHeader = false,
}: AfsA4PageProps) {
  return (
    <article className={styles.page} data-afs-a4-page="true">
      <div className={styles.content} data-afs-a4-content="true">
        {showReportHeader ? (
          <header className={styles.reportHeader} data-afs-report-header="true">
            <div className={styles.reportClientName}>{clientName}</div>

            {registrationNumber ? (
              <div className={styles.reportMeta}>
                Registration number: {registrationNumber}
              </div>
            ) : null}

            {yearEndLabel ? (
              <div className={styles.reportMeta}>{yearEndLabel}</div>
            ) : null}
          </header>
        ) : null}

        {children}
      </div>
    </article>
  );
}
