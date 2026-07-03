// Path: app/compliance/paia/page.tsx

"use client";

import { type CSSProperties, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@supabase/supabase-js";

type PaiaManual = {
  id: string;
  client_id: string | null;
  entity_name: string;
  entity_registration_number: string | null;
  entity_type: string | null;
  date_compiled: string | null;
  version_number: string | null;
  status: string | null;
};

type Organisation = {
  id: string;
  name: string;
  status: string;
  access_enabled: boolean;
};

type UserProfile = {
  id: string;
  user_id: string;
  full_name: string | null;
  email: string;
  role: string;
  organisation_id: string | null;
  access_enabled: boolean;
  can_access_paia?: boolean;
};

type NewManualForm = {
  entity_name: string;
  entity_registration_number: string;
  entity_type: string;
  date_compiled: string;
  information_officer_name: string;
  information_officer_email: string;
};

type StatusFilter = "all" | "draft" | "finalised";
type SortMode =
  | "client_asc"
  | "client_desc"
  | "status_asc"
  | "version_desc"
  | "compiled_desc"
  | "compiled_asc";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl) throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL");
if (!supabaseAnonKey) throw new Error("Missing NEXT_PUBLIC_SUPABASE_ANON_KEY");

const supabase = createClient(supabaseUrl, supabaseAnonKey);

const today = new Date().toISOString().slice(0, 10);

const emptyForm: NewManualForm = {
  entity_name: "",
  entity_registration_number: "",
  entity_type: "Private Company",
  date_compiled: today,
  information_officer_name: "",
  information_officer_email: "",
};

function isGlobalAdmin(role: string) {
  return role === "Super Admin" || role === "Admin";
}

function formatDate(value: string | null) {
  if (!value) return "-";

  return new Date(value).toLocaleDateString("en-ZA", {
    year: "numeric",
    month: "short",
    day: "2-digit",
  });
}

function normaliseStatus(value: string | null) {
  return String(value || "draft").trim().toLowerCase();
}

function versionNumberValue(value: string | null) {
  const parsed = Number(String(value || "1.0").replace(/[^\d.]/g, ""));
  return Number.isFinite(parsed) ? parsed : 1;
}

function dateValue(value: string | null) {
  if (!value) return 0;
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
}

async function getAuthToken() {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token || "";
}

