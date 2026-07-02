"use client";

import { AfsStatementOverrides } from "./AfsPrintStatementEngine";

type Props = {
  mode: "sce" | "cashFlow";
  overrides: AfsStatementOverrides;
  onChange: (key: keyof AfsStatementOverrides, value: number | null) => void;
  engineChecks?: {
    profitForYear?: number;
    profitBeforeTax?: number;
    cashClosingFromSfp?: number;
    cashOpeningFromSfp?: number;
    cashMovementFromSfp?: number;
    cashMovementFromCashFlow?: number;
    cashClosingFromCashFlow?: number;
    cashFlowMovementDifference?: number;
    cashFlowClosingDifference?: number;
    cashOpeningPrior?: number;
    cashMovementPriorFromCashFlow?: number;
    cashClosingPriorFromCashFlow?: number;
    cashClosingPriorFromSfp?: number;
    cashFlowPriorClosingDifference?: number;
    sceEquityDifferenceToSfp?: number;
  };
};

function numberValue(value: number | null | undefined) {
  if (value === null || value === undefined || Number.isNaN(value)) return "";
  return String(value);
}

function parseNumber(value: string) {
  if (value.trim() === "") return null;
  const parsed = Number(value.replace(/\s/g, "").replace(/,/g, ""));
  return Number.isFinite(parsed) ? parsed : null;
}

function amount(value: number | null | undefined) {
  const rounded = Math.round(Number(value || 0));
  if (rounded === 0) return "0";
  const formatted = Math.abs(rounded).toLocaleString("en-ZA", {
    maximumFractionDigits: 0,
  });
  return rounded < 0 ? `(${formatted})` : formatted;
}

function fieldStyle() {
  return {
    width: "100%",
    height: 24,
    border: "1px solid #cbd5e1",
    padding: "2px 5px",
    fontSize: 10,
    textAlign: "right" as const,
    background: "#fff7bf",
  };
}

function labelStyle() {
  return {
    fontSize: 10,
    fontWeight: 800,
    color: "#111827",
    lineHeight: 1.2,
  };
}

function sectionStyle() {
  return {
    border: "1px solid #dbe3ef",
    background: "#ffffff",
    padding: 8,
    display: "grid",
    gap: 6,
  };
}

function sectionTitleStyle() {
  return {
    fontSize: 10,
    fontWeight: 900,
    color: "#111827",
    textTransform: "uppercase" as const,
    letterSpacing: "0.04em",
    borderBottom: "1px solid #e5e7eb",
    paddingBottom: 4,
  };
}

function checkStyle(value: number | null | undefined) {
  const diff = Math.round(Number(value || 0));
  return {
    fontSize: 9,
    lineHeight: 1.35,
    fontWeight: 800,
    color: diff === 0 ? "#047857" : "#b91c1c",
    background: diff === 0 ? "#ecfdf5" : "#fef2f2",
    border: `1px solid ${diff === 0 ? "#86efac" : "#fecaca"}`,
    padding: "5px 6px",
  };
}

function CashField({
  label,
  currentKey,
  priorKey,
  overrides,
  onChange,
}: {
  label: string;
  currentKey: keyof AfsStatementOverrides;
  priorKey: keyof AfsStatementOverrides;
  overrides: AfsStatementOverrides;
  onChange: (key: keyof AfsStatementOverrides, value: number | null) => void;
}) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "1.25fr 0.75fr 0.75fr",
        gap: 5,
        alignItems: "center",
      }}
    >
      <span style={{ fontSize: 10, color: "#111827", fontWeight: 700 }}>
        {label}
      </span>
      <input
        type="number"
        value={numberValue(overrides[currentKey] as number | null | undefined)}
        onChange={(event) => onChange(currentKey, parseNumber(event.target.value))}
        style={fieldStyle()}
        aria-label={`${label} current year`}
      />
      <input
        type="number"
        value={numberValue(overrides[priorKey] as number | null | undefined)}
        onChange={(event) => onChange(priorKey, parseNumber(event.target.value))}
        style={fieldStyle()}
        aria-label={`${label} prior year`}
      />
    </div>
  );
}

