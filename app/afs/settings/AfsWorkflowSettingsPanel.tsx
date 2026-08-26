"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { createClient } from "@supabase/supabase-js";

type Authority = "Pilot" | "First Officer" | "Captain";
type SignoffDefault = "required" | "optional";

type WorkflowUser = {
  id: string;
  full_name: string | null;
  email: string;
  role: string;
  access_enabled: boolean;
  can_access_afs?: boolean;
  afs_authority: Authority;
  can_restrict_afs_files?: boolean;
  staff_code?: string | null;
  can_delete_afs_drafts?: boolean;
};

type SectionDefault = {
  key: string;
  label: string;
};

const SECTION_DEFAULTS: SectionDefault[] = [
  { key: "client-setup", label: "Client Setup" },
  { key: "trial-balance", label: "Trial Balance" },
  { key: "adjusting-journals", label: "Adjusting Journals" },
  { key: "mapping", label: "Mapping" },
  { key: "lead-schedules", label: "Lead Schedules" },
  { key: "tax-calculator", label: "Tax Calculator" },
  { key: "financial-statements", label: "Financial Statements" },
  { key: "minutes", label: "Minutes / Resolutions" },
  { key: "export-print", label: "Export / Print" },
];

const OPTIONAL_DEFAULTS = SECTION_DEFAULTS.reduce<Record<string, SignoffDefault>>(
  (result, section) => {
    result[section.key] = "optional";
    return result;
  },
  {},
);

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

const supabase =
  supabaseUrl && supabaseAnonKey
    ? createClient(supabaseUrl, supabaseAnonKey)
    : null;

function cleanSectionDefaults(value: unknown): Record<string, SignoffDefault> {
  const source =
    value && typeof value === "object"
      ? (value as Record<string, unknown>)
      : {};

  return SECTION_DEFAULTS.reduce<Record<string, SignoffDefault>>(
    (result, section) => {
      result[section.key] =
        source[section.key] === "required" ? "required" : "optional";
      return result;
    },
    {},
  );
}

