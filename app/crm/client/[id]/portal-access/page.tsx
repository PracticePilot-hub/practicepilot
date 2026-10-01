"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/app/lib/supabase";

type ClientContact = {
  id: string;
  contact_name: string | null;
  contact_position: string | null;
  email: string | null;
  mobile: string | null;
  phone: string | null;
  is_primary: boolean | null;
};

type PortalUser = {
  id: string;
  organisation_id: string;
  client_id: string;
  contact_id: string | null;
  auth_user_id: string | null;
  full_name: string | null;
  email: string;
  portal_role: "primary" | "authorised";
  can_view_documents: boolean;
  can_approve_actions: boolean;
  is_active: boolean;
  invitation_status: string;
  invited_at: string | null;
  accepted_at: string | null;
  last_login_at: string | null;
  created_at: string;
  updated_at: string;
};

type ApiResponse = {
  success: boolean;
  portal_users: PortalUser[];
  contacts: ClientContact[];
};

function statusLabel(value: string) {
  return String(value || "")
    .replaceAll("_", " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

export default function ClientPortalAccessPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const clientId = String(params?.id || "");

  const [contacts, setContacts] = useState<ClientContact[]>([]);
  const [portalUsers, setPortalUsers] = useState<PortalUser[]>([]);
  const [selectedContactId, setSelectedContactId] = useState("");
  const [manualName, setManualName] = useState("");
  const [manualEmail, setManualEmail] = useState("");
  const [portalRole, setPortalRole] =
    useState<"primary" | "authorised">("authorised");
  const [canApproveActions, setCanApproveActions] = useState(false);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [invitingId, setInvitingId] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId]);

  async function authToken() {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.access_token) {
      throw new Error(
        "Your PracticePilot login session could not be confirmed."
      );
    }

    return session.access_token;
  }

  async function load() {
    if (!clientId) return;

    setLoading(true);
    setError("");

    try {
      const token = await authToken();

      const response = await fetch(
        `/api/crm/clients/${clientId}/portal-users`,
        {
          cache: "no-store",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const result = (await response.json()) as ApiResponse & {
        error?: string;
      };

      if (!response.ok || !result?.success) {
        throw new Error(
          result?.error || "Could not load client portal access."
        );
      }

      setContacts(result.contacts || []);
      setPortalUsers(result.portal_users || []);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Could not load client portal access."
      );
    } finally {
      setLoading(false);
    }
  }

  const selectedContact = useMemo(
    () =>
      contacts.find((contact) => contact.id === selectedContactId) || null,
    [contacts, selectedContactId]
  );

  useEffect(() => {
    if (!selectedContact) return;

    setManualName(selectedContact.contact_name || "");
    setManualEmail(selectedContact.email || "");
  }, [selectedContact]);

  const availableContacts = useMemo(() => {
    const existingContactIds = new Set(
      portalUsers
        .map((user) => user.contact_id)
        .filter((value): value is string => Boolean(value))
    );

    return contacts.filter(
      (contact) => !existingContactIds.has(contact.id)
    );
  }, [contacts, portalUsers]);

  async function addPortalUser() {
    if (!manualEmail.trim()) {
      setError("Select a contact with an email address or enter one manually.");
      return;
    }

    setSaving(true);
    setError("");
    setNotice("");

    try {
      const token = await authToken();

      const response = await fetch(
        `/api/crm/clients/${clientId}/portal-users`,
        {
          method: "POST",
          cache: "no-store",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            contact_id: selectedContactId || null,
            full_name: manualName.trim() || null,
            email: manualEmail.trim(),
            portal_role: portalRole,
            can_view_documents: true,
            can_approve_actions: canApproveActions,
          }),
        }
      );

      const result = await response.json();

      if (!response.ok || !result?.success || !result?.portal_user) {
        throw new Error(
          result?.error || "Could not add portal access."
        );
      }

      setPortalUsers((current) => {
        const withoutExisting = current.filter(
          (item) => item.id !== result.portal_user.id
        );
        return [...withoutExisting, result.portal_user];
      });

      setSelectedContactId("");
      setManualName("");
      setManualEmail("");
      setPortalRole("authorised");
      setCanApproveActions(false);

      setNotice("Portal access added. No invitation has been sent yet.");
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Could not add portal access."
      );
    } finally {
      setSaving(false);
    }
  }

  async function invitePortalUser(portalUser: PortalUser) {
    setInvitingId(portalUser.id);
    setError("");
    setNotice("");

    try {
      const token = await authToken();

      const response = await fetch(
        `/api/crm/clients/${clientId}/portal-users/invite`,
        {
          method: "POST",
          cache: "no-store",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            portal_user_id: portalUser.id,
          }),
        }
      );

      const result = await response.json();

      if (!response.ok || !result?.success || !result?.portal_user) {
        throw new Error(
          result?.error || "Could not send the portal invitation."
        );
      }

      setPortalUsers((current) =>
        current.map((item) =>
          item.id === result.portal_user.id
            ? result.portal_user
            : item
        )
      );

      setNotice(
        result.existing_user
          ? `Portal access linked to the existing PracticePilot login for ${result.portal_user.email}. A secure portal link was sent.`
          : `Portal invitation sent to ${result.portal_user.email}.`
      );
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Could not send the portal invitation."
      );
    } finally {
      setInvitingId("");
    }
  }

  async function patchPortalUser(
    portalUserId: string,
    patch: Record<string, unknown>
  ) {
    setError("");
    setNotice("");

    try {
      const token = await authToken();

      const response = await fetch(
        `/api/crm/clients/${clientId}/portal-users`,
        {
          method: "PATCH",
          cache: "no-store",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            portal_user_id: portalUserId,
            ...patch,
          }),
        }
      );

      const result = await response.json();

      if (!response.ok || !result?.success || !result?.portal_user) {
        throw new Error(
          result?.error || "Could not update portal access."
        );
      }

      setPortalUsers((current) =>
        current.map((item) =>
          item.id === result.portal_user.id
            ? result.portal_user
            : patch.portal_role === "primary"
              ? { ...item, portal_role: "authorised" }
              : item
        )
      );

      setNotice("Portal access updated.");
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Could not update portal access."
      );
    }
  }

  if (loading) {
    return (
      <main style={styles.loadingPage}>
        Loading portal access...
      </main>
    );
  }

  return (
    <main style={styles.page}>
      <section style={styles.header}>
        <div>
          <div style={styles.eyebrow}>Client Portal</div>
          <h1 style={styles.title}>Portal Access</h1>
          <p style={styles.subtitle}>
            Choose who may access this client&apos;s portal. Invitations are
            not sent from this screen yet.
          </p>
        </div>

        <button
          type="button"
          onClick={() =>
            router.push(`/crm/client/${clientId}?tab=documents`)
          }
          style={styles.backButton}
        >
          Back to Documents
        </button>
      </section>

      {error ? <div style={styles.error}>{error}</div> : null}
      {notice ? <div style={styles.notice}>{notice}</div> : null}

      <section style={styles.panel}>
        <div style={styles.panelHeader}>
          <div>
            <h2 style={styles.panelTitle}>Add portal access</h2>
            <p style={styles.panelSubtitle}>
              Use an existing client contact where possible.
            </p>
          </div>
        </div>

        <div style={styles.addGrid}>
          <label style={styles.field}>
            <span style={styles.label}>Client contact</span>
            <select
              value={selectedContactId}
              onChange={(event) =>
                setSelectedContactId(event.target.value)
              }
              style={styles.input}
            >
              <option value="">Manual / not linked to contact</option>
              {availableContacts.map((contact) => (
                <option key={contact.id} value={contact.id}>
                  {contact.contact_name || contact.email || "Unnamed contact"}
                  {contact.is_primary ? " · Primary contact" : ""}
                </option>
              ))}
            </select>
          </label>

          <label style={styles.field}>
            <span style={styles.label}>Name</span>
            <input
              value={manualName}
              onChange={(event) => setManualName(event.target.value)}
              style={styles.input}
              placeholder="Full name"
            />
          </label>

          <label style={styles.field}>
            <span style={styles.label}>Email</span>
            <input
              value={manualEmail}
              onChange={(event) => setManualEmail(event.target.value)}
              style={styles.input}
              placeholder="name@example.com"
            />
          </label>

          <label style={styles.field}>
            <span style={styles.label}>Portal role</span>
            <select
              value={portalRole}
              onChange={(event) =>
                setPortalRole(
                  event.target.value === "primary"
                    ? "primary"
                    : "authorised"
                )
              }
              style={styles.input}
            >
              <option value="authorised">Authorised user</option>
              <option value="primary">Primary portal user</option>
            </select>
          </label>

          <label style={styles.checkField}>
            <input
              type="checkbox"
              checked={canApproveActions}
              onChange={(event) =>
                setCanApproveActions(event.target.checked)
              }
            />
            <span>
              May approve client actions later
            </span>
          </label>

          <button
            type="button"
            onClick={() => void addPortalUser()}
            disabled={saving}
            style={saving ? styles.primaryDisabled : styles.primaryButton}
          >
            {saving ? "Adding..." : "Add Access"}
          </button>
        </div>
      </section>

      <section style={styles.panel}>
        <div style={styles.panelHeader}>
          <div>
            <h2 style={styles.panelTitle}>Portal users</h2>
            <p style={styles.panelSubtitle}>
              {portalUsers.length} user
              {portalUsers.length === 1 ? "" : "s"} configured.
            </p>
          </div>
        </div>

        <div style={styles.tableHeader}>
          <span>User</span>
          <span>Role</span>
          <span>Documents</span>
          <span>Approvals</span>
          <span>Status</span>
          <span>Access</span>
        </div>

        {portalUsers.length ? (
          portalUsers.map((user) => (
            <div key={user.id} style={styles.tableRow}>
              <div style={styles.userCell}>
                <strong>{user.full_name || user.email}</strong>
                <span>{user.email}</span>
              </div>

              <button
                type="button"
                onClick={() =>
                  void patchPortalUser(user.id, {
                    portal_role:
                      user.portal_role === "primary"
                        ? "authorised"
                        : "primary",
                  })
                }
                style={
                  user.portal_role === "primary"
                    ? styles.rolePrimary
                    : styles.roleButton
                }
              >
                {user.portal_role === "primary"
                  ? "Primary"
                  : "Authorised"}
              </button>

              <label style={styles.inlineCheck}>
                <input
                  type="checkbox"
                  checked={user.can_view_documents}
                  onChange={(event) =>
                    void patchPortalUser(user.id, {
                      can_view_documents: event.target.checked,
                    })
                  }
                />
                Allowed
              </label>

              <label style={styles.inlineCheck}>
                <input
                  type="checkbox"
                  checked={user.can_approve_actions}
                  onChange={(event) =>
                    void patchPortalUser(user.id, {
                      can_approve_actions: event.target.checked,
                    })
                  }
                />
                Allowed
              </label>

              <span
                style={
                  user.is_active
                    ? styles.statusActive
                    : styles.statusDisabled
                }
              >
                {user.is_active
                  ? statusLabel(user.invitation_status)
                  : "Disabled"}
              </span>

              <div style={styles.rowActions}>
                {user.is_active ? (
                  <button
                    type="button"
                    onClick={() => void invitePortalUser(user)}
                    disabled={invitingId === user.id}
                    style={styles.inviteButton}
                  >
                    {invitingId === user.id
                      ? "Sending..."
                      : user.invitation_status === "active"
                        ? "Send Portal Link"
                        : user.invitation_status === "invited"
                          ? "Resend Invite"
                          : "Send Invite"}
                  </button>
                ) : null}

                <button
                  type="button"
                  onClick={() =>
                    void patchPortalUser(user.id, {
                      is_active: !user.is_active,
                    })
                  }
                  style={
                    user.is_active
                      ? styles.disableAccessButton
                      : styles.secondaryButton
                  }
                >
                  {user.is_active ? "Disable access" : "Enable"}
                </button>
              </div>
            </div>
          ))
        ) : (
          <div style={styles.empty}>
            No portal users have been configured yet.
          </div>
        )}
      </section>
    </main>
  );
}

