"use client";

import { useEffect, useState } from "react";

type Organisation = {
  id: string;
  name: string;
  status: string;
  access_enabled: boolean;
};

type UserProfile = {
    can_access_accounting: boolean;
    can_access_projects: boolean;
    can_access_budgeting: boolean;
  id: string;
  user_id: string;
  organisation_id: string | null;
  full_name: string | null;
  email: string;
  role: string;
  can_edit_projects: boolean;
  access_enabled: boolean;
  organisations?: {
    id: string;
    name: string;
  } | null;
};

const roleOptions = [
  "Super Admin",
  "Admin",
  "Staff",
  "Client Manager",
  "Client Viewer",
];

export default function AdminUsersPage() {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [organisations, setOrganisations] = useState<Organisation[]>([]);

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("Client Viewer");
  const [organisationId, setOrganisationId] = useState("");
  const [canEditProjects, setCanEditProjects] = useState(false);
  const [canAccessAccounting, setCanAccessAccounting] = useState(false);
  const [canAccessProjects, setCanAccessProjects] = useState(true);
  const [canAccessBudgeting, setCanAccessBudgeting] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editFullName, setEditFullName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editRole, setEditRole] = useState("Client Viewer");
  const [editOrganisationId, setEditOrganisationId] = useState("");
  const [editCanEditProjects, setEditCanEditProjects] = useState(false);
  const [editCanAccessAccounting, setEditCanAccessAccounting] = useState(false);
  const [editCanAccessProjects, setEditCanAccessProjects] = useState(true);
  const [editCanAccessBudgeting, setEditCanAccessBudgeting] = useState(false);

  const [loading, setLoading] = useState(true);
  const [loadingOrganisations, setLoadingOrganisations] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);

  const isInternalRole = role === "Super Admin" || role === "Admin" || role === "Staff";
  const isEditInternalRole =
    editRole === "Super Admin" || editRole === "Admin" || editRole === "Staff";

  useEffect(() => {
    loadUsers();
    loadOrganisations();
  }, []);

  useEffect(() => {
    if (isInternalRole) {
      setOrganisationId("");
      setCanEditProjects(true);
    }

    if (role === "Client Viewer") {
      setCanEditProjects(false);
    }

    if (role === "Client Manager") {
      setCanEditProjects(true);
    }
  }, [role, isInternalRole]);

  useEffect(() => {
    if (isEditInternalRole) {
      setEditOrganisationId("");
      setEditCanEditProjects(true);
    }

    if (editRole === "Client Viewer") {
      setEditCanEditProjects(false);
    }

    if (editRole === "Client Manager") {
      setEditCanEditProjects(true);
    }
  }, [editRole, isEditInternalRole]);

  async function loadUsers() {
    setLoading(true);

    const response = await fetch("/api/users");
    const data = await response.json();

    if (response.ok) {
      setUsers(data.users || []);
    } else {
      alert(data.error || "Could not load users.");
    }

    setLoading(false);
  }

  async function loadOrganisations() {
    setLoadingOrganisations(true);

    const response = await fetch("/api/organisations");
    const data = await response.json();

    if (response.ok) {
      setOrganisations(data.organisations || []);
    } else {
      alert(data.error || "Could not load clients.");
    }

    setLoadingOrganisations(false);
  }

  async function handleCreateUser() {
    if (!email.trim()) {
      alert("Email is required.");
      return;
    }

    if (!password.trim() || password.trim().length < 6) {
      alert("Password must be at least 6 characters.");
      return;
    }

    if (!isInternalRole && !organisationId) {
      alert("Please choose a client for this user.");
      return;
    }

    setSaving(true);

    const response = await fetch("/api/users", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
   body: JSON.stringify({
  fullName: fullName.trim(),
  email: email.trim(),
  password: password.trim(),
  role,
  organisationId,
  canEditProjects,
  canAccessAccounting,
  canAccessProjects,
  canAccessBudgeting,
}),
    });

    const data = await response.json();

    if (!response.ok) {
      alert(data.error || "Could not create user.");
      setSaving(false);
      return;
    }

    setUsers((prev) => [data.user, ...prev]);
    setFullName("");
    setEmail("");
    setPassword("");
    setRole("Client Viewer");
    setOrganisationId("");
    setCanEditProjects(false);
    setCanAccessAccounting(false);
    setCanAccessProjects(true);
    setCanAccessBudgeting(false);
    setSaving(false);       
  }

  function startEdit(user: UserProfile) {
    setEditingId(user.id);
    setEditFullName(user.full_name || "");
    setEditEmail(user.email || "");
    setEditRole(user.role || "Client Viewer");
    setEditOrganisationId(user.organisation_id || "");
    setEditCanEditProjects(Boolean(user.can_edit_projects));
    setEditCanAccessAccounting(Boolean(user.can_access_accounting));
    setEditCanAccessProjects(Boolean(user.can_access_projects));
    setEditCanAccessBudgeting(Boolean(user.can_access_budgeting));
  }

  function cancelEdit() {
    setEditingId(null);
    setEditFullName("");
    setEditEmail("");
    setEditRole("Client Viewer");
    setEditOrganisationId("");
    setEditCanEditProjects(false);
    setEditCanAccessAccounting(false);
    setEditCanAccessProjects(true);
    setEditCanAccessBudgeting(false);
  }

  async function saveEdit(user: UserProfile) {
    if (!editEmail.trim()) {
      alert("Email is required.");
      return;
    }

    if (!isEditInternalRole && !editOrganisationId) {
      alert("Please choose a client for this user.");
      return;
    }

    setSavingEdit(true);

    const response = await fetch(`/api/users/${user.id}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
     body: JSON.stringify({
  fullName: editFullName.trim(),
  email: editEmail.trim(),
  role: editRole,
  organisationId: editOrganisationId,
  canEditProjects: editCanEditProjects,
  canAccessAccounting: editCanAccessAccounting,
  canAccessProjects: editCanAccessProjects,
  canAccessBudgeting: editCanAccessBudgeting,
}),
    });

    const data = await response.json();

    if (!response.ok) {
      alert(data.error || "Could not update user.");
      setSavingEdit(false);
      return;
    }

    setUsers((prev) => prev.map((item) => (item.id === user.id ? data.user : item)));
    setSavingEdit(false);
    cancelEdit();
  }

  async function toggleAccess(user: UserProfile) {
    const response = await fetch(`/api/users/${user.id}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        accessEnabled: !user.access_enabled,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      alert(data.error || "Could not update user access.");
      return;
    }

    setUsers((prev) => prev.map((item) => (item.id === user.id ? data.user : item)));
  }

  return (
    <main style={styles.page}>
      <div style={styles.header}>
        <div>
          <h1 style={styles.title}>Admin Users</h1>
          <p style={styles.subtitle}>Manage users, roles and project access.</p>
        </div>

        <a href="/admin/clients" style={styles.backButton}>
          Back to Clients
        </a>
      </div>

      <section style={styles.card}>
        <h2 style={styles.cardTitle}>Add New User</h2>

        <div style={styles.formGrid}>
          <div style={styles.fieldGroup}>
            <label style={styles.label}>Full Name</label>
            <input
              style={styles.input}
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Example: Sarah Smith"
            />
          </div>

          <div style={styles.fieldGroup}>
            <label style={styles.label}>Email</label>
            <input
              style={styles.input}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Example: sarah@example.com"
            />
          </div>

          <div style={styles.fieldGroup}>
            <label style={styles.label}>Temporary Password</label>
            <input
              style={styles.input}
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Minimum 6 characters"
            />
          </div>

          <div style={styles.fieldGroup}>
            <label style={styles.label}>Role</label>
            <select style={styles.input} value={role} onChange={(e) => setRole(e.target.value)}>
              {roleOptions.map((roleOption) => (
                <option key={roleOption} value={roleOption}>
                  {roleOption}
                </option>
              ))}
            </select>
          </div>

          <div style={styles.fieldGroup}>
            <label style={styles.label}>Client</label>
            <select
              style={styles.input}
              value={organisationId}
              onChange={(e) => setOrganisationId(e.target.value)}
              disabled={isInternalRole || loadingOrganisations}
            >
              <option value="">
                {isInternalRole
                  ? "Internal user"
                  : loadingOrganisations
                  ? "Loading clients..."
                  : "Choose client"}
              </option>

              {organisations.map((organisation) => (
                <option key={organisation.id} value={organisation.id}>
                  {organisation.name}
                </option>
              ))}
            </select>
          </div>

          <div style={styles.checkboxGroup}>
            <label style={styles.checkboxLabel}>
              <input
                type="checkbox"
                checked={canEditProjects}
                onChange={(e) => setCanEditProjects(e.target.checked)}
                disabled={role === "Client Viewer" || isInternalRole}
              />
              Can edit projects
            </label>
          </div>
        </div>

        <div style={styles.actions}>
          <button style={styles.primaryButton} onClick={handleCreateUser} disabled={saving}>
            {saving ? "Saving..." : "Add User"}
          </button>
        </div>
      </section>

      <section style={styles.card}>
        <h2 style={styles.cardTitle}>Users</h2>

        {loading ? (
          <div style={styles.emptyState}>Loading users...</div>
        ) : users.length === 0 ? (
          <div style={styles.emptyState}>No users created yet.</div>
        ) : (
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>Name</th>
                <th style={styles.th}>Email</th>
                <th style={styles.th}>Client</th>
                <th style={styles.th}>Role</th>
                <th style={styles.th}>Can Edit Projects</th>
                <th style={styles.th}>Access</th>
                <th style={styles.thRight}>Actions</th>
              </tr>
            </thead>

            <tbody>
              {users.map((user) => {
                const isEditing = editingId === user.id;

                return (
                  <tr key={user.id}>
                    <td style={styles.td}>
                      {isEditing ? (
                        <input
                          style={styles.tableInput}
                          value={editFullName}
                          onChange={(e) => setEditFullName(e.target.value)}
                        />
                      ) : (
                        user.full_name || "-"
                      )}
                    </td>

                    <td style={styles.td}>
                      {isEditing ? (
                        <input
                          style={styles.tableInput}
                          value={editEmail}
                          onChange={(e) => setEditEmail(e.target.value)}
                        />
                      ) : (
                        user.email
                      )}
                    </td>

                    <td style={styles.td}>
                      {isEditing ? (
                        <select
                          style={styles.tableInput}
                          value={editOrganisationId}
                          onChange={(e) => setEditOrganisationId(e.target.value)}
                          disabled={isEditInternalRole}
                        >
                          <option value="">
                            {isEditInternalRole ? "Internal user" : "Choose client"}
                          </option>

                          {organisations.map((organisation) => (
                            <option key={organisation.id} value={organisation.id}>
                              {organisation.name}
                            </option>
                          ))}
                        </select>
                      ) : (
                        user.organisations?.name || "Internal user"
                      )}
                    </td>

                    <td style={styles.td}>
                      {isEditing ? (
                        <select
                          style={styles.tableInput}
                          value={editRole}
                          onChange={(e) => setEditRole(e.target.value)}
                        >
                          {roleOptions.map((roleOption) => (
                            <option key={roleOption} value={roleOption}>
                              {roleOption}
                            </option>
                          ))}
                        </select>
                      ) : (
                        user.role
                      )}
                    </td>

                    <td style={styles.td}>
                      {isEditing ? (
                        <label style={styles.checkboxLabel}>
                          <input
                            type="checkbox"
                            checked={editCanEditProjects}
                            onChange={(e) => setEditCanEditProjects(e.target.checked)}
                            disabled={editRole === "Client Viewer" || isEditInternalRole}
                          />
                          Yes
                        </label>
                      ) : user.can_edit_projects ? (
                        "Yes"
                      ) : (
                        "No"
                      )}
                    </td>

                    <td style={styles.td}>
                      <span
                        style={{
                          ...styles.statusPill,
                          ...(user.access_enabled ? styles.statusActive : styles.statusBlocked),
                        }}
                      >
                        {user.access_enabled ? "Enabled" : "Blocked"}
                      </span>
                    </td>

                    <td style={styles.tdRight}>
                      {isEditing ? (
                        <>
                          <button
                            style={styles.saveButton}
                            onClick={() => saveEdit(user)}
                            disabled={savingEdit}
                          >
                            {savingEdit ? "Saving..." : "Save"}
                          </button>

                          <button style={styles.cancelButton} onClick={cancelEdit}>
                            Cancel
                          </button>
                        </>
                      ) : (
                        <>
                          <button style={styles.editButton} onClick={() => startEdit(user)}>
                            Edit
                          </button>

                          <button
                            style={user.access_enabled ? styles.blockButton : styles.enableButton}
                            onClick={() => toggleAccess(user)}
                          >
                            {user.access_enabled ? "Block Access" : "Enable Access"}
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>
    </main>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    padding: "32px",
    background: "#f6f8fb",
    minHeight: "100vh",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "24px",
  },
  title: {
    fontSize: "32px",
    fontWeight: 700,
    margin: 0,
    color: "#12304a",
  },
  subtitle: {
    marginTop: "8px",
    color: "#5b6775",
    fontSize: "15px",
  },
  backButton: {
    background: "#eef3f8",
    color: "#12304a",
    borderRadius: "10px",
    padding: "11px 18px",
    fontSize: "14px",
    fontWeight: 600,
    textDecoration: "none",
  },
  card: {
    background: "#ffffff",
    borderRadius: "16px",
    padding: "24px",
    marginBottom: "20px",
    boxShadow: "0 8px 24px rgba(0,0,0,0.06)",
    border: "1px solid #e5eaf0",
    overflowX: "auto",
  },
  cardTitle: {
    fontSize: "20px",
    margin: "0 0 20px 0",
    color: "#12304a",
  },
  formGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(3, 1fr)",
    gap: "20px",
    alignItems: "end",
  },
  fieldGroup: {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
  },
  label: {
    fontSize: "14px",
    fontWeight: 600,
    color: "#34495e",
  },
  input: {
    height: "42px",
    borderRadius: "10px",
    border: "1px solid #d5dde6",
    padding: "0 12px",
    fontSize: "15px",
    outline: "none",
    background: "#ffffff",
  },
  tableInput: {
    height: "36px",
    borderRadius: "8px",
    border: "1px solid #d5dde6",
    padding: "0 10px",
    fontSize: "14px",
    outline: "none",
    background: "#ffffff",
    width: "170px",
  },
  checkboxGroup: {
    display: "flex",
    alignItems: "center",
    height: "42px",
  },
  checkboxLabel: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    fontSize: "14px",
    fontWeight: 600,
    color: "#12304a",
  },
  actions: {
    display: "flex",
    justifyContent: "flex-end",
    marginTop: "24px",
  },
  primaryButton: {
    background: "#0b5cab",
    color: "#ffffff",
    border: "none",
    borderRadius: "10px",
    padding: "11px 18px",
    fontSize: "14px",
    fontWeight: 600,
    cursor: "pointer",
  },
  emptyState: {
    padding: "32px",
    textAlign: "center",
    color: "#7b8794",
    border: "1px dashed #c9d3df",
    borderRadius: "14px",
    background: "#fafcff",
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
  },
  th: {
    textAlign: "left",
    padding: "12px",
    borderBottom: "1px solid #dce3eb",
    fontSize: "13px",
    color: "#34495e",
    whiteSpace: "nowrap",
  },
  thRight: {
    textAlign: "right",
    padding: "12px",
    borderBottom: "1px solid #dce3eb",
    fontSize: "13px",
    color: "#34495e",
    whiteSpace: "nowrap",
  },
  td: {
    padding: "12px",
    borderBottom: "1px solid #edf1f5",
    fontSize: "14px",
    color: "#12304a",
    verticalAlign: "middle",
  },
  tdRight: {
    padding: "12px",
    borderBottom: "1px solid #edf1f5",
    fontSize: "14px",
    color: "#12304a",
    textAlign: "right",
    verticalAlign: "middle",
    whiteSpace: "nowrap",
  },
  statusPill: {
    display: "inline-block",
    borderRadius: "999px",
    padding: "5px 10px",
    fontSize: "12px",
    fontWeight: 700,
  },
  statusActive: {
    background: "#e8f8ee",
    color: "#137333",
    border: "1px solid #b8e6c8",
  },
  statusBlocked: {
    background: "#fff1f1",
    color: "#b42318",
    border: "1px solid #ffd0d0",
  },
  editButton: {
    background: "#e8f3ff",
    color: "#0b5cab",
    border: "1px solid #c9e2ff",
    borderRadius: "8px",
    padding: "8px 12px",
    fontSize: "13px",
    fontWeight: 700,
    cursor: "pointer",
    marginRight: "8px",
  },
  saveButton: {
    background: "#e8f8ee",
    color: "#137333",
    border: "1px solid #b8e6c8",
    borderRadius: "8px",
    padding: "8px 12px",
    fontSize: "13px",
    fontWeight: 700,
    cursor: "pointer",
    marginRight: "8px",
  },
  cancelButton: {
    background: "#eef3f8",
    color: "#12304a",
    border: "1px solid #d5dde6",
    borderRadius: "8px",
    padding: "8px 12px",
    fontSize: "13px",
    fontWeight: 700,
    cursor: "pointer",
  },
  blockButton: {
    background: "#fff1f1",
    color: "#b42318",
    border: "1px solid #ffd0d0",
    borderRadius: "8px",
    padding: "8px 12px",
    fontSize: "13px",
    fontWeight: 700,
    cursor: "pointer",
  },
  enableButton: {
    background: "#e8f8ee",
    color: "#137333",
    border: "1px solid #b8e6c8",
    borderRadius: "8px",
    padding: "8px 12px",
    fontSize: "13px",
    fontWeight: 700,
    cursor: "pointer",
  },
};