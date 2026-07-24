"use client";

import { useMemo, useState } from "react";
import type { CSSProperties } from "react";

export type AfsFlightDeckIssueSeverity = "critical" | "caution" | "info";

export type AfsFlightDeckIssue = {
  id: string;
  severity: AfsFlightDeckIssueSeverity;
  title: string;
  message: string;
  target?: string;
  targetLabel?: string;
};

type AfsFlightDeckProps = {
  issues?: AfsFlightDeckIssue[];
  onJump?: (target: string) => void;
};

function toAmount(value: unknown): number {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? Math.round(n) : 0;
}

function amount(value: unknown): string {
  const n = toAmount(value);
  if (n === 0) return "0";

  const abs = Math.abs(n).toLocaleString("en-ZA", {
    maximumFractionDigits: 0,
  });

  return n < 0 ? `(${abs})` : abs;
}

function safeDiff(a: unknown, b: unknown): number {
  return toAmount(a) - toAmount(b);
}

function issueSeverity(diff: number): AfsFlightDeckIssueSeverity {
  return Math.abs(toAmount(diff)) > 1 ? "critical" : "caution";
}

export function buildAfsFlightDeckIssuesFromEngine(
  engine: any
): AfsFlightDeckIssue[] {
  const issues: AfsFlightDeckIssue[] = [];
  const checks = engine?.checks ?? {};

  const sfpDiffCurrent = toAmount(
    checks?.sfpDifference ??
      safeDiff(
        checks?.sfpAssetsTotal?.current ?? checks?.assetsTotal?.current,
        checks?.sfpEquityAndLiabilitiesTotal?.current ??
          checks?.equityAndLiabilitiesTotal?.current
      )
  );

  const sfpDiffPrior = toAmount(
    checks?.sfpPriorDifference ??
      safeDiff(
        checks?.sfpAssetsTotal?.prior ?? checks?.assetsTotal?.prior,
        checks?.sfpEquityAndLiabilitiesTotal?.prior ??
          checks?.equityAndLiabilitiesTotal?.prior
      )
  );

  if (Math.abs(sfpDiffCurrent) > 0 || Math.abs(sfpDiffPrior) > 0) {
    issues.push({
      id: "sfp-balance",
      severity:
        Math.abs(sfpDiffCurrent) > 1 || Math.abs(sfpDiffPrior) > 1
          ? "critical"
          : "caution",
      title: "Statement of financial position",
      message: `Assets must agree to equity and liabilities. Current difference ${amount(
        sfpDiffCurrent
      )}; prior difference ${amount(sfpDiffPrior)}.`,
      target: "sfp",
      targetLabel: "SFP",
    });
  }

  const sceDiff = toAmount(
    checks?.sceEquityDifferenceToSfp ??
      checks?.sceEquityDifference?.current ??
      0
  );

  if (Math.abs(sceDiff) > 0) {
    issues.push({
      id: "sce-equity",
      severity: issueSeverity(sceDiff),
      title: "Statement of changes in equity",
      message: `Closing equity must agree to SFP equity. Difference ${amount(
        sceDiff
      )}.`,
      target: "sce",
      targetLabel: "SCE",
    });
  }

  const cashMovementDiff = toAmount(
    checks?.cashFlowMovementDifference ??
      safeDiff(checks?.cashMovementFromCashFlow, checks?.cashMovementFromSfp)
  );

  if (Math.abs(cashMovementDiff) > 0) {
    issues.push({
      id: "cash-flow-movement",
      severity: issueSeverity(cashMovementDiff),
      title: "Cash flow movement",
      message: `Cash flow movement must agree to the SFP cash movement. Cash flow movement ${amount(
        checks?.cashMovementFromCashFlow
      )}; SFP movement ${amount(
        checks?.cashMovementFromSfp
      )}; difference ${amount(cashMovementDiff)}.`,
      target: "cash-flow",
      targetLabel: "Cash flow",
    });
  }

  const cashClosingDiff = toAmount(checks?.cashFlowClosingDifference ?? 0);

  if (Math.abs(cashClosingDiff) > 0) {
    issues.push({
      id: "cash-flow-closing",
      severity: issueSeverity(cashClosingDiff),
      title: "Cash flow closing cash",
      message: `Cash flow closing cash must agree to the SFP cash balance. Cash flow closing ${amount(
        checks?.cashClosingFromCashFlow
      )}; SFP closing ${amount(
        checks?.cashClosingFromSfp
      )}; difference ${amount(cashClosingDiff)}.`,
      target: "cash-flow",
      targetLabel: "Cash flow",
    });
  }

  const cashPriorClosingDiff = toAmount(
    checks?.cashFlowPriorClosingDifference ?? 0
  );

  if (Math.abs(cashPriorClosingDiff) > 0) {
    issues.push({
      id: "cash-flow-prior-closing",
      severity: issueSeverity(cashPriorClosingDiff),
      title: "Cash flow prior closing cash",
      message: `Prior cash flow closing cash must agree to prior SFP cash. Prior cash flow closing ${amount(
        checks?.cashClosingPriorFromCashFlow
      )}; prior SFP cash ${amount(
        checks?.cashClosingPriorFromSfp
      )}; difference ${amount(cashPriorClosingDiff)}.`,
      target: "cash-flow",
      targetLabel: "Cash flow",
    });
  }

  const taxDiff = safeDiff(
    checks?.taxComputationTaxExpense,
    checks?.taxNoteTaxExpense
  );

  if (Math.abs(taxDiff) > 0) {
    issues.push({
      id: "tax-note",
      severity: issueSeverity(taxDiff),
      title: "Tax computation",
      message: `Tax computation must agree to the tax note. Difference ${amount(
        taxDiff
      )}.`,
      target: "afs-tax",
      targetLabel: "Tax",
    });
  }

  const noteData = engine?.noteData ?? {};

  Object.entries(noteData).forEach(([key, note]: [string, any]) => {
    const currentDiff = safeDiff(
      note?.currentTotal ?? note?.totalCurrent,
      note?.mappedCurrent ?? note?.currentMapped
    );

    const priorDiff = safeDiff(
      note?.priorTotal ?? note?.totalPrior,
      note?.mappedPrior ?? note?.priorMapped
    );

    if (Math.abs(currentDiff) > 0 || Math.abs(priorDiff) > 0) {
      issues.push({
        id: `note-${key}`,
        severity:
          Math.abs(currentDiff) > 1 || Math.abs(priorDiff) > 1
            ? "critical"
            : "caution",
        title: note?.title ? `Note: ${note.title}` : `Note check: ${key}`,
        message: `Note total must agree to mapped balance. Current difference ${amount(
          currentDiff
        )}; prior difference ${amount(priorDiff)}.`,
        target: `note-${key}`,
        targetLabel: "Note",
      });
    }
  });

  return issues;
}

