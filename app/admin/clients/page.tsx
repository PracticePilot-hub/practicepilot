"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { createClient } from "@supabase/supabase-js";

type Organisation = {
  id: string;
  name: string;
  status: string;
  access_enabled: boolean;
  contact_person: string | null;
  contact_email: string | null;
  contact_number: string | null;
  logo_url: string | null;
  created_at: string;
};

type ModuleKey =
  | "crm"
  | "accounting"
  | "afs"
  | "assets"
  | "secretarial"
  | "projects"
  | "management_reports"
  | "paia"
  | "proposals"
  | "trusts";

type ModuleRow = {
  module_key: ModuleKey;
  licence_limit: number;
  is_enabled: boolean;
  used: number;
  available: number;
};

type PracticeUserRow = {
  id: string;
  user_id: string;
  full_name: string | null;
  email: string;
  role: string;
  access_enabled: boolean;
  is_practice_owner: boolean;
  can_manage_practice_users: boolean;
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
  { key: "trusts", label: "Trusts" },
];

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl) throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL");
if (!supabaseAnonKey) throw new Error("Missing NEXT_PUBLIC_SUPABASE_ANON_KEY");

const supabase = createClient(supabaseUrl, supabaseAnonKey);

function isAdminRole(role: string) {
  return role === "Super Admin" || role === "Admin";
}

