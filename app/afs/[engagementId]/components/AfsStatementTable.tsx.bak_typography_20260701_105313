"use client";

import styles from "./AfsStatementTable.module.css";

export type AfsStatementRowType =
  | "section"
  | "subsection"
  | "line"
  | "subtotal"
  | "total"
  | "grand-total"
  | "spacer";

export type AfsStatementRow = {
  id: string;
  label?: string;
  note?: string | number | null;
  current?: number | null;
  prior?: number | null;
  type?: AfsStatementRowType;
  indent?: 0 | 1 | 2;
};

type AfsStatementTableProps = {
  title: string;
  subtitle?: string;
  currencyLabel?: string;
  currentHeading: string;
  priorHeading: string;
  rows: AfsStatementRow[];
};

function formatAmount(value?: number | null) {
  if (value === null || value === undefined) return "–";

  const abs = Math.abs(value);
  const formatted = abs.toLocaleString("en-ZA", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });

  return value < 0 ? `(${formatted})` : formatted;
}

export default function AfsStatementTable({
  title,
  subtitle,
  currencyLabel = "Figures in Rand",
  currentHeading,
  priorHeading,
  rows,
}: AfsStatementTableProps) {
  return (
    <section className={styles.statement}>
      <header className={styles.statementHeader}>
        <h1>{title}</h1>
        {subtitle ? <p>{subtitle}</p> : null}
      </header>

      <table className={styles.table}>
        <thead>
          <tr>
            <th className={styles.currencyHeading}>{currencyLabel}</th>
            <th className={styles.noteHeading}>Note</th>
            <th className={styles.amountHeading}>{currentHeading}</th>
            <th className={styles.amountHeading}>{priorHeading}</th>
          </tr>
        </thead>

        <tbody>
          {rows.map((row) => {
            const rowType = row.type || "line";

            if (rowType === "spacer") {
              return (
                <tr key={row.id} className={styles.spacerRow}>
                  <td colSpan={4} />
                </tr>
              );
            }

            return (
              <tr key={row.id} className={styles[rowType]}>
                <td
                  className={[
                    styles.labelCell,
                    row.indent === 1 ? styles.indentOne : "",
                    row.indent === 2 ? styles.indentTwo : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                >
                  {row.label}
                </td>

                <td className={styles.noteCell}>{row.note || ""}</td>

                <td className={styles.amountCell}>
                  {rowType === "section" || rowType === "subsection"
                    ? ""
                    : formatAmount(row.current)}
                </td>

                <td className={styles.amountCell}>
                  {rowType === "section" || rowType === "subsection"
                    ? ""
                    : formatAmount(row.prior)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </section>
  );
}