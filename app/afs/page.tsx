"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
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

type AFSEngagement = {
  id: string;
  client_name: string;
  entity_type: string | null;
  financial_year_end: string;
  status: string;
  prepared_by: string | null;
  reviewed_by: string | null;
  notes: string | null;
  created_at: string;
  organisation_id?: string | null;
  firm_client_name?: string | null;
  afs_plan?: string | null;
  can_delete?: boolean;
  prepared_code?: string | null;
  reviewed_code?: string | null;
};

type Organisation = {
  id: string;
  name: string;
  status: string | null;
  access_enabled: boolean | null;
};

type NextFlightFileType =
  | "Annual Financial Statements"
  | "Management Accounts";

type EntityView =
  | "All"
  | "Companies"
  | "CCs"
  | "Trusts"
  | "NPCs"
  | "Other";

function getEntityView(entityType: string | null | undefined): EntityView {
  const value = String(entityType || "").trim().toLowerCase();

  if (value === "company") return "Companies";
  if (value === "close corporation" || value === "cc") return "CCs";
  if (value.includes("trust")) return "Trusts";
  if (
    value === "non-profit company" ||
    value === "non profit company" ||
    value === "npc"
  ) {
    return "NPCs";
  }

  return "Other";
}

type UserProfile = {
  id: string;
  user_id: string;
  full_name: string | null;
  email: string;
  role: string;
  organisation_id: string | null;
  access_enabled: boolean;
  can_access_afs?: boolean | null;
  afs_authority?: "Pilot" | "First Officer" | "Captain" | null;
  can_delete_afs_drafts?: boolean | null;
};

function isInternalRole(role: string) {
  return role === "Super Admin" || role === "Admin" || role === "Staff";
}

