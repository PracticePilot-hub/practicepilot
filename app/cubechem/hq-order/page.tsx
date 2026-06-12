"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "",
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ""
);

type HqOrderRow = {
  itemCode: string;
  description: string;
  isFrequent: boolean;
  groupName: string;
  abyxPackAmount: number;
  hqMarkupPercent: number;
  ccdPretoriaAmount: number;
};

type RowWithQty = HqOrderRow & {
  qty: number;
};

function moneyRounded(value: number | null | undefined) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return "-";
  }

  return `R ${Math.round(Number(value)).toLocaleString("en-ZA")}`;
}

function moneyCents(value: number | null | undefined) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return "-";
  }

  return `R ${Number(value).toLocaleString("en-ZA", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
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

export default function CubeChemHqOrderPage() {
  const router = useRouter();

  const [currentUserEmail, setCurrentUserEmail] = useState("");
  const [accessLoading, setAccessLoading] = useState(true);
  const [accessAllowed, setAccessAllowed] = useState(false);

  const [priceMonth, setPriceMonth] = useState("2026-06");
  const [hqMarkupPercent, setHqMarkupPercent] = useState("15");

  const [rows, setRows] = useState<RowWithQty[]>([]);
  const [loading, setLoading] = useState(false);
  const [showOrderPopup, setShowOrderPopup] = useState(false);

  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    checkAccess();
  }, []);

  const frequentRows = rows.filter((row) => row.isFrequent);
  const restRows = rows.filter((row) => !row.isFrequent);
  const orderRows = rows.filter((row) => Number(row.qty || 0) > 0);

  const totals = useMemo(() => {
    return rows.reduce(
      (acc, row) => {
        const qty = Number(row.qty || 0);
        acc.abyxPayable += qty * Number(row.abyxPackAmount || 0);
        acc.ptaToHqPayable += qty * Number(row.ccdPretoriaAmount || 0);
        return acc;
      },
      {
        abyxPayable: 0,
        ptaToHqPayable: 0,
      }
    );
  }, [rows]);

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
      setError(err instanceof Error ? err.message : "Access check failed.");
      setAccessAllowed(false);
    } finally {
      setAccessLoading(false);
    }
  }

  async function loadRows() {
    setLoading(true);
    setMessage("");
    setError("");
    setRows([]);
    setShowOrderPopup(false);

    try {
      const res = await fetch("/api/cubechem/hq-order", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-practicepilot-user-email": currentUserEmail,
        },
        body: JSON.stringify({
          priceMonth,
          hqMarkupPercent: Number(hqMarkupPercent),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Could not load HQ order list.");
      }

      const mappedRows = (data.rows || []).map((row: HqOrderRow) => ({
        ...row,
        qty: 0,
      }));

      setRows(mappedRows);
      setMessage(
        `${formatMonth(priceMonth)} loaded. ${data.frequentCount} frequent items and ${data.restCount} rest items.`
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load HQ order list.");
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

  function openOrderPopup() {
    if (orderRows.length === 0) {
      setError("Please enter at least one quantity before viewing the order.");
      return;
    }

    setError("");
    setShowOrderPopup(true);
  }

function printOrderSummary() {
  if (orderRows.length === 0) {
    setError("Please enter at least one quantity before printing the order.");
    return;
  }

  const rowsHtml = orderRows
    .map((row) => {
      const qty = Number(row.qty || 0);
      const abyxPayable = qty * Number(row.abyxPackAmount || 0);
      const ptaToHqPayable = qty * Number(row.ccdPretoriaAmount || 0);

      return `
        <tr>
          <td>${escapeHtml(row.itemCode)}</td>
          <td>${escapeHtml(row.description)}</td>
          <td class="right">${qty}</td>
          <td class="right">${moneyCents(row.abyxPackAmount)}</td>
          <td class="right">${moneyRounded(row.ccdPretoriaAmount)}</td>
          <td class="right">${moneyCents(abyxPayable)}</td>
          <td class="right">${moneyRounded(ptaToHqPayable)}</td>
        </tr>
      `;
    })
    .join("");

  const html = `
    <!doctype html>
    <html>
      <head>
        <title>CubeChem Order Summary</title>
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
        <h1>Order Summary</h1>
        <p>${formatMonth(priceMonth)} order for QuickBooks</p>

        <table>
          <thead>
            <tr>
              <th>Code</th>
              <th>Description</th>
              <th class="right">Qty</th>
              <th class="right">Abyx / Pack</th>
              <th class="right">PTA to HQ / Pack</th>
              <th class="right">Payable to Abyx</th>
              <th class="right">Payable PTA to HQ</th>
            </tr>
          </thead>

          <tbody>
            ${rowsHtml}
          </tbody>

          <tfoot>
            <tr>
              <td colspan="5">Total</td>
              <td class="right">${moneyCents(totals.abyxPayable)}</td>
              <td class="right">${moneyRounded(totals.ptaToHqPayable)}</td>
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
      const abyxPayable = qty * Number(row.abyxPackAmount || 0);
      const ptaToHqPayable = qty * Number(row.ccdPretoriaAmount || 0);

      return (
        <tr key={row.itemCode}>
          <td style={tdStyle}>{row.itemCode}</td>
          <td style={tdStyle}>{row.description}</td>
          <td style={tdRightStyle}>{moneyCents(row.abyxPackAmount)}</td>
          <td style={tdRightStyle}>{row.hqMarkupPercent}%</td>
          <td style={tdRightStyle}>{moneyRounded(row.ccdPretoriaAmount)}</td>
          <td style={tdRightStyle}>
            <input
              type="number"
              min="0"
              value={row.qty || ""}
              onChange={(e) => updateQty(row.itemCode, e.target.value)}
              style={qtyInputStyle}
            />
          </td>
          <td style={tdRightStyle}>{moneyCents(abyxPayable)}</td>
          <td style={tdRightStyle}>{moneyRounded(ptaToHqPayable)}</td>
        </tr>
      );
    });
  }

  if (accessLoading) {
    return (
      <main style={pageStyle}>
        <section style={cardStyle}>
          <h1 style={titleStyle}>HQ Supplier Order Calculator</h1>
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
      <div style={{ maxWidth: "1700px", margin: "0 auto" }}>
        <button onClick={() => router.push("/cubechem")} style={backButtonStyle}>
          ← Back to Price Manager
        </button>

        <h1 style={titleStyle}>HQ Supplier Order Calculator</h1>

        <p style={textStyle}>
          Enter the quantity of packs/boxes ordered. The calculator shows what is payable
          to Abyx and what CCD Pretoria must pay CCD HQ.
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

            <button onClick={loadRows} disabled={loading} style={buttonStyle}>
              {loading ? "Loading..." : `Load ${formatMonth(priceMonth)}`}
            </button>
          </div>
        </section>

        {message && <div style={successStyle}>{message}</div>}
        {error && <div style={errorStyle}>{error}</div>}

        {rows.length > 0 && (
          <section style={{ ...cardStyle, marginTop: "20px" }}>
            <div style={summaryStyle}>
              <div>
                <strong>Total Payable to Abyx</strong>
                <br />
                {moneyCents(totals.abyxPayable)}
              </div>

              <div>
                <strong>Total Payable PTA to HQ</strong>
                <br />
                {moneyRounded(totals.ptaToHqPayable)}
              </div>

              <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end" }}>
                <button onClick={openOrderPopup} style={orderButtonStyle}>
                  View Order Summary
                </button>
              </div>
            </div>

            <div style={{ overflowX: "auto", marginTop: "20px" }}>
              <table style={tableStyle}>
                <tbody>
                  <tr>
                    <td colSpan={8} style={sectionRowStyle}>
                      Frequent Items
                    </td>
                  </tr>

                  <tr>
                    <th style={thStyle}>Code</th>
                    <th style={thStyle}>Supplier Description</th>
                    <th style={thRightStyle}>Payable to Abyx / Pack</th>
                    <th style={thRightStyle}>HQ %</th>
                    <th style={thRightStyle}>Payable PTA to HQ / Pack</th>
                    <th style={thRightStyle}>Qty</th>
                    <th style={thRightStyle}>Payable to Abyx</th>
                    <th style={thRightStyle}>Payable PTA to HQ</th>
                  </tr>

                  {renderRows(frequentRows)}

                  <tr>
                    <td colSpan={8} style={sectionRowStyle}>
                      Rest of Items
                    </td>
                  </tr>

                  <tr>
                    <th style={thStyle}>Code</th>
                    <th style={thStyle}>Supplier Description</th>
                    <th style={thRightStyle}>Payable to Abyx / Pack</th>
                    <th style={thRightStyle}>HQ %</th>
                    <th style={thRightStyle}>Payable PTA to HQ / Pack</th>
                    <th style={thRightStyle}>Qty</th>
                    <th style={thRightStyle}>Payable to Abyx</th>
                    <th style={thRightStyle}>Payable PTA to HQ</th>
                  </tr>

                  {renderRows(restRows)}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </div>

      {showOrderPopup && (
        <div style={modalOverlayStyle}>
          <div style={modalCardStyle}>
            <div style={modalHeaderStyle}>
              <div>
                <h2 style={modalTitleStyle}>Order Summary</h2>
                <p style={modalTextStyle}>{formatMonth(priceMonth)} order for QuickBooks</p>
              </div>

              <button onClick={() => setShowOrderPopup(false)} style={modalCloseButtonStyle}>
                ×
              </button>
            </div>

            <div style={{ overflowX: "auto", marginTop: "16px" }}>
              <table style={tableStyle}>
                <thead>
                  <tr>
                    <th style={thStyle}>Code</th>
                    <th style={thStyle}>Description</th>
                    <th style={thRightStyle}>Qty</th>
                    <th style={thRightStyle}>Abyx / Pack</th>
                    <th style={thRightStyle}>PTA to HQ / Pack</th>
                    <th style={thRightStyle}>Payable to Abyx</th>
                    <th style={thRightStyle}>Payable PTA to HQ</th>
                  </tr>
                </thead>

                <tbody>
                  {orderRows.map((row) => {
                    const qty = Number(row.qty || 0);
                    const abyxPayable = qty * Number(row.abyxPackAmount || 0);
                    const ptaToHqPayable = qty * Number(row.ccdPretoriaAmount || 0);

                    return (
                      <tr key={row.itemCode}>
                        <td style={tdStyle}>{row.itemCode}</td>
                        <td style={tdStyle}>{row.description}</td>
                        <td style={tdRightStyle}>{qty}</td>
                        <td style={tdRightStyle}>{moneyCents(row.abyxPackAmount)}</td>
                        <td style={tdRightStyle}>{moneyRounded(row.ccdPretoriaAmount)}</td>
                        <td style={tdRightStyle}>{moneyCents(abyxPayable)}</td>
                        <td style={tdRightStyle}>{moneyRounded(ptaToHqPayable)}</td>
                      </tr>
                    );
                  })}
                </tbody>

                <tfoot>
                  <tr>
                    <td style={totalCellStyle} colSpan={5}>
                      Total
                    </td>
                    <td style={totalRightCellStyle}>{moneyCents(totals.abyxPayable)}</td>
                    <td style={totalRightCellStyle}>{moneyRounded(totals.ptaToHqPayable)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>

            <div style={modalFooterStyle}>
              <button onClick={printOrderSummary} style={printButtonStyle}>
                Print
              </button>

              <button onClick={() => setShowOrderPopup(false)} style={doneButtonStyle}>
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
};

const buttonStyle: React.CSSProperties = {
  border: "none",
  borderRadius: "12px",
  padding: "12px 18px",
  background: "#0f172a",
  color: "#ffffff",
  fontWeight: 800,
  cursor: "pointer",
};

const orderButtonStyle: React.CSSProperties = {
  border: "none",
  borderRadius: "12px",
  padding: "12px 18px",
  background: "#2563eb",
  color: "#ffffff",
  fontWeight: 900,
  cursor: "pointer",
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
  gridTemplateColumns: "1fr 1fr 260px",
  gap: "12px",
  background: "#f8fafc",
  border: "1px solid #e2e8f0",
  borderRadius: "14px",
  padding: "14px",
  fontSize: "18px",
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
  padding: "10px 8px",
  borderBottom: "1px solid #cbd5e1",
  background: "#f1f5f9",
  color: "#334155",
};

const thRightStyle: React.CSSProperties = {
  ...thStyle,
  textAlign: "right",
};

const tdStyle: React.CSSProperties = {
  padding: "9px 8px",
  borderBottom: "1px solid #e2e8f0",
  color: "#0f172a",
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
  width: "80px",
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