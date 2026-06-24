"use client";

import { useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import { useParams } from "next/navigation";

function num(value: string) {
  const n = Number(String(value).replace(/,/g, ""));
  return Number.isFinite(n) ? n : 0;
}

function money(value: number) {
  return `R ${Math.abs(value || 0).toLocaleString("en-ZA", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function TaxCalculatorPanel() {
  const params = useParams();
  const engagementId = String(params?.engagementId || "");
  const [taxYear, setTaxYear] = useState("2026");
  const [profit, setProfit] = useState("0");
  const [permanent, setPermanent] = useState("0");
  const [temporary, setTemporary] = useState("0");
  const [loss, setLoss] = useState("0");
  const [rate, setRate] = useState("0.27");
  const [notes, setNotes] = useState("");
  const [message, setMessage] = useState("");

  const calc = useMemo(() => {
    const taxableIncome = Math.max(0, num(profit) + num(permanent) + num(temporary) - num(loss));
    const currentTax = taxableIncome * num(rate);
    return { taxableIncome, currentTax };
  }, [profit, permanent, temporary, loss, rate]);

  useEffect(() => {
    if (!engagementId) return;
    loadTax();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [engagementId, taxYear]);

  async function loadTax() {
    const res = await fetch(`/api/afs/engagements/${engagementId}/tax-calculation?taxYear=${taxYear}`, { cache: "no-store" });
    const data = await res.json();
    if (!res.ok || !data.taxCalculation) return;
    const row = data.taxCalculation;
    setProfit(String(row.accounting_profit || 0));
    setPermanent(String(row.permanent_differences || 0));
    setTemporary(String(row.temporary_differences || 0));
    setLoss(String(row.assessed_loss_bf || 0));
    setRate(String(row.tax_rate || 0.27));
    setNotes(row.notes || "");
  }

  async function saveTax() {
    const res = await fetch(`/api/afs/engagements/${engagementId}/tax-calculation`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        taxYear,
        accountingProfit: num(profit),
        permanentDifferences: num(permanent),
        temporaryDifferences: num(temporary),
        assessedLossBf: num(loss),
        taxRate: num(rate),
        taxableIncome: calc.taxableIncome,
        currentTax: calc.currentTax,
        deferredTax: 0,
        notes,
      }),
    });
    const data = await res.json();
    setMessage(res.ok ? "Tax calculation saved." : data.error || "Tax calculation failed.");
  }

  return (
    <div style={styles.wrapper}>
      <div style={styles.headerRow}>
        <div>
          <p style={styles.kicker}>TAX CALCULATOR</p>
          <h2 style={styles.title}>Current tax worksheet</h2>
          <p style={styles.subtitle}>Basic tax computation. Detailed SARS adjustments can be layered onto this later.</p>
        </div>
        <button type="button" style={styles.primaryButton} onClick={saveTax}>Save tax</button>
      </div>
      {message ? <div style={styles.message}>{message}</div> : null}
      <section style={styles.panel}>
        <div style={styles.formGrid}>
          <label style={styles.label}>Tax year</label><input style={styles.input} value={taxYear} onChange={(e) => setTaxYear(e.target.value)} />
          <label style={styles.label}>Accounting profit</label><input style={styles.input} value={profit} onChange={(e) => setProfit(e.target.value)} />
          <label style={styles.label}>Permanent differences</label><input style={styles.input} value={permanent} onChange={(e) => setPermanent(e.target.value)} />
          <label style={styles.label}>Temporary differences</label><input style={styles.input} value={temporary} onChange={(e) => setTemporary(e.target.value)} />
          <label style={styles.label}>Assessed loss b/f</label><input style={styles.input} value={loss} onChange={(e) => setLoss(e.target.value)} />
          <label style={styles.label}>Tax rate</label><input style={styles.input} value={rate} onChange={(e) => setRate(e.target.value)} />
          <label style={styles.label}>Notes</label><textarea style={styles.textarea} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>
      </section>
      <section style={styles.panel}>
        <div style={styles.reconLine}><span>Taxable income</span><strong>{money(calc.taxableIncome)}</strong></div>
        <div style={styles.reconLine}><span>Current tax</span><strong>{money(calc.currentTax)}</strong></div>
      </section>
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  wrapper: { display: "grid", gap: "8px", fontSize: "12px", color: "#0f172a" },
  headerRow: { display: "flex", justifyContent: "space-between", alignItems: "center", border: "1px solid #dbe3ef", borderRadius: "8px", background: "#ffffff", padding: "10px" },
  kicker: { margin: 0, color: "#2563eb", fontSize: "10px", fontWeight: 900, letterSpacing: "0.1em" },
  title: { margin: "2px 0", fontSize: "16px", lineHeight: 1.1 },
  subtitle: { margin: 0, color: "#334155", fontSize: "11.5px" },
  panel: { border: "1px solid #dbe3ef", borderRadius: "8px", background: "#ffffff", overflow: "hidden" },
  formGrid: { display: "grid", gridTemplateColumns: "160px minmax(0, 1fr)", gap: "7px", padding: "10px" },
  label: { fontSize: "11px", color: "#334155", fontWeight: 800, alignSelf: "center" },
  input: { border: "1px solid #cbd5e1", borderRadius: "6px", padding: "6px 8px", fontSize: "12px" },
  textarea: { border: "1px solid #cbd5e1", borderRadius: "6px", padding: "6px 8px", fontSize: "12px", minHeight: "70px", resize: "vertical" },
  primaryButton: { border: "0", borderRadius: "7px", background: "#2563eb", color: "#fff", padding: "7px 10px", fontSize: "11.5px", fontWeight: 900, cursor: "pointer" },
  reconLine: { display: "flex", justifyContent: "space-between", padding: "9px 10px", borderBottom: "1px solid #edf2f7" },
  message: { border: "1px solid #bfdbfe", background: "#eff6ff", color: "#1d4ed8", borderRadius: "8px", padding: "8px 10px", fontWeight: 800 },
};
