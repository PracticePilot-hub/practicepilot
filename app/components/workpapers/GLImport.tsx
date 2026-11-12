"use client";
import AfsAmountInput from "@/app/components/afs/AfsAmountInput";

import { useMemo, useState } from "react";
import {
  validateGL,
  glCode,
  yearStart,
  type GLTransaction,
} from "@/app/lib/workpapers/gl";
import { workpaperRequest } from "./client";
import "./workpapers.css";
const columnNames = [
  "Account code",
  "Account name",
  "Date",
  "Reference",
  "Description",
  "Debit",
  "Credit",
];
export default function GLImport({
  engagementId,
  yearEnd,
  onImported,
  onClose,
}: {
  engagementId: string;
  yearEnd: string;
  onImported: () => void;
  onClose: () => void;
}) {
  const [rows, setRows] = useState<unknown[][]>([]),
    [columns, setColumns] = useState([0, 1, 2, 3, 4, 5, 6]),
    [header, setHeader] = useState(1),
    [filename, setFilename] = useState(""),
    [openings, setOpenings] = useState<Record<string, string>>({}),
    [start, setStart] = useState(yearEnd ? yearStart(yearEnd) : ""),
    [end, setEnd] = useState(yearEnd),
    [updateTB, setUpdateTB] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [sheet, setSheet] = useState(""),
    [sheets, setSheets] = useState<Record<string, unknown[][]>>({});
  const transactions = useMemo(
    () =>
      rows
        .slice(header)
        .filter((row) =>
          row.some((v) => v !== "" && v !== null && v !== undefined),
        )
        .map((row) => {
          const values = columns.map((i) => row[i]);
          let date = values[2];
          if (date instanceof Date) date = date.toISOString().slice(0, 10);
          return {
            accountCode: glCode(values[0]),
            accountName: String(values[1] || ""),
            date: String(date || "").slice(0, 10),
            reference: String(values[3] || ""),
            description: String(values[4] || ""),
            debit:
              values[5] === "" || values[5] === undefined
                ? 0
                : Number(values[5]),
            credit:
              values[6] === "" || values[6] === undefined
                ? 0
                : Number(values[6]),
          } as GLTransaction;
        }),
    [rows, header, columns],
  );
  const accounts = useMemo(
    () => [
      ...new Map(
        transactions.map((row) => [row.accountCode, row.accountName]),
      ).entries(),
    ],
    [transactions],
  );
  const openingNumbers = Object.fromEntries(
    Object.entries(openings)
      .filter(([, v]) => v.trim() !== "")
      .map(([code, value]) => [code, Number(value)]),
  );
  let checked: ReturnType<typeof validateGL> | null = null,
    validation = "";
  if (transactions.length) {
    try {
      const width = Math.max(
        ...rows.slice(0, Math.max(header + 20, 20)).map((row) => row.length),
      );
      const required = [
        columns[0],
        columns[1],
        columns[2],
        columns[5],
        columns[6],
      ];
      if (
        required.some((column) => column < 0 || column >= width) ||
        new Set(required).size !== required.length
      )
        throw new Error(
          "Choose separate account-code, account-name, date, debit and credit columns from this file.",
        );
      checked = validateGL(transactions, openingNumbers, start, end);
    } catch (e) {
      validation = (e as Error).message;
    }
  }
  async function fileChanged(file: File) {
    setError("");
    try {
      if (file.size > 15_000_000)
        throw new Error(
          "Choose a GL export smaller than 15 MB for interactive import.",
        );
      const XLSX = await import("xlsx"),
        workbook = XLSX.read(await file.arrayBuffer(), {
          type: "array",
          cellDates: true,
        }),
        all = Object.fromEntries(
          workbook.SheetNames.map((name) => [
            name,
            XLSX.utils.sheet_to_json<unknown[]>(workbook.Sheets[name], {
              header: 1,
              defval: "",
              raw: true,
            }),
          ]),
        );
      setSheets(all);
      setSheet(workbook.SheetNames[0]);
      setRows(all[workbook.SheetNames[0]]);
      setFilename(file.name);
      setOpenings({});
    } catch (e) {
      setError((e as Error).message);
    }
  }
  async function submit() {
    setBusy(true);
    setError("");
    try {
      const result = await workpaperRequest<{ count: number }>(
        `/api/workpapers/afs/${engagementId}/ledger`,
        {
          method: "POST",
          body: JSON.stringify({
            filename,
            periodStart: start,
            periodEnd: end,
            transactions,
            openings: openingNumbers,
            updateTrialBalance: updateTB,
          }),
        },
      );
      onImported();
      window.alert(
        `${result.count} ledger transactions imported. ${updateTB ? "Current TB balances have been generated; mappings and PP adjustments are preserved." : "Trial balance balances were not changed."}`,
      );
      onClose();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div
      className="wp-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="Import general ledger detail"
    >
      <section className="wp-picker" style={{ width: 1100 }}>
        <div className="wp-workspace" style={{ border: 0 }}>
          <header className="wp-toolbar">
            <div>
              <strong>Import general ledger detail</strong>
              <span className="wp-tag">
                Full reporting period · debit / credit export
              </span>
            </div>
            <button disabled={busy} onClick={onClose}>
              Close
            </button>
          </header>
          <p className="wp-muted">
            Import transactions once, then inspect them from each lead sheet. PP
            journals remain separate. The original import is retained and
            duplicate imports are rejected.
          </p>
          {error ? (
            <p role="alert" className="wp-error">
              {error}
            </p>
          ) : null}
          <input
            disabled={busy}
            className="wp-file-input"
            type="file"
            accept=".xlsx,.xls,.csv"
            onChange={(e) => {
              if (e.target.files?.[0]) void fileChanged(e.target.files[0]);
            }}
          />
          {rows.length ? (
            <>
              <div className="wp-columns">
                <label className="wp-field">
                  Worksheet
                  <select
                    value={sheet}
                    onChange={(e) => {
                      setSheet(e.target.value);
                      setRows(sheets[e.target.value]);
                      setOpenings({});
                    }}
                  >
                    {Object.keys(sheets).map((s) => (
                      <option key={s}>{s}</option>
                    ))}
                  </select>
                </label>
                <label className="wp-field">
                  Header rows to skip
                  <AfsAmountInput
                    type="number"
                    min={0}
                    max={rows.length - 1}
                    value={header}
                    onChange={(e) =>
                      setHeader(Math.max(0, Number(e.target.value)))
                    }
                  />
                </label>
                <label className="wp-field">
                  Reporting period start
                  <input
                    type="date"
                    value={start}
                    onChange={(e) => setStart(e.target.value)}
                  />
                </label>
                <label className="wp-field">
                  Reporting period end
                  <input
                    type="date"
                    value={end}
                    onChange={(e) => setEnd(e.target.value)}
                  />
                </label>
              </div>
              <div className="wp-columns">
                {columnNames.map((name, i) => (
                  <label className="wp-field" key={name}>
                    {name}
                    <select
                      value={columns[i]}
                      onChange={(e) =>
                        setColumns((c) =>
                          c.map((v, j) =>
                            j === i ? Number(e.target.value) : v,
                          ),
                        )
                      }
                    >
                      {(rows[Math.max(0, header - 1)] || rows[0] || []).map(
                        (v, j) => (
                          <option key={j} value={j}>
                            {j + 1} · {String(v || `Column ${j + 1}`)}
                          </option>
                        ),
                      )}
                    </select>
                  </label>
                ))}
              </div>
              <h3>Opening balances</h3>
              <p className="wp-muted">
                Debit balances positive; credit balances negative. Supply each
                opening balance explicitly, including zero. Do not include
                opening-balance entries again in the transaction rows.
              </p>
              <div className="wp-table-scroll">
                <table className="wp-table">
                  <thead>
                    <tr>
                      <th>Account</th>
                      <th>Opening balance</th>
                      <th>Calculated closing</th>
                    </tr>
                  </thead>
                  <tbody>
                    {accounts.map(([code, name]) => (
                      <tr key={code}>
                        <td>
                          {code} · {name}
                        </td>
                        <td>
                          <AfsAmountInput
                            aria-label={`Opening balance ${code}`}
                            type="number"
                            step="0.01"
                            value={openings[code] ?? ""}
                            onChange={(e) =>
                              setOpenings({
                                ...openings,
                                [code]: e.target.value,
                              })
                            }
                          />
                        </td>
                        <td>
                          {checked?.accounts
                            .find((a) => a.code === code)
                            ?.closing.toLocaleString("en-ZA", {
                              minimumFractionDigits: 2,
                            }) || "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p>
                {transactions.length} transactions · {accounts.length} accounts
              </p>
              {validation ? (
                <p className="wp-notice">{validation}</p>
              ) : (
                <p className="wp-notice">
                  Movement imbalance: {checked?.difference.toFixed(2)} · Opening
                  imbalance: {checked?.openingDifference.toFixed(2)}
                </p>
              )}
              <label
                className="wp-field"
                style={{ flexDirection: "row", alignItems: "center" }}
              >
                <input
                  type="checkbox"
                  style={{ width: "auto" }}
                  checked={updateTB}
                  onChange={(e) => setUpdateTB(e.target.checked)}
                />
                Generate / update current TB from these opening balances and GL
                movements
              </label>
              <p className="wp-muted">
                Existing mappings, comparative balances, manual adjustments and
                posted PP journals are retained. Only supplied accounts are
                updated. Leave this unchecked to import supporting detail
                without changing figures.
              </p>
              <div className="wp-actions">
                <button
                  className="wp-primary"
                  disabled={
                    busy ||
                    !checked ||
                    (updateTB &&
                      (Math.abs(checked.difference) > 0.005 ||
                        Math.abs(checked.openingDifference) > 0.005))
                  }
                  onClick={() => void submit()}
                >
                  {busy
                    ? "Importing…"
                    : updateTB
                      ? "Import GL and generate current TB"
                      : "Import supporting GL detail"}
                </button>
              </div>
            </>
          ) : null}
        </div>
      </section>
    </div>
  );
}