function severityRank(severity: AfsFlightDeckIssueSeverity) {
  if (severity === "critical") return 1;
  if (severity === "caution") return 2;
  return 3;
}

function plural(count: number, single: string, multiple: string) {
  return count === 1 ? `${count} ${single}` : `${count} ${multiple}`;
}

export default function AfsFlightDeck({
  issues = [],
  onJump,
}: AfsFlightDeckProps) {
  const [open, setOpen] = useState(false);

  const counts = useMemo(
    () => ({
      critical: issues.filter((issue) => issue.severity === "critical").length,
      caution: issues.filter((issue) => issue.severity === "caution").length,
      info: issues.filter((issue) => issue.severity === "info").length,
    }),
    [issues]
  );

  const sortedIssues = useMemo(
    () =>
      [...issues].sort(
        (a, b) => severityRank(a.severity) - severityRank(b.severity)
      ),
    [issues]
  );

  const hasIssues = counts.critical > 0 || counts.caution > 0;

  const status = counts.critical
    ? {
        label: "BLOCKER",
        detail: plural(counts.critical, "must fix", "must fix"),
        tone: "critical" as const,
      }
    : counts.caution
    ? {
        label: "CHECK",
        detail: plural(counts.caution, "item", "items"),
        tone: "caution" as const,
      }
    : {
        label: "CLEAR",
        detail: "ready to review",
        tone: "clear" as const,
      };

  function handleJump(issue: AfsFlightDeckIssue) {
    if (!issue.target || !onJump) return;
    onJump(issue.target);
    setOpen(false);
  }

  return (
    <div style={styles.wrap} className="no-print">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        style={styles.deckButton}
        aria-label="Open AFS FlightDeck"
      >
        <span style={styles.brand}>FlightDeck</span>

        <span
          style={{
            ...styles.beacon,
            ...(status.tone === "critical"
              ? styles.beaconCritical
              : status.tone === "caution"
              ? styles.beaconCaution
              : styles.beaconClear),
          }}
        />

        <span style={styles.statusLabel}>{status.label}</span>
        <span style={styles.statusDetail}>{status.detail}</span>

        <span style={styles.focusText}>
          {counts.critical
            ? "Fix blockers before export"
            : counts.caution
            ? "Review caution items"
            : "No current engine issues"}
        </span>

        <span style={styles.countText}>
          {hasIssues
            ? `${plural(counts.critical, "blocker", "blockers")} · ${plural(
                counts.caution,
                "review",
                "reviews"
              )}`
            : "All checks clear"}
        </span>

        <span style={styles.openText}>{open ? "Close" : "Open"}</span>
      </button>

      {open ? (
        <div style={styles.panel}>
          <div style={styles.panelHeader}>
            <strong>Issue radar</strong>
            <span>Click an item to jump. FlightDeck checks do not print.</span>
          </div>

          {sortedIssues.length ? (
            <div style={styles.issueGrid}>
              {sortedIssues.map((issue) => (
                <button
                  key={issue.id}
                  type="button"
                  onClick={() => handleJump(issue)}
                  style={{
                    ...styles.issue,
                    ...(issue.severity === "critical"
                      ? styles.issueCritical
                      : issue.severity === "caution"
                      ? styles.issueCaution
                      : styles.issueInfo),
                  }}
                >
                  <span style={styles.issueTopLine}>
                    <strong>{issue.title}</strong>
                    <span style={styles.targetLabel}>
                      {issue.targetLabel ?? "AFS"}
                    </span>
                  </span>

                  <span style={styles.issueMessage}>{issue.message}</span>
                </button>
              ))}
            </div>
          ) : (
            <div style={styles.emptyState}>All current checks are clear.</div>
          )}
        </div>
      ) : null}
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  wrap: {
    width: "100%",
    maxWidth: "100%",
  },
  deckButton: {
    width: "100%",
    display: "grid",
    gridTemplateColumns: "94px 12px auto auto minmax(120px, 1fr) auto 52px",
    alignItems: "center",
    gap: 7,
    minHeight: 26,
    border: "1px solid #111827",
    background: "#ffffff",
    color: "#111827",
    cursor: "pointer",
    fontFamily: "inherit",
    padding: "0 7px 0 0",
    textAlign: "left",
    boxShadow: "0 1px 0 rgba(15, 23, 42, 0.08)",
  },
  brand: {
    height: "100%",
    minHeight: 26,
    display: "flex",
    alignItems: "center",
    padding: "0 9px",
    background: "#111827",
    color: "#ffffff",
    fontSize: 10.5,
    fontWeight: 950,
    letterSpacing: 0.35,
    textTransform: "uppercase",
  },
  beacon: {
    width: 8,
    height: 8,
    borderRadius: 999,
    display: "inline-block",
  },
  beaconCritical: {
    background: "#dc2626",
    boxShadow: "0 0 0 3px #fee2e2",
  },
  beaconCaution: {
    background: "#d97706",
    boxShadow: "0 0 0 3px #fef3c7",
  },
  beaconClear: {
    background: "#059669",
    boxShadow: "0 0 0 3px #d1fae5",
  },
  statusLabel: {
    fontSize: 10.5,
    fontWeight: 950,
    textTransform: "uppercase",
  },
  statusDetail: {
    fontSize: 10.5,
    fontWeight: 800,
    color: "#64748b",
    whiteSpace: "nowrap",
  },
  focusText: {
    fontSize: 10.5,
    fontWeight: 750,
    color: "#334155",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  countText: {
    fontSize: 10.5,
    color: "#334155",
    fontWeight: 900,
    whiteSpace: "nowrap",
  },
  openText: {
    fontSize: 10.5,
    fontWeight: 950,
    textAlign: "right",
  },
  panel: {
    border: "1px solid #111827",
    borderTop: 0,
    background: "#ffffff",
    padding: 7,
    boxShadow: "0 7px 15px rgba(15, 23, 42, 0.11)",
  },
  panelHeader: {
    display: "flex",
    justifyContent: "space-between",
    gap: 10,
    marginBottom: 6,
    fontSize: 10.5,
    color: "#475569",
  },
  issueGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))",
    gap: 6,
    maxHeight: 150,
    overflow: "auto",
  },
  issue: {
    border: "1px solid #cbd5e1",
    background: "#ffffff",
    padding: 6,
    textAlign: "left",
    cursor: "pointer",
    fontFamily: "inherit",
    fontSize: 10.5,
  },
  issueCritical: {
  border: "1px solid #fca5a5",
  background: "#fff1f2",
},
issueCaution: {
  border: "1px solid #fcd34d",
  background: "#fffbeb",
},
issueInfo: {
  border: "1px solid #bfdbfe",
  background: "#eff6ff",
},
  issueTopLine: {
    display: "flex",
    justifyContent: "space-between",
    gap: 8,
    marginBottom: 3,
  },
  targetLabel: {
    color: "#64748b",
    fontWeight: 950,
    fontSize: 9.5,
  },
  issueMessage: {
    display: "block",
    lineHeight: 1.3,
    color: "#334155",
  },
  emptyState: {
    border: "1px solid #bbf7d0",
    background: "#f0fdf4",
    color: "#166534",
    padding: 8,
    fontSize: 10.5,
    fontWeight: 800,
  },
};