export default function AdminClientsPage() {
  const [organisations, setOrganisations] = useState<Organisation[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);

  const [name, setName] = useState("");
  const [contactPerson, setContactPerson] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactNumber, setContactNumber] = useState("");
  const [logoUrl, setLogoUrl] = useState("");

  const [editName, setEditName] = useState("");
  const [editContactPerson, setEditContactPerson] = useState("");
  const [editContactEmail, setEditContactEmail] = useState("");
  const [editContactNumber, setEditContactNumber] = useState("");
  const [editLogoUrl, setEditLogoUrl] = useState("");

  const [moduleOrganisation, setModuleOrganisation] = useState<Organisation | null>(null);
  const [moduleRows, setModuleRows] = useState<ModuleRow[]>([]);
  const [moduleLoading, setModuleLoading] = useState(false);
  const [moduleError, setModuleError] = useState("");
  const [moduleNotice, setModuleNotice] = useState("");
  const [savingModuleKey, setSavingModuleKey] = useState("");
  const [moduleDrafts, setModuleDrafts] = useState<Record<string, { enabled: boolean; limit: number }>>({});

  const [userOrganisation, setUserOrganisation] = useState<Organisation | null>(null);
  const [practiceUsers, setPracticeUsers] = useState<PracticeUserRow[]>([]);
  const [userLicences, setUserLicences] = useState<ModuleRow[]>([]);
  const [userLoading, setUserLoading] = useState(false);
  const [userError, setUserError] = useState("");
  const [userNotice, setUserNotice] = useState("");
  const [savingPracticeUser, setSavingPracticeUser] = useState(false);
  const [ownerFullName, setOwnerFullName] = useState("");
  const [ownerEmail, setOwnerEmail] = useState("");
  const [ownerPassword, setOwnerPassword] = useState("");
  const [ownerModules, setOwnerModules] = useState<Record<ModuleKey, boolean>>({
    crm: false,
    accounting: false,
    afs: false,
    assets: false,
    secretarial: false,
    projects: false,
    management_reports: false,
    paia: false,
    proposals: false,
    trusts: false,
  });

  useEffect(() => {
    void loadSecurePage();
  }, []);

  async function authHeaders() {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) throw new Error("Not authenticated.");
    return {
      Authorization: `Bearer ${session.access_token}`,
      "Content-Type": "application/json",
    };
  }

  async function loadSecurePage() {
    setLoading(true);

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      window.location.href = "/login";
      return;
    }

    const { data: profileData, error: profileError } = await supabase
      .from("user_profiles")
      .select("*")
      .eq("user_id", user.id)
      .single();

    if (profileError || !profileData) {
      alert("Could not load your user profile.");
      window.location.href = "/login";
      return;
    }

    if (!profileData.access_enabled || !isAdminRole(profileData.role)) {
      alert("You do not have access to Admin Clients.");
      window.location.href = "/dashboard";
      return;
    }

    await loadOrganisations();
  }

  async function loadOrganisations() {
    setLoading(true);
    const response = await fetch("/api/organisations");
    const data = await response.json();

    if (response.ok) setOrganisations(data.organisations || []);
    else alert(data.error || "Could not load clients.");

    setLoading(false);
  }

  async function handleCreateClient() {
    if (!name.trim()) {
      alert("Client name is required.");
      return;
    }

    setSaving(true);
    const response = await fetch("/api/organisations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: name.trim(),
        contactPerson: contactPerson.trim(),
        contactEmail: contactEmail.trim(),
        contactNumber: contactNumber.trim(),
        logoUrl: logoUrl.trim(),
      }),
    });

    const data = await response.json();
    if (!response.ok) {
      alert(data.error || "Could not create client.");
      setSaving(false);
      return;
    }

    setOrganisations((prev) => [data.organisation, ...prev]);
    setName("");
    setContactPerson("");
    setContactEmail("");
    setContactNumber("");
    setLogoUrl("");
    setSaving(false);
  }

  function startEdit(organisation: Organisation) {
    setEditingId(organisation.id);
    setEditName(organisation.name || "");
    setEditContactPerson(organisation.contact_person || "");
    setEditContactEmail(organisation.contact_email || "");
    setEditContactNumber(organisation.contact_number || "");
    setEditLogoUrl(organisation.logo_url || "");
  }

  function cancelEdit() {
    setEditingId(null);
    setEditName("");
    setEditContactPerson("");
    setEditContactEmail("");
    setEditContactNumber("");
    setEditLogoUrl("");
  }

  async function saveEdit(organisation: Organisation) {
    if (!editName.trim()) {
      alert("Client name is required.");
      return;
    }

    setSavingEdit(true);
    const response = await fetch(`/api/organisations/${organisation.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: editName.trim(),
        contactPerson: editContactPerson.trim(),
        contactEmail: editContactEmail.trim(),
        contactNumber: editContactNumber.trim(),
        logoUrl: editLogoUrl.trim(),
      }),
    });

    const data = await response.json();
    if (!response.ok) {
      alert(data.error || "Could not update client.");
      setSavingEdit(false);
      return;
    }

    setOrganisations((prev) => prev.map((item) => item.id === organisation.id ? data.organisation : item));
    setSavingEdit(false);
    cancelEdit();
  }

  async function uploadLogo(organisation: Organisation, file: File | null) {
    if (!file) return;
    const formData = new FormData();
    formData.append("file", file);

    const response = await fetch(`/api/organisations/${organisation.id}/logo`, {
      method: "POST",
      body: formData,
    });

    const data = await response.json();
    if (!response.ok) {
      alert(data.error || "Could not upload logo.");
      return;
    }

    setOrganisations((prev) => prev.map((item) => item.id === organisation.id ? data.organisation : item));
  }

  async function toggleAccess(organisation: Organisation) {
    const response = await fetch(`/api/organisations/${organisation.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accessEnabled: !organisation.access_enabled }),
    });

    const data = await response.json();
    if (!response.ok) {
      alert(data.error || "Could not update client access.");
      return;
    }

    setOrganisations((prev) => prev.map((item) => item.id === organisation.id ? data.organisation : item));
  }

  async function changeStatus(organisation: Organisation, status: string) {
    const response = await fetch(`/api/organisations/${organisation.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });

    const data = await response.json();
    if (!response.ok) {
      alert(data.error || "Could not update client status.");
      return;
    }

    setOrganisations((prev) => prev.map((item) => item.id === organisation.id ? data.organisation : item));
  }

  function hydrateModuleDrafts(rows: ModuleRow[]) {
    const next: Record<string, { enabled: boolean; limit: number }> = {};
    for (const option of moduleOptions) {
      const row = rows.find((item) => item.module_key === option.key);
      next[option.key] = {
        enabled: Boolean(row?.is_enabled && Number(row?.licence_limit || 0) > 0),
        limit: Number(row?.licence_limit || 1) || 1,
      };
    }
    setModuleDrafts(next);
  }

  async function openModules(organisation: Organisation) {
    if (moduleOrganisation?.id === organisation.id) {
      setModuleOrganisation(null);
      return;
    }

    setUserOrganisation(null);
    setModuleOrganisation(organisation);
    setModuleLoading(true);
    setModuleError("");
    setModuleNotice("");

    try {
      const headers = await authHeaders();
      const response = await fetch(`/api/admin/organisations/${organisation.id}/modules`, {
        headers,
        cache: "no-store",
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not load modules.");
      const rows = (data.modules || []) as ModuleRow[];
      setModuleRows(rows);
      hydrateModuleDrafts(rows);
    } catch (error: any) {
      setModuleError(error?.message || "Could not load modules.");
      setModuleRows([]);
      hydrateModuleDrafts([]);
    } finally {
      setModuleLoading(false);
    }
  }

  async function saveModule(moduleKey: ModuleKey) {
    if (!moduleOrganisation) return;
    const draft = moduleDrafts[moduleKey] || { enabled: false, limit: 1 };
    setSavingModuleKey(moduleKey);
    setModuleError("");
    setModuleNotice("");

    try {
      const headers = await authHeaders();
      const response = await fetch(`/api/admin/organisations/${moduleOrganisation.id}/modules`, {
        method: "PATCH",
        headers,
        body: JSON.stringify({
          moduleKey,
          isEnabled: draft.enabled,
          licenceLimit: draft.enabled ? Math.max(Number(draft.limit || 1), 1) : 0,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not update module.");
      const rows = (data.modules || []) as ModuleRow[];
      setModuleRows(rows);
      hydrateModuleDrafts(rows);
      setModuleNotice(`${moduleOptions.find((item) => item.key === moduleKey)?.label || moduleKey} updated.`);
    } catch (error: any) {
      setModuleError(error?.message || "Could not update module.");
    } finally {
      setSavingModuleKey("");
    }
  }


  async function openUsers(organisation: Organisation) {
    if (userOrganisation?.id === organisation.id) {
      setUserOrganisation(null);
      return;
    }

    setModuleOrganisation(null);
    setUserOrganisation(organisation);
    setUserLoading(true);
    setUserError("");
    setUserNotice("");
    setOwnerFullName(organisation.contact_person || "");
    setOwnerEmail(organisation.contact_email || "");
    setOwnerPassword("");

    try {
      const headers = await authHeaders();
      const response = await fetch(`/api/admin/organisations/${organisation.id}/users`, {
        headers,
        cache: "no-store",
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not load practice users.");

      const users = (data.users || []) as PracticeUserRow[];
      const licences = (data.licences || []) as ModuleRow[];

      setPracticeUsers(users);
      setUserLicences(licences);

      const nextModules = {} as Record<ModuleKey, boolean>;
      for (const option of moduleOptions) {
        const licence = licences.find((item) => item.module_key === option.key);
        nextModules[option.key] = Boolean(
          licence?.is_enabled &&
          Number(licence?.licence_limit || 0) > 0 &&
          Number(licence?.available || 0) > 0
        );
      }
      setOwnerModules(nextModules);
    } catch (error: any) {
      setUserError(error?.message || "Could not load practice users.");
      setPracticeUsers([]);
      setUserLicences([]);
    } finally {
      setUserLoading(false);
    }
  }

  async function createPracticeOwner() {
    if (!userOrganisation) return;

    if (!ownerFullName.trim()) {
      setUserError("Full name is required.");
      return;
    }

    if (!ownerEmail.trim()) {
      setUserError("Email is required.");
      return;
    }

    if (!ownerPassword.trim() || ownerPassword.trim().length < 6) {
      setUserError("Temporary password must be at least 6 characters.");
      return;
    }

    setSavingPracticeUser(true);
    setUserError("");
    setUserNotice("");

    try {
      const headers = await authHeaders();
      const response = await fetch(`/api/admin/organisations/${userOrganisation.id}/users`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          fullName: ownerFullName.trim(),
          email: ownerEmail.trim(),
          password: ownerPassword,
          modules: ownerModules,
        }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not create practice owner.");

      setPracticeUsers((current) => [data.user, ...current]);
      setOwnerPassword("");

      if (data.warning) {
        setUserNotice(`Practice owner created, but the welcome email failed: ${data.warning}`);
      } else {
        setUserNotice(`Practice owner created and login email sent to ${data.user.email}.`);
      }

      const refreshed = await fetch(`/api/admin/organisations/${userOrganisation.id}/users`, {
        headers,
        cache: "no-store",
      });
      const refreshedData = await refreshed.json();
      if (refreshed.ok) {
        setPracticeUsers((refreshedData.users || []) as PracticeUserRow[]);
        setUserLicences((refreshedData.licences || []) as ModuleRow[]);
      }
    } catch (error: any) {
      setUserError(error?.message || "Could not create practice owner.");
    } finally {
      setSavingPracticeUser(false);
    }
  }

  const practiceOwnerExists = useMemo(
    () => practiceUsers.some((user) => user.is_practice_owner),
    [practiceUsers]
  );

  const subscribedCount = useMemo(
    () => moduleRows.filter((row) => row.is_enabled && row.licence_limit > 0).length,
    [moduleRows]
  );

  if (loading) return <main style={styles.page}><div style={styles.emptyState}>Loading...</div></main>;

  return (
    <main style={styles.page}>
      <div style={styles.header}>
        <div>
          <h1 style={styles.title}>Admin Clients</h1>
          <p style={styles.subtitle}>Add practices, control access and allocate PracticePilot modules.</p>
        </div>
        <a href="/dashboard" style={styles.backButton}>Back to PilotHub</a>
      </div>

      <section style={styles.card}>
        <h2 style={styles.cardTitle}>Add New Client</h2>
        <div style={styles.formGrid}>
          <Field label="Client Name"><input style={styles.input} value={name} onChange={(e) => setName(e.target.value)} /></Field>
          <Field label="Logo URL"><input style={styles.input} value={logoUrl} onChange={(e) => setLogoUrl(e.target.value)} /></Field>
          <Field label="Contact Person"><input style={styles.input} value={contactPerson} onChange={(e) => setContactPerson(e.target.value)} /></Field>
          <Field label="Contact Email"><input style={styles.input} value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} /></Field>
          <Field label="Contact Number"><input style={styles.input} value={contactNumber} onChange={(e) => setContactNumber(e.target.value)} /></Field>
        </div>
        <div style={styles.actions}><button style={styles.primaryButton} onClick={handleCreateClient} disabled={saving}>{saving ? "Saving..." : "Add Client"}</button></div>
      </section>

      <section style={styles.card}>
        <h2 style={styles.cardTitle}>Clients</h2>
        <table style={styles.table}>
          <thead><tr>
            <th style={styles.th}>Client</th><th style={styles.th}>Logo</th><th style={styles.th}>Contact</th><th style={styles.th}>Email</th><th style={styles.th}>Number</th><th style={styles.th}>Status</th><th style={styles.th}>Access</th><th style={styles.thRight}>Actions</th>
          </tr></thead>
          <tbody>
            {organisations.map((organisation) => {
              const isEditing = editingId === organisation.id;
              return (
                <tr key={organisation.id}>
                  <td style={styles.td}>{isEditing ? <input style={styles.tableInput} value={editName} onChange={(e) => setEditName(e.target.value)} /> : organisation.name}</td>
                  <td style={styles.td}>{isEditing ? <div style={styles.logoCell}><input style={styles.tableInput} value={editLogoUrl} onChange={(e) => setEditLogoUrl(e.target.value)} /><label style={styles.uploadButton}>Upload Logo<input type="file" accept="image/*" style={{ display: "none" }} onChange={(e) => uploadLogo(organisation, e.target.files?.[0] || null)} /></label></div> : organisation.logo_url ? <img src={organisation.logo_url} alt={organisation.name} style={styles.logoPreview} /> : "-"}</td>
                  <td style={styles.td}>{isEditing ? <input style={styles.tableInput} value={editContactPerson} onChange={(e) => setEditContactPerson(e.target.value)} /> : organisation.contact_person || "-"}</td>
                  <td style={styles.td}>{isEditing ? <input style={styles.tableInput} value={editContactEmail} onChange={(e) => setEditContactEmail(e.target.value)} /> : organisation.contact_email || "-"}</td>
                  <td style={styles.td}>{isEditing ? <input style={styles.tableInput} value={editContactNumber} onChange={(e) => setEditContactNumber(e.target.value)} /> : organisation.contact_number || "-"}</td>
                  <td style={styles.td}><select style={styles.smallSelect} value={organisation.status} onChange={(e) => changeStatus(organisation, e.target.value)} disabled={isEditing}><option value="Active">Active</option><option value="Suspended">Suspended</option><option value="Cancelled">Cancelled</option><option value="Trial">Trial</option></select></td>
                  <td style={styles.td}><span style={{ ...styles.statusPill, ...(organisation.access_enabled ? styles.statusActive : styles.statusSuspended) }}>{organisation.access_enabled ? "Enabled" : "Blocked"}</span></td>
                  <td style={styles.tdRight}>
                    {isEditing ? <><button style={styles.saveButton} onClick={() => saveEdit(organisation)} disabled={savingEdit}>{savingEdit ? "Saving..." : "Save"}</button><button style={styles.cancelButton} onClick={cancelEdit}>Cancel</button></> : <><button style={styles.moduleButton} onClick={() => openModules(organisation)}>{moduleOrganisation?.id === organisation.id ? "Close Modules" : "Modules"}</button><button style={styles.userButton} onClick={() => openUsers(organisation)}>{userOrganisation?.id === organisation.id ? "Close Users" : "Users"}</button><button style={styles.editButton} onClick={() => startEdit(organisation)}>Edit</button><button style={organisation.access_enabled ? styles.blockButton : styles.enableButton} onClick={() => toggleAccess(organisation)}>{organisation.access_enabled ? "Block Access" : "Enable Access"}</button></>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>

      {moduleOrganisation ? (
        <section style={styles.card}>
          <div style={styles.moduleHeader}>
            <div>
              <h2 style={styles.cardTitle}>Modules — {moduleOrganisation.name}</h2>
              <p style={styles.subtitle}>PracticePilot enables the module here first. The practice owner then allocates the available licences to staff.</p>
            </div>
            <strong style={styles.moduleCount}>{subscribedCount} enabled</strong>
          </div>

          {moduleError ? <div style={styles.error}>{moduleError}</div> : null}
          {moduleNotice ? <div style={styles.notice}>{moduleNotice}</div> : null}
          {moduleLoading ? <div style={styles.emptyState}>Loading modules...</div> : (
            <div>
              <div style={styles.moduleTableHeader}><span>Module</span><span>PP enabled</span><span>Used</span><span>Licence quantity</span><span>Available</span><span /></div>
              {moduleOptions.map((option) => {
                const row = moduleRows.find((item) => item.module_key === option.key);
                const draft = moduleDrafts[option.key] || { enabled: false, limit: 1 };
                const used = Number(row?.used || 0);
                const available = Math.max(Number(draft.limit || 0) - used, 0);
                return (
                  <div key={option.key} style={styles.moduleTableRow}>
                    <strong>{option.label}</strong>
                    <label style={styles.toggleLine}><input type="checkbox" checked={draft.enabled} onChange={(event) => setModuleDrafts((current) => ({ ...current, [option.key]: { ...draft, enabled: event.target.checked, limit: event.target.checked ? Math.max(draft.limit || 1, 1) : draft.limit } }))} />{draft.enabled ? "Enabled" : "Not enabled"}</label>
                    <strong>{used}</strong>
                    <input type="number" min={Math.max(used, 1)} step="1" style={styles.licenceInput} value={Math.max(draft.limit || 1, 1)} disabled={!draft.enabled} onChange={(event) => setModuleDrafts((current) => ({ ...current, [option.key]: { ...draft, limit: Math.max(Math.max(used, 1), Number(event.target.value || 1)) } }))} />
                    <strong>{draft.enabled ? available : 0}</strong>
                    <button style={styles.saveModuleButton} onClick={() => saveModule(option.key)} disabled={savingModuleKey === option.key}>{savingModuleKey === option.key ? "Saving..." : "Save"}</button>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      ) : null}

      {userOrganisation ? (
        <section style={styles.card}>
          <div style={styles.moduleHeader}>
            <div>
              <h2 style={styles.cardTitle}>Users — {userOrganisation.name}</h2>
              <p style={styles.subtitle}>
                Create the first Practice Owner / Client Manager here. They can manage their own staff after login.
              </p>
            </div>
            <strong style={styles.moduleCount}>{practiceUsers.length} user{practiceUsers.length === 1 ? "" : "s"}</strong>
          </div>

          {userError ? <div style={styles.error}>{userError}</div> : null}
          {userNotice ? <div style={styles.notice}>{userNotice}</div> : null}

          {userLoading ? (
            <div style={styles.emptyState}>Loading practice users...</div>
          ) : (
            <>
              {practiceUsers.length > 0 ? (
                <div style={{ marginBottom: "18px" }}>
                  <div style={styles.userTableHeader}>
                    <span>Name</span>
                    <span>Email</span>
                    <span>Role</span>
                    <span>Owner</span>
                    <span>Access</span>
                  </div>
                  {practiceUsers.map((user) => (
                    <div key={user.id} style={styles.userTableRow}>
                      <strong>{user.full_name || "-"}</strong>
                      <span>{user.email}</span>
                      <span>{user.role}</span>
                      <span>{user.is_practice_owner ? "Yes" : "No"}</span>
                      <span>{user.access_enabled ? "Enabled" : "Blocked"}</span>
                    </div>
                  ))}
                </div>
              ) : null}

              {practiceOwnerExists ? (
                <div style={styles.ownerExists}>
                  A Practice Owner already exists for this practice. Additional staff must be managed by the practice from Settings → My Team & Licences.
                </div>
              ) : (
                <>
                  <h3 style={styles.userSectionTitle}>Create Practice Owner</h3>

                  <div style={styles.userFormGrid}>
                    <Field label="Full Name">
                      <input
                        style={styles.input}
                        value={ownerFullName}
                        onChange={(e) => setOwnerFullName(e.target.value)}
                        placeholder="Example: Karenza"
                      />
                    </Field>

                    <Field label="Email">
                      <input
                        style={styles.input}
                        type="email"
                        value={ownerEmail}
                        onChange={(e) => setOwnerEmail(e.target.value)}
                        placeholder="name@example.com"
                      />
                    </Field>

                    <Field label="Temporary Password">
                      <input
                        style={styles.input}
                        type="text"
                        value={ownerPassword}
                        onChange={(e) => setOwnerPassword(e.target.value)}
                        placeholder="Minimum 6 characters"
                      />
                    </Field>
                  </div>

                  <div style={styles.userModuleSection}>
                    <div style={styles.label}>Module access for the Practice Owner</div>
                    <div style={styles.userModuleGrid}>
                      {moduleOptions.map((option) => {
                        const licence = userLicences.find((item) => item.module_key === option.key);
                        const subscribed = Boolean(
                          licence?.is_enabled && Number(licence?.licence_limit || 0) > 0
                        );
                        const available = Number(licence?.available || 0);

                        return (
                          <label
                            key={option.key}
                            style={{
                              ...styles.userModuleOption,
                              opacity: subscribed ? 1 : 0.45,
                            }}
                          >
                            <input
                              type="checkbox"
                              checked={Boolean(ownerModules[option.key])}
                              disabled={!subscribed || available <= 0}
                              onChange={(event) =>
                                setOwnerModules((current) => ({
                                  ...current,
                                  [option.key]: event.target.checked,
                                }))
                              }
                            />
                            <span>{option.label}</span>
                            <small style={styles.moduleAvailability}>
                              {subscribed ? `${available} available` : "Not enabled"}
                            </small>
                          </label>
                        );
                      })}
                    </div>
                  </div>

                  <div style={styles.ownerHelp}>
                    This user will be created as <strong>Client Manager / Practice Owner</strong>, will be allowed to manage the practice team, and will receive an email containing the login link, username and temporary password.
                  </div>

                  <div style={styles.actions}>
                    <button
                      style={styles.primaryButton}
                      onClick={createPracticeOwner}
                      disabled={savingPracticeUser}
                    >
                      {savingPracticeUser ? "Creating..." : "Create Owner & Send Login Email"}
                    </button>
                  </div>
                </>
              )}
            </>
          )}
        </section>
      ) : null}
    </main>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <div style={styles.fieldGroup}><label style={styles.label}>{label}</label>{children}</div>;
}

const styles: Record<string, React.CSSProperties> = {
  page: { padding: "22px", background: "#eef2f5", minHeight: "100vh", color: "#10233a" },
  header: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" },
  title: { fontSize: "28px", fontWeight: 900, margin: 0 },
  subtitle: { marginTop: "6px", color: "#66717f", fontSize: "11px" },
  backButton: { background: "#ffffff", color: "#10233a", border: "1px solid #cfd8df", padding: "10px 14px", fontSize: "10px", fontWeight: 850, textDecoration: "none" },
  card: { background: "#ffffff", padding: "18px", marginBottom: "12px", border: "1px solid #d7dfde", overflowX: "auto" },
  cardTitle: { fontSize: "16px", margin: "0 0 12px", fontWeight: 900 },
  formGrid: { display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: "12px" },
  fieldGroup: { display: "flex", flexDirection: "column", gap: "6px" },
  label: { fontSize: "10px", fontWeight: 800, color: "#4b5b67" },
  input: { height: "36px", border: "1px solid #cfd8df", padding: "0 9px", fontSize: "11px", background: "#ffffff" },
  tableInput: { height: "32px", border: "1px solid #cfd8df", padding: "0 8px", fontSize: "10px", width: "170px" },
  actions: { display: "flex", justifyContent: "flex-end", marginTop: "14px" },
  primaryButton: { background: "#10233a", color: "#ffffff", border: "1px solid #10233a", padding: "9px 13px", fontSize: "10px", fontWeight: 850, cursor: "pointer" },
  emptyState: { padding: "22px", textAlign: "center", color: "#78858e", fontSize: "10px", border: "1px solid #d7dfde", background: "#f8fafb" },
  table: { width: "100%", borderCollapse: "collapse" },
  th: { textAlign: "left", padding: "9px 10px", borderBottom: "1px solid #dce3eb", fontSize: "9px", color: "#52616b", whiteSpace: "nowrap" },
  thRight: { textAlign: "right", padding: "9px 10px", borderBottom: "1px solid #dce3eb", fontSize: "9px", color: "#52616b", whiteSpace: "nowrap" },
  td: { padding: "9px 10px", borderBottom: "1px solid #edf1f5", fontSize: "10px", verticalAlign: "middle" },
  tdRight: { padding: "9px 10px", borderBottom: "1px solid #edf1f5", fontSize: "10px", textAlign: "right", verticalAlign: "middle", whiteSpace: "nowrap" },
  smallSelect: { height: "31px", border: "1px solid #cfd8df", padding: "0 8px", fontSize: "10px", background: "#ffffff" },
  statusPill: { display: "inline-block", padding: "4px 7px", fontSize: "9px", fontWeight: 850 },
  statusActive: { background: "#edf7f0", color: "#2f7047", border: "1px solid #b7d7c1" },
  statusSuspended: { background: "#fff3f1", color: "#9c3527", border: "1px solid #efc2ba" },
  moduleButton: { background: "#10233a", color: "#ffffff", border: "1px solid #10233a", padding: "7px 9px", fontSize: "9px", fontWeight: 850, cursor: "pointer", marginRight: "6px" },
  userButton: { background: "#eef4f8", color: "#10233a", border: "1px solid #bfcbd5", padding: "7px 9px", fontSize: "9px", fontWeight: 850, cursor: "pointer", marginRight: "6px" },
  editButton: { background: "#edf4ff", color: "#1d4ed8", border: "1px solid #c8d8f3", padding: "7px 9px", fontSize: "9px", fontWeight: 850, cursor: "pointer", marginRight: "6px" },
  saveButton: { background: "#edf7f0", color: "#2f7047", border: "1px solid #b7d7c1", padding: "7px 9px", fontSize: "9px", fontWeight: 850, cursor: "pointer", marginRight: "6px" },
  cancelButton: { background: "#ffffff", color: "#10233a", border: "1px solid #cfd8df", padding: "7px 9px", fontSize: "9px", fontWeight: 850, cursor: "pointer" },
  blockButton: { background: "#fff3f1", color: "#9c3527", border: "1px solid #efc2ba", padding: "7px 9px", fontSize: "9px", fontWeight: 850, cursor: "pointer" },
  enableButton: { background: "#edf7f0", color: "#2f7047", border: "1px solid #b7d7c1", padding: "7px 9px", fontSize: "9px", fontWeight: 850, cursor: "pointer" },
  logoCell: { display: "flex", flexDirection: "column", gap: "6px" },
  logoPreview: { maxWidth: "90px", maxHeight: "42px", objectFit: "contain", border: "1px solid #e5eaf0", padding: "3px", background: "#ffffff" },
  uploadButton: { display: "inline-block", background: "#10233a", color: "#ffffff", padding: "7px 9px", fontSize: "9px", fontWeight: 850, cursor: "pointer", textAlign: "center", width: "100px" },
  moduleHeader: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "20px", marginBottom: "12px" },
  moduleCount: { padding: "6px 9px", background: "#eef2f6", border: "1px solid #d8dee7", fontSize: "10px" },
  moduleTableHeader: { minHeight: "34px", padding: "0 12px", display: "grid", gridTemplateColumns: "minmax(220px,1fr) 140px 70px 140px 80px 80px", gap: "12px", alignItems: "center", background: "#10233a", color: "#ffffff", fontSize: "9px", fontWeight: 850 },
  moduleTableRow: { minHeight: "54px", padding: "8px 12px", display: "grid", gridTemplateColumns: "minmax(220px,1fr) 140px 70px 140px 80px 80px", gap: "12px", alignItems: "center", borderBottom: "1px solid #e7eceb", fontSize: "10px" },
  toggleLine: { display: "flex", alignItems: "center", gap: "7px", fontSize: "10px", fontWeight: 800 },
  licenceInput: { width: "100px", minHeight: "32px", padding: "0 8px", border: "1px solid #cfd8df", background: "#ffffff", fontSize: "10px" },
  saveModuleButton: { minHeight: "32px", padding: "0 10px", border: "1px solid #10233a", background: "#10233a", color: "#ffffff", fontSize: "9px", fontWeight: 850, cursor: "pointer" },
  error: { marginBottom: "10px", padding: "9px 11px", border: "1px solid #efc2ba", background: "#fff3f1", color: "#9c3527", fontSize: "10px" },
  notice: { marginBottom: "10px", padding: "9px 11px", border: "1px solid #b7d7c1", background: "#edf7f0", color: "#2f7047", fontSize: "10px" },
  userSectionTitle: { margin: "0 0 12px", fontSize: "13px", fontWeight: 900 },
  userFormGrid: { display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "12px", marginBottom: "16px" },
  userModuleSection: { borderTop: "1px solid #e1e7ec", paddingTop: "14px" },
  userModuleGrid: { display: "grid", gridTemplateColumns: "repeat(5, minmax(150px, 1fr))", gap: "8px", marginTop: "8px" },
  userModuleOption: { minHeight: "42px", border: "1px solid #d7dfde", padding: "8px", display: "grid", gridTemplateColumns: "18px 1fr", columnGap: "6px", alignItems: "center", fontSize: "10px", fontWeight: 800, background: "#f8fafb" },
  moduleAvailability: { gridColumn: "2", color: "#78858e", fontSize: "8px", fontWeight: 700 },
  ownerHelp: { marginTop: "14px", padding: "10px 12px", border: "1px solid #cfd8df", background: "#f8fafb", fontSize: "10px", color: "#52616b" },
  ownerExists: { padding: "12px", border: "1px solid #cfd8df", background: "#f8fafb", fontSize: "10px", color: "#52616b" },
  userTableHeader: { minHeight: "34px", padding: "0 12px", display: "grid", gridTemplateColumns: "1.2fr 1.7fr 1fr 80px 90px", gap: "12px", alignItems: "center", background: "#10233a", color: "#ffffff", fontSize: "9px", fontWeight: 850 },
  userTableRow: { minHeight: "46px", padding: "6px 12px", display: "grid", gridTemplateColumns: "1.2fr 1.7fr 1fr 80px 90px", gap: "12px", alignItems: "center", borderBottom: "1px solid #e7eceb", fontSize: "10px" },
};