export default function AfsStatementOverrideSettings({
  mode,
  overrides,
  onChange,
  engineChecks,
}: Props) {
  const cashMovementDiff = Math.round(
    Number(engineChecks?.cashFlowMovementDifference || 0)
  );
  const cashClosingDiff = Math.round(
    Number(engineChecks?.cashFlowClosingDifference || 0)
  );
  const priorClosingDiff = Math.round(
    Number(engineChecks?.cashFlowPriorClosingDifference || 0)
  );

  function autoBalanceCurrentWorkingCapital() {
    const targetMovement = Number(engineChecks?.cashMovementFromSfp || 0);
    const currentKnownMovement =
      Number(engineChecks?.profitBeforeTax || 0) +
      Number(overrides.cashAdjustmentsToProfitCurrent || 0) +
      Number(overrides.cashInterestReceivedCurrent || 0) +
      Number(overrides.cashFinanceCostsPaidCurrent || 0) +
      Number(overrides.cashTaxPaidCurrent || 0) +
      Number(overrides.cashOtherOperatingCurrent || 0) +
      Number(overrides.cashOtherOperating2Current || 0) +
      Number(overrides.cashOtherOperating3Current || 0) +
      Number(overrides.cashPurchaseOfPpeCurrent || 0) +
      Number(overrides.cashProceedsOnDisposalPpeCurrent || 0) +
      Number(overrides.cashOtherInvestingCurrent || 0) +
      Number(overrides.cashOtherInvesting2Current || 0) +
      Number(overrides.cashOtherInvesting3Current || 0) +
      Number(overrides.cashLoansRaisedCurrent || 0) +
      Number(overrides.cashLoansRepaidCurrent || 0) +
      Number(overrides.cashDividendsPaidCurrent || 0) +
      Number(overrides.cashOtherFinancingCurrent || 0) +
      Number(overrides.cashOtherFinancing2Current || 0) +
      Number(overrides.cashOtherFinancing3Current || 0);

    onChange("cashWorkingCapitalCurrent", Math.round(targetMovement - currentKnownMovement));
  }

  function autoBalancePriorWorkingCapital() {
    const targetMovement =
      Number(engineChecks?.cashClosingPriorFromSfp || 0) -
      Number(overrides.cashPriorOpeningBalance || 0);
    const currentKnownMovement =
      0 +
      Number(overrides.cashAdjustmentsToProfitPrior || 0) +
      Number(overrides.cashInterestReceivedPrior || 0) +
      Number(overrides.cashFinanceCostsPaidPrior || 0) +
      Number(overrides.cashTaxPaidPrior || 0) +
      Number(overrides.cashOtherOperatingPrior || 0) +
      Number(overrides.cashOtherOperating2Prior || 0) +
      Number(overrides.cashOtherOperating3Prior || 0) +
      Number(overrides.cashPurchaseOfPpePrior || 0) +
      Number(overrides.cashProceedsOnDisposalPpePrior || 0) +
      Number(overrides.cashOtherInvestingPrior || 0) +
      Number(overrides.cashOtherInvesting2Prior || 0) +
      Number(overrides.cashOtherInvesting3Prior || 0) +
      Number(overrides.cashLoansRaisedPrior || 0) +
      Number(overrides.cashLoansRepaidPrior || 0) +
      Number(overrides.cashDividendsPaidPrior || 0) +
      Number(overrides.cashOtherFinancingPrior || 0) +
      Number(overrides.cashOtherFinancing2Prior || 0) +
      Number(overrides.cashOtherFinancing3Prior || 0);

    onChange("cashWorkingCapitalPrior", Math.round(targetMovement - currentKnownMovement));
  }

  return (
    <div style={{ display: "grid", gap: 10 }}>
      <div
        style={{
          fontSize: 10,
          color: "#6b7280",
          lineHeight: 1.35,
          borderBottom: "1px solid #e5e7eb",
          paddingBottom: 8,
        }}
      >
        Manual amounts are used where prior-year values are incomplete or this is
        the first year prepared on PracticePilot. Changes auto-save.
      </div>

      {mode === "sce" ? (
        <div style={sectionStyle()}>
          <div style={{ fontSize: 11, fontWeight: 900 }}>
            Statement of Changes in Equity
          </div>

          <label style={{ display: "grid", gap: 4 }}>
            <span style={labelStyle()}>Opening share capital</span>
            <input
              type="number"
              value={numberValue(overrides.sceOpeningShareCapital)}
              onChange={(event) =>
                onChange(
                  "sceOpeningShareCapital",
                  parseNumber(event.target.value)
                )
              }
              style={fieldStyle()}
            />
          </label>

          <label style={{ display: "grid", gap: 4 }}>
            <span style={labelStyle()}>
              Opening retained income / accumulated loss
            </span>
            <input
              type="number"
              value={numberValue(overrides.sceOpeningRetainedIncome)}
              onChange={(event) =>
                onChange(
                  "sceOpeningRetainedIncome",
                  parseNumber(event.target.value)
                )
              }
              style={fieldStyle()}
            />
          </label>

          <label style={{ display: "grid", gap: 4 }}>
            <span style={labelStyle()}>Opening reserves</span>
            <input
              type="number"
              value={numberValue(overrides.sceOpeningReserves)}
              onChange={(event) =>
                onChange("sceOpeningReserves", parseNumber(event.target.value))
              }
              style={fieldStyle()}
            />
          </label>

          <label style={{ display: "grid", gap: 4 }}>
            <span style={labelStyle()}>Prior year other movements / distributions</span>
            <input
              type="number"
              value={numberValue(overrides.scePriorOtherMovements)}
              onChange={(event) =>
                onChange("scePriorOtherMovements", parseNumber(event.target.value))
              }
              style={fieldStyle()}
            />
          </label>

          <label style={{ display: "grid", gap: 4 }}>
            <span style={labelStyle()}>Current year other movements / distributions</span>
            <input
              type="number"
              value={numberValue(
                overrides.sceCurrentOtherMovements ?? overrides.sceOtherMovements
              )}
              onChange={(event) =>
                onChange("sceCurrentOtherMovements", parseNumber(event.target.value))
              }
              style={fieldStyle()}
            />
          </label>

          <div style={{ fontSize: 9, color: "#6b7280", lineHeight: 1.35 }}>
            Current profit/loss pulled from SOCI: <strong>{amount(engineChecks?.profitForYear)}</strong>
          </div>

          {Number(engineChecks?.sceEquityDifferenceToSfp || 0) !== 0 ? (
            <div style={{ fontSize: 9, color: "#b45309", fontWeight: 800 }}>
              SCE equity differs from SFP equity by {amount(engineChecks?.sceEquityDifferenceToSfp)}.
            </div>
          ) : (
            <div style={{ fontSize: 9, color: "#047857", fontWeight: 800 }}>
              SCE equity agrees to SFP equity.
            </div>
          )}
        </div>
      ) : null}

      {mode === "cashFlow" ? (
        <div style={{ display: "grid", gap: 8 }}>
          <div style={sectionStyle()}>
            <div style={{ fontSize: 11, fontWeight: 900 }}>
              Cash Flow Workspace
            </div>
            <div style={{ fontSize: 9, color: "#64748b", lineHeight: 1.35 }}>
              This works like the PPE note: fill the yellow fields, then the AFS cash flow pulls from here.
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1.25fr 0.75fr 0.75fr",
                gap: 5,
                fontSize: 9,
                color: "#64748b",
                fontWeight: 900,
                textTransform: "uppercase",
              }}
            >
              <span />
              <span style={{ textAlign: "right" }}>Current</span>
              <span style={{ textAlign: "right" }}>Prior</span>
            </div>

            <div style={sectionTitleStyle()}>Opening cash</div>
            <CashField
              label="Cash and cash equivalents at beginning of year"
              currentKey="cashOpeningBalance"
              priorKey="cashPriorOpeningBalance"
              overrides={overrides}
              onChange={onChange}
            />

            <div style={sectionTitleStyle()}>Operating activities</div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1.25fr 0.75fr 0.75fr",
                gap: 5,
                alignItems: "center",
                fontSize: 10,
              }}
            >
              <strong>Profit / (loss) before taxation</strong>
              <span style={{ textAlign: "right" }}>{amount(engineChecks?.profitBeforeTax)}</span>
              <span style={{ textAlign: "right", color: "#64748b" }}>from SOCI</span>
            </div>
            <CashField
              label="Adjustments for non-cash and other items"
              currentKey="cashAdjustmentsToProfitCurrent"
              priorKey="cashAdjustmentsToProfitPrior"
              overrides={overrides}
              onChange={onChange}
            />
            <CashField
              label="Changes in working capital"
              currentKey="cashWorkingCapitalCurrent"
              priorKey="cashWorkingCapitalPrior"
              overrides={overrides}
              onChange={onChange}
            />
            <CashField
              label="Interest received"
              currentKey="cashInterestReceivedCurrent"
              priorKey="cashInterestReceivedPrior"
              overrides={overrides}
              onChange={onChange}
            />
            <CashField
              label="Finance costs paid"
              currentKey="cashFinanceCostsPaidCurrent"
              priorKey="cashFinanceCostsPaidPrior"
              overrides={overrides}
              onChange={onChange}
            />
            <CashField
              label="Taxation paid"
              currentKey="cashTaxPaidCurrent"
              priorKey="cashTaxPaidPrior"
              overrides={overrides}
              onChange={onChange}
            />
            <CashField
              label="Other operating cash flows"
              currentKey="cashOtherOperatingCurrent"
              priorKey="cashOtherOperatingPrior"
              overrides={overrides}
              onChange={onChange}
            />
            <CashField
              label="Other operating cash flows 2"
              currentKey="cashOtherOperating2Current"
              priorKey="cashOtherOperating2Prior"
              overrides={overrides}
              onChange={onChange}
            />
            <CashField
              label="Other operating cash flows 3"
              currentKey="cashOtherOperating3Current"
              priorKey="cashOtherOperating3Prior"
              overrides={overrides}
              onChange={onChange}
            />

            <div style={sectionTitleStyle()}>Investing activities</div>
            <CashField
              label="Purchase of property, plant and equipment"
              currentKey="cashPurchaseOfPpeCurrent"
              priorKey="cashPurchaseOfPpePrior"
              overrides={overrides}
              onChange={onChange}
            />
            <CashField
              label="Proceeds on disposal of property, plant and equipment"
              currentKey="cashProceedsOnDisposalPpeCurrent"
              priorKey="cashProceedsOnDisposalPpePrior"
              overrides={overrides}
              onChange={onChange}
            />
            <CashField
              label="Other investing cash flows"
              currentKey="cashOtherInvestingCurrent"
              priorKey="cashOtherInvestingPrior"
              overrides={overrides}
              onChange={onChange}
            />
            <CashField
              label="Other investing cash flows 2"
              currentKey="cashOtherInvesting2Current"
              priorKey="cashOtherInvesting2Prior"
              overrides={overrides}
              onChange={onChange}
            />
            <CashField
              label="Other investing cash flows 3"
              currentKey="cashOtherInvesting3Current"
              priorKey="cashOtherInvesting3Prior"
              overrides={overrides}
              onChange={onChange}
            />

            <div style={sectionTitleStyle()}>Financing activities</div>
            <CashField
              label="Loans raised / advances received"
              currentKey="cashLoansRaisedCurrent"
              priorKey="cashLoansRaisedPrior"
              overrides={overrides}
              onChange={onChange}
            />
            <CashField
              label="Loans repaid / advances settled"
              currentKey="cashLoansRepaidCurrent"
              priorKey="cashLoansRepaidPrior"
              overrides={overrides}
              onChange={onChange}
            />
            <CashField
              label="Dividends paid"
              currentKey="cashDividendsPaidCurrent"
              priorKey="cashDividendsPaidPrior"
              overrides={overrides}
              onChange={onChange}
            />
            <CashField
              label="Other financing cash flows"
              currentKey="cashOtherFinancingCurrent"
              priorKey="cashOtherFinancingPrior"
              overrides={overrides}
              onChange={onChange}
            />
            <CashField
              label="Other financing cash flows 2"
              currentKey="cashOtherFinancing2Current"
              priorKey="cashOtherFinancing2Prior"
              overrides={overrides}
              onChange={onChange}
            />
            <CashField
              label="Other financing cash flows 3"
              currentKey="cashOtherFinancing3Current"
              priorKey="cashOtherFinancing3Prior"
              overrides={overrides}
              onChange={onChange}
            />

            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              <button type="button" onClick={autoBalanceCurrentWorkingCapital} style={buttonStyle()}>
                Balance current via working capital
              </button>
              <button type="button" onClick={autoBalancePriorWorkingCapital} style={buttonStyle()}>
                Balance prior via working capital
              </button>
            </div>
          </div>

          <div style={checkStyle(cashMovementDiff)}>
            Movement check: cash flow movement {amount(engineChecks?.cashMovementFromCashFlow)} vs SFP movement {amount(engineChecks?.cashMovementFromSfp)}. Difference {amount(cashMovementDiff)}.
          </div>

          <div style={checkStyle(cashClosingDiff)}>
            Closing check: cash flow closing {amount(engineChecks?.cashClosingFromCashFlow)} vs SFP closing {amount(engineChecks?.cashClosingFromSfp)}. Difference {amount(cashClosingDiff)}.
          </div>

          <div style={checkStyle(priorClosingDiff)}>
            Prior closing check: prior cash flow closing {amount(engineChecks?.cashClosingPriorFromCashFlow)} vs prior SFP cash {amount(engineChecks?.cashClosingPriorFromSfp)}. Difference {amount(priorClosingDiff)}.
          </div>
        </div>
      ) : null}
    </div>
  );
}

function buttonStyle() {
  return {
    border: "1px solid #111827",
    background: "#111827",
    color: "#ffffff",
    fontSize: 9,
    fontWeight: 800,
    padding: "5px 7px",
    cursor: "pointer",
  };
}
