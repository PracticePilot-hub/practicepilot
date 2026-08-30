"use client";

import { Fragment, useEffect, useState, type CSSProperties } from "react";
import { createClient } from "@supabase/supabase-js";

type SectionKey =
  | "flight-settings"
  | "client-setup"
  | "trial-balance"
  | "adjusting-journals"
  | "mapping"
  | "lead-schedules"
  | "tax-calculator"
  | "financial-statements"
  | "minutes"
  | "export-print";

type Props = {
  engagementId: string;
  onJump?: (section: SectionKey) => void;
};

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

const supabase =
  supabaseUrl && supabaseAnonKey
    ? createClient(supabaseUrl, supabaseAnonKey)
    : null;

async function readJson(response: Response) {
  const text = await response.text();

  if (!text) {
    throw new Error(`PP returned an empty response (${response.status}).`);
  }

  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`PP returned an invalid response (${response.status}).`);
  }
}

export default function AfsFlightControlOverview({
  engagementId,
  onJump,
}: Props) {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);
  const [message, setMessage] = useState("");
  const [savingApplicability, setSavingApplicability] = useState<string | null>(null);
  const [leadSchedulesExpanded, setLeadSchedulesExpanded] = useState(true);

  async function authHeaders(): Promise<Record<string, string>> {
    if (!supabase) return {};
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token || "";
    return token ? { Authorization: `Bearer ${token}` } : {};
  }

  async function load() {
    try {
      setLoading(true);
      setMessage("");

      const response = await fetch(
        `/api/afs/engagements/${engagementId}/flight-control`,
        {
          cache: "no-store",
          headers: await authHeaders(),
        },
      );

      const payload = await readJson(response);

      if (!response.ok) {
        throw new Error(payload.error || "Could not load Flight Control.");
      }

      setData(payload);
    } catch (error: any) {
      setMessage(error?.message || "Could not load Flight Control.");
    } finally {
      setLoading(false);
    }
  }

  async function setApplicability(
    sectionKey: string,
    applicability: "required" | "conditional" | "not_applicable" | "optional",
  ) {
    try {
      setSavingApplicability(sectionKey);
      setMessage("");

      const response = await fetch(
        `/api/afs/engagements/${engagementId}/flight-control`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            ...(await authHeaders()),
          },
          body: JSON.stringify({ sectionKey, applicability }),
        },
      );

      const payload = await readJson(response);

      if (!response.ok) {
        throw new Error(payload.error || "Could not update section applicability.");
      }

      await load();
    } catch (error: any) {
      setMessage(error?.message || "Could not update section applicability.");
    } finally {
      setSavingApplicability(null);
    }
  }

  useEffect(() => {
    void load();
  }, [engagementId]);

  if (loading) {
    return <section style={styles.panel}>Loading Flight Control...</section>;
  }

  if (message) {
    return <section style={styles.error}>{message}</section>;
  }

  const workflow = data?.workflow;
  const summary = data?.summary;
  const sections = data?.sections || [];
  const levels = Number(workflow?.workflow_levels || 2);

  if (!workflow?.is_started) {
    return (
      <section style={styles.panel}>
        <div style={styles.notStarted}>
          <div>
            <strong style={styles.notStartedTitle}>Flight not started</strong>
            <span style={styles.notStartedText}>
              Choose the workflow and crew for this AFS file before Flight Control can begin.
            </span>
          </div>

          <button
            type="button"
            style={styles.settingsButton}
            onClick={() => onJump?.("flight-settings")}
          >
            Open File Settings
          </button>
        </div>
      </section>
    );
  }

  const workflowText =
    levels === 1
      ? "Solo"
      : levels === 2
        ? "Pilot → Captain"
        : "Pilot → First Officer → Captain";

  return (
    <section style={styles.panel}>
      <div style={styles.header}>
        <div>
          <div style={styles.kicker}>FLIGHT CONTROL</div>
          <h3 style={styles.title}>Preparation & review control</h3>
          <p style={styles.help}>{workflowText}</p>
        </div>

        <div
          style={{
            ...styles.readiness,
            ...(summary?.readyForFinalisation
              ? styles.readinessReady
              : styles.readinessPending),
          }}
        >
          {summary?.readyForFinalisation ? "READY FOR FINALISATION" : "IN PROGRESS"}
        </div>
      </div>

      <div style={styles.summary}>
        <SummaryItem
          label="Prepared"
          value={`${summary?.preparedCount || 0}/${summary?.requiredTotal || 0} required`}
        />
        <SummaryItem
          label={levels === 3 ? "First Officer" : "Reviewed"}
          value={`${summary?.reviewedCount || 0}/${summary?.requiredTotal || 0}`}
        />
        <SummaryItem
          label="Captain"
          value={`${summary?.captainCount || 0}/${summary?.requiredTotal || 0}`}
        />
        <SummaryItem
          label="Open points"
          value={String(summary?.openReviewPoints || 0)}
          alert={Boolean(summary?.openReviewPoints)}
        />
        <SummaryItem
          label="Awaiting clearance"
          value={String(summary?.resolvedReviewPoints || 0)}
          alert={Boolean(summary?.resolvedReviewPoints)}
        />
        <SummaryItem
          label="N/A"
          value={String(summary?.notApplicableCount || 0)}
        />
      </div>

      <div style={styles.tableWrap}>
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={styles.th}>Section</th>
              <th style={styles.th}>Applicability</th>
              <th style={styles.th}>Pilot</th>
              {levels === 3 ? <th style={styles.th}>First Officer</th> : null}
              <th style={styles.th}>Captain</th>
              <th style={styles.th}>Review points</th>
              <th style={styles.th}>Status</th>
            </tr>
          </thead>

          <tbody>
            {sections.map((section: any) => {
              const outstanding =
                Number(section.reviewPoints?.open || 0) +
                Number(section.reviewPoints?.resolved || 0);

              return (
                <Fragment key={section.key}>
                <tr>
                  <td style={styles.td}>
                    <button
                      type="button"
                      style={styles.sectionButton}
                      onClick={() => {
                        if (section.isLeadScheduleRollup) {
                          setLeadSchedulesExpanded((current) => !current);
                          return;
                        }

                        onJump?.(section.key);
                      }}
                    >
                      <span style={styles.number}>{section.number}</span>
                      <strong>{section.title}</strong>
                      {section.isLeadScheduleRollup ? (
                        <span style={styles.rollupCount}>
                          {section.usedLeadScheduleCompleteCount}/
                          {section.usedLeadScheduleCount} complete
                        </span>
                      ) : null}
                      {section.isLeadScheduleRollup ? (
                        <span style={styles.chevron}>
                          {leadSchedulesExpanded ? "−" : "+"}
                        </span>
                      ) : null}
                    </button>
                  </td>

                  <td style={styles.td}>
                    <div style={styles.applicabilityWrap}>
                      <select
                        value={section.applicability}
                        disabled={savingApplicability === section.key}
                        onChange={(event) =>
                          void setApplicability(
                            section.key,
                            event.target.value as
                              | "required"
                              | "conditional"
                              | "not_applicable"
                              | "optional",
                          )
                        }
                        style={styles.applicabilitySelect}
                        title="Only Required sections block Ready for Review."
                      >
                        <option value="required">Required</option>
                        <option value="conditional">Conditional</option>
                        <option value="not_applicable">N/A</option>
                        <option value="optional">Optional</option>
                      </select>

                      {section.isLeadScheduleRollup ? (
                        <span
                          style={styles.usedBadge}
                          title={`${section.usedLeadScheduleCount || 0} lead schedules currently used in this file.`}
                        >
                          Used
                        </span>
                      ) : null}
                    </div>
                  </td>

                  <td style={styles.td}>
                    {section.applicability === "not_applicable" ? (
                      <span style={styles.na}>N/A</span>
                    ) : section.applicability !== "required" && !section.prepared ? (
                      <span style={styles.notRequired}>Not required</span>
                    ) : (
                      <SignoffCell
                        done={section.prepared}
                        person={section.preparedBy}
                      />
                    )}
                  </td>

                  {levels === 3 ? (
                    <td style={styles.td}>
                      {section.applicability === "not_applicable" ? (
                        <span style={styles.na}>N/A</span>
                      ) : section.applicability !== "required" && !section.reviewed ? (
                        <span style={styles.notRequired}>Not required</span>
                      ) : (
                        <SignoffCell
                          done={section.reviewed}
                          person={section.reviewedBy}
                        />
                      )}
                    </td>
                  ) : null}

                  <td style={styles.td}>
                    {section.applicability === "not_applicable" ? (
                      <span style={styles.na}>N/A</span>
                    ) : section.applicability !== "required" &&
                      !section.captainCleared ? (
                      <span style={styles.notRequired}>Not required</span>
                    ) : (
                      <SignoffCell
                        done={section.captainCleared}
                        person={section.captainBy}
                      />
                    )}
                  </td>

                  <td style={styles.td}>
                    {outstanding ? (
                      <button
                        type="button"
                        style={styles.pointButton}
                        onClick={() => onJump?.(section.key)}
                      >
                        {section.reviewPoints.open
                          ? `${section.reviewPoints.open} open`
                          : ""}
                        {section.reviewPoints.open &&
                        section.reviewPoints.resolved
                          ? " · "
                          : ""}
                        {section.reviewPoints.resolved
                          ? `${section.reviewPoints.resolved} resolved`
                          : ""}
                      </button>
                    ) : (
                      <span style={styles.none}>—</span>
                    )}
                  </td>

                  <td style={styles.td}>
                    <span
                      style={{
                        ...styles.status,
                        ...(section.applicability === "not_applicable"
                          ? styles.statusNeutral
                          : section.complete
                            ? styles.statusComplete
                            : outstanding
                              ? styles.statusAttention
                              : styles.statusPending),
                      }}
                    >
                      {section.applicability === "not_applicable"
                        ? "N/A"
                        : section.complete
                          ? "Complete"
                          : outstanding
                            ? "Attention"
                            : section.applicability === "required"
                              ? "Pending"
                              : section.applicability === "optional"
                                ? "Optional"
                                : "Conditional"}
                    </span>
                  </td>
                </tr>

                {section.isLeadScheduleRollup && leadSchedulesExpanded
                  ? (section.usedLeadSchedules || []).map((lead: any) => {
                      const leadOutstanding =
                        Number(lead.reviewPoints?.open || 0) +
                        Number(lead.reviewPoints?.resolved || 0);

                      return (
                        <tr key={lead.signoffKey} style={styles.leadChildRow}>
                          <td style={styles.leadChildTd}>
                            <button
                              type="button"
                              style={styles.leadChildButton}
                              onClick={() => onJump?.("lead-schedules")}
                            >
                              <span style={styles.leadBranch}>↳</span>
                              <span>
                                {lead.number ? `${lead.number} · ` : ""}
                                {lead.key}
                              </span>
                            </button>
                          </td>

                          <td style={styles.leadChildTd}>
                            <span style={styles.usedBadge}>Used</span>
                          </td>

                          <td style={styles.leadChildTd}>
                            {section.applicability === "required" ? (
                              <SignoffCell
                                done={lead.prepared}
                                person={lead.preparedBy}
                              />
                            ) : (
                              <span style={styles.notRequired}>Not required</span>
                            )}
                          </td>

                          {levels === 3 ? (
                            <td style={styles.leadChildTd}>
                              {section.applicability === "required" ? (
                                <SignoffCell
                                  done={lead.reviewed}
                                  person={lead.reviewedBy}
                                />
                              ) : (
                                <span style={styles.notRequired}>Not required</span>
                              )}
                            </td>
                          ) : null}

                          <td style={styles.leadChildTd}>
                            {section.applicability === "required" ? (
                              <SignoffCell
                                done={lead.captainCleared}
                                person={lead.captainBy}
                              />
                            ) : (
                              <span style={styles.notRequired}>Not required</span>
                            )}
                          </td>

                          <td style={styles.leadChildTd}>
                            {leadOutstanding ? (
                              <span style={styles.pointText}>
                                {lead.reviewPoints.open
                                  ? `${lead.reviewPoints.open} open`
                                  : ""}
                                {lead.reviewPoints.open &&
                                lead.reviewPoints.resolved
                                  ? " · "
                                  : ""}
                                {lead.reviewPoints.resolved
                                  ? `${lead.reviewPoints.resolved} resolved`
                                  : ""}
                              </span>
                            ) : (
                              <span style={styles.none}>—</span>
                            )}
                          </td>

                          <td style={styles.leadChildTd}>
                            <span
                              style={{
                                ...styles.status,
                                ...(lead.complete
                                  ? styles.statusComplete
                                  : leadOutstanding
                                    ? styles.statusAttention
                                    : styles.statusPending),
                              }}
                            >
                              {section.applicability !== "required"
                                ? "Optional"
                                : lead.complete
                                  ? "Complete"
                                  : leadOutstanding
                                    ? "Attention"
                                    : "Pending"}
                            </span>
                          </td>
                        </tr>
                      );
                    })
                  : null}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      <div style={styles.footer}>
        <span>
          {summary?.completeCount || 0} of {summary?.requiredTotal || 0} required sections complete
        </span>

        <button type="button" style={styles.refreshButton} onClick={load}>
          Refresh
        </button>
      </div>
    </section>
  );
}

function SummaryItem({
  label,
  value,
  alert = false,
}: {
  label: string;
  value: string;
  alert?: boolean;
}) {
  return (
    <div style={styles.summaryItem}>
      <span style={styles.summaryLabel}>{label}</span>
      <strong style={alert ? styles.summaryValueAlert : styles.summaryValue}>
        {value}
      </strong>
    </div>
  );
}

function SignoffCell({
  done,
  person,
}: {
  done: boolean;
  person?: string | null;
}) {
  if (!done) {
    return <span style={styles.pending}>Pending</span>;
  }

  return (
    <span style={styles.done}>
      ✓ {person || "Signed"}
    </span>
  );
}

const styles: Record<string, CSSProperties> = {
  panel: {
    background: "#ffffff",
    border: "1px solid #cfd8e6",
  },
  error: {
    background: "#fff7ed",
    border: "1px solid #fed7aa",
    color: "#9a3412",
    padding: 10,
    fontSize: 10.5,
    fontWeight: 750,
  },
  header: {
    padding: "10px 12px",
    borderBottom: "1px solid #cbd5e1",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
  },
  kicker: {
    color: "#2563eb",
    fontSize: 8.5,
    fontWeight: 900,
    letterSpacing: "0.08em",
  },
  title: {
    margin: "2px 0 0",
    color: "#0f172a",
    fontSize: 15,
    fontWeight: 900,
  },
  help: {
    margin: "3px 0 0",
    color: "#64748b",
    fontSize: 9.5,
  },
  readiness: {
    padding: "5px 8px",
    border: "1px solid #cbd5e1",
    fontSize: 9,
    fontWeight: 900,
    letterSpacing: "0.03em",
  },
  readinessReady: {
    background: "#f0fdf4",
    borderColor: "#86efac",
    color: "#166534",
  },
  readinessPending: {
    background: "#f8fafc",
    color: "#475569",
  },
  summary: {
    display: "grid",
    gridTemplateColumns: "repeat(6, minmax(0, 1fr))",
    borderBottom: "1px solid #cbd5e1",
  },
  summaryItem: {
    padding: "7px 10px",
    borderRight: "1px solid #e2e8f0",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 8,
  },
  summaryLabel: {
    color: "#64748b",
    fontSize: 9,
    fontWeight: 800,
  },
  summaryValue: {
    color: "#0f172a",
    fontSize: 11,
  },
  summaryValueAlert: {
    color: "#c2410c",
    fontSize: 11,
  },
  tableWrap: {
    overflowX: "auto",
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
  },
  th: {
    background: "#f8fafc",
    color: "#64748b",
    padding: "7px 8px",
    borderBottom: "1px solid #cbd5e1",
    textAlign: "left",
    fontSize: 8.5,
    fontWeight: 900,
    textTransform: "uppercase",
    letterSpacing: "0.04em",
    whiteSpace: "nowrap",
  },
  td: {
    padding: "7px 8px",
    borderBottom: "1px solid #e2e8f0",
    fontSize: 9.5,
    verticalAlign: "middle",
  },
  sectionButton: {
    border: 0,
    background: "transparent",
    padding: 0,
    display: "flex",
    alignItems: "center",
    gap: 7,
    color: "#0f172a",
    cursor: "pointer",
    fontSize: 9.5,
  },
  number: {
    color: "#64748b",
    fontSize: 8.5,
    fontWeight: 900,
    minWidth: 18,
  },
  applicabilityWrap: {
    display: "flex",
    alignItems: "center",
    gap: 6,
  },
  applicabilitySelect: {
    border: "1px solid #cbd5e1",
    background: "#ffffff",
    color: "#334155",
    padding: "3px 5px",
    fontSize: 9,
    fontWeight: 800,
  },
  rollupCount: {
    marginLeft: 8,
    color: "#2563eb",
    fontSize: 8.5,
    fontWeight: 900,
    whiteSpace: "nowrap",
  },
  chevron: {
    marginLeft: 4,
    color: "#64748b",
    fontSize: 12,
    fontWeight: 900,
  },
  usedRequired: {
    color: "#1d4ed8",
    fontSize: 9,
    fontWeight: 900,
    whiteSpace: "nowrap",
  },
  leadChildRow: {
    background: "#f8fbff",
  },
  leadChildTd: {
    padding: "6px 8px",
    borderBottom: "1px solid #e2e8f0",
    fontSize: 9,
    verticalAlign: "middle",
  },
  leadChildButton: {
    border: 0,
    background: "transparent",
    padding: "0 0 0 19px",
    display: "flex",
    alignItems: "center",
    gap: 6,
    color: "#334155",
    cursor: "pointer",
    fontSize: 9,
    fontWeight: 800,
  },
  leadBranch: {
    color: "#94a3b8",
    fontSize: 11,
  },
  usedBadge: {
    display: "inline-block",
    border: "1px solid #bfdbfe",
    background: "#eff6ff",
    color: "#1d4ed8",
    padding: "2px 5px",
    fontSize: 8,
    fontWeight: 900,
  },
  pointText: {
    color: "#c2410c",
    fontSize: 9,
    fontWeight: 850,
  },
  na: {
    color: "#64748b",
    fontWeight: 850,
  },
  notRequired: {
    color: "#94a3b8",
    fontWeight: 750,
    whiteSpace: "nowrap",
  },
  done: {
    color: "#166534",
    fontWeight: 850,
    whiteSpace: "nowrap",
  },
  pending: {
    color: "#94a3b8",
    fontWeight: 750,
  },
  pointButton: {
    border: 0,
    background: "transparent",
    padding: 0,
    color: "#c2410c",
    fontSize: 9.5,
    fontWeight: 850,
    cursor: "pointer",
  },
  none: {
    color: "#94a3b8",
  },
  status: {
    display: "inline-block",
    padding: "3px 6px",
    border: "1px solid #cbd5e1",
    fontSize: 8.5,
    fontWeight: 900,
  },
  statusComplete: {
    background: "#f0fdf4",
    borderColor: "#86efac",
    color: "#166534",
  },
  statusAttention: {
    background: "#fff7ed",
    borderColor: "#fdba74",
    color: "#c2410c",
  },
  statusPending: {
    background: "#f8fafc",
    color: "#64748b",
  },
  statusNeutral: {
    background: "#f8fafc",
    borderColor: "#e2e8f0",
    color: "#64748b",
  },
  footer: {
    padding: "7px 10px",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    color: "#64748b",
    fontSize: 9.5,
  },
  refreshButton: {
    border: "1px solid #cbd5e1",
    background: "#ffffff",
    color: "#334155",
    padding: "4px 7px",
    fontSize: 9,
    fontWeight: 850,
    cursor: "pointer",
  },
  notStarted: {
    padding: 12,
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    color: "#475569",
    fontSize: 10.5,
  },
  notStartedTitle: {
    display: "block",
    color: "#0f172a",
    fontSize: 11,
    fontWeight: 900,
  },
  notStartedText: {
    display: "block",
    marginTop: 3,
    color: "#64748b",
    fontSize: 9.5,
  },
  settingsButton: {
    border: "1px solid #1d4ed8",
    background: "#2563eb",
    color: "#ffffff",
    padding: "6px 10px",
    fontSize: 9.5,
    fontWeight: 900,
    cursor: "pointer",
    whiteSpace: "nowrap",
  },
};