export default function AfsWorkflowSettingsPanel() {
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [savingStandards, setSavingStandards] = useState(false);
  const [users, setUsers] = useState<WorkflowUser[]>([]);
  const [canManage, setCanManage] = useState(false);
  const [canManageRegisterSettings, setCanManageRegisterSettings] = useState(false);
  const [practiceName, setPracticeName] = useState("");
  const [sectionDefaults, setSectionDefaults] =
    useState<Record<string, SignoffDefault>>(OPTIONAL_DEFAULTS);
  const [message, setMessage] = useState("");

  async function authHeaders(): Promise<Record<string, string>> {
    if (!supabase) return {};
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token || "";
    return token ? { Authorization: `Bearer ${token}` } : {};
  }

  async function loadWorkflow() {
    try {
      setLoading(true);
      setMessage("");

      const headers = await authHeaders();

      const [workflowResponse, defaultsResponse] = await Promise.all([
        fetch("/api/afs/settings/workflow", {
          cache: "no-store",
          headers,
        }),
        fetch("/api/afs/settings/workflow-defaults", {
          cache: "no-store",
          headers,
        }),
      ]);

      const [workflowData, defaultsData] = await Promise.all([
        workflowResponse.json(),
        defaultsResponse.json(),
      ]);

      if (!workflowResponse.ok) {
        throw new Error(workflowData.error || "Could not load AFS users.");
      }

      if (!defaultsResponse.ok) {
        throw new Error(
          defaultsData.error || "Could not load AFS workflow standards.",
        );
      }

      setUsers(workflowData.users || []);
      setCanManage(
        Boolean(workflowData.canManage) && Boolean(defaultsData.canManage),
      );
      setCanManageRegisterSettings(Boolean(workflowData.canManageRegisterSettings));
      setPracticeName(defaultsData.organisation?.name || "");
      setSectionDefaults(
        cleanSectionDefaults(
          defaultsData.organisation?.afs_section_signoff_defaults,
        ),
      );
    } catch (error: any) {
      setMessage(error?.message || "Could not load AFS workflow settings.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadWorkflow();
  }, []);

  const afsUsers = useMemo(
    () =>
      users.filter(
        (user) => user.access_enabled && user.can_access_afs !== false,
      ),
    [users],
  );

  async function changeAuthority(userId: string, authority: Authority) {
    if (!canManage) return;

    try {
      setSavingId(userId);
      setMessage("");

      const response = await fetch("/api/afs/settings/workflow", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...(await authHeaders()),
        },
        body: JSON.stringify({
          action: "user-authority",
          userId,
          authority,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Could not update AFS authority.");
      }

      setUsers((current) =>
        current.map((user) =>
          user.id === userId
            ? {
                ...user,
                afs_authority: data.authority,
                can_restrict_afs_files: data.canRestrictAfsFiles,
              }
            : user,
        ),
      );
    } catch (error: any) {
      setMessage(error?.message || "Could not update AFS authority.");
    } finally {
      setSavingId(null);
    }
  }

  function updateStaffCodeLocal(userId: string, value: string) {
    const cleaned = value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8);

    setUsers((current) =>
      current.map((user) =>
        user.id === userId ? { ...user, staff_code: cleaned } : user,
      ),
    );
  }

  async function saveRegisterSettings(
    userId: string,
    patch?: { canDeleteAfsDrafts?: boolean },
  ) {
    if (!canManageRegisterSettings) return;

    const user = users.find((item) => item.id === userId);
    if (!user) return;

    const staffCode = String(user.staff_code || "").trim().toUpperCase();
    const canDeleteAfsDrafts =
      patch?.canDeleteAfsDrafts ?? Boolean(user.can_delete_afs_drafts);

    try {
      setSavingId(userId);
      setMessage("");

      const response = await fetch("/api/afs/settings/workflow", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...(await authHeaders()),
        },
        body: JSON.stringify({
          action: "user-register-settings",
          userId,
          staffCode,
          canDeleteAfsDrafts,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Could not save AFS register settings.");
      }

      setUsers((current) =>
        current.map((item) =>
          item.id === userId
            ? {
                ...item,
                staff_code: data.staffCode,
                can_delete_afs_drafts: data.canDeleteAfsDrafts,
              }
            : item,
        ),
      );

      setMessage("AFS user settings saved.");
    } catch (error: any) {
      setMessage(error?.message || "Could not save AFS register settings.");
      await loadWorkflow();
    } finally {
      setSavingId(null);
    }
  }

  async function saveSectionStandards() {
    if (!canManage) return;

    try {
      setSavingStandards(true);
      setMessage("");

      const response = await fetch("/api/afs/settings/workflow-defaults", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...(await authHeaders()),
        },
        body: JSON.stringify({
          sectionSignoffDefaults: sectionDefaults,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error || "Could not save required sign-off standards.",
        );
      }

      setSectionDefaults(
        cleanSectionDefaults(
          data.organisation?.afs_section_signoff_defaults ?? sectionDefaults,
        ),
      );
      setMessage("Section sign-off standards saved.");
    } catch (error: any) {
      setMessage(
        error?.message || "Could not save section sign-off standards.",
      );
    } finally {
      setSavingStandards(false);
    }
  }

  if (loading) {
    return <section style={styles.loading}>Loading Users & Workflow...</section>;
  }

  return (
    <section style={styles.shell}>
      {message ? <div style={styles.message}>{message}</div> : null}

      <section style={styles.section}>
        <SectionHeader
          number="01"
          kicker="AFS TEAM"
          title="People & authority"
          help="Set each person’s AFS authority, short register code and controlled Draft-delete access."
        />

        <div style={styles.legend}>
          <span><b>Pilot</b> prepares</span>
          <span><b>First Officer</b> reviews</span>
          <span><b>Captain</b> has final authority</span>
        </div>

        <div style={styles.tableWrap}>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>Person</th>
                <th style={styles.th}>Code</th>
                <th style={styles.th}>Highest AFS authority</th>
                <th style={styles.th}>Draft delete</th>
                <th style={styles.th}>File access</th>
              </tr>
            </thead>
            <tbody>
              {afsUsers.map((user) => (
                <tr key={user.id}>
                  <td style={styles.td}>
                    <strong style={styles.person}>
                      {user.full_name || user.email}
                    </strong>
                    <span style={styles.email}>{user.email}</span>
                    <span style={styles.roleHint}>{user.role || "User"}</span>
                  </td>

                  <td style={styles.td}>
                    <input
                      value={user.staff_code || ""}
                      disabled={!canManageRegisterSettings || savingId === user.id}
                      onChange={(event) =>
                        updateStaffCodeLocal(user.id, event.target.value)
                      }
                      onBlur={() => saveRegisterSettings(user.id)}
                      placeholder="e.g. FVA"
                      style={styles.codeInput}
                      maxLength={8}
                    />
                  </td>

                  <td style={styles.td}>
                    <select
                      value={user.afs_authority}
                      disabled={!canManage || savingId === user.id}
                      onChange={(event) =>
                        changeAuthority(
                          user.id,
                          event.target.value as Authority,
                        )
                      }
                      style={styles.select}
                    >
                      <option value="Pilot">Pilot</option>
                      <option value="First Officer">First Officer</option>
                      <option value="Captain">Captain</option>
                    </select>
                  </td>

                  <td style={styles.td}>
                    {user.afs_authority === "Captain" ? (
                      <span style={styles.captainPermission}>Captain</span>
                    ) : (
                      <label style={styles.permissionCheck}>
                        <input
                          type="checkbox"
                          checked={Boolean(user.can_delete_afs_drafts)}
                          disabled={!canManageRegisterSettings || savingId === user.id}
                          onChange={(event) => {
                            const checked = event.target.checked;

                            setUsers((current) =>
                              current.map((item) =>
                                item.id === user.id
                                  ? { ...item, can_delete_afs_drafts: checked }
                                  : item,
                              ),
                            );

                            void saveRegisterSettings(user.id, {
                              canDeleteAfsDrafts: checked,
                            });
                          }}
                        />
                        <span>Allowed</span>
                      </label>
                    )}
                  </td>

                  <td style={styles.td}>
                    {user.afs_authority === "Pilot" ? (
                      <span style={styles.normalBadge}>Normal</span>
                    ) : (
                      <span style={styles.seniorBadge}>
                        Senior / restricted
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {afsUsers.length === 0 ? (
          <div style={styles.empty}>No AFS-enabled users found.</div>
        ) : null}
      </section>

      <section style={styles.section}>
        <SectionHeader
          number="02"
          kicker="SECTION SIGN-OFF STANDARDS"
          title="What must be signed off?"
          help={`${practiceName || "Your practice"} decides which sections must be completed and signed off before Ready for Review.`}
        />

        <div style={styles.standardsGrid}>
          {SECTION_DEFAULTS.map((section) => {
            const required = sectionDefaults[section.key] === "required";

            return (
              <div key={section.key} style={styles.standardRow}>
                <div style={styles.standardName}>
                  <span style={styles.standardDot}>
                    {required ? "●" : "○"}
                  </span>
                  <strong>{section.label}</strong>
                </div>

                <div style={styles.segmented}>
                  <button
                    type="button"
                    disabled={!canManage || savingStandards}
                    onClick={() =>
                      setSectionDefaults((current) => ({
                        ...current,
                        [section.key]: "optional",
                      }))
                    }
                    style={{
                      ...styles.segmentButton,
                      ...(required ? {} : styles.segmentButtonActive),
                    }}
                  >
                    Optional
                  </button>

                  <button
                    type="button"
                    disabled={!canManage || savingStandards}
                    onClick={() =>
                      setSectionDefaults((current) => ({
                        ...current,
                        [section.key]: "required",
                      }))
                    }
                    style={{
                      ...styles.segmentButton,
                      ...(required ? styles.segmentButtonRequired : {}),
                    }}
                  >
                    Required
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        <div style={styles.standardFooter}>
          <div style={styles.standardNote}>
            <strong>Practice default only.</strong>
            <span>
              Existing flights stay unchanged when you change these standards.
            </span>
          </div>

          {canManage ? (
            <button
              type="button"
              style={styles.saveButton}
              onClick={saveSectionStandards}
              disabled={savingStandards}
            >
              {savingStandards ? "Saving..." : "Save sign-off standards"}
            </button>
          ) : null}
        </div>
      </section>
    </section>
  );
}

function SectionHeader({
  number,
  kicker,
  title,
  help,
}: {
  number: string;
  kicker: string;
  title: string;
  help: string;
}) {
  return (
    <div style={styles.sectionHeader}>
      <div style={styles.sectionNumber}>{number}</div>
      <div>
        <div style={styles.kicker}>{kicker}</div>
        <h3 style={styles.title}>{title}</h3>
        <p style={styles.help}>{help}</p>
      </div>
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  shell: {
    display: "grid",
    gap: 18,
  },
  loading: {
    padding: 14,
    border: "1px solid #cbd5e1",
    background: "#ffffff",
    color: "#475569",
    fontSize: 11,
  },
  section: {
    background: "#ffffff",
    borderTop: "3px solid #0f172a",
    borderBottom: "1px solid #cbd5e1",
  },
  sectionHeader: {
    display: "grid",
    gridTemplateColumns: "38px minmax(0, 1fr)",
    alignItems: "start",
    gap: 10,
    padding: "11px 12px 10px",
    borderBottom: "1px solid #cbd5e1",
    background: "#f8fafc",
  },
  sectionNumber: {
    fontSize: 10,
    fontWeight: 900,
    color: "#2563eb",
    letterSpacing: "0.06em",
    paddingTop: 2,
  },
  kicker: {
    color: "#2563eb",
    fontSize: 9,
    fontWeight: 900,
    letterSpacing: "0.08em",
  },
  title: {
    margin: "2px 0 0",
    fontSize: 15,
    fontWeight: 900,
    color: "#0f172a",
  },
  help: {
    margin: "4px 0 0",
    color: "#64748b",
    fontSize: 10,
    lineHeight: 1.35,
  },
  legend: {
    display: "flex",
    gap: 18,
    alignItems: "center",
    padding: "8px 12px",
    borderBottom: "1px solid #e2e8f0",
    color: "#64748b",
    fontSize: 9.5,
    background: "#ffffff",
  },
  tableWrap: {
    overflowX: "auto",
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
  },
  th: {
    textAlign: "left",
    padding: "7px 10px",
    borderBottom: "1px solid #cbd5e1",
    background: "#f8fafc",
    color: "#64748b",
    fontSize: 8.5,
    fontWeight: 900,
    textTransform: "uppercase",
    letterSpacing: "0.05em",
    whiteSpace: "nowrap",
  },
  td: {
    padding: "8px 10px",
    borderBottom: "1px solid #e2e8f0",
    verticalAlign: "middle",
    fontSize: 10.5,
  },
  person: {
    display: "block",
    color: "#0f172a",
    fontSize: 10.5,
  },
  email: {
    display: "block",
    marginTop: 2,
    color: "#64748b",
    fontSize: 9,
  },
  roleHint: {
    display: "block",
    marginTop: 2,
    color: "#94a3b8",
    fontSize: 8.5,
  },
  codeInput: {
    width: 74,
    height: 27,
    border: "1px solid #94a3b8",
    background: "#ffffff",
    color: "#0f172a",
    padding: "4px 6px",
    fontSize: 10,
    fontWeight: 900,
    letterSpacing: "0.06em",
    textTransform: "uppercase",
  },
  permissionCheck: {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    color: "#334155",
    fontSize: 9.5,
    fontWeight: 800,
    whiteSpace: "nowrap",
  },
  captainPermission: {
    display: "inline-block",
    borderBottom: "1px solid #0f172a",
    color: "#0f172a",
    fontSize: 9.5,
    fontWeight: 900,
    paddingBottom: 1,
  },
  select: {
    minWidth: 150,
    height: 29,
    border: "1px solid #94a3b8",
    background: "#ffffff",
    color: "#0f172a",
    padding: "4px 7px",
    fontSize: 10,
    fontWeight: 850,
  },
  normalBadge: {
    display: "inline-block",
    border: "1px solid #cbd5e1",
    background: "#f8fafc",
    color: "#64748b",
    padding: "3px 6px",
    fontSize: 9,
    fontWeight: 850,
  },
  seniorBadge: {
    display: "inline-block",
    border: "1px solid #93c5fd",
    background: "#eff6ff",
    color: "#1d4ed8",
    padding: "3px 6px",
    fontSize: 9,
    fontWeight: 850,
  },
  standardsGrid: {
    display: "grid",
  },
  standardRow: {
    display: "grid",
    gridTemplateColumns: "minmax(220px, 1fr) 240px",
    alignItems: "center",
    gap: 16,
    minHeight: 42,
    padding: "6px 12px",
    borderBottom: "1px solid #e2e8f0",
  },
  standardName: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    color: "#0f172a",
    fontSize: 10.5,
  },
  standardDot: {
    width: 14,
    color: "#2563eb",
    fontSize: 10,
    textAlign: "center",
  },
  segmented: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    border: "1px solid #94a3b8",
    background: "#ffffff",
  },
  segmentButton: {
    border: 0,
    borderRight: "1px solid #cbd5e1",
    background: "#ffffff",
    color: "#64748b",
    minHeight: 28,
    padding: "5px 8px",
    fontSize: 9.5,
    fontWeight: 850,
    cursor: "pointer",
  },
  segmentButtonActive: {
    background: "#f1f5f9",
    color: "#0f172a",
    boxShadow: "inset 0 -2px 0 #64748b",
  },
  segmentButtonRequired: {
    background: "#eff6ff",
    color: "#1d4ed8",
    boxShadow: "inset 0 -2px 0 #2563eb",
  },
  standardFooter: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 14,
    padding: "10px 12px",
    background: "#f8fafc",
  },
  standardNote: {
    display: "grid",
    gap: 2,
    color: "#64748b",
    fontSize: 9.5,
  },
  saveButton: {
    border: "1px solid #1d4ed8",
    background: "#2563eb",
    color: "#ffffff",
    padding: "7px 11px",
    fontSize: 10,
    fontWeight: 900,
    cursor: "pointer",
    whiteSpace: "nowrap",
  },
  message: {
    padding: "7px 9px",
    background: "#f8fafc",
    border: "1px solid #cbd5e1",
    color: "#475569",
    fontSize: 9.5,
  },
  empty: {
    padding: "10px 12px",
    color: "#94a3b8",
    fontSize: 10,
  },
};
