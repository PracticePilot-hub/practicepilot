"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { supabase } from "@/app/lib/supabase";

type TeamMember = {
  id: string;
  user_id: string | null;
  full_name: string | null;
  email: string | null;
  access_enabled: boolean | null;
};

type ClientAllocation = {
  client_id: string;
  client_name: string;
  allocation_type: "client_lead" | "manager" | "partner";
};

type OpenWorkItem = {
  id: string;
  client_id: string | null;
  client_name: string | null;
  title: string | null;
  status: string | null;
  due_date: string | null;
};

type HandoverPreview = {
  success: boolean;
  departing: TeamMember;
  client_allocations: ClientAllocation[];
  open_work: OpenWorkItem[];
  counts: {
    client_lead: number;
    manager: number;
    partner: number;
    open_work: number;
  };
};

export default function TeamHandoverPage() {
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [departingProfileId, setDepartingProfileId] = useState("");
  const [preview, setPreview] = useState<HandoverPreview | null>(null);

  const [leadReplacement, setLeadReplacement] = useState("");
  const [managerReplacement, setManagerReplacement] = useState("");
  const [partnerReplacement, setPartnerReplacement] = useState("");
  const [workReplacement, setWorkReplacement] = useState("");

  const [disableAccess, setDisableAccess] = useState(true);

  const [loadingTeam, setLoadingTeam] = useState(true);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function authFetch(url: string, options?: RequestInit) {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.access_token) {
      throw new Error("Your PracticePilot login session could not be confirmed.");
    }

    const response = await fetch(url, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
        ...(options?.headers || {}),
      },
      cache: "no-store",
    });

    const result = await response.json();

    if (!response.ok || !result?.success) {
      throw new Error(result?.error || "Request failed.");
    }

    return result;
  }

  useEffect(() => {
    async function loadTeam() {
      setLoadingTeam(true);
      setError("");

      try {
        const result = await authFetch("/api/crm/team-handover");
        setTeam((result.team || []) as TeamMember[]);
      } catch (caught) {
        setError(
          caught instanceof Error
            ? caught.message
            : "Could not load the practice team."
        );
      } finally {
        setLoadingTeam(false);
      }
    }

    void loadTeam();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const activeReplacementTeam = useMemo(
    () =>
      team.filter(
        (member) =>
          member.access_enabled !== false &&
          member.id !== departingProfileId
      ),
    [team, departingProfileId]
  );

  const departingMember = useMemo(
    () => team.find((member) => member.id === departingProfileId) || null,
    [team, departingProfileId]
  );

  async function loadPreview() {
    if (!departingProfileId) return;

    setLoadingPreview(true);
    setError("");
    setNotice("");
    setPreview(null);

    try {
      const result = (await authFetch(
        `/api/crm/team-handover?departingProfileId=${encodeURIComponent(
          departingProfileId
        )}`
      )) as HandoverPreview;

      setPreview(result);

      const suggestedReplacement =
        activeReplacementTeam[0]?.id || "";

      setLeadReplacement(suggestedReplacement);
      setManagerReplacement(suggestedReplacement);
      setPartnerReplacement(suggestedReplacement);
      setWorkReplacement(suggestedReplacement);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Could not load the handover preview."
      );
    } finally {
      setLoadingPreview(false);
    }
  }

  async function executeHandover() {
    if (!preview) return;

    const needsLead = preview.counts.client_lead > 0;
    const needsManager = preview.counts.manager > 0;
    const needsPartner = preview.counts.partner > 0;
    const needsWork = preview.counts.open_work > 0;

    if (needsLead && !leadReplacement) {
      setError("Choose the replacement Client Lead.");
      return;
    }

    if (needsManager && !managerReplacement) {
      setError("Choose the replacement Manager.");
      return;
    }

    if (needsPartner && !partnerReplacement) {
      setError("Choose the replacement Partner.");
      return;
    }

    if (needsWork && !workReplacement) {
      setError("Choose the replacement for open work.");
      return;
    }

    const ok = window.confirm(
      `Complete the handover for ${
        preview.departing.full_name ||
        preview.departing.email ||
        "this team member"
      }?\n\nHistorical completed work and notes will remain under the original staff member. Only current client allocations and open work will move.`
    );

    if (!ok) return;

    setProcessing(true);
    setError("");
    setNotice("");

    try {
      const result = await authFetch("/api/crm/team-handover", {
        method: "POST",
        body: JSON.stringify({
          departingProfileId,
          leadReplacementProfileId: leadReplacement || null,
          managerReplacementProfileId: managerReplacement || null,
          partnerReplacementProfileId: partnerReplacement || null,
          workReplacementProfileId: workReplacement || null,
          disableAccess,
        }),
      });

      setNotice(
        `Handover completed. ${result.reassigned_clients || 0} client allocation${
          Number(result.reassigned_clients || 0) === 1 ? "" : "s"
        } and ${result.reassigned_work || 0} open work item${
          Number(result.reassigned_work || 0) === 1 ? "" : "s"
        } reassigned.`
      );

      await loadPreview();
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Could not complete the staff handover."
      );
    } finally {
      setProcessing(false);
    }
  }

  function teamOptions(value: string, setter: (value: string) => void) {
    return (
      <select
        value={value}
        onChange={(event) => setter(event.target.value)}
        style={styles.select}
      >
        <option value="">Select replacement...</option>
        {activeReplacementTeam.map((member) => (
          <option key={member.id} value={member.id}>
            {member.full_name || member.email || "Team member"}
          </option>
        ))}
      </select>
    );
  }

  return (
    <main style={styles.page}>
      <section style={styles.header}>
        <div>
          <Link href="/crm/clients/bulk-edit" style={styles.backLink}>
            ← Bulk Client Editor
          </Link>

          <h1 style={styles.title}>Staff Handover</h1>

          <p style={styles.subtitle}>
            Reassign current client responsibility and open work while preserving the complete historical record.
          </p>
        </div>
      </section>

      <section style={styles.selectPanel}>
        <div>
          <div style={styles.panelTitle}>Departing team member</div>
          <div style={styles.panelText}>
            Choose the person whose live responsibilities must be handed over.
          </div>
        </div>

        <select
          value={departingProfileId}
          onChange={(event) => {
            setDepartingProfileId(event.target.value);
            setPreview(null);
            setNotice("");
            setError("");
          }}
          style={styles.largeSelect}
          disabled={loadingTeam}
        >
          <option value="">
            {loadingTeam ? "Loading team..." : "Select team member..."}
          </option>

          {team.map((member) => (
            <option key={member.id} value={member.id}>
              {member.full_name || member.email || "Team member"}
              {member.access_enabled === false ? " · Inactive" : ""}
            </option>
          ))}
        </select>

        <button
          type="button"
          onClick={() => void loadPreview()}
          disabled={!departingProfileId || loadingPreview}
          style={{
            ...styles.primaryButton,
            opacity: !departingProfileId || loadingPreview ? 0.55 : 1,
          }}
        >
          {loadingPreview ? "Checking..." : "Review Handover"}
        </button>
      </section>

      {error ? <div style={styles.errorBar}>{error}</div> : null}
      {notice ? <div style={styles.noticeBar}>{notice}</div> : null}

      {preview ? (
        <>
          <section style={styles.personBar}>
            <div>
              <div style={styles.personName}>
                {departingMember?.full_name ||
                  departingMember?.email ||
                  "Team member"}
              </div>
              <div style={styles.personMeta}>
                {departingMember?.email || "No email"} ·{" "}
                {departingMember?.access_enabled === false
                  ? "Inactive"
                  : "Active"}
              </div>
            </div>

            <div style={styles.auditNote}>
              Historical work remains unchanged
            </div>
          </section>

          <section style={styles.summaryGrid}>
            <SummaryCell
              label="Client Lead"
              value={preview.counts.client_lead}
            />
            <SummaryCell
              label="Manager"
              value={preview.counts.manager}
            />
            <SummaryCell
              label="Partner"
              value={preview.counts.partner}
            />
            <SummaryCell
              label="Open Work"
              value={preview.counts.open_work}
            />
          </section>

          <section style={styles.assignmentPanel}>
            <div style={styles.sectionHeader}>
              <div>
                <h2 style={styles.sectionTitle}>Reassignment plan</h2>
                <p style={styles.sectionText}>
                  Different responsibilities may be handed to different people.
                </p>
              </div>
            </div>

            <div style={styles.assignmentGrid}>
              <AssignmentRow
                label="Client Lead"
                count={preview.counts.client_lead}
                control={teamOptions(
                  leadReplacement,
                  setLeadReplacement
                )}
              />

              <AssignmentRow
                label="Manager"
                count={preview.counts.manager}
                control={teamOptions(
                  managerReplacement,
                  setManagerReplacement
                )}
              />

              <AssignmentRow
                label="Partner"
                count={preview.counts.partner}
                control={teamOptions(
                  partnerReplacement,
                  setPartnerReplacement
                )}
              />

              <AssignmentRow
                label="Open work"
                count={preview.counts.open_work}
                control={teamOptions(
                  workReplacement,
                  setWorkReplacement
                )}
              />
            </div>

            <label style={styles.disableRow}>
              <input
                type="checkbox"
                checked={disableAccess}
                onChange={(event) =>
                  setDisableAccess(event.target.checked)
                }
              />
              <span>
                Disable this staff member’s PracticePilot access when the
                handover completes.
              </span>
            </label>
          </section>

          <div style={styles.detailGrid}>
            <section style={styles.detailPanel}>
              <div style={styles.detailHeader}>
                <div>
                  <h2 style={styles.sectionTitle}>Client responsibilities</h2>
                  <p style={styles.sectionText}>
                    Current allocations only. Historic responsibility is not rewritten.
                  </p>
                </div>

                <span style={styles.countBadge}>
                  {preview.client_allocations.length}
                </span>
              </div>

              <div style={styles.tableHeader}>
                <span>Client</span>
                <span>Responsibility</span>
              </div>

              {preview.client_allocations.length ? (
                preview.client_allocations.map((item) => (
                  <div
                    key={`${item.client_id}-${item.allocation_type}`}
                    style={styles.tableRow}
                  >
                    <span style={styles.clientName}>
                      {item.client_name}
                    </span>
                    <span style={styles.roleBadge}>
                      {item.allocation_type === "client_lead"
                        ? "Client Lead"
                        : item.allocation_type === "manager"
                          ? "Manager"
                          : "Partner"}
                    </span>
                  </div>
                ))
              ) : (
                <div style={styles.emptyState}>
                  No current client responsibilities.
                </div>
              )}
            </section>

            <section style={styles.detailPanel}>
              <div style={styles.detailHeader}>
                <div>
                  <h2 style={styles.sectionTitle}>Open work</h2>
                  <p style={styles.sectionText}>
                    Only outstanding work will move to the replacement person.
                  </p>
                </div>

                <span style={styles.countBadge}>
                  {preview.open_work.length}
                </span>
              </div>

              <div style={styles.workHeader}>
                <span>Work</span>
                <span>Client</span>
                <span>Due</span>
              </div>

              {preview.open_work.length ? (
                preview.open_work.map((item) => (
                  <div key={item.id} style={styles.workRow}>
                    <span style={styles.clientName}>
                      {item.title || "Untitled work"}
                    </span>
                    <span style={styles.muted}>
                      {item.client_name || "No client"}
                    </span>
                    <span style={styles.muted}>
                      {item.due_date || "—"}
                    </span>
                  </div>
                ))
              ) : (
                <div style={styles.emptyState}>
                  No open work assigned to this person.
                </div>
              )}
            </section>
          </div>

          <section style={styles.footerAction}>
            <div>
              <div style={styles.footerTitle}>
                Ready to complete the handover?
              </div>
              <div style={styles.footerText}>
                Completed tasks, notes and historical activity remain attributed to the original staff member.
              </div>
            </div>

            <button
              type="button"
              onClick={() => void executeHandover()}
              disabled={processing}
              style={{
                ...styles.completeButton,
                opacity: processing ? 0.6 : 1,
              }}
            >
              {processing
                ? "Completing Handover..."
                : "Complete Handover"}
            </button>
          </section>
        </>
      ) : null}
    </main>
  );
}

