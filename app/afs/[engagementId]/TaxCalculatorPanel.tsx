"use client";

import { useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import { useParams } from "next/navigation";

type TaxRegime = "normal" | "sbc";

function num(value: string | number | null | undefined) {
  const n = Number(String(value ?? "0").replace(/,/g, ""));
  return Number.isFinite(n) ? n : 0;
}

function money(value: number) {
  const rounded = Math.round(value || 0);
  if (rounded === 0) return "R –";

  const absolute = Math.abs(rounded).toLocaleString("en-ZA", {
    maximumFractionDigits: 0,
  });

  return rounded < 0 ? `R (${absolute})` : `R ${absolute}`;
}

function normalCompanyRate(yearEnd: string) {
  if (!yearEnd) return 0.27;

  // Standard company rate is 27% for years of assessment ending
  // on or after 31 March 2023.
  if (yearEnd >= "2023-03-31") return 0.27;

  return 0.28;
}

function sbcBandLabel(yearEnd: string) {
  if (yearEnd >= "2026-04-01" && yearEnd <= "2027-03-31") {
    return "SBC rates: years ending 1 Apr 2026 – 31 Mar 2027";
  }

  return "SBC rates: years ending 1 Apr 2023 – 31 Mar 2026";
}

function calculateSbcTax(taxableIncome: number, yearEnd: string) {
  const income = Math.max(0, taxableIncome);

  // SARS: years of assessment ending 1 Apr 2026 – 31 Mar 2027
  if (yearEnd >= "2026-04-01" && yearEnd <= "2027-03-31") {
    if (income <= 99_000) return 0;
    if (income <= 365_000) return (income - 99_000) * 0.07;
    if (income <= 550_000) return 18_620 + (income - 365_000) * 0.21;
    return 57_470 + (income - 550_000) * 0.27;
  }

  // SARS: years of assessment ending 1 Apr 2023 – 31 Mar 2026
  if (income <= 95_750) return 0;
  if (income <= 365_000) return (income - 95_750) * 0.07;
  if (income <= 550_000) return 18_848 + (income - 365_000) * 0.21;
  return 57_698 + (income - 550_000) * 0.27;
}


type TaxTrialBalanceLine = {
  mapping_code?: string | null;
  current_year_balance?: number | null;
  prior_year_balance?: number | null;
  debit?: number | null;
  credit?: number | null;
};

type TaxCalculatorPanelProps = {
  trialBalanceLines?: TaxTrialBalanceLine[];
  clientSetup?: Record<string, any> | null;
};

function rawCurrent(line: TaxTrialBalanceLine) {
  if (
    line.current_year_balance !== null &&
    line.current_year_balance !== undefined
  ) {
    return Number(line.current_year_balance) || 0;
  }

  return (Number(line.debit) || 0) - (Number(line.credit) || 0);
}

function rawPrior(line: TaxTrialBalanceLine) {
  if (
    line.prior_year_balance !== null &&
    line.prior_year_balance !== undefined
  ) {
    return Number(line.prior_year_balance) || 0;
  }

  return 0;
}

function mappingCode(line: TaxTrialBalanceLine) {
  return String(line.mapping_code || "").trim();
}

function mappingCodeStartsWith(line: TaxTrialBalanceLine, prefixes: string[]) {
  const code = mappingCode(line);
  return prefixes.some(
    (prefix) => code === prefix || code.startsWith(`${prefix}.`),
  );
}

function exactMappedTotal(
  lines: TaxTrialBalanceLine[],
  code: string,
  side: "current" | "prior",
) {
  return (lines || [])
    .filter((line) => mappingCode(line) === code)
    .reduce(
      (sum, line) =>
        sum + (side === "current" ? rawCurrent(line) : rawPrior(line)),
      0,
    );
}

function mappedProfitBeforeTax(lines: TaxTrialBalanceLine[]) {
  const preTaxCodes = [
    "700",
    "720",
    "730",
    "750",
    "770",
    "775",
    "780",
    "781",
    "785",
  ];

  const rawTotal = (lines || [])
    .filter((line) => mappingCodeStartsWith(line, preTaxCodes))
    .reduce((sum, line) => sum + rawCurrent(line), 0);

  return -rawTotal;
}

function mappedProvisionalTaxPaid(lines: TaxTrialBalanceLine[]) {
  const currentTaxExpense = Math.abs(
    exactMappedTotal(lines, "795.10", "current"),
  );
  const openingReceivable = Math.abs(
    exactMappedTotal(lines, "495.10", "prior"),
  );
  const closingReceivable = Math.abs(
    exactMappedTotal(lines, "495.10", "current"),
  );
  const openingPayable = Math.abs(
    exactMappedTotal(lines, "695.10", "prior"),
  );
  const closingPayable = Math.abs(
    exactMappedTotal(lines, "695.10", "current"),
  );

  const paid =
    openingPayable -
    openingReceivable +
    currentTaxExpense -
    closingPayable +
    closingReceivable;

  return Math.max(0, paid);
}

function mappedOpeningTaxBalance(lines: TaxTrialBalanceLine[]) {
  const openingReceivable = Math.abs(
    exactMappedTotal(lines, "495.10", "prior"),
  );
  const openingPayable = Math.abs(
    exactMappedTotal(lines, "695.10", "prior"),
  );

  return openingPayable - openingReceivable;
}

function setupNumber(
  setup: Record<string, any> | null | undefined,
  keys: string[],
) {
  for (const key of keys) {
    const value = setup?.[key];
    if (value !== null && value !== undefined && String(value).trim() !== "") {
      const parsed = Number(String(value).replace(/,/g, ""));
      if (Number.isFinite(parsed)) return parsed;
    }
  }

  return 0;
}

export default function TaxCalculatorPanel({
  trialBalanceLines = [],
  clientSetup = null,
}: TaxCalculatorPanelProps) {
  const params = useParams();
  const engagementId = String(params?.engagementId || "");

  const [taxYear, setTaxYear] = useState("2026");
  const [financialYearEnd, setFinancialYearEnd] = useState("");
  const [taxRegime, setTaxRegime] = useState<TaxRegime>("normal");
  const [permanent, setPermanent] = useState("0");
  const [temporary, setTemporary] = useState("0");
  const [notes, setNotes] = useState("");
  const [recogniseDta, setRecogniseDta] = useState(false);
  const [recognisedDta, setRecognisedDta] = useState("0");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  const automaticAccountingProfit = useMemo(
    () => mappedProfitBeforeTax(trialBalanceLines),
    [trialBalanceLines],
  );

  const automaticProvisionalTaxPaid = useMemo(
    () => mappedProvisionalTaxPaid(trialBalanceLines),
    [trialBalanceLines],
  );

  const automaticOpeningTaxBalance = useMemo(
    () => mappedOpeningTaxBalance(trialBalanceLines),
    [trialBalanceLines],
  );

  const automaticAssessedLossBf = useMemo(
    () =>
      Math.max(
        0,
        setupNumber(clientSetup, [
          "assessed_loss_brought_forward",
          "tax_loss_prior_year",
          "assessed_loss_prior_year",
          "tax_loss_brought_forward",
          "assessed_loss",
        ]),
      ),
    [clientSetup],
  );

  const calc = useMemo(() => {
    const accountingProfit = automaticAccountingProfit;
    const permanentDifferences = num(permanent);
    const temporaryDifferences = num(temporary);
    const assessedLossBf = automaticAssessedLossBf;

    const taxableBeforeLoss =
      accountingProfit + permanentDifferences + temporaryDifferences;

    const currentYearAssessedLoss = Math.max(0, -taxableBeforeLoss);

    const assessedLossRestriction =
      taxableBeforeLoss > 0
        ? Math.max(1_000_000, taxableBeforeLoss * 0.8)
        : 0;

    const maximumAssessedLossDeduction =
      taxableBeforeLoss > 0
        ? Math.min(taxableBeforeLoss, assessedLossRestriction)
        : 0;

    const assessedLossUsed =
      taxableBeforeLoss > 0
        ? Math.min(assessedLossBf, maximumAssessedLossDeduction)
        : 0;

    const taxableIncome =
      taxableBeforeLoss > 0
        ? Math.max(0, taxableBeforeLoss - assessedLossUsed)
        : 0;

    const currentTax =
      taxRegime === "sbc"
        ? calculateSbcTax(taxableIncome, financialYearEnd)
        : taxableIncome * normalCompanyRate(financialYearEnd);

    const effectiveRate =
      taxableIncome > 0 ? currentTax / taxableIncome : 0;

    const provisionalPaid = automaticProvisionalTaxPaid;
    const taxPayable =
      automaticOpeningTaxBalance + currentTax - provisionalPaid;

    const assessedLossCf =
      Math.max(0, assessedLossBf - assessedLossUsed) +
      currentYearAssessedLoss;

    const deferredTaxMeasurementRate = normalCompanyRate(financialYearEnd);
    const potentialDeferredTaxAsset =
      assessedLossCf * deferredTaxMeasurementRate;

    const requestedRecognisedDta = Math.max(0, num(recognisedDta));
    const recognisedDeferredTaxAsset = recogniseDta
      ? Math.min(requestedRecognisedDta, potentialDeferredTaxAsset)
      : 0;

    return {
      accountingProfit,
      permanentDifferences,
      temporaryDifferences,
      taxableBeforeLoss,
      assessedLossBf,
      assessedLossRestriction,
      maximumAssessedLossDeduction,
      assessedLossUsed,
      currentYearAssessedLoss,
      assessedLossCf,
      taxableIncome,
      currentTax,
      provisionalPaid,
      taxPayable,
      effectiveRate,
      deferredTaxMeasurementRate,
      potentialDeferredTaxAsset,
      recognisedDeferredTaxAsset,
    };
  }, [
    automaticAccountingProfit,
    automaticProvisionalTaxPaid,
    automaticOpeningTaxBalance,
    automaticAssessedLossBf,
    permanent,
    temporary,
    taxRegime,
    financialYearEnd,
    recogniseDta,
    recognisedDta,
  ]);

  useEffect(() => {
    if (!engagementId) return;
    void loadEngagement();
  }, [engagementId]);

  useEffect(() => {
    if (!engagementId) return;
    void loadTax();
  }, [engagementId, taxYear]);

  async function loadEngagement() {
    try {
      const res = await fetch(`/api/afs/engagements/${engagementId}`, {
        cache: "no-store",
      });
      const data = await res.json();

      if (!res.ok) return;

      const yearEnd = String(data?.engagement?.financial_year_end || "");
      setFinancialYearEnd(yearEnd);

      if (yearEnd) {
        setTaxYear(String(new Date(`${yearEnd}T00:00:00`).getFullYear()));
      }
    } catch {
      // Tax worksheet can still be used if engagement metadata is unavailable.
    }
  }

  async function loadTax() {
    const res = await fetch(
      `/api/afs/engagements/${engagementId}/tax-calculation?taxYear=${taxYear}`,
      { cache: "no-store" },
    );

    const data = await res.json();
    if (!res.ok || !data.taxCalculation) return;

    const row = data.taxCalculation;

    setPermanent(String(row.permanent_differences || 0));
    setTemporary(String(row.temporary_differences || 0));
    setTaxRegime(row.tax_regime === "sbc" ? "sbc" : "normal");
    setNotes(row.notes || "");
    setRecogniseDta(Boolean(row.recognise_deferred_tax_asset));
    setRecognisedDta(String(row.deferred_tax_asset_recognised || 0));
  }

  function notifyTaxSignoffRefresh() {
    window.dispatchEvent(
      new CustomEvent("afs-signoff-refresh", {
        detail: {
          engagementId,
          sectionKey: "tax-calculator",
        },
      }),
    );
  }

  async function saveTax() {
    setSaving(true);
    setMessage("");

    try {
      const res = await fetch(
        `/api/afs/engagements/${engagementId}/tax-calculation`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            taxYear,
            taxRegime,
            accountingProfit: calc.accountingProfit,
            permanentDifferences: calc.permanentDifferences,
            temporaryDifferences: calc.temporaryDifferences,
            assessedLossBf: calc.assessedLossBf,
            assessedLossCarriedForward: calc.assessedLossCf,
            taxRate:
              taxRegime === "normal"
                ? normalCompanyRate(financialYearEnd)
                : calc.effectiveRate,
            taxableIncome: calc.taxableIncome,
            currentTax: calc.currentTax,
            provisionalTaxPaid: calc.provisionalPaid,
            deferredTaxAssetPotential: calc.potentialDeferredTaxAsset,
            recogniseDeferredTaxAsset: recogniseDta,
            deferredTaxAssetRecognised: calc.recognisedDeferredTaxAsset,
            deferredTax: calc.recognisedDeferredTaxAsset,
            notes,
          }),
        },
      );

      const data = await res.json();

      if (res.ok) {
        setMessage("Tax calculation saved.");
        notifyTaxSignoffRefresh();
      } else {
        setMessage(data.error || "Tax calculation failed.");
      }
    } catch (error: any) {
      setMessage(error?.message || "Tax calculation failed.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={styles.wrapper}>
      <div style={styles.headerRow}>
        <div>
          <p style={styles.kicker}>Tax workpaper</p>
          <h2 style={styles.title}>Current tax computation</h2>
          <p style={styles.subtitle}>
            Reconcile accounting profit to taxable income and calculate normal
            company or Small Business Corporation tax.
          </p>
        </div>

        <button
          type="button"
          style={styles.primaryButton}
          onClick={saveTax}
          disabled={saving}
        >
          {saving ? "Saving..." : "Save tax"}
        </button>
      </div>

      {message ? <div style={styles.message}>{message}</div> : null}

      <section style={styles.panel}>
        <div style={styles.sectionHeader}>Tax basis</div>

        <div style={styles.formGrid}>
          <label style={styles.label}>Financial year end</label>
          <div style={styles.readOnlyValue}>
            {financialYearEnd || "Not available"}
          </div>

          <label style={styles.label}>Tax year</label>
          <input
            style={styles.input}
            value={taxYear}
            onChange={(e) => setTaxYear(e.target.value)}
          />

          <label style={styles.label}>Tax regime</label>
          <div style={styles.regimeButtons}>
            <button
              type="button"
              style={{
                ...styles.regimeButton,
                ...(taxRegime === "normal" ? styles.regimeButtonActive : {}),
              }}
              onClick={() => setTaxRegime("normal")}
            >
              Normal company · 27%
            </button>

            <button
              type="button"
              style={{
                ...styles.regimeButton,
                ...(taxRegime === "sbc" ? styles.regimeButtonActive : {}),
              }}
              onClick={() => setTaxRegime("sbc")}
            >
              Small Business Corporation (SBC)
            </button>
          </div>

          <label style={styles.label}>Rate basis</label>
          <div style={styles.readOnlyValue}>
            {taxRegime === "normal"
              ? `${(normalCompanyRate(financialYearEnd) * 100).toFixed(0)}% normal company rate`
              : sbcBandLabel(financialYearEnd)}
          </div>
        </div>
      </section>

      {taxRegime === "sbc" ? (
        <section style={styles.notice}>
          <strong>SBC selected</strong>
          <span>
            PracticePilot will apply the SARS progressive SBC tax table for the
            engagement year end. SBC qualification must be confirmed by the
            practitioner before using this basis.
          </span>
        </section>
      ) : null}

      <section style={styles.panel}>
        <div style={styles.sectionHeader}>Taxable income reconciliation</div>

        <div style={styles.formGrid}>
          <label style={styles.label}>Accounting profit / (loss)</label>
          <div style={styles.readOnlyMappedValue}>
            <strong>{money(automaticAccountingProfit)}</strong>
            <span>Automatic from mapped SOCI accounts</span>
          </div>

          <label style={styles.label}>Permanent differences</label>
          <input
            style={styles.input}
            value={permanent}
            onChange={(e) => setPermanent(e.target.value)}
          />

          <label style={styles.label}>Temporary differences</label>
          <input
            style={styles.input}
            value={temporary}
            onChange={(e) => setTemporary(e.target.value)}
          />

          <label style={styles.label}>Assessed loss brought forward</label>
          <div style={styles.readOnlyMappedValue}>
            <strong>{money(automaticAssessedLossBf)}</strong>
            <span>Automatic from Client Setup</span>
          </div>

          <label style={styles.label}>Provisional tax paid / credits</label>
          <div style={styles.readOnlyMappedValue}>
            <strong>{money(automaticProvisionalTaxPaid)}</strong>
            <span>Automatic from mappings 495.10 / 695.10 / 795.10</span>
          </div>
        </div>

        <div style={styles.reconciliation}>
          <div style={styles.reconLine}>
            <span>Accounting profit / (loss)</span>
            <strong>{money(calc.accountingProfit)}</strong>
          </div>

          <div style={styles.reconLine}>
            <span>Add / (deduct): permanent differences</span>
            <strong>{money(calc.permanentDifferences)}</strong>
          </div>

          <div style={styles.reconLine}>
            <span>Add / (deduct): temporary differences</span>
            <strong>{money(calc.temporaryDifferences)}</strong>
          </div>

          <div style={styles.reconSubtotal}>
            <span>Taxable income / (assessed loss) before losses</span>
            <strong>{money(calc.taxableBeforeLoss)}</strong>
          </div>

          {calc.taxableBeforeLoss > 0 && calc.assessedLossBf > 0 ? (
            <>
              <div style={styles.reconLine}>
                <span>SARS assessed-loss limit — higher of R1m or 80%</span>
                <strong>{money(calc.assessedLossRestriction)}</strong>
              </div>
              <div style={styles.reconLine}>
                <span>Maximum assessed loss deduction for this year</span>
                <strong>{money(calc.maximumAssessedLossDeduction)}</strong>
              </div>
            </>
          ) : null}

          <div style={styles.reconLine}>
            <span>Assessed loss utilised</span>
            <strong>{money(-calc.assessedLossUsed)}</strong>
          </div>

          <div style={styles.reconTotal}>
            <span>Taxable income</span>
            <strong>{money(calc.taxableIncome)}</strong>
          </div>

          {calc.currentYearAssessedLoss > 0 ? (
            <div style={styles.reconLine}>
              <span>Current-year assessed loss</span>
              <strong>{money(calc.currentYearAssessedLoss)}</strong>
            </div>
          ) : null}

          {calc.assessedLossCf > 0 ? (
            <div style={styles.reconLine}>
              <span>Assessed loss carried forward</span>
              <strong>{money(calc.assessedLossCf)}</strong>
            </div>
          ) : null}
        </div>
      </section>

      <section style={styles.panel}>
        <div style={styles.sectionHeader}>Current tax</div>

        <div style={styles.taxResultGrid}>
          <div>
            <span style={styles.resultLabel}>Taxable income</span>
            <strong style={styles.resultValue}>
              {money(calc.taxableIncome)}
            </strong>
          </div>

          <div>
            <span style={styles.resultLabel}>Tax basis</span>
            <strong style={styles.resultValueSmall}>
              {taxRegime === "sbc"
                ? "SBC progressive rates"
                : `${(normalCompanyRate(financialYearEnd) * 100).toFixed(0)}%`}
            </strong>
          </div>

          <div>
            <span style={styles.resultLabel}>Current tax</span>
            <strong style={styles.resultValue}>
              {money(calc.currentTax)}
            </strong>
          </div>

          <div>
            <span style={styles.resultLabel}>Opening tax balance</span>
            <strong style={styles.resultValue}>
              {money(automaticOpeningTaxBalance)}
            </strong>
          </div>

          <div>
            <span style={styles.resultLabel}>Provisional tax paid</span>
            <strong style={styles.resultValue}>
              {money(calc.provisionalPaid)}
            </strong>
          </div>

          <div>
            <span style={styles.resultLabel}>Tax payable / (prepaid)</span>
            <strong style={styles.resultValue}>
              {money(calc.taxPayable)}
            </strong>
          </div>

          <div>
            <span style={styles.resultLabel}>Effective tax rate</span>
            <strong style={styles.resultValueSmall}>
              {(calc.effectiveRate * 100).toFixed(2)}%
            </strong>
          </div>
        </div>
      </section>

      <section style={styles.panel}>
        <div style={styles.sectionHeader}>Deferred tax on assessed loss</div>

        <div style={styles.reconciliation}>
          <div style={styles.reconLine}>
            <span>Assessed loss carried forward</span>
            <strong>{money(calc.assessedLossCf)}</strong>
          </div>

          <div style={styles.reconLine}>
            <span>Measurement rate</span>
            <strong>{(calc.deferredTaxMeasurementRate * 100).toFixed(0)}%</strong>
          </div>

          <div style={styles.reconSubtotal}>
            <span>Potential deferred tax asset</span>
            <strong>{money(calc.potentialDeferredTaxAsset)}</strong>
          </div>
        </div>

        <div style={styles.dtaDecision}>
          <label style={styles.checkboxRow}>
            <input
              type="checkbox"
              checked={recogniseDta}
              onChange={(e) => {
                const checked = e.target.checked;
                setRecogniseDta(checked);
                if (checked && num(recognisedDta) === 0) {
                  setRecognisedDta(String(Math.round(calc.potentialDeferredTaxAsset)));
                }
              }}
            />
            <span>
              Recognise deferred tax asset — sufficient future taxable profits are probable
            </span>
          </label>

          <label style={styles.label}>Recognised deferred tax asset</label>
          <input
            style={styles.input}
            value={recognisedDta}
            disabled={!recogniseDta}
            onChange={(e) => setRecognisedDta(e.target.value)}
          />

          <div style={styles.dtaHelp}>
            Recognition is capped at the potential deferred tax asset. The practitioner
            must assess recoverability before recognising the asset.
          </div>
        </div>
      </section>

      <section style={styles.panel}>
        <div style={styles.sectionHeader}>Tax workpaper notes</div>
        <textarea
          style={styles.textarea}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Document tax adjustments, assessed loss considerations and SBC qualification here."
        />
      </section>
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  wrapper: {
    display: "grid",
    gap: "8px",
    fontSize: "12px",
    color: "#0f172a",
  },
  headerRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    border: "1px solid #dbe3ef",
    background: "#ffffff",
    padding: "10px",
  },
  kicker: {
    margin: 0,
    color: "#2563eb",
    fontSize: "11px",
    fontWeight: 800,
    letterSpacing: "0",
  },
  title: {
    margin: "2px 0",
    fontSize: "16px",
    lineHeight: 1.1,
  },
  subtitle: {
    margin: 0,
    color: "#334155",
    fontSize: "11.5px",
  },
  panel: {
    border: "1px solid #dbe3ef",
    background: "#ffffff",
    overflow: "hidden",
  },
  sectionHeader: {
    background: "#eef3f8",
    borderBottom: "1px solid #dbe3ef",
    padding: "7px 10px",
    fontSize: "11.5px",
    fontWeight: 800,
    color: "#0f2742",
    letterSpacing: "0",
  },
  formGrid: {
    display: "grid",
    gridTemplateColumns: "220px minmax(0, 1fr)",
    gap: "1px",
    background: "#e5edf6",
  },
  label: {
    fontSize: "11px",
    color: "#334155",
    fontWeight: 800,
    background: "#f8fafc",
    padding: "8px 10px",
    alignSelf: "stretch",
    display: "flex",
    alignItems: "center",
  },
  input: {
    border: "1px solid #94a3b8",
    background: "#f8fbff",
    color: "#0f2742",
    padding: "7px 9px",
    fontSize: "12px",
    outline: "none",
    boxSizing: "border-box",
  },
  regimeButtons: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "6px",
    background: "#ffffff",
    padding: "5px 7px",
  },
  regimeButton: {
    border: "1px solid #94a3b8",
    background: "#f8fafc",
    color: "#334155",
    padding: "7px 9px",
    fontSize: "11.5px",
    fontWeight: 900,
    cursor: "pointer",
  },
  regimeButtonActive: {
    border: "1px solid #2563eb",
    background: "#eaf3ff",
    color: "#1d4ed8",
  },

  readOnlyMappedValue: {
    background: "#f8fafc",
    padding: "7px 9px",
    color: "#0f2742",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "12px",
  },

  readOnlyValue: {
    background: "#ffffff",
    padding: "8px 9px",
    color: "#334155",
    fontWeight: 700,
  },
  dtaDecision: {
    display: "grid",
    gridTemplateColumns: "220px minmax(0, 1fr)",
    gap: "8px",
    padding: "10px",
    borderTop: "1px solid #dbe3ef",
  },
  checkboxRow: {
    gridColumn: "1 / -1",
    display: "flex",
    alignItems: "center",
    gap: "8px",
    fontSize: "11.5px",
    fontWeight: 800,
  },
  dtaHelp: {
    gridColumn: "1 / -1",
    color: "#64748b",
    fontSize: "10.5px",
  },

  textarea: {
    border: "1px solid #94a3b8",
    background: "#f8fbff",
    padding: "9px 10px",
    fontSize: "12px",
    minHeight: "80px",
    resize: "vertical",
    width: "100%",
    boxSizing: "border-box",
    outline: "none",
  },
  primaryButton: {
    border: "1px solid #2563eb",
    background: "#2563eb",
    color: "#fff",
    padding: "7px 12px",
    fontSize: "11.5px",
    fontWeight: 900,
    cursor: "pointer",
  },
  message: {
    border: "1px solid #bfdbfe",
    background: "#eff6ff",
    color: "#1d4ed8",
    padding: "8px 10px",
    fontWeight: 800,
  },
  notice: {
    border: "1px solid #f59e0b",
    background: "#fffbeb",
    color: "#78350f",
    padding: "9px 10px",
    display: "grid",
    gap: "3px",
    lineHeight: 1.4,
  },
  reconciliation: {
    borderTop: "1px solid #dbe3ef",
  },
  reconLine: {
    display: "flex",
    justifyContent: "space-between",
    padding: "7px 10px",
    borderBottom: "1px solid #edf2f7",
  },
  reconSubtotal: {
    display: "flex",
    justifyContent: "space-between",
    padding: "8px 10px",
    borderTop: "1px solid #cbd5e1",
    borderBottom: "1px solid #cbd5e1",
    background: "#f8fafc",
    fontWeight: 900,
  },
  reconTotal: {
    display: "flex",
    justifyContent: "space-between",
    padding: "9px 10px",
    borderTop: "2px solid #0f2742",
    borderBottom: "1px solid #0f2742",
    fontWeight: 900,
    fontSize: "13px",
  },
  taxResultGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(6, minmax(0, 1fr))",
  },
  resultLabel: {
    display: "block",
    padding: "7px 9px 2px",
    color: "#64748b",
    fontSize: "10.5px",
    fontWeight: 800,
  },
  resultValue: {
    display: "block",
    padding: "2px 9px 9px",
    color: "#0f2742",
    fontSize: "17px",
    fontWeight: 900,
  },
  resultValueSmall: {
    display: "block",
    padding: "5px 9px 9px",
    color: "#0f2742",
    fontSize: "12px",
    fontWeight: 900,
  },
};
