"use client";

import { useEffect, useState } from "react";

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

  useEffect(() => {
    loadOrganisations();
  }, []);

  async function loadOrganisations() {
    setLoading(true);

    const response = await fetch("/api/organisations");
    const data = await response.json();

    if (response.ok) {
      setOrganisations(data.organisations || []);
    } else {
      alert(data.error || "Could not load clients.");
    }

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
      headers: {
        "Content-Type": "application/json",
      },
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
      headers: {
        "Content-Type": "application/json",
      },
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

    setOrganisations((prev) =>
      prev.map((item) => (item.id === organisation.id ? data.organisation : item))
    );

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

  setOrganisations((prev) =>
    prev.map((item) => (item.id === organisation.id ? data.organisation : item))
  );
}

  async function toggleAccess(organisation: Organisation) {
    const response = await fetch(`/api/organisations/${organisation.id}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        accessEnabled: !organisation.access_enabled,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      alert(data.error || "Could not update client access.");
      return;
    }

    setOrganisations((prev) =>
      prev.map((item) => (item.id === organisation.id ? data.organisation : item))
    );
  }

  async function changeStatus(organisation: Organisation, status: string) {
    const response = await fetch(`/api/organisations/${organisation.id}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        status,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      alert(data.error || "Could not update client status.");
      return;
    }

    setOrganisations((prev) =>
      prev.map((item) => (item.id === organisation.id ? data.organisation : item))
    );
  }

  return (
    <main style={styles.page}>
      <div style={styles.header}>
        <div>
          <h1 style={styles.title}>Admin Clients</h1>
          <p style={styles.subtitle}>Add clients and control client access.</p>
        </div>

        <a href="/project-management" style={styles.backButton}>
          Back to Projects
        </a>
      </div>

      <section style={styles.card}>
        <h2 style={styles.cardTitle}>Add New Client</h2>

        <div style={styles.formGrid}>
          <div style={styles.fieldGroup}>
            <label style={styles.label}>Client Name</label>
            <input
              style={styles.input}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Example: Slinx"
            />
          </div>

        <div style={styles.fieldGroup}>
             <label style={styles.label}>Logo URL</label>
             <input
              style={styles.input}
              value={logoUrl}
              onChange={(e) => setLogoUrl(e.target.value)}
              placeholder="Paste logo image URL"
             />
        </div>

          <div style={styles.fieldGroup}>
            <label style={styles.label}>Contact Person</label>
            <input
              style={styles.input}
              value={contactPerson}
              onChange={(e) => setContactPerson(e.target.value)}
              placeholder="Example: Sarah"
            />
          </div>

          <div style={styles.fieldGroup}>
            <label style={styles.label}>Contact Email</label>
            <input
              style={styles.input}
              value={contactEmail}
              onChange={(e) => setContactEmail(e.target.value)}
              placeholder="Example: sarah@example.com"
            />
          </div>

          <div style={styles.fieldGroup}>
            <label style={styles.label}>Contact Number</label>
            <input
              style={styles.input}
              value={contactNumber}
              onChange={(e) => setContactNumber(e.target.value)}
              placeholder="Example: 0820000000"
            />
          </div>
        </div>

        <div style={styles.actions}>
          <button style={styles.primaryButton} onClick={handleCreateClient} disabled={saving}>
            {saving ? "Saving..." : "Add Client"}
          </button>
        </div>
      </section>

      <section style={styles.card}>
        <h2 style={styles.cardTitle}>Clients</h2>

        {loading ? (
          <div style={styles.emptyState}>Loading clients...</div>
        ) : organisations.length === 0 ? (
          <div style={styles.emptyState}>No clients created yet.</div>
        ) : (
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>Client</th>
                <th style={styles.th}>Logo URL</th>
                <th style={styles.th}>Contact</th>
                <th style={styles.th}>Email</th>
                <th style={styles.th}>Number</th>
                <th style={styles.th}>Status</th>
                <th style={styles.th}>Access</th>
                <th style={styles.thRight}>Actions</th>
              </tr>
            </thead>

            <tbody>
              {organisations.map((organisation) => {
                const isEditing = editingId === organisation.id;

                return (
                  <tr key={organisation.id}>
                    <td style={styles.td}>
                      {isEditing ? (
                        <input
                          style={styles.tableInput}
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                        />
                      ) : (
                        organisation.name
                      )}
                    </td>

                   <td style={styles.td}>
  {isEditing ? (
    <div style={styles.logoCell}>
      <input
        style={styles.tableInput}
        value={editLogoUrl}
        onChange={(e) => setEditLogoUrl(e.target.value)}
        placeholder="Logo URL"
      />

   <label style={styles.uploadButton}>
  Upload Logo
  <input
    type="file"
    accept="image/*"
    style={{ display: "none" }}
    onChange={(e) => uploadLogo(organisation, e.target.files?.[0] || null)}
  />
</label>

    </div>

  ) : organisation.logo_url ? (
    <img src={organisation.logo_url} alt={organisation.name} style={styles.logoPreview} />
  ) : (
    "-"
  )}
</td>

                    <td style={styles.td}>
                      {isEditing ? (
                        <input
                          style={styles.tableInput}
                          value={editContactPerson}
                          onChange={(e) => setEditContactPerson(e.target.value)}
                        />
                      ) : (
                        organisation.contact_person || "-"
                      )}
                    </td>

                    <td style={styles.td}>
                      {isEditing ? (
                        <input
                          style={styles.tableInput}
                          value={editContactEmail}
                          onChange={(e) => setEditContactEmail(e.target.value)}
                        />
                      ) : (
                        organisation.contact_email || "-"
                      )}
                    </td>

                    <td style={styles.td}>
                      {isEditing ? (
                        <input
                          style={styles.tableInput}
                          value={editContactNumber}
                          onChange={(e) => setEditContactNumber(e.target.value)}
                        />
                      ) : (
                        organisation.contact_number || "-"
                      )}
                    </td>

                    <td style={styles.td}>
                      <select
                        style={styles.smallSelect}
                        value={organisation.status}
                        onChange={(e) => changeStatus(organisation, e.target.value)}
                        disabled={isEditing}
                      >
                        <option value="Active">Active</option>
                        <option value="Suspended">Suspended</option>
                        <option value="Cancelled">Cancelled</option>
                        <option value="Trial">Trial</option>
                      </select>
                    </td>

                    <td style={styles.td}>
                      <span
                        style={{
                          ...styles.statusPill,
                          ...(organisation.access_enabled
                            ? styles.statusActive
                            : styles.statusSuspended),
                        }}
                      >
                        {organisation.access_enabled ? "Enabled" : "Blocked"}
                      </span>
                    </td>

                    <td style={styles.tdRight}>
                      {isEditing ? (
                        <>
                          <button
                            style={styles.saveButton}
                            onClick={() => saveEdit(organisation)}
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
                          <button style={styles.editButton} onClick={() => startEdit(organisation)}>
                            Edit
                          </button>

                          <button
                            style={
                              organisation.access_enabled
                                ? styles.blockButton
                                : styles.enableButton
                            }
                            onClick={() => toggleAccess(organisation)}
                          >
                            {organisation.access_enabled ? "Block Access" : "Enable Access"}
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
    gridTemplateColumns: "repeat(5, 1fr)",
    gap: "20px",
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
    width: "180px",
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
  smallSelect: {
    height: "34px",
    borderRadius: "8px",
    border: "1px solid #d5dde6",
    padding: "0 10px",
    fontSize: "14px",
    background: "#ffffff",
    color: "#12304a",
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
  statusSuspended: {
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

  logoCell: {
  display: "flex",
  flexDirection: "column",
  gap: "8px",
},
logoPreview: {
  maxWidth: "90px",
  maxHeight: "45px",
  objectFit: "contain",
  border: "1px solid #e5eaf0",
  borderRadius: "6px",
  padding: "4px",
  background: "#ffffff",
},

uploadButton: {
  display: "inline-block",
  background: "#0b5cab",
  color: "#ffffff",
  border: "none",
  borderRadius: "8px",
  padding: "8px 12px",
  fontSize: "13px",
  fontWeight: 700,
  cursor: "pointer",
  textAlign: "center",
  width: "120px",
},


};