const styles: Record<string, CSSProperties> = {
  page: {
    minHeight: "100vh",
    padding: "18px 22px 40px",
    background: "#eef2f5",
    color: "#10233a",
  },
  loadingPage: {
    minHeight: "70vh",
    display: "grid",
    placeItems: "center",
    color: "#526577",
    fontSize: 13,
    fontWeight: 800,
  },
  header: {
    display: "flex",
    alignItems: "flex-end",
    justifyContent: "space-between",
    gap: 20,
    marginBottom: 12,
  },
  eyebrow: {
    marginBottom: 3,
    color: "#1768d2",
    fontSize: 10,
    fontWeight: 900,
  },
  title: {
    margin: 0,
    fontSize: 24,
    fontWeight: 950,
    letterSpacing: "-0.025em",
  },
  subtitle: {
    margin: "5px 0 0",
    color: "#687789",
    fontSize: 11,
  },
  backButton: {
    height: 34,
    padding: "0 12px",
    border: "1px solid #cbd5e1",
    background: "#ffffff",
    color: "#10233a",
    fontSize: 9,
    fontWeight: 900,
    cursor: "pointer",
  },
  error: {
    marginBottom: 10,
    padding: "9px 11px",
    border: "1px solid #e4a0a0",
    background: "#fff1f1",
    color: "#9f1f1f",
    fontSize: 9,
    fontWeight: 800,
  },
  notice: {
    marginBottom: 10,
    padding: "9px 11px",
    border: "1px solid #b7ddc7",
    background: "#edf9f2",
    color: "#226443",
    fontSize: 9,
    fontWeight: 800,
  },
  panel: {
    marginBottom: 12,
    border: "1px solid #cfd8e3",
    background: "#ffffff",
  },
  panelHeader: {
    minHeight: 56,
    padding: "10px 12px",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottom: "1px solid #dfe6ed",
  },
  panelTitle: {
    margin: 0,
    fontSize: 13,
    fontWeight: 950,
  },
  panelSubtitle: {
    margin: "3px 0 0",
    color: "#748191",
    fontSize: 9,
  },
  addGrid: {
    padding: 12,
    display: "grid",
    gridTemplateColumns:
      "1.25fr 1fr 1.15fr 0.9fr auto auto",
    gap: 9,
    alignItems: "end",
  },
  field: {
    minWidth: 0,
    display: "grid",
    gap: 4,
  },
  label: {
    color: "#526577",
    fontSize: 8,
    fontWeight: 900,
  },
  input: {
    width: "100%",
    height: 34,
    padding: "0 9px",
    border: "1px solid #cbd5e1",
    background: "#ffffff",
    color: "#10233a",
    fontSize: 9,
    outline: "none",
  },
  checkField: {
    height: 34,
    display: "flex",
    alignItems: "center",
    gap: 6,
    color: "#526577",
    fontSize: 8.5,
    fontWeight: 800,
    whiteSpace: "nowrap",
  },
  primaryButton: {
    height: 34,
    padding: "0 13px",
    border: "1px solid #1768d2",
    background: "#1768d2",
    color: "#ffffff",
    fontSize: 9,
    fontWeight: 950,
    cursor: "pointer",
  },
  primaryDisabled: {
    height: 34,
    padding: "0 13px",
    border: "1px solid #cbd5e1",
    background: "#e9edf2",
    color: "#8996a4",
    fontSize: 9,
    fontWeight: 950,
    cursor: "not-allowed",
  },
  tableHeader: {
    minHeight: 36,
    padding: "0 12px",
    display: "grid",
    gridTemplateColumns:
      "minmax(240px, 1.5fr) 120px 115px 115px 120px 190px",
    gap: 10,
    alignItems: "center",
    background: "#f4f7fa",
    borderBottom: "1px solid #dfe6ed",
    color: "#5f6f81",
    fontSize: 8,
    fontWeight: 900,
  },
  tableRow: {
    minHeight: 58,
    padding: "8px 12px",
    display: "grid",
    gridTemplateColumns:
      "minmax(240px, 1.5fr) 120px 115px 115px 120px 190px",
    gap: 10,
    alignItems: "center",
    borderBottom: "1px solid #e6ebf0",
  },
  userCell: {
    minWidth: 0,
    display: "grid",
    gap: 3,
    fontSize: 9.5,
  },
  roleButton: {
    height: 28,
    border: "1px solid #cbd5e1",
    background: "#ffffff",
    color: "#526577",
    fontSize: 8,
    fontWeight: 900,
    cursor: "pointer",
  },
  rolePrimary: {
    height: 28,
    border: "1px solid #1768d2",
    background: "#eaf3ff",
    color: "#1768d2",
    fontSize: 8,
    fontWeight: 950,
    cursor: "pointer",
  },
  inlineCheck: {
    display: "flex",
    alignItems: "center",
    gap: 5,
    color: "#526577",
    fontSize: 8.5,
    fontWeight: 800,
  },
  statusActive: {
    justifySelf: "start",
    padding: "5px 8px",
    borderRadius: 999,
    background: "#eef4f8",
    color: "#526577",
    fontSize: 7.8,
    fontWeight: 900,
  },
  statusDisabled: {
    justifySelf: "start",
    padding: "5px 8px",
    borderRadius: 999,
    background: "#fff0f0",
    color: "#a43d2f",
    fontSize: 7.8,
    fontWeight: 900,
  },
  rowActions: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    justifyContent: "flex-end",
  },
  inviteButton: {
    minWidth: 94,
    height: 28,
    padding: "0 10px",
    border: "1px solid #1768d2",
    background: "#1768d2",
    color: "#ffffff",
    fontSize: 8,
    fontWeight: 950,
    cursor: "pointer",
    whiteSpace: "nowrap",
  },
  disableAccessButton: {
    minWidth: 86,
    height: 28,
    padding: "0 8px",
    border: "1px solid #e1b7b7",
    background: "#fffafa",
    color: "#a43d2f",
    fontSize: 8,
    fontWeight: 900,
    cursor: "pointer",
    whiteSpace: "nowrap",
  },
  secondaryButton: {
    height: 28,
    border: "1px solid #cbd5e1",
    background: "#ffffff",
    color: "#10233a",
    fontSize: 8,
    fontWeight: 900,
    cursor: "pointer",
  },
  empty: {
    minHeight: 120,
    display: "grid",
    placeItems: "center",
    color: "#7b8794",
    fontSize: 9.5,
  },
};
