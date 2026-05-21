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
  status: "Active" | "Completed";
  created_at: string;
  organisation_id?: string | null;
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

export default function ProjectManagementPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [organisations, setOrganisations] = useState<Organisation[]>([]);
  const [profile, setProfile] = useState<UserProfile | null>(null);

  const [selectedOrganisationId, setSelectedOrganisationId] = useState("");
  const [showNewProject, setShowNewProject] = useState(false);
  const [projectName, setProjectName] = useState("");
  const [numberOfPhases, setNumberOfPhases] = useState("");

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

  const filteredProjects = useMemo(() => {
    if (!profile) return [];

    if (isInternalUser) {
      if (!selectedOrganisationId) return [];
      if (selectedOrganisationId === "all") return projects;

      return projects.filter((project) => project.organisation_id === selectedOrganisationId);
    }

    return projects.filter((project) => project.organisation_id === profile.organisation_id);
  }, [projects, selectedOrganisationId, profile, isInternalUser]);

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

  if (loading) {
    return (
      <main style={styles.page}>
        <div style={styles.emptyState}>Loading projects...</div>
      </main>
    );
  }

  return (
    <main style={styles.page}>
      <div style={styles.header}>
        <div>
          <h1 style={styles.title}>Project Management</h1>
          <p style={styles.subtitle}>
            Track project phases, billing percentages, invoices and payments.
          </p>
        </div>

        {canAddProject && (
          <button style={styles.primaryButton} onClick={openNewProjectForm}>
            + Add New Project
          </button>
        )}
      </div>

      <section style={styles.clientBar}>
        {isInternalUser ? (
          <>
            <div style={styles.fieldGroup}>
              <label style={styles.label}>Working Client</label>

              <select
                style={styles.clientSelect}
                value={selectedOrganisationId}
                onChange={(e) => {
                  setSelectedOrganisationId(e.target.value);
                  setShowNewProject(false);
                  setProjectName("");
                  setNumberOfPhases("");
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

            <div style={styles.clientContext}>
              {selectedOrganisationId === "all" ? (
                <>
                  <strong>All Clients</strong>
                  <span>Showing all projects</span>
                </>
              ) : selectedOrganisation ? (
                <>
                  <strong>{selectedOrganisation.name}</strong>
                  <span>
                    {selectedOrganisation.status} ·{" "}
                    {selectedOrganisation.access_enabled ? "Access Enabled" : "Access Blocked"}
                  </span>
                </>
              ) : (
                <>
                  <strong>Choose client</strong>
                  <span>No client selected</span>
                </>
              )}
            </div>
          </>
        ) : (
          <div style={styles.clientContext}>
            <strong>{selectedOrganisation?.name || "Client"}</strong>
            <span>Showing your projects only</span>
          </div>
        )}
      </section>

      {showNewProject && selectedOrganisation && (
        <section style={styles.card}>
          <h2 style={styles.cardTitle}>New Project for {selectedOrganisation.name}</h2>

          <div style={styles.formGrid}>
            <div style={styles.fieldGroup}>
              <label style={styles.label}>Project Name</label>
              <input
                style={styles.input}
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                placeholder="Example: House Smith"
              />
            </div>

            <div style={styles.fieldGroup}>
              <label style={styles.label}>Number of Phases</label>
              <input
                style={styles.input}
                type="number"
                min="1"
                value={numberOfPhases}
                onChange={(e) => setNumberOfPhases(e.target.value)}
                placeholder="Example: 5"
              />
            </div>
          </div>

          <div style={styles.actions}>
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
              {saving ? "Saving..." : "Save Project"}
            </button>
          </div>
        </section>
      )}

      <section style={styles.card}>
        <h2 style={styles.cardTitle}>
          {isInternalUser
            ? selectedOrganisationId === "all"
              ? "Active Projects"
              : selectedOrganisation
              ? `${selectedOrganisation.name} Projects`
              : "Active Projects"
            : `${selectedOrganisation?.name || "Client"} Projects`}
        </h2>

        {filteredProjects.length === 0 ? (
          <div style={styles.emptyState}>No projects created for this client yet.</div>
        ) : (
          <div style={styles.projectList}>
            {filteredProjects.map((project) => (
  <Link
    key={project.id}
    href={`/project-management/${project.id}`}
    style={styles.projectRow}
  >
    <div>
      <h3 style={styles.projectName}>{project.name}</h3>

      <p style={styles.projectMeta}>
        Client: {project.organisations?.name || "Not linked"}
      </p>

      <p style={styles.projectMeta}>
        {project.number_of_phases} phase
        {project.number_of_phases === 1 ? "" : "s"} · {project.status}
      </p>
    </div>
  </Link>
))}
          </div>
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
  clientBar: {
    display: "grid",
    gridTemplateColumns: "360px 1fr",
    gap: "20px",
    alignItems: "end",
    background: "#ffffff",
    borderRadius: "16px",
    padding: "20px",
    marginBottom: "20px",
    boxShadow: "0 8px 24px rgba(0,0,0,0.06)",
    border: "1px solid #e5eaf0",
  },
  clientSelect: {
    height: "44px",
    borderRadius: "10px",
    border: "1px solid #d5dde6",
    padding: "0 12px",
    fontSize: "15px",
    outline: "none",
    background: "#ffffff",
    color: "#12304a",
  },
  clientContext: {
    display: "flex",
    flexDirection: "column",
    gap: "6px",
    color: "#12304a",
    fontSize: "14px",
  },
  card: {
    background: "#ffffff",
    borderRadius: "16px",
    padding: "24px",
    marginBottom: "20px",
    boxShadow: "0 8px 24px rgba(0,0,0,0.06)",
    border: "1px solid #e5eaf0",
  },
  cardTitle: {
    fontSize: "20px",
    margin: "0 0 20px 0",
    color: "#12304a",
  },
  formGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 220px",
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
  actions: {
    display: "flex",
    justifyContent: "flex-end",
    gap: "12px",
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
  secondaryButton: {
    background: "#eef3f8",
    color: "#12304a",
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
  projectList: {
    display: "flex",
    flexDirection: "column",
    gap: "12px",
  },
  projectRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "18px",
    border: "1px solid #e5eaf0",
    borderRadius: "14px",
    background: "#fbfdff",
    textDecoration: "none",
    cursor: "pointer",
  },
  projectName: {
    margin: 0,
    fontSize: "18px",
    color: "#12304a",
  },
  projectMeta: {
    margin: "6px 0 0 0",
    fontSize: "14px",
    color: "#5b6775",
  },
  openButton: {
    background: "#eef3f8",
    color: "#12304a",
    borderRadius: "10px",
    padding: "10px 16px",
    fontSize: "14px",
    fontWeight: 600,
    textDecoration: "none",
  },
};