function SummaryCell({
  label,
  value,
}: {
  label: string;
  value: number;
}) {
  return (
    <div style={styles.summaryCell}>
      <div style={styles.summaryLabel}>{label}</div>
      <div style={styles.summaryValue}>{value}</div>
    </div>
  );
}

function AssignmentRow({
  label,
  count,
  control,
}: {
  label: string;
  count: number;
  control: React.ReactNode;
}) {
  return (
    <div style={styles.assignmentRow}>
      <div>
        <div style={styles.assignmentLabel}>{label}</div>
        <div style={styles.assignmentCount}>
          {count} current {count === 1 ? "item" : "items"}
        </div>
      </div>

      <div style={styles.arrow}>→</div>

      <div>{control}</div>
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  page: {
    minHeight: "100vh",
    padding: "18px 20px 32px",
    background: "#f4f7fb",
    color: "#10233a",
  },

  header: {
    marginBottom: 10,
  },

  backLink: {
    display: "inline-block",
    marginBottom: 4,
    color: "#1769e0",
    textDecoration: "none",
    fontSize: 10,
    fontWeight: 900,
  },

  title: {
    margin: 0,
    fontSize: 20,
    fontWeight: 950,
  },

  subtitle: {
    margin: "5px 0 0",
    color: "#64748b",
    fontSize: 10,
  },

  selectPanel: {
    display: "grid",
    gridTemplateColumns: "minmax(260px, 1fr) 360px auto",
    gap: 12,
    alignItems: "center",
    padding: 12,
    background: "#ffffff",
    border: "1px solid #d8e2ee",
  },

  panelTitle: {
    fontSize: 12,
    fontWeight: 900,
  },

  panelText: {
    marginTop: 3,
    color: "#64748b",
    fontSize: 9,
  },

  largeSelect: {
    width: "100%",
    height: 32,
    padding: "0 8px",
    border: "1px solid #c8d4e5",
    background: "#ffffff",
    fontSize: 10,
    color: "#10233a",
  },

  primaryButton: {
    height: 32,
    padding: "0 12px",
    border: "1px solid #1769e0",
    background: "#1769e0",
    color: "#ffffff",
    fontSize: 9.5,
    fontWeight: 900,
    cursor: "pointer",
  },

  errorBar: {
    marginTop: 8,
    padding: "8px 10px",
    border: "1px solid #fecaca",
    background: "#fff1f2",
    color: "#b42318",
    fontSize: 9,
    fontWeight: 850,
  },

  noticeBar: {
    marginTop: 8,
    padding: "8px 10px",
    border: "1px solid #bbf7d0",
    background: "#ecfdf3",
    color: "#166534",
    fontSize: 9,
    fontWeight: 850,
  },

  personBar: {
    marginTop: 8,
    padding: "10px 12px",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    background: "#10233a",
    color: "#ffffff",
  },

  personName: {
    fontSize: 13,
    fontWeight: 950,
  },

  personMeta: {
    marginTop: 2,
    color: "#cbd5e1",
    fontSize: 8.5,
  },

  auditNote: {
    padding: "5px 8px",
    border: "1px solid #35506f",
    background: "#17324f",
    color: "#dbeafe",
    fontSize: 8.5,
    fontWeight: 850,
  },

  summaryGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
    border: "1px solid #d8e2ee",
    borderTop: "none",
    background: "#ffffff",
  },

  summaryCell: {
    minHeight: 56,
    padding: "8px 10px",
    display: "grid",
    alignContent: "center",
    borderRight: "1px solid #e4eaf0",
  },

  summaryLabel: {
    color: "#64748b",
    fontSize: 8,
    fontWeight: 850,
  },

  summaryValue: {
    marginTop: 2,
    fontSize: 18,
    fontWeight: 950,
  },

  assignmentPanel: {
    marginTop: 8,
    background: "#ffffff",
    border: "1px solid #d8e2ee",
  },

  sectionHeader: {
    padding: "8px 10px",
    borderBottom: "1px solid #d8e2ee",
  },

  sectionTitle: {
    margin: 0,
    fontSize: 12,
    fontWeight: 900,
  },

  sectionText: {
    margin: "2px 0 0",
    color: "#64748b",
    fontSize: 8.5,
  },

  assignmentGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
  },

  assignmentRow: {
    minHeight: 78,
    padding: 10,
    display: "grid",
    gridTemplateColumns: "1fr 18px 1.3fr",
    gap: 6,
    alignItems: "center",
    borderRight: "1px solid #e7edf4",
  },

  assignmentLabel: {
    fontSize: 10,
    fontWeight: 900,
  },

  assignmentCount: {
    marginTop: 2,
    color: "#64748b",
    fontSize: 8,
  },

  arrow: {
    color: "#1769e0",
    fontSize: 15,
    fontWeight: 900,
  },

  select: {
    width: "100%",
    height: 30,
    minWidth: 0,
    padding: "0 6px",
    border: "1px solid #c8d4e5",
    background: "#ffffff",
    color: "#10233a",
    fontSize: 8.5,
  },

  disableRow: {
    minHeight: 38,
    padding: "0 10px",
    display: "flex",
    alignItems: "center",
    gap: 7,
    borderTop: "1px solid #e7edf4",
    color: "#334155",
    fontSize: 8.8,
    fontWeight: 800,
  },

  detailGrid: {
    marginTop: 8,
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 8,
  },

  detailPanel: {
    background: "#ffffff",
    border: "1px solid #d8e2ee",
  },

  detailHeader: {
    minHeight: 52,
    padding: "7px 10px",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottom: "1px solid #d8e2ee",
  },

  countBadge: {
    minWidth: 24,
    height: 24,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    background: "#eef5ff",
    color: "#1769e0",
    fontSize: 9,
    fontWeight: 900,
  },

  tableHeader: {
    minHeight: 30,
    padding: "0 10px",
    display: "grid",
    gridTemplateColumns: "1fr 110px",
    alignItems: "center",
    background: "#f6f8fb",
    color: "#526174",
    fontSize: 8,
    fontWeight: 900,
  },

  tableRow: {
    minHeight: 36,
    padding: "4px 10px",
    display: "grid",
    gridTemplateColumns: "1fr 110px",
    gap: 8,
    alignItems: "center",
    borderBottom: "1px solid #e7edf4",
  },

  workHeader: {
    minHeight: 30,
    padding: "0 10px",
    display: "grid",
    gridTemplateColumns: "1.3fr .9fr 86px",
    gap: 8,
    alignItems: "center",
    background: "#f6f8fb",
    color: "#526174",
    fontSize: 8,
    fontWeight: 900,
  },

  workRow: {
    minHeight: 36,
    padding: "4px 10px",
    display: "grid",
    gridTemplateColumns: "1.3fr .9fr 86px",
    gap: 8,
    alignItems: "center",
    borderBottom: "1px solid #e7edf4",
  },

  clientName: {
    fontSize: 8.8,
    fontWeight: 900,
  },

  muted: {
    color: "#64748b",
    fontSize: 8.2,
  },

  roleBadge: {
    justifySelf: "start",
    padding: "3px 6px",
    background: "#eef5ff",
    color: "#1769e0",
    fontSize: 7.8,
    fontWeight: 900,
  },

  emptyState: {
    padding: 14,
    color: "#64748b",
    fontSize: 8.5,
  },

  footerAction: {
    marginTop: 8,
    padding: "10px 12px",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 14,
    border: "1px solid #bcd0e8",
    background: "#f8fbff",
  },

  footerTitle: {
    fontSize: 10,
    fontWeight: 900,
  },

  footerText: {
    marginTop: 2,
    color: "#64748b",
    fontSize: 8.5,
  },

  completeButton: {
    height: 32,
    padding: "0 14px",
    border: "1px solid #1769e0",
    background: "#1769e0",
    color: "#ffffff",
    fontSize: 9.5,
    fontWeight: 900,
    cursor: "pointer",
  },
};
