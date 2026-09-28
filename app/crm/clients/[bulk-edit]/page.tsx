"use client";

import Link from "next/link";
import {
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
} from "react";
import { supabase } from "@/app/lib/supabase";

type TeamMember = {
  id: string;
  full_name: string | null;
  email: string | null;
  access_enabled: boolean | null;
};

type ClientRow = {
  id: string;
  client_name: string;
  client_code: string | null;
  client_category: string | null;
  engagement_type: string | null;
  relationship_status: string | null;
  year_end: string | null;
  client_lead_user_id: string | null;
  manager_user_id: string | null;
  partner_user_id: string | null;
  group_ids: string[];
  group_names: string[];
};

type GroupRow = {
  id: string;
  group_name: string;
  group_code: string | null;
};

type SortMode =
  | "client_asc"
  | "client_desc"
  | "lead_asc"
  | "lead_desc";

const relationships = [
  ["flying_client", "Flying Client"],
  ["in_airspace", "In Airspace"],
  ["on_radar", "On Radar"],
  ["former_client", "Former Client"],
] as const;

const categories = [
  ["individual", "Individual"],
  ["entity", "Entity"],
  ["trust", "Trust"],
] as const;

const serviceRelationships = [
  ["", "—"],
  ["ongoing_monthly", "Ongoing monthly"],
  ["annual_monthly_retainer", "Annual – monthly retainer"],
  ["annual_ad_hoc", "Annual – ad hoc"],
] as const;

const months = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

function labelFromOptions(
  value: string | null | undefined,
  options: readonly (readonly [string, string])[],
  fallback = "—"
) {
  return (
    options.find(([key]) => key === String(value || ""))?.[1] ||
    (value ? String(value) : fallback)
  );
}

function relationshipLabel(value: string | null | undefined) {
  return labelFromOptions(value, relationships, "Flying Client");
}

function categoryLabel(value: string | null | undefined) {
  return labelFromOptions(value, categories, "Entity");
}

function serviceRelationshipLabel(value: string | null | undefined) {
  return labelFromOptions(value, serviceRelationships);
}