export default function PaiaManualsPage() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [manuals, setManuals] = useState<PaiaManual[]>([]);
  const [organisations, setOrganisations] = useState<Organisation[]>([]);
  const [currentOrganisation, setCurrentOrganisation] = useState<Organisation | null>(null);

  const [selectedOrganisationId, setSelectedOrganisationId] = useState("");
  const [form, setForm] = useState<NewManualForm>(emptyForm);

  const [loading, setLoading] = useState(true);
  const [manualsLoading, setManualsLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [clientFilter, setClientFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [sortMode, setSortMode] = useState<SortMode>("client_asc");

  const globalAdmin = Boolean(profile && isGlobalAdmin(profile.role));
  const selectedOrganisation =
    organisations.find((organisation) => organisation.id === selectedOrganisationId) ||
    currentOrganisation ||
    null;

  useEffect(() => {
    loadSecurePage();
  }, []);

  useEffect(() => {
    if (!profile) return;

    loadManuals(selectedOrganisationId);
  }, [profile, selectedOrganisationId]);

  async function loadSecurePage() {
    setLoading(true);
    setError(null);

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

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

    const loadedProfile = profileData as UserProfile;
    const admin = isGlobalAdmin(loadedProfile.role);

    if (!loadedProfile.access_enabled) {
      alert("Your access has been blocked.");
      await supabase.auth.signOut();
      window.location.href = "/login";
      return;
    }

    if (!admin && !loadedProfile.can_access_paia) {
      alert("You do not have access to PAIA Manuals.");
      window.location.href = "/dashboard";
      return;
    }

    if (!admin && !loadedProfile.organisation_id) {
      alert("Your user is not linked to a firm/client. Please contact PracticePilot support.");
      window.location.href = "/dashboard";
      return;
    }

    setProfile(loadedProfile);

    if (!admin) {
      setSelectedOrganisationId(loadedProfile.organisation_id || "");
    }

    setLoading(false);
  }

  async function loadManuals(clientId: string) {
    setManualsLoading(true);
    setError(null);

    try {
      const token = await getAuthToken();

      if (!token) {
        window.location.href = "/login";
        return;
      }

      const params = new URLSearchParams();

      if (clientId) {
        params.set("clientId", clientId);
      }

      const url = `/api/paia/manuals${params.toString() ? `?${params.toString()}` : ""}`;

      const res = await fetch(url, {
        cache: "no-store",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const json = await res.json();

      if (!res.ok) {
        throw new Error(json.error || "Could not load PAIA manuals.");
      }

      setManuals(json.manuals ?? []);
      setOrganisations(json.organisations ?? []);
      setCurrentOrganisation(json.currentOrganisation ?? null);
    } catch (err: any) {
      setError(err?.message ?? "Could not load PAIA manuals.");
      setManuals([]);
    } finally {
      setManualsLoading(false);
    }
  }

  const filteredManuals = useMemo(() => {
    const clientSearch = clientFilter.trim().toLowerCase();

    const filtered = manuals.filter((manual) => {
      const status = normaliseStatus(manual.status);

      const matchesClient =
        !clientSearch ||
        String(manual.entity_name || "").toLowerCase().includes(clientSearch) ||
        String(manual.entity_registration_number || "")
          .toLowerCase()
          .includes(clientSearch);

      const matchesStatus = statusFilter === "all" || status === statusFilter;

      return matchesClient && matchesStatus;
    });

    filtered.sort((a, b) => {
      if (sortMode === "client_asc") {
        return String(a.entity_name || "").localeCompare(String(b.entity_name || ""));
      }

      if (sortMode === "client_desc") {
        return String(b.entity_name || "").localeCompare(String(a.entity_name || ""));
      }

      if (sortMode === "status_asc") {
        return normaliseStatus(a.status).localeCompare(normaliseStatus(b.status));
      }

      if (sortMode === "version_desc") {
        return versionNumberValue(b.version_number) - versionNumberValue(a.version_number);
      }

      if (sortMode === "compiled_desc") {
        return dateValue(b.date_compiled) - dateValue(a.date_compiled);
      }

      if (sortMode === "compiled_asc") {
        return dateValue(a.date_compiled) - dateValue(b.date_compiled);
      }

      return 0;
    });

    return filtered;
  }, [manuals, clientFilter, statusFilter, sortMode]);

  function updateField(field: keyof NewManualForm, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function createManual(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!form.entity_name.trim()) {
      setError("Entity name is required.");
      return;
    }

    const clientIdToUse = globalAdmin
      ? selectedOrganisationId
      : profile?.organisation_id || "";

    if (!clientIdToUse) {
      setError("Please choose a firm/client before creating a PAIA manual.");
      return;
    }

    setCreating(true);
    setError(null);

    try {
      const token = await getAuthToken();

      if (!token) {
        window.location.href = "/login";
        return;
      }

      const res = await fetch("/api/paia/manuals", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          ...form,
          client_id: clientIdToUse,
          manual_name: `${form.entity_name.trim()} PAIA Manual`,
          information_officer_position: "Information Officer",
          next_review_date: "",
        }),
      });

      const json = await res.json();

      if (!res.ok) {
        throw new Error(json.error || "Could not create PAIA manual.");
      }

      if (json.manual?.id) {
        window.location.href = `/compliance/paia/${json.manual.id}`;
      } else {
        await loadManuals(clientIdToUse);
      }
    } catch (err: any) {
      setError(err?.message ?? "Could not create PAIA manual.");
    } finally {
      setCreating(false);
    }
  }

  function clearFilters() {
    setClientFilter("");
    setStatusFilter("all");
    setSortMode("client_asc");
  }

  if (loading) {
    return (
      <main style={s.page}>
        <div style={s.empty}>Loading PAIA Manuals...</div>
      </main>
    );
  }

  return (
    <main style={s.page}>
      <section style={s.hero}>
        <div>
          <p style={s.eyebrow}>PracticePilot</p>
          <h1 style={s.title}>PAIA Manuals</h1>
        </div>

        <p style={s.sub}>
          Create and manage PAIA / POPIA manuals, records, information
          processing, security measures and sign-off.
        </p>
      </section>

      <section style={s.grid}>
        <aside style={s.leftStack}>
          <section style={s.card}>
            <div style={s.cardBody}>
              <h2 style={s.h2}>Firm control</h2>

              {globalAdmin ? (
                <label style={s.fieldWrap}>
                  <span style={s.label}>Working firm / client</span>
                  <select
                    value={selectedOrganisationId}
                    onChange={(event) => {
                      setSelectedOrganisationId(event.target.value);
                      setForm(emptyForm);
                      clearFilters();
                    }}
                    style={s.input}
                  >
                    <option value="">Choose firm/client</option>
                    {organisations.map((organisation) => (
                      <option key={organisation.id} value={organisation.id}>
                        {organisation.name}
                        {!organisation.access_enabled ? " - Blocked" : ""}
                      </option>
                    ))}
                  </select>
                </label>
              ) : (
                <div style={s.lockBox}>
                  <strong>{selectedOrganisation?.name || "Your firm"}</strong>
                  <span>Locked to your firm only</span>
                </div>
              )}

              {globalAdmin && !selectedOrganisationId ? (
                <div style={s.infoBox}>Choose a firm/client before creating or viewing PAIA manuals.</div>
              ) : selectedOrganisation ? (
                <div style={s.infoBox}>
                  <strong>{selectedOrganisation.name}</strong>
                  <span>
                    {selectedOrganisation.status || "Active"} ·{" "}
                    {selectedOrganisation.access_enabled ? "Access enabled" : "Access blocked"}
                  </span>
                </div>
              ) : null}
            </div>
          </section>

          <form onSubmit={createManual} style={s.card}>
            <div style={s.cardBody}>
              <h2 style={s.h2}>New PAIA manual</h2>

              <Field
                label="Entity name"
                value={form.entity_name}
                onChange={(value) => updateField("entity_name", value)}
                placeholder="Example: ABC Trading (Pty) Ltd"
                required
              />

              <Field
                label="Registration number"
                value={form.entity_registration_number}
                onChange={(value) => updateField("entity_registration_number", value)}
                placeholder="Optional"
              />

              <Field
                label="Entity type"
                value={form.entity_type}
                onChange={(value) => updateField("entity_type", value)}
              />

              <Field
                label="Date compiled"
                type="date"
                value={form.date_compiled}
                onChange={(value) => updateField("date_compiled", value)}
              />

              <Field
                label="Information Officer"
                value={form.information_officer_name}
                onChange={(value) => updateField("information_officer_name", value)}
                placeholder="Optional"
              />

              <Field
                label="Information Officer email"
                value={form.information_officer_email}
                onChange={(value) => updateField("information_officer_email", value)}
                placeholder="Optional"
              />

              {error ? <div style={s.error}>{error}</div> : null}

              <button
                type="submit"
                disabled={creating || (globalAdmin && !selectedOrganisationId)}
                style={{
                  ...s.button,
                  opacity: creating || (globalAdmin && !selectedOrganisationId) ? 0.55 : 1,
                }}
              >
                {creating ? "Creating..." : "Create PAIA manual"}
              </button>
            </div>
          </form>
        </aside>

        <section style={s.card}>
          <div style={s.listCard}>
            <div style={s.listHeader}>
              <div>
                <h2 style={s.h2}>
                  {selectedOrganisation
                    ? `${selectedOrganisation.name} PAIA manuals`
                    : "Existing manuals"}
                </h2>
                <div style={s.resultText}>
                  Showing {filteredManuals.length} of {manuals.length} manual(s)
                </div>
              </div>

              <button type="button" style={s.clearButton} onClick={clearFilters}>
                Clear filters
              </button>
            </div>

            <div style={s.filters}>
              <label style={s.filterLabel}>
                <span style={s.filterText}>Entity / reg no.</span>
                <input
                  value={clientFilter}
                  onChange={(event) => setClientFilter(event.target.value)}
                  placeholder="Search entity..."
                  style={s.filterInput}
                />
              </label>

              <label style={s.filterLabel}>
                <span style={s.filterText}>Status</span>
                <select
                  value={statusFilter}
                  onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}
                  style={s.filterInput}
                >
                  <option value="all">All</option>
                  <option value="draft">Draft</option>
                  <option value="finalised">Finalised</option>
                </select>
              </label>

              <label style={s.filterLabel}>
                <span style={s.filterText}>Sort by</span>
                <select
                  value={sortMode}
                  onChange={(event) => setSortMode(event.target.value as SortMode)}
                  style={s.filterInput}
                >
                  <option value="client_asc">Entity A-Z</option>
                  <option value="client_desc">Entity Z-A</option>
                  <option value="status_asc">Status</option>
                  <option value="version_desc">Version newest</option>
                  <option value="compiled_desc">Compiled newest</option>
                  <option value="compiled_asc">Compiled oldest</option>
                </select>
              </label>
            </div>

            {manualsLoading ? (
              <div style={s.empty}>Loading PAIA manuals...</div>
            ) : manuals.length === 0 ? (
              <div style={s.empty}>No PAIA manuals found for the selected firm/client.</div>
            ) : filteredManuals.length === 0 ? (
              <div style={s.empty}>No PAIA manuals match the selected filters.</div>
            ) : (
              <table style={s.table}>
                <thead>
                  <tr>
                    <th style={s.th}>Entity</th>
                    <th style={s.th}>Type</th>
                    <th style={s.th}>Registration</th>
                    <th style={s.th}>Compiled</th>
                    <th style={s.th}>Version</th>
                    <th style={s.th}>Status</th>
                    <th style={s.thRight}>Action</th>
                  </tr>
                </thead>

                <tbody>
                  {filteredManuals.map((manual) => (
                    <tr key={manual.id}>
                      <td style={s.tdStrong}>{manual.entity_name}</td>
                      <td style={s.td}>{manual.entity_type || "-"}</td>
                      <td style={s.td}>
                        {manual.entity_registration_number || "-"}
                      </td>
                      <td style={s.td}>{formatDate(manual.date_compiled)}</td>
                      <td style={s.td}>{manual.version_number || "1.0"}</td>
                      <td style={s.td}>
                        <span
                          style={{
                            ...s.status,
                            ...(normaliseStatus(manual.status) === "finalised"
                              ? s.statusFinalised
                              : {}),
                          }}
                        >
                          {normaliseStatus(manual.status)}
                        </span>
                      </td>
                      <td style={s.tdRight}>
                        <Link
                          href={`/compliance/paia/${manual.id}`}
                          style={s.openLink}
                        >
                          Open
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </section>
      </section>
    </main>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
  required = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  placeholder?: string;
  required?: boolean;
}) {
  return (
    <label style={s.fieldWrap}>
      <span style={s.label}>{label}</span>
      <input
        type={type}
        value={value}
        required={required}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        style={s.input}
      />
    </label>
  );
}

const s: Record<string, CSSProperties> = {
  page: {
    minHeight: "calc(100vh - 48px)",
    background: "#f3f7fb",
    padding: "14px 18px",
    color: "#0f172a",
    fontFamily:
      "Inter, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  },
  hero: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "end",
    gap: 18,
    background: "#ffffff",
    border: "1px solid #d8e2ee",
    borderRadius: 12,
    padding: "14px 20px",
    marginBottom: 14,
  },
  eyebrow: {
    margin: 0,
    color: "#1769e0",
    fontSize: 11,
    fontWeight: 900,
    letterSpacing: "0.1em",
    textTransform: "uppercase",
  },
  title: {
    margin: "5px 0 0",
    fontSize: 25,
    fontWeight: 800,
    lineHeight: 1.05,
    color: "#0f172a",
  },
  sub: {
    margin: 0,
    maxWidth: 720,
    fontSize: 13,
    color: "#667085",
    textAlign: "right",
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "360px 1fr",
    gap: 14,
    alignItems: "start",
  },
  leftStack: {
    display: "grid",
    gap: 14,
  },
  card: {
    background: "#ffffff",
    border: "1px solid #d8e2ee",
    borderRadius: 12,
    overflow: "hidden",
  },
  cardBody: {
    padding: 14,
  },
  h2: {
    margin: 0,
    fontSize: 17,
    fontWeight: 800,
    color: "#0f172a",
  },
  fieldWrap: {
    display: "block",
    marginTop: 8,
  },
  label: {
    display: "block",
    marginBottom: 3,
    fontSize: 12,
    fontWeight: 800,
    color: "#25364d",
  },
  input: {
    width: "100%",
    boxSizing: "border-box",
    height: 35,
    border: "1px solid #cfd8e3",
    borderRadius: 8,
    padding: "0 9px",
    fontSize: 13,
    color: "#0f172a",
    outline: "none",
    background: "#ffffff",
  },
  lockBox: {
    marginTop: 10,
    display: "grid",
    gap: 4,
    border: "1px solid #d8e2ee",
    background: "#f8fafc",
    borderRadius: 10,
    padding: 10,
    fontSize: 13,
    color: "#12304a",
  },
  infoBox: {
    marginTop: 10,
    display: "grid",
    gap: 4,
    border: "1px solid #d8e2ee",
    background: "#f8fafc",
    borderRadius: 10,
    padding: 10,
    fontSize: 12,
    color: "#475569",
  },
  button: {
    width: "100%",
    marginTop: 12,
    height: 38,
    border: "1px solid #1769e0",
    borderRadius: 8,
    background: "#1769e0",
    color: "#ffffff",
    fontSize: 13,
    fontWeight: 800,
    cursor: "pointer",
  },
  error: {
    marginTop: 8,
    background: "#fff1f2",
    border: "1px solid #fecaca",
    color: "#991b1b",
    padding: 8,
    borderRadius: 8,
    fontSize: 12,
  },
  listCard: {
    padding: 12,
  },
  listHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 8,
    gap: 12,
  },
  resultText: {
    marginTop: 3,
    fontSize: 12,
    color: "#667085",
    fontWeight: 650,
  },
  clearButton: {
    border: "1px solid #d5dde6",
    background: "#ffffff",
    color: "#12304a",
    borderRadius: 7,
    padding: "6px 9px",
    fontSize: 12,
    fontWeight: 850,
    cursor: "pointer",
  },
  filters: {
    display: "grid",
    gridTemplateColumns: "1.4fr 150px 180px",
    gap: 8,
    marginBottom: 10,
    paddingBottom: 10,
    borderBottom: "1px solid #edf2f7",
  },
  filterLabel: {
    display: "block",
  },
  filterText: {
    display: "block",
    marginBottom: 3,
    fontSize: 11,
    color: "#34495e",
    fontWeight: 850,
  },
  filterInput: {
    width: "100%",
    boxSizing: "border-box",
    height: 32,
    border: "1px solid #cfd8e3",
    borderRadius: 7,
    padding: "0 8px",
    fontSize: 12,
    color: "#0f172a",
    background: "#ffffff",
    outline: "none",
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
  },
  th: {
    textAlign: "left",
    padding: "6px 8px",
    background: "#f8fbff",
    borderTop: "1px solid #dbe5ef",
    borderBottom: "1px solid #dbe5ef",
    fontSize: 11,
    fontWeight: 900,
    color: "#34495e",
    whiteSpace: "nowrap",
  },
  thRight: {
    textAlign: "right",
    padding: "6px 8px",
    background: "#f8fbff",
    borderTop: "1px solid #dbe5ef",
    borderBottom: "1px solid #dbe5ef",
    fontSize: 11,
    fontWeight: 900,
    color: "#34495e",
    whiteSpace: "nowrap",
  },
  td: {
    padding: "6px 8px",
    borderBottom: "1px solid #edf2f7",
    fontSize: 12,
    color: "#34495e",
    verticalAlign: "middle",
  },
  tdStrong: {
    padding: "6px 8px",
    borderBottom: "1px solid #edf2f7",
    fontSize: 12,
    color: "#0f172a",
    fontWeight: 800,
    verticalAlign: "middle",
  },
  tdRight: {
    padding: "6px 8px",
    borderBottom: "1px solid #edf2f7",
    fontSize: 12,
    color: "#34495e",
    textAlign: "right",
    verticalAlign: "middle",
  },
  status: {
    display: "inline-block",
    borderRadius: 999,
    background: "#eef4ff",
    color: "#1769e0",
    padding: "2px 7px",
    fontSize: 11,
    fontWeight: 800,
    textTransform: "lowercase",
  },
  statusFinalised: {
    background: "#dcfce7",
    color: "#166534",
  },
  openLink: {
    display: "inline-block",
    color: "#1769e0",
    fontSize: 12,
    fontWeight: 900,
    textDecoration: "none",
  },
  empty: {
    marginTop: 10,
    border: "1px dashed #cfd8e3",
    borderRadius: 10,
    padding: 12,
    color: "#667085",
    fontSize: 13,
  },
};