function formatDate(dateValue: string | null | undefined) {
  if (!dateValue) return "-";

  return new Date(dateValue).toLocaleDateString("en-ZA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

function normaliseStatus(status: string | null | undefined) {
  const value = String(status || "Draft").trim();
  if (!value) return "Draft";
  return value.charAt(0).toUpperCase() + value.slice(1).toLowerCase();
}

function calculateDefaultNextPeriodEnd(financialYearEnd: string) {
  const match = String(financialYearEnd || "").match(
    /^(\d{4})-(\d{2})-(\d{2})$/,
  );

  if (!match) return "";

  const year = Number(match[1]) + 1;
  const month = Number(match[2]);
  const day = Number(match[3]);
  const lastDayOfMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const safeDay = Math.min(day, lastDayOfMonth);

  return [
    String(year).padStart(4, "0"),
    String(month).padStart(2, "0"),
    String(safeDay).padStart(2, "0"),
  ].join("-");
}


function makeStaffCode(value: unknown) {
  const raw = String(value || "").trim();
  if (!raw) return "-";

  const words = raw
    .replace(/[()[\].,]/g, " ")
    .split(/\s+/)
    .map((word) => word.trim())
    .filter(Boolean);

  if (words.length === 0) return "-";

  const ignored = new Set([
    "mr",
    "mrs",
    "ms",
    "miss",
    "dr",
    "prof",
    "pty",
    "ltd",
    "sa",
  ]);

  const useful = words.filter(
    (word) => !ignored.has(word.toLowerCase()),
  );

  const source = useful.length > 0 ? useful : words;
  const initials = source
    .map((word) => word[0]?.toUpperCase() || "")
    .join("");

  if (initials.length >= 3) return initials.slice(0, 3);
  if (source.length === 1) return source[0].slice(0, 3).toUpperCase();

  return initials || "-";
}

function compactStatus(status: unknown) {
  const clean = normaliseStatus(status as string | null | undefined);

  if (clean === "Draft") return { code: "D", label: "Draft" };
  if (clean === "Ready for review") return { code: "R", label: "Ready for review" };
  if (clean === "Final") return { code: "F", label: "Final" };
  if (clean === "Archived") return { code: "A", label: "Archived" };
  if (clean === "Reopened") return { code: "O", label: "Reopened" };

  return {
    code: clean.slice(0, 1).toUpperCase() || "?",
    label: clean || "Unknown status",
  };
}

export default function AFSPage() {
  const router = useRouter();

  const [engagements, setEngagements] = useState<AFSEngagement[]>([]);
  const [organisations, setOrganisations] = useState<Organisation[]>([]);
  const [profile, setProfile] = useState<UserProfile | null>(null);

  const [selectedOrganisationId, setSelectedOrganisationId] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [archivingEngagementId, setArchivingEngagementId] = useState<string | null>(null);
  const [archiveCandidate, setArchiveCandidate] = useState<AFSEngagement | null>(null);
  const [archiveConfirmed, setArchiveConfirmed] = useState(false);

  const [rollingOverEngagementId, setRollingOverEngagementId] = useState<
    string | null
  >(null);

  const [rolloverMessage, setRolloverMessage] = useState("");
  const [nextFlightEngagement, setNextFlightEngagement] =
    useState<AFSEngagement | null>(null);
  const [nextFlightPeriodEnd, setNextFlightPeriodEnd] = useState("");
  const [nextFlightRefreshReason, setNextFlightRefreshReason] = useState("");

  const [nextFlightFileType, setNextFlightFileType] =
    useState<NextFlightFileType>("Annual Financial Statements");

  const [clientName, setClientName] = useState("");
  const [entityType, setEntityType] = useState("Company");
  const [financialYearEnd, setFinancialYearEnd] = useState("");
  const [preparedBy, setPreparedBy] = useState("");
  const [reviewedBy, setReviewedBy] = useState("");
  const [notes, setNotes] = useState("");

  const [searchText, setSearchText] = useState("");
  const [entityView, setEntityView] = useState<EntityView>("All");
  const [statusFilter, setStatusFilter] = useState("All");
  const [sortBy, setSortBy] = useState("Entity A-Z");
  const [deletingEngagementId, setDeletingEngagementId] = useState<string | null>(null);
  const [openActionMenuId, setOpenActionMenuId] = useState<string | null>(null);

  const internalUser = isInternalRole(profile?.role || "");

  const selectedOrganisation = useMemo(() => {
    return (
      organisations.find(
        (organisation) => organisation.id === selectedOrganisationId,
      ) || null
    );
  }, [organisations, selectedOrganisationId]);

  const existingNextFlightEngagement = useMemo(() => {
    if (!nextFlightEngagement || !nextFlightPeriodEnd) return null;

    return (
      engagements.find(
        (engagement) =>
          engagement.id !== nextFlightEngagement.id &&
          engagement.organisation_id ===
            nextFlightEngagement.organisation_id &&
          engagement.client_name === nextFlightEngagement.client_name &&
          engagement.financial_year_end === nextFlightPeriodEnd,
      ) || null
    );
  }, [engagements, nextFlightEngagement, nextFlightPeriodEnd]);

  const organisationScopedEngagements = useMemo(() => {
    let rows = [...engagements];

    return rows;
  }, [
    engagements,
    selectedOrganisationId,
    profile,
    internalUser,
  ]);

  const entityViewCounts = useMemo(() => {
    const counts: Record<EntityView, number> = {
      All: organisationScopedEngagements.length,
      Companies: 0,
      CCs: 0,
      Trusts: 0,
      NPCs: 0,
      Other: 0,
    };

    organisationScopedEngagements.forEach((engagement) => {
      counts[getEntityView(engagement.entity_type)] += 1;
    });

    return counts;
  }, [organisationScopedEngagements]);

  const visibleEngagements = useMemo(() => {
    let rows = [...organisationScopedEngagements];

    if (profile) {
      if (internalUser) {
        if (!selectedOrganisationId) rows = [];
        else if (selectedOrganisationId !== "all") {
          rows = rows.filter(
            (engagement) =>
              engagement.organisation_id === selectedOrganisationId,
          );
        }
      } else {
        rows = rows.filter(
          (engagement) =>
            engagement.organisation_id === profile.organisation_id,
        );
      }
    }

    if (entityView !== "All") {
      rows = rows.filter(
        (engagement) => getEntityView(engagement.entity_type) === entityView,
      );
    }

    const search = searchText.trim().toLowerCase();

    if (search) {
      rows = rows.filter((engagement) => {
        const firmClient = engagement.firm_client_name || "";

        return (
          engagement.client_name.toLowerCase().includes(search) ||
          String(engagement.entity_type || "")
            .toLowerCase()
            .includes(search) ||
          String(engagement.financial_year_end || "")
            .toLowerCase()
            .includes(search) ||
          firmClient.toLowerCase().includes(search)
        );
      });
    }

    if (statusFilter !== "All") {
      rows = rows.filter(
        (engagement) =>
          normaliseStatus(engagement.status) === statusFilter,
      );
    }

    rows.sort((a, b) => {
      if (sortBy === "Entity A-Z") {
        return a.client_name.localeCompare(b.client_name);
      }

      if (sortBy === "Entity Z-A") {
        return b.client_name.localeCompare(a.client_name);
      }

      if (sortBy === "Year end newest") {
        return (
          new Date(b.financial_year_end).getTime() -
          new Date(a.financial_year_end).getTime()
        );
      }

      if (sortBy === "Year end oldest") {
        return (
          new Date(a.financial_year_end).getTime() -
          new Date(b.financial_year_end).getTime()
        );
      }

      if (sortBy === "Newest created") {
        return (
          new Date(b.created_at).getTime() -
          new Date(a.created_at).getTime()
        );
      }

      if (sortBy === "Oldest created") {
        return (
          new Date(a.created_at).getTime() -
          new Date(b.created_at).getTime()
        );
      }

      return 0;
    });

    return rows;
  }, [
    organisationScopedEngagements,
    entityView,
    searchText,
    statusFilter,
    sortBy,
  ]);

  const userCanDeleteAfsDrafts =
    profile?.afs_authority === "Captain" ||
    Boolean(profile?.can_delete_afs_drafts);

  async function loadPage() {
    setLoading(true);

    try {
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

      if (!profileData.access_enabled || !profileData.can_access_afs) {
        alert("You do not have access to Annual Financial Statements.");
        window.location.href = "/dashboard";
        return;
      }

      setProfile(profileData);

      const internal = isInternalRole(profileData.role || "");

      const organisationsResponse = await fetch("/api/organisations", {
        cache: "no-store",
      });

      const organisationsData = await organisationsResponse.json();

      if (!organisationsResponse.ok) {
        throw new Error(
          organisationsData.error || "Could not load firms/clients.",
        );
      }

      const loadedOrganisations: Organisation[] =
        organisationsData.organisations || [];

      setOrganisations(loadedOrganisations);

      const engagementsResponse = await fetch("/api/afs/engagements", {
        cache: "no-store",
      });

      const engagementsData = await engagementsResponse.json();

      if (!engagementsResponse.ok) {
        throw new Error(
          engagementsData.error || "Could not load AFS engagements.",
        );
      }

      setEngagements(engagementsData.engagements || []);

      if (internal) {
        const bizzacc = loadedOrganisations.find((organisation) =>
          organisation.name.toLowerCase().includes("bizzacc menlyn"),
        );

        setSelectedOrganisationId(
          bizzacc?.id || loadedOrganisations[0]?.id || "",
        );
      } else {
        setSelectedOrganisationId(profileData.organisation_id || "");
      }
    } catch (error: any) {
      alert(error.message || "Failed to load AFS engagements.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadPage();
  }, []);

  async function createEngagement(
    e: React.FormEvent<HTMLFormElement>,
  ) {
    e.preventDefault();

    if (!selectedOrganisationId || selectedOrganisationId === "all") {
      alert("Please choose a specific firm/client first.");
      return;
    }

    if (!clientName.trim()) {
      alert("Client name is required.");
      return;
    }

    if (!financialYearEnd) {
      alert("Financial year end is required.");
      return;
    }

    setSaving(true);

    try {
      const firmClient =
        organisations.find(
          (organisation) =>
            organisation.id === selectedOrganisationId,
        ) || null;

      const res = await fetch("/api/afs/engagements", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          clientName,
          entityType,
          financialYearEnd,
          preparedBy,
          reviewedBy,
          notes,
          organisationId: selectedOrganisationId,
          firmClientName: firmClient?.name || null,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(
          data.error || "Failed to create AFS engagement.",
        );
      }

      setClientName("");
      setEntityType("Company");
      setFinancialYearEnd("");
      setPreparedBy("");
      setReviewedBy("");
      setNotes("");

      router.push(`/afs/${data.engagement.id}`);
    } catch (error: any) {
      alert(error.message || "Failed to create AFS engagement.");
    } finally {
      setSaving(false);
    }
  }

  function launchNextFlight(engagement: AFSEngagement) {
    setNextFlightEngagement(engagement);
    setNextFlightPeriodEnd(
      calculateDefaultNextPeriodEnd(engagement.financial_year_end),
    );
    setNextFlightFileType("Annual Financial Statements");
    setNextFlightRefreshReason("");
    setRolloverMessage("");
  }

  function closeNextFlightPanel() {
    if (rollingOverEngagementId) return;

    setNextFlightEngagement(null);
    setNextFlightPeriodEnd("");
    setNextFlightFileType("Annual Financial Statements");
    setNextFlightRefreshReason("");
    setRolloverMessage("");
  }

  async function createNextFlight() {
    if (!nextFlightEngagement) return;

    if (!nextFlightPeriodEnd) {
      alert("Please choose the target period end.");
      return;
    }

    if (
      existingNextFlightEngagement &&
      !nextFlightRefreshReason.trim()
    ) {
      alert(
        "Please enter a reason for refreshing the existing Next Flight.",
      );
      return;
    }

    setRollingOverEngagementId(nextFlightEngagement.id);

    setRolloverMessage(
      existingNextFlightEngagement
        ? "Refreshing existing file..."
        : "Creating file...",
    );

    try {
      const response = await fetch(
        `/api/afs/engagements/${nextFlightEngagement.id}/rollover`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            financialYearEnd: nextFlightPeriodEnd,
            fileType: nextFlightFileType,
            refreshReason: nextFlightRefreshReason.trim() || null,
          }),
        },
      );

      const responseText = await response.text();
      let data: any = {};

      if (responseText.trim()) {
        try {
          data = JSON.parse(responseText);
        } catch {
          throw new Error(
            `Next Flight returned an invalid server response (${response.status}).`,
          );
        }
      }

      if (!response.ok) {
        if (data.existingEngagementId) {
          setRolloverMessage(
            "A file already exists for this exact period end.",
          );

          const openExisting = confirm(
            `${data.error}\n\nOpen the existing engagement?`,
          );

          if (openExisting) {
            router.push(`/afs/${data.existingEngagementId}`);
          }

          return;
        }

        throw new Error(
          data.error ||
            responseText.trim() ||
            `Next Flight rollover failed (${response.status}).`,
        );
      }

      if (!data?.engagement?.id) {
        throw new Error(
          data?.error ||
            "Next Flight did not return the new engagement. Please try again.",
        );
      }

      setRolloverMessage(
        data.refreshed
          ? "Existing file refreshed successfully."
          : "File created successfully.",
      );

      setTimeout(() => {
        router.push(`/afs/${data.engagement.id}`);
      }, 850);
    } catch (error: any) {
      setRolloverMessage("");
      alert(error.message || "Next Flight rollover failed.");
    } finally {
      setRollingOverEngagementId(null);
    }
  }


  function requestArchiveEngagement(engagement: AFSEngagement) {
    if (normaliseStatus(engagement.status) !== "Final") {
      alert("Only final AFS engagements can be archived.");
      return;
    }

    setArchiveCandidate(engagement);
    setArchiveConfirmed(false);
  }

  function closeArchiveConfirmation() {
    if (archivingEngagementId) return;
    setArchiveCandidate(null);
    setArchiveConfirmed(false);
  }

  async function archiveEngagement() {
    if (!archiveCandidate || !archiveConfirmed) return;

    setArchivingEngagementId(archiveCandidate.id);

    try {
      const response = await fetch("/api/afs/engagements", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          engagementId: archiveCandidate.id,
          status: "Archived",
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Could not archive AFS engagement.");
      }

      setEngagements((current) =>
        current.map((item) =>
          item.id === archiveCandidate.id
            ? { ...item, status: "Archived" }
            : item,
        ),
      );

      setArchiveCandidate(null);
      setArchiveConfirmed(false);
    } catch (error: any) {
      alert(error.message || "Could not archive AFS engagement.");
    } finally {
      setArchivingEngagementId(null);
    }
  }

  async function deleteEngagement(engagement: AFSEngagement) {
    if (!engagement.can_delete) return;

    const confirmed = window.confirm(
      `Permanently delete the Draft AFS working file for ${engagement.client_name}?\n\n` +
        "This will delete the trial balance, journals, mappings, working papers and related AFS data. This cannot be undone.",
    );

    if (!confirmed) return;

    const finalConfirmed = window.confirm(
      "Delete permanently? There is no undo.",
    );

    if (!finalConfirmed) return;

    setDeletingEngagementId(engagement.id);

    try {
      const response = await fetch("/api/afs/engagements", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${
            (await supabase.auth.getSession()).data.session?.access_token || ""
          }`,
        },
        body: JSON.stringify({
          engagementId: engagement.id,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data?.error || "Could not permanently delete the AFS engagement.",
        );
      }

      setEngagements((current) =>
        current.filter((item) => item.id !== engagement.id),
      );
    } catch (error: any) {
      alert(
        error?.message || "Could not permanently delete the AFS engagement.",
      );
    } finally {
      setDeletingEngagementId(null);
    }
  }

  function clearFilters() {
    setSearchText("");
    setEntityView("All");
    setStatusFilter("All");
    setSortBy("Entity A-Z");
  }

  if (loading) {
    return (
      <main style={styles.page}>
        <div style={styles.emptyState}>
          Loading AFS engagements...
        </div>
      </main>
    );
  }

  return (
    <main style={styles.page}>
      <section style={styles.heroPanel}>
        <div>
          <div style={styles.kicker}>PracticePilot</div>
          <h1 style={styles.title}>Annual Financial Statements</h1>
        </div>

        <p style={styles.heroText}>
          Create and manage AFS engagements, trial balances, lead
          schedules, statements and final file packs.
        </p>
      </section>

      <div style={styles.layoutGrid}>
        <aside style={styles.leftPanel}>
          <h2 style={styles.panelTitle}>Firm control</h2>

          <div style={styles.fieldGroup}>
            <label style={styles.label}>Working firm / client</label>

            {internalUser ? (
              <select
                style={styles.input}
                value={selectedOrganisationId}
                onChange={(e) => {
                  setSelectedOrganisationId(e.target.value);
                  setSearchText("");
                  setEntityView("All");
                }}
              >
                <option value="">Choose firm/client</option>
                <option value="all">All firms / clients</option>

                {organisations.map((organisation) => (
                  <option
                    key={organisation.id}
                    value={organisation.id}
                  >
                    {organisation.name}
                    {organisation.access_enabled === false
                      ? " - Suspended"
                      : ""}
                  </option>
                ))}
              </select>
            ) : (
              <div style={styles.lockedClientBox}>
                {selectedOrganisation?.name ||
                  profile?.organisation_id ||
                  "Client"}
              </div>
            )}
          </div>

          <div style={styles.infoBox}>
            {selectedOrganisationId === "all" ? (
              <>
                <strong>All firms / clients</strong>
                <span>Showing all AFS engagements</span>
              </>
            ) : selectedOrganisation ? (
              <>
                <strong>{selectedOrganisation.name}</strong>
                <span>
                  {selectedOrganisation.status || "Active"} ·{" "}
                  {selectedOrganisation.access_enabled === false
                    ? "Access blocked"
                    : "Access enabled"}
                </span>
              </>
            ) : (
              <>
                <strong>Choose firm/client</strong>
                <span>No firm/client selected</span>
              </>
            )}
          </div>

          <form onSubmit={createEngagement} style={styles.createForm}>
            <h2 style={styles.panelTitle}>New AFS engagement</h2>

            <label style={styles.labelBlock}>
              Client name
              <input
                style={styles.input}
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                placeholder="Example: ABC Trading (Pty) Ltd"
              />
            </label>

            <label style={styles.labelBlock}>
              Entity type
              <select
                style={styles.input}
                value={entityType}
                onChange={(e) => setEntityType(e.target.value)}
              >
                <option value="Company">Company</option>
                <option value="Close Corporation">
                  Close Corporation
                </option>
                <option value="Trust">Trust</option>
                <option value="Sole Proprietor">
                  Sole Proprietor
                </option>
                <option value="Partnership">Partnership</option>
                <option value="Non-Profit Company">
                  Non-Profit Company
                </option>
              </select>
            </label>

            <label style={styles.labelBlock}>
              Financial year end
              <input
                style={styles.input}
                type="date"
                value={financialYearEnd}
                onChange={(e) =>
                  setFinancialYearEnd(e.target.value)
                }
              />
            </label>

            <label style={styles.labelBlock}>
              Prepared by
              <input
                style={styles.input}
                value={preparedBy}
                onChange={(e) => setPreparedBy(e.target.value)}
                placeholder="Optional"
              />
            </label>

            <label style={styles.labelBlock}>
              Reviewed by
              <input
                style={styles.input}
                value={reviewedBy}
                onChange={(e) => setReviewedBy(e.target.value)}
                placeholder="Optional"
              />
            </label>

            <label style={styles.labelBlock}>
              Notes
              <textarea
                style={{
                  ...styles.input,
                  height: 58,
                  paddingTop: 7,
                  resize: "vertical",
                }}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Optional internal notes"
              />
            </label>

            <button
              type="submit"
              style={styles.primaryButtonFull}
              disabled={saving}
            >
              {saving ? "Creating..." : "Create AFS engagement"}
            </button>
          </form>
        </aside>

        <section style={styles.rightPanel}>
          <div style={styles.tableHeaderRow}>
            <div>
              <h2 style={styles.panelTitle}>
                {selectedOrganisationId === "all"
                  ? "All AFS engagements"
                  : `${
                      selectedOrganisation?.name || "AFS"
                    } AFS engagements`}
              </h2>

              <p style={styles.resultText}>
                Showing {visibleEngagements.length} of{" "}
                {organisationScopedEngagements.length} engagement(s)
              </p>
            </div>

            <button
              style={styles.clearButton}
              onClick={clearFilters}
            >
              Clear filters
            </button>
          </div>

          <div style={styles.entityViewBar}>
            <div style={styles.entityViewLabel}>View</div>

            {(
              [
                "All",
                "Companies",
                "CCs",
                "Trusts",
                "NPCs",
                "Other",
              ] as EntityView[]
            ).map((view) => {
              const active = entityView === view;

              return (
                <button
                  key={view}
                  type="button"
                  style={{
                    ...styles.entityViewButton,
                    ...(active ? styles.entityViewButtonActive : {}),
                  }}
                  onClick={() => setEntityView(view)}
                >
                  {view}
                  <span
                    style={{
                      ...styles.entityViewCount,
                      ...(active ? styles.entityViewCountActive : {}),
                    }}
                  >
                    {entityViewCounts[view]}
                  </span>
                </button>
              );
            })}
          </div>

          <div style={styles.filtersGrid}>
            <div style={styles.fieldGroupCompact}>
              <label style={styles.label}>Entity / year end</label>

              <input
                style={styles.input}
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                placeholder="Search engagement..."
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
                <option value="Draft">Draft</option>
                <option value="Final">Final</option>
                <option value="Reopened">Reopened</option>
                <option value="Archived">Archived</option>
              </select>
            </div>

            <div style={styles.fieldGroupCompact}>
              <label style={styles.label}>Sort by</label>

              <select
                style={styles.input}
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
              >
                <option value="Entity A-Z">Entity A-Z</option>
                <option value="Entity Z-A">Entity Z-A</option>
                <option value="Year end newest">
                  Year end newest
                </option>
                <option value="Year end oldest">
                  Year end oldest
                </option>
                <option value="Newest created">
                  Newest created
                </option>
                <option value="Oldest created">
                  Oldest created
                </option>
              </select>
            </div>
          </div>

          {visibleEngagements.length === 0 ? (
            <div style={styles.emptyState}>
              No AFS engagements found for the current selection.
            </div>
          ) : (
            <>
              <div style={styles.statusLegend}>
            <span style={styles.statusLegendLabel}>Status:</span>

            {[
              ["D", "Draft"],
              ["R", "Ready for review"],
              ["F", "Final"],
              ["A", "Archived"],
              ["O", "Reopened"],
            ].map(([code, label]) => (
              <span key={code} style={styles.statusLegendItem}>
                <span style={styles.statusLegendCode}>{code}</span>
                <span>{label}</span>
              </span>
            ))}
          </div>

          <div style={styles.tableWrap}>
              <table style={styles.table}>
                <colgroup>
                  <col style={{ width: "30%" }} />
                  <col style={{ width: "11%" }} />
                  <col style={{ width: "9%" }} />
                  <col style={{ width: "18%" }} />
                  <col style={{ width: "5%" }} />
                  <col style={{ width: "4%" }} />
                  <col style={{ width: "5%" }} />
                  <col style={{ width: "8%" }} />
                  <col style={{ width: "5%" }} />
                  <col style={{ width: "5%" }} />
                </colgroup>
                <thead>
                  <tr>
                    <th style={styles.th}>Entity</th>
                    <th style={styles.th}>Type</th>
                    <th style={styles.th}>Year end</th>
                    <th style={styles.th}>Firm / client</th>
                    <th style={{ ...styles.th, textAlign: "center" }}>Prep</th>
                    <th style={{ ...styles.th, textAlign: "center" }}>Rev</th>
                    <th style={{ ...styles.th, textAlign: "center" }}>Status</th>
                    <th style={styles.th}>Next</th>
                    <th style={styles.th}>Open</th>
                    <th style={styles.th}>More</th>
                  </tr>
                </thead>

                <tbody>
                  {visibleEngagements.map((engagement) => (
                    <tr key={engagement.id}>
                      <td style={styles.tdStrong}>
                        {engagement.client_name}
                      </td>

                      <td style={{ ...styles.td, whiteSpace: "nowrap" }}>
                        {engagement.entity_type || "Entity"}
                      </td>

                      <td style={{ ...styles.td, whiteSpace: "nowrap" }}>
                        {formatDate(
                          engagement.financial_year_end,
                        )}
                      </td>

                      <td style={styles.td}>
                        {engagement.firm_client_name ||
                          "Not allocated"}
                      </td>

                      <td style={{ ...styles.td, textAlign: "center", whiteSpace: "nowrap" }}>
                        <span
                          style={styles.staffCode}
                          title={engagement.prepared_by || "Not assigned"}
                        >
                          {engagement.prepared_code ||
                            makeStaffCode(engagement.prepared_by)}
                        </span>
                      </td>

                      <td style={{ ...styles.td, textAlign: "center", whiteSpace: "nowrap" }}>
                        <span
                          style={styles.staffCode}
                          title={engagement.reviewed_by || "Not assigned"}
                        >
                          {engagement.reviewed_code ||
                            makeStaffCode(engagement.reviewed_by)}
                        </span>
                      </td>

                      <td
                        style={{
                          ...styles.td,
                          textAlign: "center",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {(() => {
                          const status = compactStatus(engagement.status);

                          return (
                            <span
                              style={styles.compactStatusBadge}
                              title={status.label}
                              aria-label={status.label}
                            >
                              {status.code}
                            </span>
                          );
                        })()}
                      </td>

                      <td style={{ ...styles.td, whiteSpace: "nowrap" }}>
                        {["Ready for review", "Final"].includes(
                          normaliseStatus(engagement.status),
                        ) ? (
                          <button
                            type="button"
                            style={styles.nextFlightInlineButton}
                            onClick={() => launchNextFlight(engagement)}
                          >
                            Next Flight
                          </button>
                        ) : null}
                      </td>

                      <td style={{ ...styles.td, whiteSpace: "nowrap" }}>
                        <button
                          type="button"
                          style={styles.openButton}
                          onClick={() =>
                            router.push(
                              `/afs/${engagement.id}`,
                            )
                          }
                        >
                          {normaliseStatus(engagement.status) === "Archived"
                            ? "View"
                            : "Open"}
                        </button>
                      </td>

                      <td style={{ ...styles.td, whiteSpace: "nowrap" }}>
                        {normaliseStatus(engagement.status) === "Final" ||
                        (engagement.can_delete && userCanDeleteAfsDrafts) ? (
                          <span style={styles.actionMenuWrap}>
                            <button
                              type="button"
                              style={styles.moreButton}
                              onClick={() =>
                                setOpenActionMenuId((current) =>
                                  current === engagement.id ? null : engagement.id,
                                )
                              }
                              aria-label={`More actions for ${engagement.client_name}`}
                              title="More actions"
                            >
                              More ▾
                            </button>

                            {openActionMenuId === engagement.id ? (
                              <span style={styles.actionMenu}>
                                {normaliseStatus(engagement.status) === "Final" ? (
                                  <button
                                    type="button"
                                    style={styles.menuActionButton}
                                    onClick={() => {
                                      setOpenActionMenuId(null);
                                      void requestArchiveEngagement(engagement);
                                    }}
                                    disabled={archivingEngagementId === engagement.id}
                                  >
                                    {archivingEngagementId === engagement.id
                                      ? "Archiving..."
                                      : "Archive"}
                                  </button>
                                ) : null}

                                {engagement.can_delete &&
                                userCanDeleteAfsDrafts ? (
                                  <button
                                    type="button"
                                    style={styles.menuDeleteButton}
                                    disabled={deletingEngagementId === engagement.id}
                                    onClick={() => {
                                      setOpenActionMenuId(null);
                                      void deleteEngagement(engagement);
                                    }}
                                  >
                                    {deletingEngagementId === engagement.id
                                      ? "Deleting..."
                                      : "Delete Draft"}
                                  </button>
                                ) : null}
                              </span>
                            ) : null}
                          </span>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            </>
          )}
        </section>
      </div>

      {archiveCandidate ? (
        <div style={styles.modalOverlay}>
          <section style={styles.archiveModal}>
            <div style={styles.archiveModalHeader}>
              <div>
                <div style={styles.archiveWarningKicker}>Permanent archive</div>
                <h2 style={styles.archiveModalTitle}>Archive AFS engagement?</h2>
              </div>

              <button
                type="button"
                style={styles.modalCloseButton}
                onClick={closeArchiveConfirmation}
                disabled={Boolean(archivingEngagementId)}
                aria-label="Close archive confirmation"
              >
                ×
              </button>
            </div>

            <div style={styles.archiveClientBox}>
              <strong>{archiveCandidate.client_name}</strong>
              <span>
                Year ended {formatDate(archiveCandidate.financial_year_end)}
              </span>
            </div>

            <div style={styles.archiveWarningBox}>
              <strong>This action is permanent.</strong>
              <span>
                Once archived, this AFS engagement will be read only and cannot
                be reopened or edited again. You will still be able to view and
                export the file.
              </span>
            </div>

            <label style={styles.archiveAgreementRow}>
              <input
                type="checkbox"
                checked={archiveConfirmed}
                onChange={(event) => setArchiveConfirmed(event.target.checked)}
                disabled={Boolean(archivingEngagementId)}
              />
              <span>
                I understand that this file will be permanently read only after
                archiving.
              </span>
            </label>

            <div style={styles.archiveModalActions}>
              <button
                type="button"
                style={styles.modalSecondaryButton}
                onClick={closeArchiveConfirmation}
                disabled={Boolean(archivingEngagementId)}
              >
                Cancel
              </button>

              <button
                type="button"
                style={{
                  ...styles.archiveConfirmButton,
                  ...(!archiveConfirmed ? styles.archiveConfirmButtonDisabled : {}),
                }}
                onClick={archiveEngagement}
                disabled={!archiveConfirmed || Boolean(archivingEngagementId)}
              >
                {archivingEngagementId ? "Archiving..." : "Archive permanently"}
              </button>
            </div>
          </section>
        </div>
      ) : null}

      {nextFlightEngagement ? (
        <div style={styles.modalOverlay}>
          <section style={styles.nextFlightModal}>
            <div style={styles.nextFlightModalHeader}>
              <div>
                <div style={styles.nextFlightKicker}>
                  PracticePilot
                </div>

                <h2 style={styles.nextFlightTitle}>
                  Prepare Next Flight
                </h2>

                <p style={styles.nextFlightSubtitle}>
                  Create the next working file for{" "}
                  <strong>
                    {nextFlightEngagement.client_name}
                  </strong>
                  .
                </p>
              </div>

              <button
                type="button"
                style={styles.modalCloseButton}
                onClick={closeNextFlightPanel}
                disabled={Boolean(rollingOverEngagementId)}
                aria-label="Close Next Flight panel"
              >
                ×
              </button>
            </div>

            <div style={styles.nextFlightDetails}>
              <div style={styles.nextFlightSourceBox}>
                <span>Source flight</span>
                <strong>
                  {formatDate(
                    nextFlightEngagement.financial_year_end,
                  )}
                </strong>
                <small>
                  {normaliseStatus(nextFlightEngagement.status)}
                </small>
              </div>

              <label style={styles.nextFlightLabel}>
                File type
                <select
                  style={styles.nextFlightInput}
                  value={nextFlightFileType}
                  onChange={(event) =>
                    setNextFlightFileType(
                      event.target
                        .value as NextFlightFileType,
                    )
                  }
                  disabled={Boolean(rollingOverEngagementId)}
                >
                  <option value="Annual Financial Statements">
                    Annual Financial Statements
                  </option>
                  <option value="Management Accounts">
                    Management Accounts
                  </option>
                </select>
              </label>

              <label style={styles.nextFlightLabel}>
                Target period end
                <input
                  style={styles.nextFlightInput}
                  type="date"
                  value={nextFlightPeriodEnd}
                  onChange={(event) => {
                    setNextFlightPeriodEnd(event.target.value);
                    setNextFlightRefreshReason("");
                    setRolloverMessage("");
                  }}
                  disabled={Boolean(rollingOverEngagementId)}
                />
              </label>
            </div>

            <div style={styles.nextFlightNotice}>
              PracticePilot will carry forward the client setup,
              people, mappings, note settings and prior-period
              balances. Current-period journals and adjustments start
              clean.
            </div>

            {existingNextFlightEngagement ? (
              <div style={styles.refreshWarningBox}>
                <strong>Existing Next Flight found</strong>

                <span>
                  A file already exists for the year ended{" "}
                  {formatDate(nextFlightPeriodEnd)}. Continuing will
                  refresh its opening balances, comparative history
                  and rolled Print Studio data. Current-year journals
                  and adjustments will remain intact.
                </span>

                <label style={styles.nextFlightLabel}>
                  Refresh reason
                  <textarea
                    style={styles.refreshReasonInput}
                    value={nextFlightRefreshReason}
                    onChange={(event) =>
                      setNextFlightRefreshReason(
                        event.target.value,
                      )
                    }
                    placeholder="Explain why this existing Next Flight must be refreshed"
                    disabled={Boolean(
                      rollingOverEngagementId,
                    )}
                  />
                </label>
              </div>
            ) : null}

            {rolloverMessage ? (
              <div
                style={{
                  ...styles.rolloverStatusBox,
                  ...(rolloverMessage.includes("successfully")
                    ? styles.rolloverStatusSuccess
                    : {}),
                }}
              >
                {rolloverMessage === "Creating file..." ||
                rolloverMessage ===
                  "Refreshing existing file..." ? (
                  <span style={styles.rolloverSpinner} />
                ) : null}

                <strong>{rolloverMessage}</strong>
              </div>
            ) : null}

            <div style={styles.nextFlightActions}>
              <button
                type="button"
                style={styles.modalSecondaryButton}
                onClick={closeNextFlightPanel}
                disabled={Boolean(rollingOverEngagementId)}
              >
                Cancel
              </button>

              <button
                type="button"
                style={styles.modalPrimaryButton}
                onClick={createNextFlight}
                disabled={
                  Boolean(rollingOverEngagementId) ||
                  !nextFlightPeriodEnd ||
                  Boolean(
                    existingNextFlightEngagement &&
                      !nextFlightRefreshReason.trim(),
                  )
                }
              >
                {rollingOverEngagementId
                  ? existingNextFlightEngagement
                    ? "Refreshing file..."
                    : "Creating file..."
                  : existingNextFlightEngagement
                    ? "Refresh Existing Flight"
                    : "Create Next Flight"}
              </button>
            </div>
          </section>
        </div>
      ) : null}
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
    padding: "14px 18px",
    marginBottom: "10px",
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
    fontSize: "24px",
    fontWeight: 900,
    margin: 0,
    color: "#0f2742",
  },

  heroText: {
    margin: 0,
    color: "#56657a",
    fontSize: "13px",
    lineHeight: 1.45,
  },

  layoutGrid: {
    display: "grid",
    gridTemplateColumns: "300px 1fr",
    gap: "10px",
    alignItems: "start",
  },

  leftPanel: {
    background: "#ffffff",
    border: "1px solid #d8e2ef",
    padding: "8px",
  },

  rightPanel: {
    background: "#ffffff",
    border: "1px solid #d8e2ef",
    padding: "8px",
    minWidth: 0,
  },

  panelTitle: {
    fontSize: "16px",
    margin: "0 0 7px 0",
    color: "#0f2742",
    fontWeight: 900,
  },

  resultText: {
    margin: 0,
    color: "#64748b",
    fontSize: "12px",
    fontWeight: 700,
  },

  fieldGroup: {
    display: "grid",
    gap: "5px",
    marginBottom: "8px",
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

  labelBlock: {
    display: "grid",
    gap: "5px",
    marginBottom: "8px",
    fontSize: "12px",
    fontWeight: 900,
    color: "#334155",
  },

  input: {
    width: "100%",
    height: "34px",
    border: "1px solid #cbd5e1",
    padding: "0 9px",
    fontSize: "13px",
    background: "#ffffff",
    color: "#12304a",
    outline: "none",
    borderRadius: 0,
    boxSizing: "border-box",
  },

  lockedClientBox: {
    minHeight: "34px",
    border: "1px solid #cbd5e1",
    padding: "8px 9px",
    fontSize: "13px",
    background: "#f8fafc",
    color: "#12304a",
    boxSizing: "border-box",
    fontWeight: 800,
  },

  infoBox: {
    display: "grid",
    gap: "4px",
    border: "1px solid #d8e2ef",
    background: "#f8fafc",
    padding: "8px",
    marginBottom: "10px",
    fontSize: "12px",
    color: "#12304a",
  },

  createForm: {
    borderTop: "2px solid #0f2742",
    paddingTop: "10px",
  },

  primaryButtonFull: {
    width: "100%",
    background: "#0b5cab",
    color: "#ffffff",
    border: "1px solid #0b5cab",
    padding: "9px 10px",
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
    marginBottom: "8px",
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

  entityViewBar: {
    display: "flex",
    alignItems: "stretch",
    gap: 0,
    marginBottom: "8px",
    border: "1px solid #cbd5e1",
    background: "#ffffff",
    width: "fit-content",
    maxWidth: "100%",
    overflowX: "auto",
  },

  entityViewLabel: {
    display: "flex",
    alignItems: "center",
    padding: "6px 9px",
    background: "#eef3f8",
    borderRight: "1px solid #cbd5e1",
    color: "#64748b",
    fontSize: "11px",
    fontWeight: 900,
    textTransform: "uppercase",
    letterSpacing: "0.06em",
    whiteSpace: "nowrap",
  },

  entityViewButton: {
    display: "flex",
    alignItems: "center",
    gap: "6px",
    border: 0,
    borderRight: "1px solid #d8e2ef",
    background: "#ffffff",
    color: "#334155",
    padding: "6px 10px",
    fontSize: "12px",
    fontWeight: 900,
    cursor: "pointer",
    whiteSpace: "nowrap",
    borderRadius: 0,
  },

  entityViewButtonActive: {
    background: "#0f2742",
    color: "#ffffff",
  },

  entityViewCount: {
    minWidth: "18px",
    padding: "1px 4px",
    border: "1px solid #cbd5e1",
    background: "#f8fafc",
    color: "#64748b",
    fontSize: "10px",
    fontWeight: 900,
    textAlign: "center",
    lineHeight: 1.2,
  },

  entityViewCountActive: {
    border: "1px solid rgba(255,255,255,0.45)",
    background: "rgba(255,255,255,0.12)",
    color: "#ffffff",
  },

  filtersGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 150px 170px",
    gap: "8px",
    marginBottom: "8px",
  },

  statusLegend: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
    flexWrap: "wrap",
    margin: "2px 0 7px",
    padding: "4px 0",
    color: "#64748b",
    fontSize: "9.5px",
    lineHeight: 1.2,
  },

  statusLegendLabel: {
    color: "#334155",
    fontWeight: 900,
  },

  statusLegendItem: {
    display: "inline-flex",
    alignItems: "center",
    gap: "4px",
    whiteSpace: "nowrap",
  },

  statusLegendCode: {
    display: "inline-flex",
    width: "18px",
    height: "18px",
    alignItems: "center",
    justifyContent: "center",
    border: "1px solid #cbd5e1",
    background: "#ffffff",
    color: "#0f2742",
    fontSize: "9px",
    fontWeight: 900,
    lineHeight: 1,
  },

  tableWrap: {
    border: "1px solid #d8e2ef",
    overflow: "visible",
    width: "100%",
  },

  table: {
    width: "100%",
    borderCollapse: "collapse",
    tableLayout: "fixed",
    fontSize: "12px",
  },

  th: {
    background: "#eef3f8",
    color: "#334155",
    textAlign: "left",
    padding: "7px 6px",
    borderBottom: "1px solid #cbd5e1",
    fontSize: "11px",
    fontWeight: 900,
    whiteSpace: "nowrap",
  },

  td: {
    padding: "6px 6px",
    borderBottom: "1px solid #e5edf6",
    color: "#12304a",
    verticalAlign: "middle",
    whiteSpace: "normal",
    overflowWrap: "anywhere",
    lineHeight: 1.25,
  },

  tdStrong: {
    padding: "6px 6px",
    borderBottom: "1px solid #e5edf6",
    color: "#0f2742",
    fontWeight: 900,
    verticalAlign: "middle",
    whiteSpace: "normal",
    overflowWrap: "anywhere",
    lineHeight: 1.25,
  },

  staffCode: {
    display: "inline-block",
    minWidth: "28px",
    color: "#0f2742",
    fontWeight: 900,
    letterSpacing: "0.04em",
    textAlign: "center",
  },

  nextFlightInlineButton: {
    border: "1px solid #0891b2",
    background: "#ffffff",
    color: "#0e7490",
    fontWeight: 900,
    cursor: "pointer",
    padding: "3px 7px",
    fontSize: "10px",
    lineHeight: 1.1,
    whiteSpace: "nowrap",
    borderRadius: 0,
  },

  compactStatusBadge: {
    display: "inline-flex",
    width: "22px",
    height: "22px",
    alignItems: "center",
    justifyContent: "center",
    border: "1px solid #cbd5e1",
    background: "#ffffff",
    color: "#0f2742",
    fontSize: "10px",
    fontWeight: 900,
    lineHeight: 1,
    borderRadius: 0,
    cursor: "help",
  },

  statusBadge: {
    display: "inline-block",
    padding: "3px 8px",
    background: "#eaf3ff",
    color: "#0b5cab",
    border: "1px solid #bfdbfe",
    fontSize: "12px",
    fontWeight: 900,
  },

  actionMenuWrap: {
    position: "relative",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "flex-end",
  },

  moreButton: {
    minWidth: "46px",
    height: "18px",
    border: 0,
    background: "transparent",
    color: "#64748b",
    padding: "0 2px",
    fontSize: "9px",
    fontWeight: 800,
    lineHeight: 1,
    cursor: "pointer",
    borderRadius: 0,
    whiteSpace: "nowrap",
  },

  actionMenu: {
    position: "absolute",
    zIndex: 20,
    top: "28px",
    right: 0,
    minWidth: "112px",
    border: "1px solid #94a3b8",
    background: "#ffffff",
    boxShadow: "0 4px 12px rgba(15, 23, 42, 0.12)",
    padding: "3px",
  },

  menuActionButton: {
    width: "100%",
    border: 0,
    background: "#ffffff",
    color: "#0f2742",
    padding: "7px 8px",
    textAlign: "left",
    fontSize: "10px",
    fontWeight: 850,
    cursor: "pointer",
    whiteSpace: "nowrap",
  },

  menuDeleteButton: {
    width: "100%",
    border: 0,
    background: "#ffffff",
    color: "#334155",
    padding: "7px 8px",
    textAlign: "left",
    fontSize: "10px",
    fontWeight: 850,
    cursor: "pointer",
    whiteSpace: "nowrap",
  },

  actionButtons: {
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
    alignItems: "flex-end",
    gap: "2px",
    whiteSpace: "nowrap",
  },

  nextFlightButton: {
    border: "1px solid #0891b2",
    background: "#ecfeff",
    color: "#0e7490",
    fontWeight: 900,
    cursor: "pointer",
    padding: "3px 8px",
    fontSize: "12px",
    lineHeight: 1.2,
  },

  archiveButton: {
    border: "1px solid #64748b",
    background: "#f8fafc",
    color: "#334155",
    fontWeight: 900,
    cursor: "pointer",
    padding: "3px 8px",
    fontSize: "12px",
    lineHeight: 1.2,
  },

  archiveModal: {
    width: "min(560px, 100%)",
    background: "#ffffff",
    border: "1px solid #b9c9dc",
    boxShadow: "0 24px 70px rgba(15, 39, 66, 0.28)",
    padding: "18px",
    display: "grid",
    gap: "16px",
  },

  archiveModalHeader: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: "16px",
    borderBottom: "1px solid #d8e2ef",
    paddingBottom: "12px",
  },

  archiveWarningKicker: {
    color: "#b45309",
    fontSize: "10px",
    fontWeight: 900,
    textTransform: "uppercase",
    letterSpacing: "0.13em",
    marginBottom: "5px",
  },

  archiveModalTitle: {
    margin: 0,
    color: "#0f2742",
    fontSize: "21px",
    fontWeight: 900,
  },

  archiveClientBox: {
    display: "grid",
    gap: "4px",
    border: "1px solid #d8e2ef",
    background: "#f8fafc",
    padding: "10px 12px",
    fontSize: "13px",
    color: "#12304a",
  },

  archiveWarningBox: {
    display: "grid",
    gap: "6px",
    border: "1px solid #f59e0b",
    background: "#fffbeb",
    color: "#78350f",
    padding: "12px",
    fontSize: "13px",
    lineHeight: 1.45,
  },

  archiveAgreementRow: {
    display: "flex",
    alignItems: "flex-start",
    gap: "9px",
    color: "#334155",
    fontSize: "13px",
    fontWeight: 800,
    lineHeight: 1.4,
    cursor: "pointer",
  },

  archiveModalActions: {
    display: "flex",
    justifyContent: "flex-end",
    alignItems: "center",
    gap: "10px",
    borderTop: "1px solid #d8e2ef",
    paddingTop: "12px",
  },

  archiveConfirmButton: {
    border: "1px solid #b45309",
    background: "#b45309",
    color: "#ffffff",
    padding: "8px 14px",
    fontSize: "12px",
    fontWeight: 900,
    cursor: "pointer",
  },

  archiveConfirmButtonDisabled: {
    opacity: 0.45,
    cursor: "not-allowed",
  },

  modalOverlay: {
    position: "fixed",
    inset: 0,
    zIndex: 9999,
    background: "rgba(15, 39, 66, 0.58)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "20px",
  },

  nextFlightModal: {
    width: "min(620px, 100%)",
    background: "#ffffff",
    border: "1px solid #b9c9dc",
    boxShadow: "0 24px 70px rgba(15, 39, 66, 0.28)",
    padding: "18px",
    display: "grid",
    gap: "16px",
  },

  nextFlightModalHeader: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: "16px",
    borderBottom: "1px solid #d8e2ef",
    paddingBottom: "12px",
  },

  nextFlightKicker: {
    color: "#0891b2",
    fontSize: "10px",
    fontWeight: 900,
    textTransform: "uppercase",
    letterSpacing: "0.13em",
    marginBottom: "5px",
  },

  nextFlightTitle: {
    margin: 0,
    color: "#0f2742",
    fontSize: "21px",
    fontWeight: 900,
  },

  nextFlightSubtitle: {
    margin: "5px 0 0",
    color: "#56657a",
    fontSize: "13px",
    lineHeight: 1.4,
  },

  modalCloseButton: {
    border: "1px solid #cbd5e1",
    background: "#ffffff",
    color: "#334155",
    width: "32px",
    height: "32px",
    fontSize: "20px",
    lineHeight: 1,
    cursor: "pointer",
  },

  nextFlightDetails: {
    display: "grid",
    gridTemplateColumns: "150px 1fr 1fr",
    gap: "10px",
    alignItems: "end",
  },

  nextFlightSourceBox: {
    minHeight: "62px",
    border: "1px solid #d8e2ef",
    background: "#f8fafc",
    padding: "8px",
    display: "grid",
    alignContent: "center",
    gap: "3px",
    fontSize: "11px",
    color: "#64748b",
  },

  nextFlightLabel: {
    display: "grid",
    gap: "6px",
    color: "#334155",
    fontSize: "12px",
    fontWeight: 900,
  },

  nextFlightInput: {
    width: "100%",
    height: "36px",
    border: "1px solid #cbd5e1",
    background: "#ffffff",
    color: "#12304a",
    padding: "0 9px",
    fontSize: "13px",
    boxSizing: "border-box",
    borderRadius: 0,
  },

  nextFlightNotice: {
    borderLeft: "3px solid #0891b2",
    background: "#ecfeff",
    color: "#155e75",
    padding: "10px 12px",
    fontSize: "12px",
    lineHeight: 1.45,
  },

  refreshWarningBox: {
    border: "1px solid #f59e0b",
    background: "#fffbeb",
    color: "#78350f",
    padding: "10px 12px",
    display: "grid",
    gap: "8px",
    fontSize: "12px",
    lineHeight: 1.45,
  },

  refreshReasonInput: {
    width: "100%",
    minHeight: "76px",
    border: "1px solid #d97706",
    background: "#ffffff",
    color: "#12304a",
    padding: "8px 9px",
    fontSize: "13px",
    fontFamily: "inherit",
    resize: "vertical",
    boxSizing: "border-box",
    borderRadius: 0,
  },

  rolloverStatusBox: {
    minHeight: "42px",
    border: "1px solid #bae6fd",
    background: "#f0f9ff",
    color: "#075985",
    padding: "10px 12px",
    display: "flex",
    alignItems: "center",
    gap: "9px",
    fontSize: "12px",
  },

  rolloverStatusSuccess: {
    border: "1px solid #a7f3d0",
    background: "#ecfdf5",
    color: "#166534",
  },

  rolloverSpinner: {
    width: "15px",
    height: "15px",
    border: "2px solid #bae6fd",
    borderTopColor: "#0891b2",
    borderRadius: "50%",
    display: "inline-block",
  },

  nextFlightActions: {
    display: "flex",
    justifyContent: "flex-end",
    alignItems: "center",
    gap: "10px",
    borderTop: "1px solid #d8e2ef",
    paddingTop: "12px",
  },

  modalSecondaryButton: {
    border: "1px solid #cbd5e1",
    background: "#ffffff",
    color: "#334155",
    padding: "8px 13px",
    fontSize: "12px",
    fontWeight: 900,
    cursor: "pointer",
  },

  modalPrimaryButton: {
    border: "1px solid #0891b2",
    background: "#0891b2",
    color: "#ffffff",
    padding: "8px 14px",
    fontSize: "12px",
    fontWeight: 900,
    cursor: "pointer",
  },

  openButton: {
    border: 0,
    background: "transparent",
    color: "#0b5cab",
    textDecoration: "none",
    fontWeight: 900,
    cursor: "pointer",
    padding: 0,
    fontSize: "13px",
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