export default function BulkClientEditorPage() {
  const [clients, setClients] = useState<ClientRow[]>([]);
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [groups, setGroups] = useState<GroupRow[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [serviceFilter, setServiceFilter] = useState("all");
  const [relationshipFilter, setRelationshipFilter] = useState("all");
  const [clientLeadFilter, setClientLeadFilter] = useState("all");
  const [groupFilter, setGroupFilter] = useState("all");
  const [sortMode, setSortMode] = useState<SortMode>("client_asc");

  const [bulkField, setBulkField] = useState("");
  const [bulkValue, setBulkValue] = useState("");
  const [newGroupName, setNewGroupName] = useState("");

  async function authFetch(url: string, options?: RequestInit) {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.access_token) {
      throw new Error("Your login session could not be confirmed.");
    }

    const response = await fetch(url, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
        ...(options?.headers || {}),
      },
      cache: "no-store",
    });

    const result = await response.json();

    if (!response.ok || !result?.success) {
      throw new Error(result?.error || "Request failed.");
    }

    return result;
  }

  async function load() {
    setLoading(true);
    setError("");

    try {
      const result = await authFetch("/api/crm/clients/bulk-edit");

      setClients((result.clients || []) as ClientRow[]);
      setTeam((result.team || []) as TeamMember[]);
      setGroups((result.groups || []) as GroupRow[]);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Could not load the bulk client editor."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const teamMap = useMemo(
    () => new Map(team.map((member) => [member.id, member])),
    [team]
  );

  const activeTeam = useMemo(
    () => team.filter((member) => member.access_enabled !== false),
    [team]
  );

  const relationshipCounts = useMemo(() => {
    const counts = {
      flying_client: 0,
      in_airspace: 0,
      on_radar: 0,
      former_client: 0,
    };

    for (const client of clients) {
      const key = String(client.relationship_status || "flying_client");

      if (key in counts) {
        counts[key as keyof typeof counts] += 1;
      }
    }

    return counts;
  }, [clients]);

  const visibleClients = useMemo(() => {
    const term = search.trim().toLowerCase();

    const rows = clients.filter((client) => {
      const lead = client.client_lead_user_id
        ? teamMap.get(client.client_lead_user_id)
        : null;

      const manager = client.manager_user_id
        ? teamMap.get(client.manager_user_id)
        : null;

      const partner = client.partner_user_id
        ? teamMap.get(client.partner_user_id)
        : null;

      if (term) {
        const haystack = [
          client.client_name,
          client.client_code,
          lead?.full_name,
          lead?.email,
          manager?.full_name,
          partner?.full_name,
          ...client.group_names,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

        if (!haystack.includes(term)) return false;
      }

      if (
        categoryFilter !== "all" &&
        client.client_category !== categoryFilter
      ) {
        return false;
      }

      if (
        serviceFilter !== "all" &&
        String(client.engagement_type || "") !== serviceFilter
      ) {
        return false;
      }

      if (
        relationshipFilter !== "all" &&
        client.relationship_status !== relationshipFilter
      ) {
        return false;
      }

      if (clientLeadFilter === "unassigned" && client.client_lead_user_id) {
        return false;
      }

      if (
        clientLeadFilter !== "all" &&
        clientLeadFilter !== "unassigned" &&
        client.client_lead_user_id !== clientLeadFilter
      ) {
        return false;
      }

      if (groupFilter === "unassigned" && client.group_ids.length > 0) {
        return false;
      }

      if (
        groupFilter !== "all" &&
        groupFilter !== "unassigned" &&
        !client.group_ids.includes(groupFilter)
      ) {
        return false;
      }

      return true;
    });

    return [...rows].sort((a, b) => {
      const aLead =
        teamMap.get(a.client_lead_user_id || "")?.full_name ||
        teamMap.get(a.client_lead_user_id || "")?.email ||
        "ZZZZZZ";

      const bLead =
        teamMap.get(b.client_lead_user_id || "")?.full_name ||
        teamMap.get(b.client_lead_user_id || "")?.email ||
        "ZZZZZZ";

      if (sortMode === "client_desc") {
        return b.client_name.localeCompare(a.client_name);
      }

      if (sortMode === "lead_asc") {
        return (
          aLead.localeCompare(bLead) ||
          a.client_name.localeCompare(b.client_name)
        );
      }

      if (sortMode === "lead_desc") {
        return (
          bLead.localeCompare(aLead) ||
          a.client_name.localeCompare(b.client_name)
        );
      }

      return a.client_name.localeCompare(b.client_name);
    });
  }, [
    clients,
    search,
    categoryFilter,
    serviceFilter,
    relationshipFilter,
    clientLeadFilter,
    groupFilter,
    sortMode,
    teamMap,
  ]);

  const allVisibleSelected =
    visibleClients.length > 0 &&
    visibleClients.every((client) => selected.has(client.id));

  function toggleClient(clientId: string) {
    setSelected((current) => {
      const next = new Set(current);

      if (next.has(clientId)) next.delete(clientId);
      else next.add(clientId);

      return next;
    });
  }

  function toggleAllVisible() {
    setSelected((current) => {
      const next = new Set(current);

      if (allVisibleSelected) {
        for (const client of visibleClients) next.delete(client.id);
      } else {
        for (const client of visibleClients) next.add(client.id);
      }

      return next;
    });
  }

  async function save(
    clientIds: string[],
    field: string,
    value: string | null,
    groupName?: string
  ) {
    if (!clientIds.length || !field) return;

    setSaving(true);
    setError("");
    setNotice("");

    try {
      const result = await authFetch("/api/crm/clients/bulk-edit", {
        method: "PATCH",
        body: JSON.stringify({
          clientIds,
          field,
          value,
          groupName,
        }),
      });

      if (field === "group_add" || field === "group_remove") {
        const changedGroup = result.group as GroupRow | undefined;

        if (changedGroup && field === "group_add") {
          setGroups((current) =>
            current.some((group) => group.id === changedGroup.id)
              ? current
              : [...current, changedGroup].sort((a, b) =>
                  a.group_name.localeCompare(b.group_name)
                )
          );
        }

        if (changedGroup) {
          setClients((current) =>
            current.map((client) => {
              if (!clientIds.includes(client.id)) return client;

              if (field === "group_add") {
                if (client.group_ids.includes(changedGroup.id)) {
                  return client;
                }

                return {
                  ...client,
                  group_ids: [...client.group_ids, changedGroup.id],
                  group_names: [
                    ...client.group_names,
                    changedGroup.group_name,
                  ].sort((a, b) => a.localeCompare(b)),
                };
              }

              return {
                ...client,
                group_ids: client.group_ids.filter(
                  (groupId) => groupId !== changedGroup.id
                ),
                group_names: client.group_names.filter(
                  (name) => name !== changedGroup.group_name
                ),
              };
            })
          );
        }
      } else {
        setClients((current) =>
          current.map((client) =>
            clientIds.includes(client.id)
              ? {
                  ...client,
                  [field]: value,
                }
              : client
          )
        );
      }

      setNotice(
        `${clientIds.length} client${
          clientIds.length === 1 ? "" : "s"
        } updated.`
      );
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Could not save the bulk change."
      );
    } finally {
      setSaving(false);
    }
  }

  async function applyBulk() {
    if (!selected.size) {
      setError("Select at least one client.");
      return;
    }

    if (!bulkField) {
      setError("Choose a field to update.");
      return;
    }

    if (bulkField === "group_add" && bulkValue === "__new__") {
      if (!newGroupName.trim()) {
        setError("Enter the new group name.");
        return;
      }

      await save(
        Array.from(selected),
        "group_add",
        "__new__",
        newGroupName.trim()
      );

      setNewGroupName("");
      setBulkValue("");
      setSelected(new Set());
      return;
    }

    if (
      bulkValue === "" &&
      ![
        "client_lead_user_id",
        "manager_user_id",
        "partner_user_id",
      ].includes(bulkField)
    ) {
      setError("Choose the new value.");
      return;
    }

    await save(
      Array.from(selected),
      bulkField,
      bulkValue === "" ? null : bulkValue
    );

    setSelected(new Set());
  }

  function clearBulkValue() {
    setBulkValue("");
    setNewGroupName("");
  }

  function renderBulkValueControl() {
    if (!bulkField) {
      return (
        <select value="" disabled style={styles.select}>
          <option>Select a field first...</option>
        </select>
      );
    }

    if (bulkField === "group_add" || bulkField === "group_remove") {
      return (
        <div style={styles.valueControlRow}>
          <select
            value={bulkValue}
            onChange={(event) => {
              setBulkValue(event.target.value);

              if (event.target.value !== "__new__") {
                setNewGroupName("");
              }
            }}
            style={styles.select}
          >
            <option value="">
              {bulkField === "group_add"
                ? "Select a group..."
                : "Select group to remove..."}
            </option>

            {bulkField === "group_add" ? (
              <option value="__new__">+ Create new group</option>
            ) : null}

            {groups.map((group) => (
              <option key={group.id} value={group.id}>
                {group.group_name}
              </option>
            ))}
          </select>

          {bulkField === "group_add" && bulkValue === "__new__" ? (
            <input
              value={newGroupName}
              onChange={(event) => setNewGroupName(event.target.value)}
              placeholder="New group name"
              style={styles.newGroupInput}
            />
          ) : null}
        </div>
      );
    }

    if (
      ["client_lead_user_id", "manager_user_id", "partner_user_id"].includes(
        bulkField
      )
    ) {
      return (
        <select
          value={bulkValue}
          onChange={(event) => setBulkValue(event.target.value)}
          style={styles.select}
        >
          <option value="">Unassigned</option>

          {activeTeam.map((member) => (
            <option key={member.id} value={member.id}>
              {member.full_name || member.email || "Team member"}
            </option>
          ))}
        </select>
      );
    }

    if (bulkField === "year_end") {
      return (
        <select
          value={bulkValue}
          onChange={(event) => setBulkValue(event.target.value)}
          style={styles.select}
        >
          <option value="">Select year-end...</option>

          {months.map((month) => (
            <option key={month} value={month}>
              {month}
            </option>
          ))}
        </select>
      );
    }

    const options =
      bulkField === "relationship_status"
        ? relationships
        : bulkField === "client_category"
          ? categories
          : serviceRelationships;

    return (
      <select
        value={bulkValue}
        onChange={(event) => setBulkValue(event.target.value)}
        style={styles.select}
      >
        <option value="">Select a value...</option>

        {options.map(([value, label]) => (
          <option key={value || "blank"} value={value}>
            {label}
          </option>
        ))}
      </select>
    );
  }

  return (
    <main style={styles.page}>
      <section style={styles.header}>
        <div>
          <Link href="/crm/clients" style={styles.backLink}>
            ← Clients
          </Link>

          <h1 style={styles.title}>Bulk Client Editor</h1>

          <p style={styles.subtitle}>
            Update multiple clients at once. Select clients, choose a field and
            value, then apply the changes.
          </p>
        </div>

        <Link href="/crm/team-handover" style={styles.headerAction}>
          Staff Handover
        </Link>
      </section>

      <section style={styles.summaryGrid}>
        <button
          type="button"
          onClick={() => setRelationshipFilter("flying_client")}
          style={styles.summaryCard}
        >
          <span style={{ ...styles.summaryIcon, ...styles.summaryIconBlue }}>
            ✈
          </span>
          <span>
            <strong style={styles.summaryCount}>
              {relationshipCounts.flying_client}
            </strong>
            <span style={styles.summaryLabel}>Flying Clients</span>
          </span>
          <span style={styles.summaryArrow}>›</span>
        </button>

        <button
          type="button"
          onClick={() => setRelationshipFilter("in_airspace")}
          style={styles.summaryCard}
        >
          <span style={{ ...styles.summaryIcon, ...styles.summaryIconAmber }}>
            ●
          </span>
          <span>
            <strong style={styles.summaryCount}>
              {relationshipCounts.in_airspace}
            </strong>
            <span style={styles.summaryLabel}>In Airspace</span>
          </span>
          <span style={styles.summaryArrow}>›</span>
        </button>

        <button
          type="button"
          onClick={() => setRelationshipFilter("on_radar")}
          style={styles.summaryCard}
        >
          <span style={{ ...styles.summaryIcon, ...styles.summaryIconGreen }}>
            ◎
          </span>
          <span>
            <strong style={styles.summaryCount}>
              {relationshipCounts.on_radar}
            </strong>
            <span style={styles.summaryLabel}>On Radar</span>
          </span>
          <span style={styles.summaryArrow}>›</span>
        </button>

        <button
          type="button"
          onClick={() => setRelationshipFilter("former_client")}
          style={styles.summaryCard}
        >
          <span style={{ ...styles.summaryIcon, ...styles.summaryIconSlate }}>
            ◉
          </span>
          <span>
            <strong style={styles.summaryCount}>
              {relationshipCounts.former_client}
            </strong>
            <span style={styles.summaryLabel}>Former Clients</span>
          </span>
          <span style={styles.summaryArrow}>›</span>
        </button>
      </section>

      <section style={styles.bulkPanel}>
        <div style={styles.selectedBlock}>
          <strong style={styles.selectedNumber}>{selected.size}</strong>
          <span style={styles.selectedLabel}>clients selected</span>
        </div>

        <label style={styles.field}>
          <span style={styles.fieldLabel}>Update field</span>
          <select
            value={bulkField}
            onChange={(event) => {
              setBulkField(event.target.value);
              clearBulkValue();
            }}
            style={styles.select}
          >
            <option value="">Select a field to update...</option>
            <option value="relationship_status">PP Relationship</option>
            <option value="client_category">Record Type</option>
            <option value="engagement_type">Service Relationship</option>
            <option value="client_lead_user_id">Client Lead</option>
            <option value="manager_user_id">Manager</option>
            <option value="partner_user_id">Partner</option>
            <option value="group_add">Add to Group</option>
            <option value="group_remove">Remove from Group</option>
            <option value="year_end">Year-end</option>
          </select>
        </label>

        <label style={styles.field}>
          <span style={styles.fieldLabel}>New value</span>
          {renderBulkValueControl()}
        </label>

        <div style={styles.bulkActions}>
          <button
            type="button"
            onClick={() => void applyBulk()}
            disabled={saving || selected.size === 0}
            style={{
              ...styles.applyButton,
              opacity: saving || selected.size === 0 ? 0.55 : 1,
            }}
          >
            {saving ? "Applying..." : "Apply to Selected"}
          </button>

          <Link href="/crm/team-handover" style={styles.handoverButton}>
            Staff Handover
          </Link>
        </div>
      </section>

      <section style={styles.filterPanel}>
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search client, code or staff member..."
          style={styles.searchInput}
        />

        <select
          value={categoryFilter}
          onChange={(event) => setCategoryFilter(event.target.value)}
          style={styles.filterSelect}
        >
          <option value="all">All record types</option>

          {categories.map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>

        <select
          value={serviceFilter}
          onChange={(event) => setServiceFilter(event.target.value)}
          style={styles.filterSelect}
        >
          <option value="all">All service relationships</option>

          {serviceRelationships
            .filter(([value]) => value)
            .map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
        </select>

        <select
          value={relationshipFilter}
          onChange={(event) => setRelationshipFilter(event.target.value)}
          style={styles.filterSelect}
        >
          <option value="all">All PP relationships</option>

          {relationships.map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>

        <select
          value={clientLeadFilter}
          onChange={(event) => setClientLeadFilter(event.target.value)}
          style={styles.filterSelect}
        >
          <option value="all">All client leads</option>
          <option value="unassigned">Unassigned</option>

          {team.map((member) => (
            <option key={member.id} value={member.id}>
              {member.full_name || member.email || "Team member"}
              {member.access_enabled === false ? " · Former staff" : ""}
            </option>
          ))}
        </select>

        <select
          value={groupFilter}
          onChange={(event) => setGroupFilter(event.target.value)}
          style={styles.filterSelect}
        >
          <option value="all">All groups</option>
          <option value="unassigned">No group</option>

          {groups.map((group) => (
            <option key={group.id} value={group.id}>
              {group.group_name}
            </option>
          ))}
        </select>

        <label style={styles.sortBox}>
          <span style={styles.sortLabel}>Sort by</span>

          <select
            value={sortMode}
            onChange={(event) =>
              setSortMode(event.target.value as SortMode)
            }
            style={styles.filterSelect}
          >
            <option value="client_asc">Client name A–Z</option>
            <option value="client_desc">Client name Z–A</option>
            <option value="lead_asc">Client lead A–Z</option>
            <option value="lead_desc">Client lead Z–A</option>
          </select>
        </label>

        <strong style={styles.visibleCount}>
          {visibleClients.length} clients
        </strong>
      </section>

      {error ? <div style={styles.errorBar}>{error}</div> : null}
      {notice ? <div style={styles.noticeBar}>{notice}</div> : null}

      <section style={styles.tablePanel}>
        {loading ? (
          <div style={styles.loadingState}>Loading clients...</div>
        ) : (
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={{ ...styles.th, width: "2.5%" }}>
                  <input
                    type="checkbox"
                    checked={allVisibleSelected}
                    onChange={toggleAllVisible}
                  />
                </th>
                <th style={{ ...styles.th, width: "19%" }}>Client</th>
                <th style={{ ...styles.th, width: "7%" }}>Record Type</th>
                <th style={{ ...styles.th, width: "9%" }}>
                  Service Relationship
                </th>
                <th style={{ ...styles.th, width: "9%" }}>
                  PP Relationship
                </th>
                <th style={{ ...styles.th, width: "9%" }}>Client Lead</th>
                <th style={{ ...styles.th, width: "8%" }}>Manager</th>
                <th style={{ ...styles.th, width: "8%" }}>Partner</th>
                <th style={{ ...styles.th, width: "12%" }}>Group</th>
                <th style={{ ...styles.th, width: "7%" }}>Year-end</th>
                <th style={{ ...styles.th, width: "3.5%" }} />
              </tr>
            </thead>

            <tbody>
              {visibleClients.map((client) => {
                const lead = teamMap.get(
                  client.client_lead_user_id || ""
                );
                const manager = teamMap.get(
                  client.manager_user_id || ""
                );
                const partner = teamMap.get(
                  client.partner_user_id || ""
                );

                return (
                  <tr
                    key={client.id}
                    style={
                      selected.has(client.id)
                        ? styles.selectedRow
                        : undefined
                    }
                  >
                    <td style={styles.tdCheck}>
                      <input
                        type="checkbox"
                        checked={selected.has(client.id)}
                        onChange={() => toggleClient(client.id)}
                      />
                    </td>

                    <td style={styles.clientCell}>
                      <div style={styles.clientName}>
                        {client.client_name}
                      </div>

                      <div style={styles.clientMeta}>
                        {categoryLabel(client.client_category)}
                        {" · "}
                        {relationshipLabel(client.relationship_status)}
                        {client.client_code
                          ? ` · ${client.client_code}`
                          : ""}
                      </div>
                    </td>

                    <td style={styles.td}>
                      <span
                        style={{
                          ...styles.pill,
                          ...styles.recordPill,
                          ...(client.client_category === "trust"
                            ? styles.trustPill
                            : client.client_category === "individual"
                              ? styles.individualPill
                              : {}),
                        }}
                      >
                        {categoryLabel(client.client_category)}
                      </span>
                    </td>

                    <td style={styles.td}>
                      {serviceRelationshipLabel(
                        client.engagement_type
                      )}
                    </td>

                    <td style={styles.td}>
                      <span
                        style={{
                          ...styles.pill,
                          ...(client.relationship_status === "flying_client"
                            ? styles.flyingPill
                            : client.relationship_status === "in_airspace"
                              ? styles.airspacePill
                              : client.relationship_status === "on_radar"
                                ? styles.radarPill
                                : styles.formerPill),
                        }}
                      >
                        {relationshipLabel(
                          client.relationship_status
                        )}
                      </span>
                    </td>

                    <td style={styles.tdText}>
                      {lead?.full_name ||
                        lead?.email ||
                        "Unassigned"}
                    </td>

                    <td style={styles.tdText}>
                      {manager?.full_name ||
                        manager?.email ||
                        "Unassigned"}
                    </td>

                    <td style={styles.tdText}>
                      {partner?.full_name ||
                        partner?.email ||
                        "Unassigned"}
                    </td>

                    <td style={styles.groupCell}>
                      {client.group_names.length ? (
                        <div style={styles.groupPills}>
                          {client.group_names
                            .slice(0, 2)
                            .map((groupName, index) => (
                              <span
                                key={groupName}
                                style={{
                                  ...styles.pill,
                                  ...(index % 2 === 0
                                    ? styles.groupBluePill
                                    : styles.groupGreenPill),
                                }}
                                title={groupName}
                              >
                                {groupName}
                              </span>
                            ))}

                          {client.group_names.length > 2 ? (
                            <span style={styles.moreGroups}>
                              +{client.group_names.length - 2}
                            </span>
                          ) : null}
                        </div>
                      ) : (
                        <span style={styles.noGroup}>No group</span>
                      )}
                    </td>

                    <td style={styles.tdText}>
                      {client.year_end || "—"}
                    </td>

                    <td style={styles.moreCell}>
                      <Link
                        href={`/crm/client/${client.id}`}
                        style={styles.moreLink}
                        title="Open client"
                      >
                        •••
                      </Link>
                    </td>
                  </tr>
                );
              })}

              {!visibleClients.length ? (
                <tr>
                  <td colSpan={11} style={styles.emptyState}>
                    No clients match the current filters.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        )}
      </section>
    </main>
  );
}

const styles: Record<string, CSSProperties> = {
  page: {
    minHeight: "100vh",
    padding: "18px 20px 32px",
    background:
      "linear-gradient(180deg, #f7fbff 0px, #f4f7fb 220px, #f4f7fb 100%)",
    color: "#10233a",
  },

  header: {
    display: "flex",
    alignItems: "flex-end",
    justifyContent: "space-between",
    gap: "18px",
    marginBottom: "12px",
  },

  backLink: {
    display: "inline-block",
    marginBottom: "4px",
    color: "#1769e0",
    textDecoration: "none",
    fontSize: "10px",
    fontWeight: 900,
  },

  title: {
    margin: 0,
    fontSize: "20px",
    lineHeight: 1.1,
    fontWeight: 950,
  },

  subtitle: {
    margin: "5px 0 0",
    color: "#64748b",
    fontSize: "10px",
  },

  headerAction: {
    height: "32px",
    padding: "0 12px",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    border: "1px solid #c8d4e5",
    background: "#ffffff",
    color: "#174bc9",
    textDecoration: "none",
    fontSize: "9.5px",
    fontWeight: 900,
  },

  summaryGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
    gap: "8px",
    marginBottom: "10px",
  },

  summaryCard: {
    minHeight: "68px",
    padding: "9px 12px",
    display: "grid",
    gridTemplateColumns: "42px minmax(0, 1fr) 18px",
    gap: "10px",
    alignItems: "center",
    border: "1px solid #d8e2ee",
    background: "#ffffff",
    textAlign: "left",
    color: "#10233a",
    cursor: "pointer",
  },

  summaryIcon: {
    width: "40px",
    height: "40px",
    borderRadius: "50%",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "17px",
    fontWeight: 950,
  },

  summaryIconBlue: {
    background: "#e6efff",
    color: "#1957d2",
  },

  summaryIconAmber: {
    background: "#fff1df",
    color: "#d77700",
  },

  summaryIconGreen: {
    background: "#e6f7ea",
    color: "#2d8c43",
  },

  summaryIconSlate: {
    background: "#eef2f7",
    color: "#55657d",
  },

  summaryCount: {
    display: "block",
    fontSize: "17px",
    lineHeight: 1,
    fontWeight: 950,
  },

  summaryLabel: {
    display: "block",
    marginTop: "4px",
    color: "#183666",
    fontSize: "10px",
    fontWeight: 850,
  },

  summaryArrow: {
    color: "#1d3f88",
    fontSize: "22px",
    textAlign: "right",
  },

  bulkPanel: {
    display: "grid",
    gridTemplateColumns: "160px minmax(220px, 1fr) minmax(220px, 1fr) auto",
    gap: "10px",
    alignItems: "end",
    padding: "10px",
    marginBottom: "8px",
    border: "1px solid #d8e2ee",
    background: "#ffffff",
  },

  selectedBlock: {
    height: "56px",
    padding: "0 12px",
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
    border: "1px solid #e1e9f5",
    background: "#f5f8fe",
  },

  selectedNumber: {
    fontSize: "16px",
    lineHeight: 1,
    fontWeight: 950,
  },

  selectedLabel: {
    marginTop: "5px",
    color: "#36516f",
    fontSize: "9.5px",
    fontWeight: 850,
  },

  field: {
    minWidth: 0,
    display: "grid",
    gap: "4px",
  },

  fieldLabel: {
    color: "#183666",
    fontSize: "8.5px",
    fontWeight: 900,
  },

  select: {
    width: "100%",
    minWidth: 0,
    height: "32px",
    boxSizing: "border-box",
    padding: "0 8px",
    border: "1px solid #c8d4e5",
    background: "#ffffff",
    color: "#10233a",
    fontSize: "9.5px",
  },

  valueControlRow: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1fr) minmax(150px, .7fr)",
    gap: "6px",
  },

  newGroupInput: {
    width: "100%",
    minWidth: 0,
    height: "32px",
    boxSizing: "border-box",
    padding: "0 8px",
    border: "1px solid #c8d4e5",
    background: "#ffffff",
    color: "#10233a",
    fontSize: "9.5px",
  },

  bulkActions: {
    display: "flex",
    gap: "7px",
    alignItems: "center",
  },

  applyButton: {
    height: "32px",
    padding: "0 13px",
    border: "1px solid #1769e0",
    background: "#1769e0",
    color: "#ffffff",
    fontSize: "9.5px",
    fontWeight: 900,
    cursor: "pointer",
    whiteSpace: "nowrap",
  },

  handoverButton: {
    height: "32px",
    padding: "0 12px",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    border: "1px solid #c8d4e5",
    background: "#ffffff",
    color: "#174bc9",
    textDecoration: "none",
    fontSize: "9.5px",
    fontWeight: 900,
    whiteSpace: "nowrap",
  },

  filterPanel: {
    display: "grid",
    gridTemplateColumns:
      "minmax(220px, 1.4fr) .72fr .9fr .82fr .85fr .8fr 1fr auto",
    gap: "6px",
    alignItems: "center",
    padding: "8px",
    marginBottom: "8px",
    border: "1px solid #d8e2ee",
    background: "#ffffff",
  },

  searchInput: {
    width: "100%",
    minWidth: 0,
    height: "30px",
    boxSizing: "border-box",
    padding: "0 9px",
    border: "1px solid #c8d4e5",
    background: "#ffffff",
    color: "#10233a",
    fontSize: "9.5px",
  },

  filterSelect: {
    width: "100%",
    minWidth: 0,
    height: "30px",
    boxSizing: "border-box",
    padding: "0 6px",
    border: "1px solid #c8d4e5",
    background: "#ffffff",
    color: "#10233a",
    fontSize: "8.8px",
  },

  sortBox: {
    display: "grid",
    gridTemplateColumns: "42px minmax(0, 1fr)",
    gap: "5px",
    alignItems: "center",
  },

  sortLabel: {
    color: "#183666",
    fontSize: "8.5px",
    fontWeight: 900,
    textAlign: "right",
  },

  visibleCount: {
    color: "#52637b",
    fontSize: "9px",
    fontWeight: 900,
    whiteSpace: "nowrap",
    textAlign: "right",
  },

  errorBar: {
    padding: "8px 9px",
    marginBottom: "8px",
    border: "1px solid #fecaca",
    background: "#fff1f2",
    color: "#b42318",
    fontSize: "9px",
    fontWeight: 850,
  },

  noticeBar: {
    padding: "8px 9px",
    marginBottom: "8px",
    border: "1px solid #bbf7d0",
    background: "#ecfdf3",
    color: "#166534",
    fontSize: "9px",
    fontWeight: 850,
  },

  tablePanel: {
    width: "100%",
    overflow: "hidden",
    border: "1px solid #d8e2ee",
    background: "#ffffff",
  },

  loadingState: {
    padding: "18px",
    color: "#64748b",
    fontSize: "10px",
    fontWeight: 850,
  },

  table: {
    width: "100%",
    borderCollapse: "collapse",
    tableLayout: "fixed",
  },

  th: {
    padding: "7px 6px",
    borderBottom: "1px solid #d8e2ee",
    borderRight: "1px solid #e9eef4",
    background: "#f5f8fc",
    color: "#173158",
    textAlign: "left",
    fontSize: "8px",
    lineHeight: 1.15,
    fontWeight: 900,
    whiteSpace: "normal",
  },

  tdCheck: {
    padding: "5px 4px",
    borderBottom: "1px solid #e7edf4",
    textAlign: "center",
    verticalAlign: "middle",
  },

  td: {
    minWidth: 0,
    padding: "6px",
    borderBottom: "1px solid #e7edf4",
    borderRight: "1px solid #f0f3f7",
    color: "#10233a",
    fontSize: "8.8px",
    verticalAlign: "middle",
    overflow: "hidden",
  },

  tdText: {
    minWidth: 0,
    padding: "6px",
    borderBottom: "1px solid #e7edf4",
    borderRight: "1px solid #f0f3f7",
    color: "#10233a",
    fontSize: "8.8px",
    verticalAlign: "middle",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },

  clientCell: {
    padding: "6px",
    borderBottom: "1px solid #e7edf4",
    borderRight: "1px solid #f0f3f7",
    verticalAlign: "middle",
    overflow: "hidden",
  },

  clientName: {
    color: "#10284b",
    fontSize: "9.2px",
    lineHeight: 1.22,
    fontWeight: 900,
    whiteSpace: "normal",
    overflowWrap: "anywhere",
  },

  clientMeta: {
    marginTop: "2px",
    color: "#64748b",
    fontSize: "7.8px",
    lineHeight: 1.15,
    whiteSpace: "normal",
  },

  pill: {
    display: "inline-flex",
    maxWidth: "100%",
    minHeight: "20px",
    alignItems: "center",
    justifyContent: "center",
    padding: "0 7px",
    borderRadius: "999px",
    fontSize: "7.8px",
    lineHeight: 1,
    fontWeight: 900,
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },

  recordPill: {
    background: "#e8f0ff",
    color: "#1957d2",
  },

  trustPill: {
    background: "#ecebff",
    color: "#4b3fd2",
  },

  individualPill: {
    background: "#fff0d8",
    color: "#c87400",
  },

  flyingPill: {
    background: "#e8f0ff",
    color: "#1957d2",
  },

  airspacePill: {
    background: "#fff2df",
    color: "#d77700",
  },

  radarPill: {
    background: "#e8f6df",
    color: "#487f12",
  },

  formerPill: {
    background: "#eef2f7",
    color: "#55657d",
  },

  groupCell: {
    padding: "5px 6px",
    borderBottom: "1px solid #e7edf4",
    borderRight: "1px solid #f0f3f7",
    verticalAlign: "middle",
    overflow: "hidden",
  },

  groupPills: {
    minWidth: 0,
    display: "flex",
    alignItems: "center",
    gap: "3px",
    overflow: "hidden",
  },

  groupBluePill: {
    background: "#e8f0ff",
    color: "#1957d2",
  },

  groupGreenPill: {
    background: "#dcf4eb",
    color: "#1b7a5b",
  },

  moreGroups: {
    color: "#52637b",
    fontSize: "7.5px",
    fontWeight: 900,
    whiteSpace: "nowrap",
  },

  noGroup: {
    color: "#94a3b8",
    fontSize: "8px",
  },

  moreCell: {
    padding: "5px 3px",
    borderBottom: "1px solid #e7edf4",
    textAlign: "center",
  },

  moreLink: {
    color: "#40526f",
    textDecoration: "none",
    fontSize: "13px",
    lineHeight: 1,
    fontWeight: 950,
  },

  selectedRow: {
    background: "#f5f9ff",
  },

  emptyState: {
    padding: "18px 10px",
    color: "#64748b",
    textAlign: "center",
    fontSize: "9px",
  },
};
