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

  const requiredCount = useMemo(
    () =>
      SECTION_DEFAULTS.filter(
        (section) => sectionDefaults[section.key] === "required",
      ).length,
    [sectionDefaults],
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
          data.error || "Could not save section sign-off standards.",
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
    return <div style={styles.loading}>Loading Users & Workflow...</div>;
  }

  return (
    <div style={styles.shell}>
      {message ? <div style={styles.message}>{message}</div> : null}

      <section style={styles.block}>
        <div style={styles.blockHeader}>
          <div>
            <h2 style={styles.blockTitle}>AFS team</h2>
            <p style={styles.blockText}>
              Decide the highest AFS authority each person may hold. Their actual
              role is still chosen on each file.
            </p>
          </div>

          <div style={styles.roleFlow}>
            <span style={styles.roleStep}>Pilot</span>
            <span style={styles.arrow}>→</span>
            <span style={styles.roleStep}>First Officer</span>
            <span style={styles.arrow}>→</span>
            <span style={styles.roleStepStrong}>Captain</span>
          </div>
        </div>

        <div style={styles.peopleGrid}>
          {afsUsers.map((user) => (
            <div key={user.id} style={styles.personRow}>
              <div style={styles.personIdentity}>
                <strong style={styles.personName}>
                  {user.full_name || user.email}
                </strong>
                <span style={styles.email}>{user.email}</span>
              </div>

              <div style={styles.platformRole}>
                {user.role || "User"}
              </div>

              <div>
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
              </div>

              <div style={styles.accessCell}>
                {user.afs_authority === "Pilot" ? (
                  <span style={styles.normalAccess}>Normal access</span>
                ) : (
                  <span style={styles.seniorAccess}>Senior access</span>
                )}
              </div>
            </div>
          ))}
        </div>

        {afsUsers.length === 0 ? (
          <div style={styles.empty}>No AFS-enabled users found.</div>
        ) : null}
      </section>

      <section style={styles.block}>
        <div style={styles.blockHeader}>
          <div>
            <h2 style={styles.blockTitle}>Section sign-off standards</h2>
            <p style={styles.blockText}>
              Choose what {practiceName || "your practice"} insists must be signed
              off before a file can move to Ready for Review.
            </p>
          </div>

          <div style={styles.requiredSummary}>
            <strong style={styles.requiredNumber}>{requiredCount}</strong>
            <span style={styles.requiredText}>
              required of {SECTION_DEFAULTS.length}
            </span>
          </div>
        </div>

        <div style={styles.standardList}>
          {SECTION_DEFAULTS.map((section, index) => {
            const required = sectionDefaults[section.key] === "required";

            return (
              <div key={section.key} style={styles.standardRow}>
                <div style={styles.standardLeft}>
                  <span style={styles.standardIndex}>
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <strong style={styles.standardName}>{section.label}</strong>
                </div>

                <div style={styles.choice}>
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
                      ...styles.choiceButton,
                      ...(!required ? styles.optionalSelected : {}),
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
                      ...styles.choiceButton,
                      ...(required ? styles.requiredSelected : {}),
                    }}
                  >
                    Required
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        <div style={styles.footer}>
          <p style={styles.footerText}>
            Changing these standards affects new flights only. Existing files keep
            their current setup.
          </p>

          {canManage ? (
            <button
              type="button"
              style={styles.saveButton}
              onClick={saveSectionStandards}
              disabled={savingStandards}
            >
              {savingStandards ? "Saving..." : "Save standards"}
            </button>
          ) : null}
        </div>
      </section>
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  shell: {
    display: "grid",
    gap: 20,
    padding: "8px 0 2px",
    background:
      "linear-gradient(180deg, rgba(239,246,255,0.45) 0%, rgba(248,250,252,0) 100%)",
  },
  loading: {
    padding: "14px 16px",
    background: "#ffffff",
    border: "1px solid #d7dee8",
    color: "#475569",
    fontSize: 12,
  },
  message: {
    padding: "9px 12px",
    background: "#eef6ff",
    borderLeft: "4px solid #2563eb",
    color: "#1e3a5f",
    fontSize: 11,
    fontWeight: 700,
  },
  block: {
    background: "#ffffff",
    border: "1px solid #c9d8ee",
    borderLeft: "4px solid #2563eb",
    boxShadow: "0 10px 26px rgba(37, 99, 235, 0.06)",
  },
  blockHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 20,
    padding: "18px 20px",
    borderBottom: "1px solid #cfe0f7",
    background:
      "linear-gradient(90deg, #edf5ff 0%, #f7fbff 58%, #ffffff 100%)",
  },
  blockTitle: {
    margin: 0,
    color: "#0f172a",
    fontSize: 20,
    lineHeight: 1.15,
    fontWeight: 850,
    letterSpacing: "-0.02em",
  },
  blockText: {
    margin: "6px 0 0",
    maxWidth: 720,
    color: "#64748b",
    fontSize: 11.5,
    lineHeight: 1.45,
  },
  roleFlow: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: "8px 10px",
    border: "1px solid #bfd3ef",
    background: "#ffffff",
    boxShadow: "0 3px 10px rgba(37, 99, 235, 0.05)",
    whiteSpace: "nowrap",
  },
  roleStep: {
    color: "#475569",
    fontSize: 10.5,
    fontWeight: 750,
  },
  roleStepStrong: {
    color: "#1d4ed8",
    fontSize: 10.5,
    fontWeight: 900,
  },
  arrow: {
    color: "#94a3b8",
    fontSize: 12,
  },
  peopleGrid: {
    display: "grid",
  },
  personRow: {
    display: "grid",
    gridTemplateColumns: "minmax(260px, 1.3fr) minmax(140px, 0.7fr) 190px 150px",
    alignItems: "center",
    gap: 16,
    minHeight: 58,
    padding: "8px 20px",
    borderBottom: "1px solid #edf1f5",
  },
  personIdentity: {
    minWidth: 0,
  },
  personName: {
    display: "block",
    color: "#0f172a",
    fontSize: 12,
    fontWeight: 850,
  },
  email: {
    display: "block",
    marginTop: 3,
    color: "#94a3b8",
    fontSize: 9.5,
  },
  platformRole: {
    color: "#475569",
    fontSize: 10.5,
    fontWeight: 750,
  },
  select: {
    width: "100%",
    height: 34,
    border: "1px solid #aeb9c8",
    background: "#ffffff",
    color: "#0f172a",
    padding: "4px 9px",
    fontSize: 10.5,
    fontWeight: 800,
    outline: "none",
  },
  accessCell: {
    display: "flex",
    justifyContent: "flex-start",
  },
  normalAccess: {
    display: "inline-block",
    color: "#475569",
    background: "#f1f5f9",
    border: "1px solid #d7dee8",
    padding: "4px 7px",
    fontSize: 9.5,
    fontWeight: 800,
  },
  seniorAccess: {
    display: "inline-block",
    color: "#174ea6",
    background: "#eaf3ff",
    border: "1px solid #9fc0ef",
    padding: "4px 7px",
    fontSize: 9.5,
    fontWeight: 900,
  },
  empty: {
    padding: 18,
    color: "#94a3b8",
    fontSize: 11,
  },
  requiredSummary: {
    minWidth: 120,
    textAlign: "center",
    padding: "10px 14px",
    background: "#2563eb",
    border: "1px solid #1d4ed8",
    boxShadow: "0 5px 14px rgba(37, 99, 235, 0.16)",
  },
  requiredNumber: {
    display: "block",
    color: "#ffffff",
    fontSize: 28,
    lineHeight: 1,
    fontWeight: 900,
    letterSpacing: "-0.04em",
  },
  requiredText: {
    display: "block",
    marginTop: 4,
    color: "#dbeafe",
    fontSize: 9.5,
    fontWeight: 800,
  },
  standardList: {
    display: "grid",
  },
  standardRow: {
    display: "grid",
    gridTemplateColumns: "minmax(260px, 1fr) 240px",
    alignItems: "center",
    gap: 18,
    minHeight: 50,
    padding: "7px 20px",
    borderBottom: "1px solid #edf1f5",
  },
  standardLeft: {
    display: "flex",
    alignItems: "center",
    gap: 14,
  },
  standardIndex: {
    color: "#9aa7b7",
    fontSize: 10,
    fontWeight: 800,
    fontVariantNumeric: "tabular-nums",
  },
  standardName: {
    color: "#0f172a",
    fontSize: 11.5,
    fontWeight: 850,
  },
  choice: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    border: "1px solid #b7c2d0",
    background: "#ffffff",
  },
  choiceButton: {
    minHeight: 32,
    border: 0,
    borderRight: "1px solid #d7dee8",
    background: "#ffffff",
    color: "#64748b",
    padding: "5px 8px",
    fontSize: 10,
    fontWeight: 800,
    cursor: "pointer",
  },
  optionalSelected: {
    background: "#f8fafc",
    color: "#334155",
    boxShadow: "inset 0 -3px 0 #94a3b8",
  },
  requiredSelected: {
    background: "#2563eb",
    color: "#ffffff",
    boxShadow: "inset 0 -3px 0 #174ea6",
  },
  footer: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 20,
    padding: "14px 20px",
    background: "#f4f8ff",
  },
  footerText: {
    margin: 0,
    color: "#64748b",
    fontSize: 10,
  },
  saveButton: {
    border: "1px solid #1d4ed8",
    background: "linear-gradient(180deg, #2f73f6 0%, #2563eb 100%)",
    color: "#ffffff",
    padding: "8px 14px",
    fontSize: 10.5,
    fontWeight: 900,
    cursor: "pointer",
    whiteSpace: "nowrap",
    boxShadow: "0 4px 10px rgba(37, 99, 235, 0.18)",
  },
};
