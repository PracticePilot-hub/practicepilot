"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import Link from "next/link";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const supabase = createClient(supabaseUrl, supabaseAnonKey);

type ModuleKey =
  | "crm"
  | "accounting"
  | "afs"
  | "assets"
  | "secretarial"
  | "projects"
  | "management_reports"
  | "paia"
  | "proposals";

type ModuleState = Record<ModuleKey, boolean>;

type TeamUser = {
  id: string;
  user_id: string;
  full_name: string | null;
  email: string;
  role: string;
  access_enabled: boolean;
  can_manage_practice_users?: boolean | null;
  is_practice_owner?: boolean | null;
  can_access_crm?: boolean | null;
  can_access_accounting?: boolean | null;
  can_access_afs?: boolean | null;
  can_access_assets?: boolean | null;
  can_access_secretarial?: boolean | null;
  can_access_projects?: boolean | null;
  can_access_management_reports?: boolean | null;
  can_access_paia?: boolean | null;
  can_access_proposals?: boolean | null;
};

type LicenceRow = {
  module_key: string;
  licence_limit: number;
  is_enabled: boolean;
  used: number;
  available: number;
};

type Payload = {
  organisation?: { id: string; name: string };
  currentProfile?: TeamUser;
  internalTeam?: boolean;
  users?: TeamUser[];
  licences?: LicenceRow[];
  warning?: string | null;
  error?: string;
};

const moduleOptions: { key: ModuleKey; label: string }[] = [
  { key: "crm", label: "CRM" },
  { key: "accounting", label: "Accounting" },
  { key: "afs", label: "Financial Statements" },
  { key: "assets", label: "Assets" },
  { key: "secretarial", label: "Secretarial" },
  { key: "projects", label: "Projects" },
  { key: "management_reports", label: "Management Reports" },
  { key: "paia", label: "PAIA Manuals" },
  { key: "proposals", label: "Proposals" },
];

const emptyModules: ModuleState = {
  crm: false,
  accounting: false,
  afs: false,
  assets: false,
  secretarial: false,
  projects: false,
  management_reports: false,
  paia: false,
  proposals: false,
};

function modulesFromUser(user: TeamUser): ModuleState {
  return {
    crm: Boolean(user.can_access_crm),
    accounting: Boolean(user.can_access_accounting),
    afs: Boolean(user.can_access_afs),
    assets: Boolean(user.can_access_assets),
    secretarial: Boolean(user.can_access_secretarial),
    projects: Boolean(user.can_access_projects),
    management_reports: Boolean(user.can_access_management_reports),
    paia: Boolean(user.can_access_paia),
    proposals: Boolean(user.can_access_proposals),
  };
}

function modulesText(user: TeamUser) {
  const modules = moduleOptions
    .filter((item) => modulesFromUser(user)[item.key])
    .map((item) => item.label);

  return modules.length ? modules.join(", ") : "No modules";
}

