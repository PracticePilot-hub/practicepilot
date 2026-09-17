"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/app/lib/supabase";

type RelatedParty = {
  id: string;
  party_type: "individual" | "entity" | "trust";
  display_name: string;
  id_registration_number: string | null;
  email: string | null;
  phone: string | null;
  mobile: string | null;
  linked_client_id: string | null;
};

type RelatedRole = {
  id: string;
  related_party_id: string;
  client_id: string;
  role_type: string;
  role_label: string | null;
  is_active: boolean;
  crm_related_parties?: RelatedParty | RelatedParty[] | null;
};

type Props = {
  clientId: string;
  organisationId: string;
};

const roleLabels: Record<string, string> = {
  contact: "Contact",
  director: "Director",
  shareholder: "Shareholder",
  beneficial_owner: "Beneficial Owner",
  trustee: "Trustee",
  beneficiary: "Beneficiary",
  member: "Member",
  partner: "Partner",
  office_bearer: "Office Bearer",
  registered_representative: "Registered Representative",
  other: "Other",
};

function one<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] || null;
  return value || null;
}

export default function RelatedPartiesPanel({
  clientId,
}: Props) {
  const [roles, setRoles] = useState<RelatedRole[]>([]);
  const [parties, setParties] = useState<RelatedParty[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [mode, setMode] = useState<"link" | "create">("link");
  const [partyId, setPartyId] = useState("");
  const [partyType, setPartyType] = useState<RelatedParty["party_type"]>("individual");
  const [displayName, setDisplayName] = useState("");
  const [idRegistrationNumber, setIdRegistrationNumber] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [roleType, setRoleType] = useState("contact");
  const [roleLabel, setRoleLabel] = useState("");

  async function getToken() {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.access_token) {
      throw new Error("You are not signed in.");
    }

    return session.access_token;
  }

  async function apiFetch(url: string, init?: RequestInit) {
    const token = await getToken();

    return fetch(url, {
      ...init,
      headers: {
        ...(init?.headers || {}),
        Authorization: `Bearer ${token}`,
      },
    });
  }

  async function load() {
    try {
      setLoading(true);
      setError("");

      const response = await apiFetch(
        `/api/crm/clients/${encodeURIComponent(clientId)}/related-parties`
      );
      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || "Could not load related parties.");
      }

      setRoles(data.roles || []);
      setParties(data.parties || []);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not load related parties."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [clientId]);

  const linkedPartyIds = useMemo(
    () => new Set(roles.map((role) => role.related_party_id)),
    [roles]
  );

  const availableParties = useMemo(
    () => parties.filter((party) => !linkedPartyIds.has(party.id)),
    [parties, linkedPartyIds]
  );

  async function saveLink() {
    try {
      setSaving(true);
      setError("");

      const payload =
        mode === "link"
          ? {
              action: "link_existing",
              relatedPartyId: partyId,
              roleType,
              roleLabel: roleLabel.trim() || null,
            }
          : {
              action: "create_and_link",
              partyType,
              displayName: displayName.trim(),
              idRegistrationNumber: idRegistrationNumber.trim() || null,
              email: email.trim() || null,
              phone: phone.trim() || null,
              roleType,
              roleLabel: roleLabel.trim() || null,
            };

      const response = await apiFetch(
        `/api/crm/clients/${encodeURIComponent(clientId)}/related-parties`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || "Could not save related party.");
      }

      setPartyId("");
      setDisplayName("");
      setIdRegistrationNumber("");
      setEmail("");
      setPhone("");
      setRoleLabel("");
      await load();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not save related party."
      );
    } finally {
      setSaving(false);
    }
  }

  async function removeRole(roleId: string) {
    try {
      setSaving(true);
      setError("");

      const response = await apiFetch(
        `/api/crm/clients/${encodeURIComponent(clientId)}/related-parties?roleId=${encodeURIComponent(roleId)}`,
        { method: "DELETE" }
      );

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || "Could not remove relationship.");
      }

      await load();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not remove relationship."
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={wrap}>
      <div style={header}>
        <div>
          <strong style={title}>Master relationships</strong>
          <div style={subtitle}>
            A related party can be linked to many clients without becoming an active client.
          </div>
        </div>

        <div style={toggle}>
          <button
            type="button"
            style={{ ...toggleButton, ...(mode === "link" ? toggleActive : {}) }}
            onClick={() => setMode("link")}
          >
            Link existing
          </button>
          <button
            type="button"
            style={{ ...toggleButton, ...(mode === "create" ? toggleActive : {}) }}
            onClick={() => setMode("create")}
          >
            Create related party
          </button>
        </div>
      </div>

      <div style={editor}>
        {mode === "link" ? (
          <label style={field}>
            <span style={label}>Related party</span>
            <select
              style={input}
              value={partyId}
              onChange={(event) => setPartyId(event.target.value)}
            >
              <option value="">Select...</option>
              {availableParties.map((party) => (
                <option key={party.id} value={party.id}>
                  {party.display_name}
                  {party.id_registration_number
                    ? ` · ${party.id_registration_number}`
                    : ""}
                </option>
              ))}
            </select>
          </label>
        ) : (
          <>
            <label style={field}>
              <span style={label}>Type</span>
              <select
                style={input}
                value={partyType}
                onChange={(event) =>
                  setPartyType(event.target.value as RelatedParty["party_type"])
                }
              >
                <option value="individual">Individual</option>
                <option value="entity">Entity</option>
                <option value="trust">Trust</option>
              </select>
            </label>

            <label style={field}>
              <span style={label}>Name</span>
              <input
                style={input}
                value={displayName}
                onChange={(event) => setDisplayName(event.target.value)}
              />
            </label>

            <label style={field}>
              <span style={label}>ID / Registration</span>
              <input
                style={input}
                value={idRegistrationNumber}
                onChange={(event) => setIdRegistrationNumber(event.target.value)}
              />
            </label>

            <label style={field}>
              <span style={label}>Email</span>
              <input
                style={input}
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
            </label>

            <label style={field}>
              <span style={label}>Phone</span>
              <input
                style={input}
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
              />
            </label>
          </>
        )}

        <label style={field}>
          <span style={label}>Role</span>
          <select
            style={input}
            value={roleType}
            onChange={(event) => setRoleType(event.target.value)}
          >
            {Object.entries(roleLabels).map(([value, text]) => (
              <option key={value} value={value}>
                {text}
              </option>
            ))}
          </select>
        </label>

        <label style={field}>
          <span style={label}>Role detail</span>
          <input
            style={input}
            value={roleLabel}
            onChange={(event) => setRoleLabel(event.target.value)}
            placeholder="Optional"
          />
        </label>

        <button
          type="button"
          style={saveButton}
          disabled={
            saving ||
            (mode === "link" ? !partyId : !displayName.trim()) ||
            !roleType
          }
          onClick={saveLink}
        >
          {saving ? "Saving..." : "Add relationship"}
        </button>
      </div>

      {error ? <div style={errorBox}>{error}</div> : null}

      <div style={table}>
        <div style={tableHeader}>
          <span>Name</span>
          <span>Type</span>
          <span>Role</span>
          <span>ID / Registration</span>
          <span>Contact</span>
          <span />
        </div>

        {loading ? (
          <div style={empty}>Loading related parties...</div>
        ) : roles.length ? (
          roles.map((role) => {
            const party = one(role.crm_related_parties);

            return (
              <div key={role.id} style={row}>
                <strong>{party?.display_name || "Related party"}</strong>
                <span>{party?.party_type || "—"}</span>
                <span>
                  {roleLabels[role.role_type] || role.role_type}
                  {role.role_label ? ` · ${role.role_label}` : ""}
                </span>
                <span>{party?.id_registration_number || "—"}</span>
                <span>{party?.email || party?.mobile || party?.phone || "—"}</span>
                <button
                  type="button"
                  style={removeButton}
                  disabled={saving}
                  onClick={() => removeRole(role.id)}
                >
                  Remove link
                </button>
              </div>
            );
          })
        ) : (
          <div style={empty}>No master relationships linked yet.</div>
        )}
      </div>
    </div>
  );
}

