"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "",
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ""
);

type ClientPricingRow = {
  itemCode: string;
  description: string;
  categoryName: string;
  categorySort: number;
  itemSort: number;
  supplierCostExVat: number;
  currentHqMarkupPercent: number;
  currentPtaMarkupPercent: number;
  normalHqPrice: number;
  normalClientPrice: number;
  scenarioHqPrice: number;
  scenarioClientPrice: number;
};

type RowWithQty = ClientPricingRow & {
  qty: number;
};

type GroupedRows = {
  categoryName: string;
  rows: RowWithQty[];
};

function money(value: number | null | undefined) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return "-";
  }

  return `R ${Number(value).toLocaleString("en-ZA", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function percentage(value: number | null | undefined) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return "-";
  }

  return `${Number(value).toFixed(2)}%`;
}

function formatMonth(value: string) {
  if (!value) return "";

  const [year, month] = value.split("-");
  const date = new Date(Number(year), Number(month) - 1, 1);

  return date.toLocaleDateString("en-ZA", {
    month: "long",
    year: "numeric",
  });
}

function escapeHtml(value: string) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export default function CubeChemClientPricingPage() {
  const router = useRouter();

  const [currentUserEmail, setCurrentUserEmail] = useState("");
  const [accessLoading, setAccessLoading] = useState(true);
  const [accessAllowed, setAccessAllowed] = useState(false);

  const [priceMonth, setPriceMonth] = useState("2026-09");
  const [hqMarkupPercent, setHqMarkupPercent] = useState("15");
  const [ptaMarkupPercent, setPtaMarkupPercent] = useState("45");

  const [rows, setRows] = useState<RowWithQty[]>([]);
  const [loading, setLoading] = useState(false);
  const [showSummary, setShowSummary] = useState(false);

  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    checkAccess();
  }, []);

  const selectedRows = useMemo(
    () => rows.filter((row) => Number(row.qty || 0) > 0),
    [rows]
  );

  const groupedRows = useMemo<GroupedRows[]>(() => {
    const groups = new Map<string, RowWithQty[]>();

    for (const row of rows) {
      const category = row.categoryName || "Other";

      if (!groups.has(category)) {
        groups.set(category, []);
      }

      groups.get(category)?.push(row);
    }

    return Array.from(groups.entries()).map(([categoryName, groupRows]) => ({
      categoryName,
      rows: groupRows,
    }));
  }, [rows]);

  const totals = useMemo(() => {
    return selectedRows.reduce(
      (acc, row) => {
        const qty = Number(row.qty || 0);
        const normal = Number(row.normalClientPrice || 0) * qty;
        const scenario = Number(row.scenarioClientPrice || 0) * qty;
        const saving = Math.max(0, normal - scenario);

        acc.normalTotal += normal;
        acc.scenarioTotal += scenario;
        acc.savingTotal += saving;
        acc.abyxCostTotal += Number(row.supplierCostExVat || 0) * qty;
        acc.ptaToHqTotal += Number(row.scenarioHqPrice || 0) * qty;

        return acc;
      },
      {
        normalTotal: 0,
        scenarioTotal: 0,
        savingTotal: 0,
        abyxCostTotal: 0,
        ptaToHqTotal: 0,
      }
    );
  }, [selectedRows]);

  const savingPercent =
    totals.normalTotal > 0
      ? (totals.savingTotal / totals.normalTotal) * 100
      : 0;

  async function checkAccess() {
    setAccessLoading(true);
    setError("");

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user?.email) {
        router.push("/login");
        return;
      }

      const email = user.email.toLowerCase();
      setCurrentUserEmail(email);

      const res = await fetch("/api/cubechem/check-access", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-practicepilot-user-email": email,
        },
        body: JSON.stringify({ email }),
      });

      const data = await res.json();

      if (!res.ok || !data.allowed) {
        setAccessAllowed(false);
        setError(data.error || "You do not have access to CubeChem.");
        return;
      }

      setAccessAllowed(true);
    } catch (err) {
      setAccessAllowed(false);
      setError(err instanceof Error ? err.message : "Access check failed.");
    } finally {
      setAccessLoading(false);
    }
  }

  async function loadRows() {
    setLoading(true);
    setMessage("");
    setError("");
    setRows([]);
    setShowSummary(false);

    const hq = Number(hqMarkupPercent);
    const pta = Number(ptaMarkupPercent);

    if (!Number.isFinite(hq) || !Number.isFinite(pta)) {
      setError("Please enter valid HQ and PTA markup percentages.");
      setLoading(false);
      return;
    }

    try {
      const res = await fetch("/api/cubechem/client-pricing", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-practicepilot-user-email": currentUserEmail,
        },
        body: JSON.stringify({
          priceMonth,
          hqMarkupPercent: hq,
          ptaMarkupPercent: pta,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Could not load client pricing.");
      }

      setRows(
        (data.rows || []).map((row: ClientPricingRow) => ({
          ...row,
          qty: 0,
        }))
      );

      setMessage(
        `${formatMonth(priceMonth)} loaded. ${data.itemCount || 0} priced items available.`
      );
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not load client pricing."
      );
    } finally {
      setLoading(false);
    }
  }

  function updateQty(itemCode: string, qtyValue: string) {
    const qty = qtyValue === "" ? 0 : Number(qtyValue);

    setRows((current) =>
      current.map((row) =>
        row.itemCode === itemCode
          ? {
              ...row,
              qty: Number.isFinite(qty) ? qty : 0,
            }
          : row
      )
    );
  }

  function openSummary() {
    if (selectedRows.length === 0) {
      setError("Please enter at least one quantity before viewing the summary.");
      return;
    }

    setError("");
    setShowSummary(true);
  }

  function printSummary() {
    if (selectedRows.length === 0) {
      setError("Please enter at least one quantity before printing.");
      return;
    }

    const rowsHtml = selectedRows
      .map((row) => {
        const qty = Number(row.qty || 0);
        const normalTotal = qty * Number(row.normalClientPrice || 0);
        const scenarioTotal = qty * Number(row.scenarioClientPrice || 0);
        const saving = Math.max(0, normalTotal - scenarioTotal);

        return `
          <tr>
            <td>${escapeHtml(row.itemCode)}</td>
            <td>${escapeHtml(row.description)}</td>
            <td class="right">${qty}</td>
            <td class="right">${money(row.normalClientPrice)}</td>
            <td class="right">${money(row.scenarioClientPrice)}</td>
            <td class="right">${money(saving)}</td>
            <td class="right">${money(scenarioTotal)}</td>
          </tr>
        `;
      })
      .join("");

    const html = `
      <!doctype html>
      <html>
        <head>
          <title>CubeChem Client Pricing Summary</title>
          <style>
            body {
              font-family: Arial, sans-serif;
              padding: 24px;
              color: #0f172a;
            }

            h1 {
              margin: 0;
              font-size: 24px;
            }

            p {
              margin: 6px 0 20px;
              color: #475569;
              font-size: 13px;
              font-weight: 700;
            }

            .summary {
              display: grid;
              grid-template-columns: repeat(3, 1fr);
              gap: 10px;
              margin-bottom: 18px;
            }

            .summary div {
              border: 1px solid #cbd5e1;
              padding: 10px;
            }

            .summary strong {
              display: block;
              margin-bottom: 4px;
            }

            table {
              width: 100%;
              border-collapse: collapse;
              font-size: 12px;
            }

            th {
              text-align: left;
              background: #f1f5f9;
              border-bottom: 1px solid #cbd5e1;
              padding: 8px;
            }

            td {
              border-bottom: 1px solid #e2e8f0;
              padding: 8px;
              vertical-align: top;
            }

            .right {
              text-align: right;
              white-space: nowrap;
            }

            tfoot td {
              font-weight: 900;
              background: #f1f5f9;
              border-top: 2px solid #cbd5e1;
            }

            @page {
              size: landscape;
              margin: 12mm;
            }
          </style>
        </head>

        <body>
          <h1>Client Pricing Summary</h1>
          <p>
            ${formatMonth(priceMonth)} pricing scenario • HQ ${escapeHtml(
      hqMarkupPercent
    )}% • PTA ${escapeHtml(ptaMarkupPercent)}%
          </p>

          <div class="summary">
            <div>
              <strong>Normal Client Total</strong>
              ${money(totals.normalTotal)}
            </div>

            <div>
              <strong>Adjusted Client Total</strong>
              ${money(totals.scenarioTotal)}
            </div>

            <div>
              <strong>Client Saving</strong>
              ${money(totals.savingTotal)} (${percentage(savingPercent)})
            </div>
          </div>

          <table>
            <thead>
              <tr>
                <th>Code</th>
                <th>Description</th>
                <th class="right">Qty</th>
                <th class="right">Normal / Unit</th>
                <th class="right">Adjusted / Unit</th>
                <th class="right">Saving</th>
                <th class="right">Adjusted Total</th>
              </tr>
            </thead>

            <tbody>
              ${rowsHtml}
            </tbody>

            <tfoot>
              <tr>
                <td colspan="4">Total</td>
                <td class="right">${money(totals.normalTotal)}</td>
                <td class="right">${money(totals.savingTotal)}</td>
                <td class="right">${money(totals.scenarioTotal)}</td>
              </tr>
            </tfoot>
          </table>
        </body>
      </html>
    `;

    const printWindow = window.open("", "_blank", "width=1200,height=800");

    if (!printWindow) {
      setError("Popup blocked. Please allow popups and try again.");
      return;
    }

    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();

    printWindow.onload = () => {
      printWindow.focus();
      printWindow.print();
    };
  }

  function renderRows(sectionRows: RowWithQty[]) {
    return sectionRows.map((row) => {
      const qty = Number(row.qty || 0);
      const normalTotal = qty * Number(row.normalClientPrice || 0);
      const scenarioTotal = qty * Number(row.scenarioClientPrice || 0);
      const unitSaving = Math.max(
        0,
        Number(row.normalClientPrice || 0) -
          Number(row.scenarioClientPrice || 0)
      );
      const totalSaving = Math.max(0, normalTotal - scenarioTotal);

      return (
        <tr key={row.itemCode}>
          <td style={tdStyle}>{row.itemCode}</td>
          <td style={tdStyle}>{row.description}</td>
          <td style={tdRightStyle}>{money(row.supplierCostExVat)}</td>
          <td style={tdRightStyle}>{percentage(row.currentHqMarkupPercent)}</td>
          <td style={tdRightStyle}>{percentage(row.currentPtaMarkupPercent)}</td>
          <td style={tdRightStyle}>{money(row.normalClientPrice)}</td>
          <td style={tdRightStyle}>{money(row.scenarioHqPrice)}</td>
          <td style={tdRightStyle}>{money(row.scenarioClientPrice)}</td>
          <td style={tdRightStyle}>
            {unitSaving > 0 ? money(unitSaving) : "-"}
          </td>
          <td style={tdRightStyle}>
            <input
              type="number"
              min="0"
              value={row.qty || ""}
              onChange={(e) => updateQty(row.itemCode, e.target.value)}
              style={qtyInputStyle}
            />
          </td>
          <td style={tdRightStyle}>{money(scenarioTotal)}</td>
          <td style={tdRightStyle}>
            {totalSaving > 0 ? money(totalSaving) : "-"}
          </td>
        </tr>
      );
    });
  }

  if (accessLoading) {
    return (
      <main style={pageStyle}>
        <section style={cardStyle}>
          <h1 style={titleStyle}>Client Price Calculator</h1>
          <p>Checking access...</p>
        </section>
      </main>
    );
  }

  if (!accessAllowed) {
    return (
      <main style={pageStyle}>
        <section style={cardStyle}>
          <h1 style={titleStyle}>Access denied</h1>
          <p>{error || "You do not have access to this screen."}</p>
        </section>
      </main>
    );
  }

  return (
    <main style={pageStyle}>
      <div style={{ maxWidth: "1800px", margin: "0 auto" }}>
        <button
          onClick={() => router.push("/cubechem")}
          style={backButtonStyle}
        >
          ← Back to Price Manager
        </button>

        <h1 style={titleStyle}>Client Price Calculator</h1>

        <p style={textStyle}>
          Test a temporary client pricing scenario by changing the HQ and PTA
          markup percentages. Nothing changed here is saved back to the CubeChem
          master price list.
        </p>

        <section style={cardStyle}>
          <div style={controlsStyle}>
            <label style={labelStyle}>
              Month
              <input
                type="month"
                value={priceMonth}
                onChange={(e) => setPriceMonth(e.target.value)}
                style={inputStyle}
              />
            </label>

            <label style={labelStyle}>
              HQ Markup %
              <input
                type="number"
                value={hqMarkupPercent}
                onChange={(e) => setHqMarkupPercent(e.target.value)}
                style={inputStyle}
              />
            </label>

            <label style={labelStyle}>
              PTA Markup %
              <input
                type="number"
                value={ptaMarkupPercent}
                onChange={(e) => setPtaMarkupPercent(e.target.value)}
                style={inputStyle}
              />
            </label>

            <button
              onClick={loadRows}
              disabled={loading}
              style={{
                ...buttonStyle,
                opacity: loading ? 0.7 : 1,
                cursor: loading ? "not-allowed" : "pointer",
              }}
            >
              {loading
                ? "Loading..."
                : `Load ${formatMonth(priceMonth)} Pricing`}
            </button>
          </div>
        </section>

        {message && <div style={successStyle}>{message}</div>}
        {error && <div style={errorStyle}>{error}</div>}

        {rows.length > 0 && (
          <section style={{ ...cardStyle, marginTop: "20px" }}>
            <div style={summaryStyle}>
              <div>
                <span style={summaryLabelStyle}>Normal Client Total</span>
                <strong>{money(totals.normalTotal)}</strong>
              </div>

              <div>
                <span style={summaryLabelStyle}>Adjusted Client Total</span>
                <strong>{money(totals.scenarioTotal)}</strong>
              </div>

              <div>
                <span style={summaryLabelStyle}>Client Saving</span>
                <strong>
                  {money(totals.savingTotal)}{" "}
                  {totals.normalTotal > 0 ? `(${percentage(savingPercent)})` : ""}
                </strong>
              </div>

              <div>
                <span style={summaryLabelStyle}>Payable PTA to HQ</span>
                <strong>{money(totals.ptaToHqTotal)}</strong>
              </div>

              <div style={summaryButtonCellStyle}>
                <button onClick={openSummary} style={summaryButtonStyle}>
                  View Pricing Summary
                </button>
              </div>
            </div>

            <div style={{ overflowX: "auto", marginTop: "20px" }}>
              <table style={tableStyle}>
                <tbody>
                  {groupedRows.map((group) => (
                    <React.Fragment key={group.categoryName}>
                      <tr>
                        <td colSpan={12} style={sectionRowStyle}>
                          {group.categoryName}
                        </td>
                      </tr>

                      <tr>
                        <th style={thStyle}>Code</th>
                        <th style={thStyle}>Description</th>
                        <th style={thRightStyle}>Cost Ex VAT</th>
                        <th style={thRightStyle}>Normal HQ %</th>
                        <th style={thRightStyle}>Normal PTA %</th>
                        <th style={thRightStyle}>Normal Client Price</th>
                        <th style={thRightStyle}>Scenario PTA to HQ</th>
                        <th style={thRightStyle}>Scenario Client Price</th>
                        <th style={thRightStyle}>Saving / Unit</th>
                        <th style={thRightStyle}>Qty</th>
                        <th style={thRightStyle}>Adjusted Total</th>
                        <th style={thRightStyle}>Total Saving</th>
                      </tr>

                      {renderRows(group.rows)}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </div>

      {showSummary && (
        <div style={modalOverlayStyle}>
          <div style={modalCardStyle}>
            <div style={modalHeaderStyle}>
              <div>
                <h2 style={modalTitleStyle}>Client Pricing Summary</h2>
                <p style={modalTextStyle}>
                  {formatMonth(priceMonth)} • HQ {hqMarkupPercent}% • PTA{" "}
                  {ptaMarkupPercent}%
                </p>
              </div>

              <button
                onClick={() => setShowSummary(false)}
                style={modalCloseButtonStyle}
              >
                ×
              </button>
            </div>

            <div style={modalSummaryStyle}>
              <div>
                <span style={summaryLabelStyle}>Normal Client Total</span>
                <strong>{money(totals.normalTotal)}</strong>
              </div>

              <div>
                <span style={summaryLabelStyle}>Adjusted Client Total</span>
                <strong>{money(totals.scenarioTotal)}</strong>
              </div>

              <div>
                <span style={summaryLabelStyle}>Client Saving</span>
                <strong>
                  {money(totals.savingTotal)} ({percentage(savingPercent)})
                </strong>
              </div>
            </div>

            <div style={{ overflowX: "auto", marginTop: "16px" }}>
              <table style={tableStyle}>
                <thead>
                  <tr>
                    <th style={thStyle}>Code</th>
                    <th style={thStyle}>Description</th>
                    <th style={thRightStyle}>Qty</th>
                    <th style={thRightStyle}>Normal / Unit</th>
                    <th style={thRightStyle}>Adjusted / Unit</th>
                    <th style={thRightStyle}>Saving</th>
                    <th style={thRightStyle}>Adjusted Total</th>
                  </tr>
                </thead>

                <tbody>
                  {selectedRows.map((row) => {
                    const qty = Number(row.qty || 0);
                    const normalTotal =
                      qty * Number(row.normalClientPrice || 0);
                    const adjustedTotal =
                      qty * Number(row.scenarioClientPrice || 0);
                    const saving = Math.max(0, normalTotal - adjustedTotal);

                    return (
                      <tr key={row.itemCode}>
                        <td style={tdStyle}>{row.itemCode}</td>
                        <td style={tdStyle}>{row.description}</td>
                        <td style={tdRightStyle}>{qty}</td>
                        <td style={tdRightStyle}>
                          {money(row.normalClientPrice)}
                        </td>
                        <td style={tdRightStyle}>
                          {money(row.scenarioClientPrice)}
                        </td>
                        <td style={tdRightStyle}>
                          {saving > 0 ? money(saving) : "-"}
                        </td>
                        <td style={tdRightStyle}>{money(adjustedTotal)}</td>
                      </tr>
                    );
                  })}
                </tbody>

                <tfoot>
                  <tr>
                    <td style={totalCellStyle} colSpan={4}>
                      Total
                    </td>
                    <td style={totalRightCellStyle}>
                      {money(totals.normalTotal)}
                    </td>
                    <td style={totalRightCellStyle}>
                      {money(totals.savingTotal)}
                    </td>
                    <td style={totalRightCellStyle}>
                      {money(totals.scenarioTotal)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>

            <div style={modalFooterStyle}>
              <button onClick={printSummary} style={printButtonStyle}>
                Print
              </button>

              <button
                onClick={() => setShowSummary(false)}
                style={doneButtonStyle}
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

const pageStyle: React.CSSProperties = {
  minHeight: "100vh",
  background: "#f8fafc",
  padding: "32px",
};

const titleStyle: React.CSSProperties = {
  margin: 0,
  color: "#0f172a",
  fontSize: "34px",
  fontWeight: 800,
};

const textStyle: React.CSSProperties = {
  color: "#475569",
  fontSize: "16px",
  maxWidth: "1100px",
};

const cardStyle: React.CSSProperties = {
  background: "#ffffff",
  border: "1px solid #e2e8f0",
  borderRadius: "18px",
  padding: "22px",
  boxShadow: "0 10px 25px rgba(15, 23, 42, 0.06)",
};

const backButtonStyle: React.CSSProperties = {
  border: "1px solid #cbd5e1",
  background: "#ffffff",
  color: "#0f172a",
  borderRadius: "12px",
  padding: "10px 14px",
  fontWeight: 800,
  cursor: "pointer",
  marginBottom: "18px",
};

const controlsStyle: React.CSSProperties = {
  display: "flex",
  gap: "14px",
  alignItems: "end",
  flexWrap: "wrap",
};

const labelStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "8px",
  fontSize: "14px",
  fontWeight: 800,
  color: "#334155",
};

const inputStyle: React.CSSProperties = {
  border: "1px solid #cbd5e1",
  borderRadius: "12px",
  padding: "10px",
  fontSize: "14px",
  minWidth: "150px",
  background: "#ffffff",
};

const buttonStyle: React.CSSProperties = {
  border: "none",
  borderRadius: "12px",
  padding: "12px 18px",
  background: "#0f172a",
  color: "#ffffff",
  fontWeight: 800,
};

const successStyle: React.CSSProperties = {
  marginTop: "18px",
  background: "#dcfce7",
  color: "#166534",
  border: "1px solid #bbf7d0",
  borderRadius: "14px",
  padding: "14px 16px",
  fontWeight: 800,
};

const errorStyle: React.CSSProperties = {
  marginTop: "18px",
  background: "#fee2e2",
  color: "#991b1b",
  border: "1px solid #fecaca",
  borderRadius: "14px",
  padding: "14px 16px",
  fontWeight: 800,
};

const summaryStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr 1fr 1fr 240px",
  gap: "12px",
  background: "#f8fafc",
  border: "1px solid #e2e8f0",
  borderRadius: "14px",
  padding: "14px",
  fontSize: "16px",
  alignItems: "center",
};

const summaryLabelStyle: React.CSSProperties = {
  display: "block",
  color: "#64748b",
  fontSize: "12px",
  fontWeight: 800,
  marginBottom: "4px",
};

const summaryButtonCellStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "flex-end",
};

const summaryButtonStyle: React.CSSProperties = {
  border: "none",
  borderRadius: "12px",
  padding: "12px 18px",
  background: "#2563eb",
  color: "#ffffff",
  fontWeight: 900,
  cursor: "pointer",
};

const tableStyle: React.CSSProperties = {
  width: "100%",
  borderCollapse: "collapse",
  fontSize: "13px",
};

const sectionRowStyle: React.CSSProperties = {
  padding: "12px 10px",
  background: "#e2e8f0",
  color: "#0f172a",
  fontWeight: 900,
  borderTop: "2px solid #cbd5e1",
  borderBottom: "1px solid #cbd5e1",
  textTransform: "uppercase",
};

const thStyle: React.CSSProperties = {
  textAlign: "left",
  padding: "9px 7px",
  borderBottom: "1px solid #cbd5e1",
  background: "#f1f5f9",
  color: "#334155",
  whiteSpace: "normal",
  lineHeight: 1.15,
};

const thRightStyle: React.CSSProperties = {
  ...thStyle,
  textAlign: "right",
};

const tdStyle: React.CSSProperties = {
  padding: "8px 7px",
  borderBottom: "1px solid #e2e8f0",
  color: "#0f172a",
  verticalAlign: "top",
};

const tdRightStyle: React.CSSProperties = {
  ...tdStyle,
  textAlign: "right",
  whiteSpace: "nowrap",
};

const qtyInputStyle: React.CSSProperties = {
  border: "1px solid #cbd5e1",
  borderRadius: "10px",
  padding: "8px",
  fontSize: "13px",
  width: "72px",
  textAlign: "right",
  fontWeight: 800,
};

const modalOverlayStyle: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  background: "rgba(15, 23, 42, 0.55)",
  zIndex: 9999,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "24px",
};

const modalCardStyle: React.CSSProperties = {
  background: "#ffffff",
  borderRadius: "22px",
  padding: "24px",
  width: "min(1300px, 96vw)",
  maxHeight: "88vh",
  overflowY: "auto",
  boxShadow: "0 25px 80px rgba(15, 23, 42, 0.35)",
};

const modalHeaderStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: "16px",
};

const modalTitleStyle: React.CSSProperties = {
  margin: 0,
  color: "#0f172a",
  fontSize: "28px",
  fontWeight: 900,
};

const modalTextStyle: React.CSSProperties = {
  margin: "6px 0 0",
  color: "#64748b",
  fontSize: "14px",
  fontWeight: 700,
};

const modalCloseButtonStyle: React.CSSProperties = {
  border: "none",
  background: "#f1f5f9",
  color: "#0f172a",
  borderRadius: "12px",
  width: "42px",
  height: "42px",
  fontSize: "26px",
  lineHeight: "26px",
  cursor: "pointer",
};

const modalSummaryStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr 1fr",
  gap: "12px",
  marginTop: "18px",
  background: "#f8fafc",
  border: "1px solid #e2e8f0",
  padding: "14px",
};

const modalFooterStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "flex-end",
  gap: "10px",
  marginTop: "18px",
};

const printButtonStyle: React.CSSProperties = {
  border: "none",
  borderRadius: "12px",
  padding: "12px 18px",
  background: "#16a34a",
  color: "#ffffff",
  fontWeight: 900,
  cursor: "pointer",
};

const doneButtonStyle: React.CSSProperties = {
  border: "none",
  borderRadius: "12px",
  padding: "12px 18px",
  background: "#0f172a",
  color: "#ffffff",
  fontWeight: 900,
  cursor: "pointer",
};

const totalCellStyle: React.CSSProperties = {
  padding: "12px 8px",
  borderTop: "2px solid #cbd5e1",
  color: "#0f172a",
  fontWeight: 900,
  background: "#f1f5f9",
};

const totalRightCellStyle: React.CSSProperties = {
  ...totalCellStyle,
  textAlign: "right",
};