export default function TeamPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [organisationName, setOrganisationName] = useState("Practice");
  const [internalTeam, setInternalTeam] = useState(false);
  const [currentProfile, setCurrentProfile] = useState<TeamUser | null>(null);
  const [users, setUsers] = useState<TeamUser[]>([]);
  const [licences, setLicences] = useState<LicenceRow[]>([]);
  const [licenceDrafts, setLicenceDrafts] = useState<Record<string, number>>({});
  const [savingLicenceKey, setSavingLicenceKey] = useState("");

  const [showAdd, setShowAdd] = useState(false);
  const [addName, setAddName] = useState("");
  const [addEmail, setAddEmail] = useState("");
  const [addRole, setAddRole] = useState("Staff");
  const [addCanManage, setAddCanManage] = useState(false);
  const [addModules, setAddModules] = useState<ModuleState>(emptyModules);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editRole, setEditRole] = useState("Staff");
  const [editAccess, setEditAccess] = useState(true);
  const [editCanManage, setEditCanManage] = useState(false);
  const [editModules, setEditModules] = useState<ModuleState>(emptyModules);
  const [copySourceId, setCopySourceId] = useState("");

  useEffect(() => {
    void loadTeam();
  }, []);

  async function authHeaders() {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.access_token) {
      throw new Error("Not authenticated.");
    }

    return {
      Authorization: `Bearer ${session.access_token}`,
      "Content-Type": "application/json",
    };
  }

  async function loadTeam() {
    setLoading(true);
    setError("");

    try {
      const headers = await authHeaders();
      const response = await fetch("/api/settings/team", {
        headers,
        cache: "no-store",
      });

      const data = (await response.json()) as Payload;
      if (!response.ok) throw new Error(data.error || "Could not load team.");

      setOrganisationName(data.organisation?.name || "Practice");
      setInternalTeam(Boolean(data.internalTeam));
      setCurrentProfile(data.currentProfile || null);
      setUsers(data.users || []);
      setLicences(data.licences || []);

      const nextDrafts: Record<string, number> = {};
      moduleOptions.forEach((item) => {
        const licence = (data.licences || []).find(
          (row: LicenceRow) => row.module_key === item.key
        );
        nextDrafts[item.key] = Number(licence?.licence_limit || 0);
      });
      setLicenceDrafts(nextDrafts);
    } catch (err: any) {
      setError(err?.message || "Could not load team.");
    } finally {
      setLoading(false);
    }
  }

  const activeUsers = useMemo(
    () => users.filter((user) => user.access_enabled !== false).length,
    [users]
  );

  const practiceOwner = users.find((user) => user.is_practice_owner);

  function toggleAddModule(key: ModuleKey) {
    setAddModules((current) => ({ ...current, [key]: !current[key] }));
  }

  function toggleEditModule(key: ModuleKey) {
    setEditModules((current) => ({ ...current, [key]: !current[key] }));
  }

  function startEdit(user: TeamUser) {
    setEditingId(user.id);
    setEditName(user.full_name || "");
    setEditRole(user.role === "Client Manager" ? "Client Manager" : "Staff");
    setEditAccess(user.access_enabled !== false);
    setEditCanManage(Boolean(user.can_manage_practice_users));
    setEditModules(modulesFromUser(user));
    setCopySourceId("");
    setNotice("");
    setError("");
  }

  function cancelEdit() {
    setEditingId(null);
    setCopySourceId("");
  }

  async function addTeamMember() {
    setSaving(true);
    setError("");
    setNotice("");

    try {
      const headers = await authHeaders();
      const response = await fetch("/api/settings/team", {
        method: "POST",
        headers,
        body: JSON.stringify({
          fullName: addName,
          email: addEmail,
          role: addRole,
          accessEnabled: true,
          canManagePracticeUsers: addCanManage,
          canAccessCrm: addModules.crm,
          canAccessAccounting: addModules.accounting,
          canAccessAfs: addModules.afs,
          canAccessAssets: addModules.assets,
          canAccessSecretarial: addModules.secretarial,
          canAccessProjects: addModules.projects,
          canAccessManagementReports: addModules.management_reports,
          canAccessPaia: addModules.paia,
          canAccessProposals: addModules.proposals,
        }),
      });

      const data = (await response.json()) as Payload;
      if (!response.ok) throw new Error(data.error || "Could not add team member.");

      setShowAdd(false);
      setAddName("");
      setAddEmail("");
      setAddRole("Staff");
      setAddCanManage(false);
      setAddModules(emptyModules);
      setNotice(
        data.warning
          ? data.warning
          : "Team member created. A login/setup email was sent."
      );
      await loadTeam();
    } catch (err: any) {
      setError(err?.message || "Could not add team member.");
    } finally {
      setSaving(false);
    }
  }

  async function saveEdit(user: TeamUser) {
    setSaving(true);
    setError("");
    setNotice("");

    try {
      const headers = await authHeaders();
      const response = await fetch("/api/settings/team", {
        method: "PATCH",
        headers,
        body: JSON.stringify({
          userId: user.id,
          fullName: editName,
          role: editRole,
          accessEnabled: editAccess,
          canManagePracticeUsers: editCanManage,
          canAccessCrm: editModules.crm,
          canAccessAccounting: editModules.accounting,
          canAccessAfs: editModules.afs,
          canAccessAssets: editModules.assets,
          canAccessSecretarial: editModules.secretarial,
          canAccessProjects: editModules.projects,
          canAccessManagementReports: editModules.management_reports,
          canAccessPaia: editModules.paia,
          canAccessProposals: editModules.proposals,
        }),
      });

      const data = (await response.json()) as Payload;
      if (!response.ok) throw new Error(data.error || "Could not update team member.");

      setNotice("Team member updated.");
      cancelEdit();
      await loadTeam();
    } catch (err: any) {
      setError(err?.message || "Could not update team member.");
    } finally {
      setSaving(false);
    }
  }

  async function copyPermissions(user: TeamUser) {
    if (!copySourceId) {
      setError("Choose a team member to copy permissions from.");
      return;
    }

    setSaving(true);
    setError("");
    setNotice("");

    try {
      const headers = await authHeaders();
      const response = await fetch("/api/settings/team", {
        method: "PATCH",
        headers,
        body: JSON.stringify({
          action: "copy_permissions",
          userId: user.id,
          sourceUserId: copySourceId,
        }),
      });

      const data = (await response.json()) as Payload;
      if (!response.ok) throw new Error(data.error || "Could not copy permissions.");

      setNotice("Permissions copied.");
      cancelEdit();
      await loadTeam();
    } catch (err: any) {
      setError(err?.message || "Could not copy permissions.");
    } finally {
      setSaving(false);
    }
  }

  async function saveLicence(moduleKey: ModuleKey) {
    setSavingLicenceKey(moduleKey);
    setError("");
    setNotice("");

    try {
      const headers = await authHeaders();
      const response = await fetch("/api/settings/team", {
        method: "PATCH",
        headers,
        body: JSON.stringify({
          action: "update_licence",
          moduleKey,
          licenceLimit: Number(licenceDrafts[moduleKey] || 0),
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Could not update licence quantity.");
      }

      setNotice(
        `${moduleOptions.find((item) => item.key === moduleKey)?.label || moduleKey} licence quantity updated.`
      );
      await loadTeam();
    } catch (err: any) {
      setError(err?.message || "Could not update licence quantity.");
    } finally {
      setSavingLicenceKey("");
    }
  }

  function moduleChecks(
    value: ModuleState,
    toggle: (key: ModuleKey) => void
  ) {
    return (
      <div style={styles.moduleChecks}>
        {moduleOptions.map((item) => (
          <label key={item.key} style={styles.moduleCheck}>
            <input
              type="checkbox"
              checked={value[item.key]}
              onChange={() => toggle(item.key)}
            />
            {item.label}
          </label>
        ))}
      </div>
    );
  }

  if (loading) {
    return <main style={styles.page}>Loading team...</main>;
  }

  return (
    <main style={styles.page}>
      <section style={styles.header}>
        <div>
          <div style={styles.kicker}>{internalTeam ? "PracticePilot Team" : "My Team"}</div>
          <h1 style={styles.title}>{organisationName}</h1>
          <p style={styles.subtitle}>
            {internalTeam
              ? "PracticePilot internal users are separate from client practices."
              : "Manage team members, module access and delegated team permissions."}
          </p>
        </div>

        <Link href="/settings" style={styles.secondaryButton}>
          Back to Settings
        </Link>
      </section>

      {error ? <div style={styles.error}>{error}</div> : null}
      {notice ? <div style={styles.notice}>{notice}</div> : null}

      <section style={styles.summaryStrip}>
        <div style={styles.summaryCell}>
          <span style={styles.summaryLabel}>Active team members</span>
          <strong style={styles.summaryValue}>{activeUsers}</strong>
        </div>
        <div style={styles.summaryCell}>
          <span style={styles.summaryLabel}>Practice owner</span>
          <strong style={styles.summaryValue}>
            {internalTeam ? "PracticePilot internal" : practiceOwner?.full_name || "—"}
          </strong>
        </div>
        <div style={styles.summaryCell}>
          <span style={styles.summaryLabel}>Delegated managers</span>
          <strong style={styles.summaryValue}>
            {users.filter((user) => user.can_manage_practice_users && !user.is_practice_owner).length}
          </strong>
        </div>
      </section>

      {!internalTeam ? (
        <section style={styles.panel}>
          <div style={styles.panelHeader}>
            <div>
              <h2 style={styles.panelTitle}>Module licences</h2>
              <p style={styles.panelSubtitle}>
                The Practice Owner can increase or reduce licence quantities as the practice changes.
              </p>
            </div>
          </div>

          <div style={styles.licenceTableHeader}>
            <span>Module</span>
            <span>Used</span>
            <span>Licence quantity</span>
            <span>Available</span>
            <span />
          </div>

          {moduleOptions.map((item) => {
            const licence = licences.find(
              (row) => row.module_key === item.key
            );

            const used = Number(licence?.used || 0);
            const limit = Number(licenceDrafts[item.key] || 0);
            const available = Math.max(limit - used, 0);
            const ownerCanChange = Boolean(currentProfile?.is_practice_owner);

            return (
              <div key={item.key} style={styles.licenceTableRow}>
                <div>
                  <strong style={styles.licenceName}>{item.label}</strong>
                  <div style={styles.smallMuted}>
                    {limit > 0 ? "Enabled" : "Not subscribed"}
                  </div>
                </div>

                <strong>{used}</strong>

                <input
                  type="number"
                  min={used}
                  step="1"
                  style={styles.licenceInput}
                  value={limit}
                  onChange={(event) =>
                    setLicenceDrafts((current) => ({
                      ...current,
                      [item.key]: Math.max(
                        used,
                        Number(event.target.value || 0)
                      ),
                    }))
                  }
                  disabled={!ownerCanChange}
                />

                <strong>{available}</strong>

                <button
                  type="button"
                  style={styles.secondaryButton}
                  onClick={() => saveLicence(item.key)}
                  disabled={
                    !ownerCanChange ||
                    savingLicenceKey === item.key
                  }
                >
                  {savingLicenceKey === item.key ? "Saving..." : "Update"}
                </button>
              </div>
            );
          })}

          {!currentProfile?.is_practice_owner ? (
            <div style={styles.empty}>
              Only the Practice Owner can change purchased licence quantities.
            </div>
          ) : null}
        </section>
      ) : null}

      <section style={styles.panel}>
        <div style={styles.panelHeader}>
          <div>
            <h2 style={styles.panelTitle}>Team members</h2>
            <p style={styles.panelSubtitle}>Users linked to this team.</p>
          </div>

          {!internalTeam ? (
            <button
              type="button"
              style={styles.primaryButton}
              onClick={() => setShowAdd((current) => !current)}
            >
              {showAdd ? "Cancel" : "+ Add Team Member"}
            </button>
          ) : null}
        </div>

        {showAdd && !internalTeam ? (
          <div style={styles.editor}>
            <div style={styles.editorGrid}>
              <label style={styles.field}>
                <span>Full name</span>
                <input
                  style={styles.input}
                  value={addName}
                  onChange={(event) => setAddName(event.target.value)}
                />
              </label>

              <label style={styles.field}>
                <span>Email</span>
                <input
                  style={styles.input}
                  type="email"
                  value={addEmail}
                  onChange={(event) => setAddEmail(event.target.value)}
                />
              </label>

              <label style={styles.field}>
                <span>Role</span>
                <select
                  style={styles.input}
                  value={addRole}
                  onChange={(event) => setAddRole(event.target.value)}
                >
                  <option value="Staff">Staff</option>
                  <option value="Client Manager">Practice Manager</option>
                </select>
              </label>

              <label style={styles.checkLine}>
                <input
                  type="checkbox"
                  checked={addCanManage}
                  onChange={(event) => setAddCanManage(event.target.checked)}
                />
                Can manage team
              </label>
            </div>

            <div style={styles.moduleHeading}>Module access</div>
            {moduleChecks(addModules, toggleAddModule)}

            <div style={styles.editorActions}>
              <button
                type="button"
                style={styles.primaryButton}
                onClick={addTeamMember}
                disabled={saving}
              >
                {saving ? "Saving..." : "Create Team Member"}
              </button>
            </div>
          </div>
        ) : null}

        <div style={styles.table}>
          <div style={styles.tableHeader}>
            <span>Name</span>
            <span>Role</span>
            <span>Modules</span>
            <span>Access</span>
            <span>Team management</span>
            <span />
          </div>

          {users.map((user) => {
            const isEditing = editingId === user.id;

            return (
              <div key={user.id}>
                <div style={styles.tableRow}>
                  <div>
                    <strong style={styles.userName}>
                      {user.full_name || user.email}
                      {user.is_practice_owner ? (
                        <span style={styles.ownerBadge}>Practice Owner</span>
                      ) : null}
                    </strong>
                    <div style={styles.smallMuted}>{user.email}</div>
                  </div>

                  <span>
                    {user.role === "Client Manager" ? "Practice Manager" : user.role}
                  </span>

                  <span style={styles.modules}>{modulesText(user)}</span>

                  <span
                    style={{
                      ...styles.status,
                      ...(user.access_enabled
                        ? styles.statusActive
                        : styles.statusBlocked),
                    }}
                  >
                    {user.access_enabled ? "Enabled" : "Blocked"}
                  </span>

                  <span>
                    {user.is_practice_owner
                      ? "Owner"
                      : user.can_manage_practice_users
                        ? "Can manage team"
                        : "No"}
                  </span>

                  <div style={styles.rowActions}>
                    {!internalTeam ? (
                      <button
                        type="button"
                        style={styles.editButton}
                        onClick={() => (isEditing ? cancelEdit() : startEdit(user))}
                      >
                        {isEditing ? "Close" : "Edit"}
                      </button>
                    ) : null}
                  </div>
                </div>

                {isEditing && !internalTeam ? (
                  <div style={styles.editor}>
                    <div style={styles.editorGrid}>
                      <label style={styles.field}>
                        <span>Full name</span>
                        <input
                          style={styles.input}
                          value={editName}
                          onChange={(event) => setEditName(event.target.value)}
                        />
                      </label>

                      <label style={styles.field}>
                        <span>Role</span>
                        <select
                          style={styles.input}
                          value={editRole}
                          onChange={(event) => setEditRole(event.target.value)}
                          disabled={Boolean(user.is_practice_owner)}
                        >
                          <option value="Staff">Staff</option>
                          <option value="Client Manager">Practice Manager</option>
                        </select>
                      </label>

                      <label style={styles.checkLine}>
                        <input
                          type="checkbox"
                          checked={editAccess}
                          onChange={(event) => setEditAccess(event.target.checked)}
                          disabled={Boolean(user.is_practice_owner)}
                        />
                        Access enabled
                      </label>

                      <label style={styles.checkLine}>
                        <input
                          type="checkbox"
                          checked={editCanManage}
                          onChange={(event) => setEditCanManage(event.target.checked)}
                          disabled={Boolean(user.is_practice_owner)}
                        />
                        Can manage team
                      </label>
                    </div>

                    <div style={styles.copyRow}>
                      <label style={styles.field}>
                        <span>Copy permissions from</span>
                        <select
                          style={styles.input}
                          value={copySourceId}
                          onChange={(event) => setCopySourceId(event.target.value)}
                        >
                          <option value="">Select team member...</option>
                          {users
                            .filter((candidate) => candidate.id !== user.id)
                            .map((candidate) => (
                              <option key={candidate.id} value={candidate.id}>
                                {candidate.full_name || candidate.email}
                              </option>
                            ))}
                        </select>
                      </label>

                      <button
                        type="button"
                        style={styles.secondaryButton}
                        onClick={() => copyPermissions(user)}
                        disabled={saving || !copySourceId}
                      >
                        Copy permissions
                      </button>
                    </div>

                    <div style={styles.moduleHeading}>Module access</div>
                    {moduleChecks(editModules, toggleEditModule)}

                    <div style={styles.editorActions}>
                      <button
                        type="button"
                        style={styles.primaryButton}
                        onClick={() => saveEdit(user)}
                        disabled={saving}
                      >
                        {saving ? "Saving..." : "Save Changes"}
                      </button>
                    </div>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      </section>
    </main>
  );
}

const styles: Record<string, CSSProperties> = {
  page: { minHeight: "100vh", padding: "18px", background: "#eef2f5", color: "#10233a" },
  header: { minHeight: "104px", padding: "18px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "20px", background: "#ffffff", border: "1px solid #d7dfde", marginBottom: "10px" },
  kicker: { color: "#5d6f7b", fontSize: "11px", fontWeight: 850 },
  title: { margin: "4px 0 0", fontSize: "24px", fontWeight: 900 },
  subtitle: { margin: "5px 0 0", color: "#6b7882", fontSize: "11px" },
  primaryButton: { minHeight: "36px", padding: "0 13px", border: "1px solid #10233a", background: "#10233a", color: "#ffffff", fontSize: "10px", fontWeight: 850, cursor: "pointer" },
  secondaryButton: { minHeight: "36px", padding: "0 13px", display: "inline-flex", alignItems: "center", justifyContent: "center", border: "1px solid #cfd8df", background: "#ffffff", color: "#10233a", textDecoration: "none", fontSize: "10px", fontWeight: 850, cursor: "pointer" },
  error: { marginBottom: "10px", padding: "10px 12px", border: "1px solid #efc2ba", background: "#fff3f1", color: "#9c3527", fontSize: "11px" },
  notice: { marginBottom: "10px", padding: "10px 12px", border: "1px solid #b7d7c1", background: "#edf7f0", color: "#2f7047", fontSize: "11px" },
  summaryStrip: { display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", border: "1px solid #d7dfde", background: "#ffffff", marginBottom: "10px" },
  summaryCell: { minHeight: "66px", padding: "11px 14px", display: "flex", flexDirection: "column", justifyContent: "center", borderRight: "1px solid #e5eae9" },
  summaryLabel: { color: "#74808a", fontSize: "9px", fontWeight: 800 },
  summaryValue: { marginTop: "4px", fontSize: "16px", fontWeight: 900 },
  panel: { background: "#ffffff", border: "1px solid #d7dfde", marginBottom: "10px" },
  panelHeader: { minHeight: "66px", padding: "11px 14px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "16px", borderBottom: "1px solid #e5eae9" },
  panelTitle: { margin: 0, fontSize: "14px", fontWeight: 900 },
  panelSubtitle: { margin: "3px 0 0", color: "#74808a", fontSize: "9px" },
  licenceTableHeader: { minHeight: "34px", padding: "0 14px", display: "grid", gridTemplateColumns: "minmax(220px,1fr) 80px 140px 90px 90px", gap: "12px", alignItems: "center", background: "#10233a", color: "#ffffff", fontSize: "9px", fontWeight: 850 },
  licenceTableRow: { minHeight: "56px", padding: "8px 14px", display: "grid", gridTemplateColumns: "minmax(220px,1fr) 80px 140px 90px 90px", gap: "12px", alignItems: "center", borderBottom: "1px solid #e7eceb", fontSize: "10px" },
  licenceName: { fontSize: "11px", fontWeight: 900 },
  licenceInput: { width: "110px", minHeight: "34px", padding: "0 8px", border: "1px solid #cfd8df", background: "#ffffff", color: "#10233a", fontSize: "10px" },
  smallMuted: { marginTop: "2px", color: "#78858e", fontSize: "9px" },
  empty: { padding: "22px 14px", color: "#78858e", fontSize: "10px" },
  table: { display: "grid" },
  tableHeader: { minHeight: "34px", padding: "0 14px", display: "grid", gridTemplateColumns: "minmax(220px,1.2fr) 120px minmax(260px,1.3fr) 90px 130px 65px", gap: "12px", alignItems: "center", background: "#10233a", color: "#ffffff", fontSize: "9px", fontWeight: 850 },
  tableRow: { minHeight: "62px", padding: "8px 14px", display: "grid", gridTemplateColumns: "minmax(220px,1.2fr) 120px minmax(260px,1.3fr) 90px 130px 65px", gap: "12px", alignItems: "center", borderBottom: "1px solid #e7eceb", fontSize: "10px" },
  userName: { display: "flex", alignItems: "center", gap: "7px", fontSize: "11px", fontWeight: 900 },
  ownerBadge: { padding: "3px 6px", border: "1px solid #b7d7c1", background: "#edf7f0", color: "#2f7047", fontSize: "8px", fontWeight: 850 },
  modules: { color: "#52616b", fontSize: "9px", lineHeight: 1.4 },
  status: { width: "fit-content", padding: "4px 7px", fontSize: "8px", fontWeight: 850 },
  statusActive: { border: "1px solid #b7d7c1", background: "#edf7f0", color: "#2f7047" },
  statusBlocked: { border: "1px solid #efc2ba", background: "#fff3f1", color: "#9c3527" },
  rowActions: { display: "flex", justifyContent: "flex-end" },
  editButton: { minHeight: "30px", padding: "0 9px", border: "1px solid #cfd8df", background: "#ffffff", color: "#10233a", fontSize: "9px", fontWeight: 850, cursor: "pointer" },
  editor: { padding: "14px", background: "#f8fafb", borderBottom: "1px solid #d7dfde" },
  editorGrid: { display: "grid", gridTemplateColumns: "repeat(4, minmax(0,1fr))", gap: "10px", alignItems: "end" },
  field: { display: "grid", gap: "5px", color: "#5f6d76", fontSize: "9px", fontWeight: 800 },
  input: { minHeight: "36px", width: "100%", padding: "0 9px", boxSizing: "border-box", border: "1px solid #cfd8df", background: "#ffffff", color: "#10233a", fontSize: "10px" },
  checkLine: { minHeight: "36px", display: "flex", alignItems: "center", gap: "7px", color: "#10233a", fontSize: "10px", fontWeight: 800 },
  moduleHeading: { marginTop: "14px", marginBottom: "7px", fontSize: "10px", fontWeight: 900 },
  moduleChecks: { display: "flex", flexWrap: "wrap", gap: "7px" },
  moduleCheck: { minHeight: "30px", padding: "0 9px", display: "inline-flex", alignItems: "center", gap: "6px", border: "1px solid #d8e0e6", background: "#ffffff", fontSize: "9px", fontWeight: 800 },
  editorActions: { marginTop: "14px", display: "flex", justifyContent: "flex-end" },
  copyRow: { marginTop: "12px", display: "grid", gridTemplateColumns: "minmax(260px, 420px) auto", gap: "8px", alignItems: "end" },
};