const wrap: React.CSSProperties = {
  padding: "12px",
  borderBottom: "1px solid #dfe6ec",
  background: "#f8fafb",
};

const header: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "14px",
  marginBottom: "10px",
};

const title: React.CSSProperties = {
  color: "#10233a",
  fontSize: "12px",
  fontWeight: 900,
};

const subtitle: React.CSSProperties = {
  marginTop: "3px",
  color: "#71808c",
  fontSize: "9px",
};

const toggle: React.CSSProperties = {
  display: "flex",
  border: "1px solid #cfd8df",
};

const toggleButton: React.CSSProperties = {
  minHeight: "30px",
  padding: "0 10px",
  border: "none",
  borderRight: "1px solid #cfd8df",
  background: "#ffffff",
  color: "#52616d",
  fontSize: "9px",
  fontWeight: 850,
  cursor: "pointer",
};

const toggleActive: React.CSSProperties = {
  background: "#10233a",
  color: "#ffffff",
};

const editor: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(7, minmax(0, 1fr))",
  gap: "8px",
  alignItems: "end",
  marginBottom: "10px",
};

const field: React.CSSProperties = {
  display: "grid",
  gap: "4px",
};

const label: React.CSSProperties = {
  color: "#607180",
  fontSize: "8px",
  fontWeight: 850,
};

const input: React.CSSProperties = {
  width: "100%",
  minHeight: "32px",
  padding: "5px 7px",
  boxSizing: "border-box",
  border: "1px solid #cfd8df",
  background: "#ffffff",
  color: "#10233a",
  fontSize: "10px",
};

const saveButton: React.CSSProperties = {
  minHeight: "32px",
  padding: "0 10px",
  border: "1px solid #10233a",
  background: "#10233a",
  color: "#ffffff",
  fontSize: "9px",
  fontWeight: 850,
  cursor: "pointer",
};

const errorBox: React.CSSProperties = {
  marginBottom: "10px",
  padding: "8px 10px",
  border: "1px solid #e4a0a0",
  background: "#fff3f3",
  color: "#9f2d2d",
  fontSize: "9px",
  fontWeight: 800,
};

const table: React.CSSProperties = {
  border: "1px solid #d8e0e6",
  background: "#ffffff",
};

const tableHeader: React.CSSProperties = {
  minHeight: "30px",
  display: "grid",
  gridTemplateColumns: "1.35fr .7fr 1fr 1fr 1fr 90px",
  gap: "8px",
  alignItems: "center",
  padding: "0 9px",
  background: "#10233a",
  color: "#ffffff",
  fontSize: "8px",
  fontWeight: 850,
};

const row: React.CSSProperties = {
  minHeight: "42px",
  display: "grid",
  gridTemplateColumns: "1.35fr .7fr 1fr 1fr 1fr 90px",
  gap: "8px",
  alignItems: "center",
  padding: "0 9px",
  borderBottom: "1px solid #e6ebef",
  color: "#40515d",
  fontSize: "9px",
};

const removeButton: React.CSSProperties = {
  padding: 0,
  border: "none",
  background: "transparent",
  color: "#9f2d2d",
  fontSize: "8px",
  fontWeight: 850,
  cursor: "pointer",
};

const empty: React.CSSProperties = {
  padding: "14px 10px",
  color: "#71808c",
  fontSize: "9px",
};
