"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl) {
  throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL");
}

if (!supabaseAnonKey) {
  throw new Error("Missing NEXT_PUBLIC_SUPABASE_ANON_KEY");
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

type Project = {
  id: string;
  name: string;
  number_of_phases: number;
  status: "Active" | "Completed" | string;
  created_at: string;
  organisation_id?: string | null;
  client_income_total?: number | null;
  client_income_vat_mode?: string | null;
  client_payment_count?: number | null;
  current_supplier_phase?: number | null;
  organisations?: {
    id: string;
    name: string;
  } | null;
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
  organisation_id: string | null;
  full_name: string | null;
  email: string;
  role: string;
  can_edit_projects: boolean;
  access_enabled: boolean;
  can_access_projects: boolean;
};

function formatCurrency(value: number | null | undefined) {
  const amount = Number(value || 0);

  return new Intl.NumberFormat("en-ZA", {
    style: "currency",
    currency: "ZAR",
  }).format(amount);
}

function formatDate(dateValue: string | null | undefined) {
  if (!dateValue) return "-";

  return new Date(dateValue).toLocaleDateString("en-ZA", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export default function ProjectManagementPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [organisations, setOrganisations] = useState<Organisation[]>([]);
  const [profile, setProfile] = useState<UserProfile | null>(null);

  const [selectedOrganisationId, setSelectedOrganisationId] = useState("");
  const [showNewProject, setShowNewProject] = useState(false);
  const [projectName, setProjectName] = useState("");
  const [numberOfPhases, setNumberOfPhases] = useState("");

  const [searchText, setSearchText] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [sortBy, setSortBy] = useState("Project A-Z");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const isInternalUser =
    profile?.role === "Super Admin" ||
    profile?.role === "Admin" ||
    profile?.role === "Staff";

  const canAddProject = Boolean(isInternalUser || profile?.can_edit_projects);

  useEffect(() => {
    loadPage();
  }, []);

  const selectedOrganisation = useMemo(() => {
    return organisations.find((organisation) => organisation.id === selectedOrganisationId) || null;
  }, [organisations, selectedOrganisationId]);

  const visibleProjects = useMemo(() => {
    if (!profile) return [];

    let rows: Project[] = [];

    if (isInternalUser) {
      if (!selectedOrganisationId) rows = [];
      else if (selectedOrganisationId === "all") rows = projects;
      else rows = projects.filter((project) => project.organisation_id === selectedOrganisationId);
    } else {
      rows = projects.filter((project) => project.organisation_id === profile.organisation_id);
    }

    const search = searchText.trim().toLowerCase();

    if (search) {
      rows = rows.filter((project) => {
        const clientName = project.organisations?.name || "";
        return (
          project.name.toLowerCase().includes(search) ||
          clientName.toLowerCase().includes(search) ||
          String(project.number_of_phases || "").includes(search)
        );
      });
    }

    if (statusFilter !== "All") {
      rows = rows.filter((project) => project.status === statusFilter);
    }

    const sortedRows = [...rows];

    sortedRows.sort((a, b) => {
      if (sortBy === "Project A-Z") return a.name.localeCompare(b.name);
      if (sortBy === "Project Z-A") return b.name.localeCompare(a.name);
      if (sortBy === "Client A-Z") {
        return (a.organisations?.name || "").localeCompare(b.organisations?.name || "");
      }
      if (sortBy === "Newest") {
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      }
      if (sortBy === "Oldest") {
        return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      }

      return 0;
    });

    return sortedRows;
  }, [projects, selectedOrganisationId, profile, isInternalUser, searchText, statusFilter, sortBy]);

  const activeProjectCount = visibleProjects.filter((project) => project.status === "Active").length;
  const completedProjectCount = visibleProjects.filter((project) => project.status === "Completed").length;

  async function loadPage() {
    setLoading(true);

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

    if (!profileData.access_enabled || !profileData.can_access_projects) {
      alert("You do not have access to Project Management.");
      window.location.href = "/dashboard";
      return;
    }

    setProfile(profileData);

    const organisationsResponse = await fetch("/api/organisations");
    const organisationsData = await organisationsResponse.json();

    if (organisationsResponse.ok) {
      setOrganisations(organisationsData.organisations || []);
    } else {
      alert(organisationsData.error || "Could not load clients.");
    }

    const projectsResponse = await fetch("/api/projects");
    const projectsData = await projectsResponse.json();

    if (projectsResponse.ok) {
      setProjects(projectsData.projects || []);
    } else {
      alert(projectsData.error || "Could not load projects.");
    }

    const internal =
      profileData.role === "Super Admin" ||
      profileData.role === "Admin" ||
      profileData.role === "Staff";

    if (!internal && profileData.organisation_id) {
      setSelectedOrganisationId(profileData.organisation_id);
    }

    setLoading(false);
  }

  function openNewProjectForm() {
    if (!canAddProject) {
      alert("You do not have permission to add projects.");
      return;
    }

    if (!selectedOrganisationId || selectedOrganisationId === "all") {
      alert("Please choose a specific client first.");
      return;
    }

    setShowNewProject(true);
  }

  async function handleCreateProject() {
    if (!selectedOrganisationId || selectedOrganisationId === "all") {
      alert("Please choose a specific client first.");
      return;
    }

    if (!projectName.trim()) {
      alert("Project name is required.");
      return;
    }

    if (!numberOfPhases || Number(numberOfPhases) <= 0) {
      alert("Number of phases is required.");
      return;
    }

    setSaving(true);

    const response = await fetch("/api/projects", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        organisationId: selectedOrganisationId,
        name: projectName.trim(),
        numberOfPhases: Number(numberOfPhases),
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      alert(data.error || "Could not save project.");
      setSaving(false);
      return;
    }

    setProjects((prev) => [data.project, ...prev]);
    setProjectName("");
    setNumberOfPhases("");
    setShowNewProject(false);
    setSaving(false);
  }

  function clearFilters() {
    setSearchText("");
    setStatusFilter("All");
    setSortBy("Project A-Z");
  }

  if (loading) {
    return (
      <main style={styles.page}>
        <div style={styles.emptyState}>Loading projects...</div>
      </main>
    );
  }

  return (
    <main style={styles.page}>
      <section style={styles.heroPanel}>
        <div>
          <div style={styles.kicker}>PracticePilot</div>
          <h1 style={styles.title}>Project Management</h1>
        </div>

        <p style={styles.heroText}>
          Manage project income, supplier budgets, phase payment lists, POPs, cashflow and exception reporting.
        </p>
      </section>

      <div style={styles.layoutGrid}>
        <aside style={styles.leftPanel}>
          <h2 style={styles.panelTitle}>Project control</h2>

          {isInternalUser ? (
            <div style={styles.fieldGroup}>
              <label style={styles.label}>Working client</label>
              <select
                style={styles.input}
                value={selectedOrganisationId}
                onChange={(e) => {
                  setSelectedOrganisationId(e.target.value);
                  setShowNewProject(false);
                  setProjectName("");
                  setNumberOfPhases("");
                  setSearchText("");
                }}
              >
                <option value="">Choose client</option>
                <option value="all">All Projects</option>
                {organisations.map((organisation) => (
                  <option key={organisation.id} value={organisation.id}>
                    {organisation.name}
                    {!organisation.access_enabled ? " - Suspended" : ""}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <div style={styles.infoBox}>
              <strong>{selectedOrganisation?.name || "Client"}</strong>
              <span>Showing your projects only</span>
            </div>
          )}

          {isInternalUser && (
            <div style={styles.infoBox}>
              {selectedOrganisationId === "all" ? (
                <>
                  <strong>All Clients</strong>
                  <span>Showing all projects</span>
                </>
              ) : selectedOrganisation ? (
                <>
                  <strong>{selectedOrganisation.name}</strong>
                  <span>
                    {selectedOrganisation.status} · {selectedOrganisation.access_enabled ? "Access Enabled" : "Access Blocked"}
                  </span>
                </>
              ) : (
                <>
                  <strong>Choose client</strong>
                  <span>No client selected</span>
                </>
              )}
            </div>
          )}

          <div style={styles.statGridSmall}>
            <div style={styles.statBoxSmall}>
              <span>Total</span>
              <strong>{visibleProjects.length}</strong>
            </div>
            <div style={styles.statBoxSmall}>
              <span>Active</span>
              <strong>{activeProjectCount}</strong>
            </div>
            <div style={styles.statBoxSmall}>
              <span>Completed</span>
              <strong>{completedProjectCount}</strong>
            </div>
          </div>

          {canAddProject && (
            <button style={styles.primaryButtonFull} onClick={openNewProjectForm}>
              + Add New Project
            </button>
          )}

          {showNewProject && selectedOrganisation && (
            <div style={styles.createBox}>
              <h3 style={styles.createTitle}>New project</h3>
              <p style={styles.createSubtitle}>{selectedOrganisation.name}</p>

              <div style={styles.fieldGroup}>
                <label style={styles.label}>Project name</label>
                <input
                  style={styles.input}
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                  placeholder="Example: Vitality Wellness"
                />
              </div>

              <div style={styles.fieldGroup}>
                <label style={styles.label}>Number of phases</label>
                <input
                  style={styles.input}
                  type="number"
                  min="1"
                  value={numberOfPhases}
                  onChange={(e) => setNumberOfPhases(e.target.value)}
                  placeholder="Example: 5"
                />
              </div>

              <div style={styles.buttonRow}>
                <button
                  style={styles.secondaryButton}
                  onClick={() => {
                    setShowNewProject(false);
                    setProjectName("");
                    setNumberOfPhases("");
                  }}
                >
                  Cancel
                </button>
                <button style={styles.primaryButton} onClick={handleCreateProject} disabled={saving}>
                  {saving ? "Saving..." : "Save"}
                </button>
              </div>
            </div>
          )}
        </aside>

        <section style={styles.rightPanel}>
          <div style={styles.tableHeaderRow}>
            <div>
              <h2 style={styles.panelTitle}>
                {isInternalUser
                  ? selectedOrganisationId === "all"
                    ? "All Projects"
                    : selectedOrganisation
                    ? `${selectedOrganisation.name} Projects`
                    : "Projects"
                  : `${selectedOrganisation?.name || "Client"} Projects`}
              </h2>
              <p style={styles.resultText}>Showing {visibleProjects.length} project(s)</p>
            </div>

            <button style={styles.clearButton} onClick={clearFilters}>
              Clear filters
            </button>
          </div>

          <div style={styles.filtersGrid}>
            <div style={styles.fieldGroupCompact}>
              <label style={styles.label}>Project / client</label>
              <input
                style={styles.input}
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                placeholder="Search project or client..."
              />
            </div>

            <div style={styles.fieldGroupCompact}>
              <label style={styles.label}>Status</label>
              <select
                style={styles.input}
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="All">All</option>
                <option value="Active">Active</option>
                <option value="Completed">Completed</option>
              </select>
            </div>

            <div style={styles.fieldGroupCompact}>
              <label style={styles.label}>Sort by</label>
              <select style={styles.input} value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
                <option value="Project A-Z">Project A-Z</option>
                <option value="Project Z-A">Project Z-A</option>
                <option value="Client A-Z">Client A-Z</option>
                <option value="Newest">Newest</option>
                <option value="Oldest">Oldest</option>
              </select>
            </div>
          </div>

          {visibleProjects.length === 0 ? (
            <div style={styles.emptyState}>No projects found for the current selection.</div>
          ) : (
            <div style={styles.tableWrap}>
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={styles.th}>Project</th>
                    <th style={styles.th}>Client</th>
                    <th style={{ ...styles.th, textAlign: "right" }}>Phases</th>
                    <th style={{ ...styles.th, textAlign: "right" }}>Income</th>
                    <th style={styles.th}>Current Phase</th>
                    <th style={styles.th}>Status</th>
                    <th style={styles.th}>Created</th>
                    <th style={{ ...styles.th, textAlign: "right" }}>Action</th>
                  </tr>
                </thead>

                <tbody>
                  {visibleProjects.map((project) => (
                    <tr key={project.id}>
                      <td style={styles.tdStrong}>{project.name}</td>
                      <td style={styles.td}>{project.organisations?.name || "Not linked"}</td>
                      <td style={{ ...styles.td, textAlign: "right" }}>{project.number_of_phases}</td>
                      <td style={{ ...styles.td, textAlign: "right" }}>
                        {project.client_income_total ? formatCurrency(project.client_income_total) : "-"}
                      </td>
                      <td style={styles.td}>
                        {project.current_supplier_phase
                          ? `Phase ${project.current_supplier_phase}`
                          : "Not set"}
                      </td>
                      <td style={styles.td}>
                        <span style={project.status === "Completed" ? styles.statusDone : styles.statusActive}>
                          {project.status}
                        </span>
                      </td>
                      <td style={styles.td}>{formatDate(project.created_at)}</td>
                      <td style={{ ...styles.td, textAlign: "right" }}>
                        <Link href={`/project-management/${project.id}`} style={styles.openLink}>
                          Open
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    padding: "18px",
    background: "#eef3f8",
    minHeight: "100vh",
    color: "#12304a",
  },
  heroPanel: {
    display: "grid",
    gridTemplateColumns: "1fr 1.5fr",
    gap: "24px",
    alignItems: "end",
    background: "#ffffff",
    border: "1px solid #d8e2ef",
    padding: "18px 22px",
    marginBottom: "14px",
  },
  kicker: {
    color: "#0b63ff",
    fontSize: "12px",
    fontWeight: 900,
    textTransform: "uppercase",
    letterSpacing: "0.12em",
    marginBottom: "6px",
  },
  title: {
    fontSize: "28px",
    fontWeight: 900,
    margin: 0,
    color: "#0f2742",
  },
  heroText: {
    margin: 0,
    color: "#56657a",
    fontSize: "14px",
    lineHeight: 1.5,
  },
  layoutGrid: {
    display: "grid",
    gridTemplateColumns: "320px 1fr",
    gap: "14px",
    alignItems: "start",
  },
  leftPanel: {
    background: "#ffffff",
    border: "1px solid #d8e2ef",
    padding: "16px",
  },
  rightPanel: {
    background: "#ffffff",
    border: "1px solid #d8e2ef",
    padding: "12px",
    minWidth: 0,
  },
  panelTitle: {
    fontSize: "18px",
    margin: "0 0 8px 0",
    color: "#0f2742",
    fontWeight: 900,
  },
  resultText: {
    margin: 0,
    color: "#64748b",
    fontSize: "13px",
    fontWeight: 700,
  },
  fieldGroup: {
    display: "grid",
    gap: "6px",
    marginBottom: "12px",
  },
  fieldGroupCompact: {
    display: "grid",
    gap: "5px",
  },
  label: {
    fontSize: "12px",
    fontWeight: 900,
    color: "#334155",
  },
  input: {
    height: "34px",
    border: "1px solid #cbd5e1",
    padding: "0 9px",
    fontSize: "13px",
    background: "#ffffff",
    color: "#12304a",
    outline: "none",
    borderRadius: 0,
  },
  infoBox: {
    display: "grid",
    gap: "4px",
    border: "1px solid #d8e2ef",
    background: "#f8fafc",
    padding: "10px",
    marginBottom: "12px",
    fontSize: "13px",
    color: "#12304a",
  },
  statGridSmall: {
    display: "grid",
    gridTemplateColumns: "repeat(3, 1fr)",
    gap: "8px",
    marginBottom: "12px",
  },
  statBoxSmall: {
    display: "grid",
    gap: "4px",
    border: "1px solid #d8e2ef",
    background: "#ffffff",
    padding: "10px",
    fontSize: "11px",
    color: "#64748b",
    textTransform: "uppercase",
    fontWeight: 900,
  },
  primaryButtonFull: {
    width: "100%",
    background: "#0b5cab",
    color: "#ffffff",
    border: "1px solid #0b5cab",
    padding: "10px 12px",
    fontSize: "13px",
    fontWeight: 900,
    cursor: "pointer",
    borderRadius: 0,
  },
  createBox: {
    borderTop: "2px solid #0f2742",
    marginTop: "14px",
    paddingTop: "14px",
  },
  createTitle: {
    margin: 0,
    fontSize: "16px",
    fontWeight: 900,
    color: "#0f2742",
  },
  createSubtitle: {
    margin: "4px 0 12px 0",
    fontSize: "12px",
    color: "#64748b",
    fontWeight: 700,
  },
  buttonRow: {
    display: "flex",
    justifyContent: "flex-end",
    gap: "8px",
    marginTop: "12px",
  },
  primaryButton: {
    background: "#0b5cab",
    color: "#ffffff",
    border: "1px solid #0b5cab",
    padding: "9px 12px",
    fontSize: "13px",
    fontWeight: 900,
    cursor: "pointer",
    borderRadius: 0,
  },
  secondaryButton: {
    background: "#eef3f8",
    color: "#12304a",
    border: "1px solid #cbd5e1",
    padding: "9px 12px",
    fontSize: "13px",
    fontWeight: 900,
    cursor: "pointer",
    borderRadius: 0,
  },
  tableHeaderRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "start",
    gap: "12px",
    marginBottom: "10px",
  },
  clearButton: {
    background: "#ffffff",
    color: "#12304a",
    border: "1px solid #cbd5e1",
    padding: "8px 12px",
    fontSize: "12px",
    fontWeight: 900,
    cursor: "pointer",
    borderRadius: 0,
  },
  filtersGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 150px 170px",
    gap: "8px",
    marginBottom: "12px",
  },
  tableWrap: {
    border: "1px solid #d8e2ef",
    overflowX: "auto",
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
    fontSize: "13px",
  },
  th: {
    background: "#eef3f8",
    color: "#334155",
    textAlign: "left",
    padding: "9px 8px",
    borderBottom: "1px solid #cbd5e1",
    fontSize: "12px",
    fontWeight: 900,
    whiteSpace: "nowrap",
  },
  td: {
    padding: "9px 8px",
    borderBottom: "1px solid #e5edf6",
    color: "#12304a",
    verticalAlign: "middle",
    whiteSpace: "nowrap",
  },
  tdStrong: {
    padding: "9px 8px",
    borderBottom: "1px solid #e5edf6",
    color: "#0f2742",
    fontWeight: 900,
    verticalAlign: "middle",
    whiteSpace: "nowrap",
  },
  statusActive: {
    display: "inline-block",
    padding: "3px 8px",
    background: "#eaf3ff",
    color: "#0b5cab",
    border: "1px solid #bfdbfe",
    fontSize: "12px",
    fontWeight: 900,
  },
  statusDone: {
    display: "inline-block",
    padding: "3px 8px",
    background: "#ecfdf3",
    color: "#027a48",
    border: "1px solid #bbf7d0",
    fontSize: "12px",
    fontWeight: 900,
  },
  openLink: {
    color: "#0b5cab",
    textDecoration: "none",
    fontWeight: 900,
  },
  emptyState: {
    padding: "28px",
    textAlign: "center",
    color: "#64748b",
    border: "1px dashed #cbd5e1",
    background: "#f8fafc",
    fontWeight: 700,
  },
};
